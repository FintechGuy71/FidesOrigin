"""
FidesOrigin Blockscout 服务(重构版)
策略模式:封装外部 API 调用,支持重试、限流、断路器
"""
import asyncio
from typing import Any, Dict, List, Optional
from urllib.parse import urljoin, urlparse

import httpx
from tenacity import retry, retry_if_exception, stop_after_attempt, wait_exponential

from app.config import get_settings
from app.core.exceptions import BlockscoutAPIException

# [P1-006 Fix] 断路器开路专用异常,避免 tenacity 无效重试
class CircuitBreakerOpenException(BlockscoutAPIException):
    """断路器已开路,无需重试"""
    def __init__(self, message: str = "Circuit breaker is open - too many consecutive failures"):
        super().__init__(message=message, status_code=503)

# 向后兼容别名:旧代码使用 BlockscoutAPIError
BlockscoutAPIError = BlockscoutAPIException
from app.core.logging import get_logger

# [LOW Fix #25] 不再使用 pickle 进行序列化/反序列化,改用 JSON
# pickle 反序列化存在任意代码执行风险
import json as _json_for_pickle_replacement

logger = get_logger(__name__)
settings = get_settings()

# [P2-7 Fix] SSRF 防护 — 允许的 Blockscout URL 白名单
_ALLOWED_BLOCKSCOUT_HOSTS = frozenset({
    "blockscout.com",
    "eth.blockscout.com",
    "sepolia.blockscout.com",
    "polygon.blockscout.com",
    "optimism.blockscout.com",
    "arbitrum.blockscout.com",
    "base.blockscout.com",
    "gnosis.blockscout.com",
    "celo.blockscout.com",
    "sokol.blockscout.com",
    "localhost",
    "127.0.0.1",
})


def _validate_blockscout_url(url: str) -> bool:
    """
    [P2-7 Fix] 验证 Blockscout URL 是否在白名单中
    
    防止 SSRF 攻击，确保只访问合法的 Blockscout 实例。
    """
    try:
        parsed = urlparse(url)
        if parsed.scheme not in ("http", "https"):
            logger.warning("blockscout_invalid_scheme", scheme=parsed.scheme, url=url)
            return False
        hostname = parsed.hostname
        if not hostname:
            return False
        # 检查 hostname 是否在白名单中（支持子域名匹配）
        hostname_lower = hostname.lower()
        if hostname_lower in _ALLOWED_BLOCKSCOUT_HOSTS:
            return True
        # 检查是否以白名单中的域名结尾（如 eth.blockscout.com）
        for allowed in _ALLOWED_BLOCKSCOUT_HOSTS:
            if hostname_lower == allowed or hostname_lower.endswith(f".{allowed}"):
                return True
        logger.warning("blockscout_url_not_in_allowlist", hostname=hostname, url=url)
        return False
    except Exception as e:
        logger.warning("blockscout_url_validation_error", error=str(e), url=url)
        return False


class BlockscoutService:
    """
    Blockscout API 服务

    设计模式:策略模式(封装不同数据源策略)
    特性:
    - 连接池管理(httpx.AsyncClient)
    - 信号量限流(并发控制)
    - 指数退避重试(tenacity)
    - 断路器模式(连续失败时快速失败)
    - [M-4 Fix] 断路器状态持久化到 Redis,支持多实例共享
    """

    CIRCUIT_KEY = "circuit:blockscout"
    CIRCUIT_TTL = 300  # 断路器状态在 Redis 中保留 5 分钟

    def __init__(self, cache=None):
        raw_url = settings.BLOCKSCOUT_BASE_URL.rstrip('/')
        # [P2-7 Fix] SSRF 防护：初始化时校验 base_url
        if raw_url and not _validate_blockscout_url(raw_url):
            raise BlockscoutAPIException(
                f"BLOCKSCOUT_BASE_URL '{raw_url}' is not in the allowed whitelist. "
                f"Allowed hosts: {', '.join(sorted(_ALLOWED_BLOCKSCOUT_HOSTS))}",
                status_code=400
            )
        self.base_url = raw_url
        self.api_key = settings.BLOCKSCOUT_API_KEY
        self.timeout = settings.BLOCKSCOUT_TIMEOUT
        self._semaphore = None
        self._client: Optional[httpx.AsyncClient] = None
        self._failure_count = 0
        self._circuit_open = False
        self._circuit_threshold = 5  # 连续失败阈值
        self._cache = cache  # [M-4 Fix] 可选的 CacheService 用于持久化断路器状态

    async def connect(self) -> None:
        """建立 HTTP 连接"""
        if self._client is None or self._client.is_closed:
            headers = {
                "Accept": "application/json",
                "User-Agent": f"FidesOrigin/{settings.APP_VERSION}"
            }
            if self.api_key:
                headers["Authorization"] = f"Bearer {self.api_key}"

            self._client = httpx.AsyncClient(
                headers=headers,
                timeout=httpx.Timeout(self.timeout),
                follow_redirects=True,
                limits=httpx.Limits(
                    max_connections=20,
                    max_keepalive_connections=10
                )
            )
            self._semaphore = asyncio.Semaphore(settings.BLOCKSCOUT_RATE_LIMIT)
            # [P0-001 Fix] 信号量已在 connect() 中同步初始化,避免竞态条件
            logger.info("blockscout_service_connected", base_url=self.base_url)

    async def close(self) -> None:
        """关闭 HTTP 连接"""
        if self._client and not self._client.is_closed:
            await self._client.aclose()
            self._client = None
            logger.info("blockscout_service_disconnected")

    # [M-4 Fix] 断路器状态持久化方法
    async def _load_circuit_state(self):
        """从 Redis 加载断路器状态"""
        if self._cache is None:
            return
        try:
            state = await self._cache.get_json(self.CIRCUIT_KEY)
            if state:
                self._failure_count = state.get("failure_count", self._failure_count)
                self._circuit_open = state.get("circuit_open", self._circuit_open)
                if self._circuit_open:
                    self._circuit_opened_at = asyncio.get_event_loop().time()
                    logger.info("blockscout_circuit_state_restored_from_redis",
                               failure_count=self._failure_count)
        except Exception as e:
            logger.warning("blockscout_circuit_load_failed", error=str(e))

    async def _save_circuit_state(self):
        """保存断路器状态到 Redis"""
        if self._cache is None:
            return
        try:
            await self._cache.set_json(
                self.CIRCUIT_KEY,
                {"failure_count": self._failure_count, "circuit_open": self._circuit_open},
                expire=self.CIRCUIT_TTL
            )
        except Exception as e:
            logger.warning("blockscout_circuit_save_failed", error=str(e))

    def _get_semaphore(self):
        """获取已初始化的信号量(P0-001 修复:信号量已在 connect() 中同步初始化)"""
        if self._semaphore is None:
            # 安全回退:如果 connect() 未被调用,延迟初始化(非竞态安全,但保证可用)
            self._semaphore = asyncio.Semaphore(settings.BLOCKSCOUT_RATE_LIMIT)
        return self._semaphore

    def _check_circuit(self):
        """检查断路器状态（[AUDIT FIX 2026-09-18 R3-H4] 半开探测：
        原实现断路器打开后永久拒绝直到进程重启。现超过冷却期（CIRCUIT_TTL）
        放行一次试探请求，成功则由 _record_success 关闭断路器）"""
        if self._circuit_open:
            opened_at = getattr(self, "_circuit_opened_at", None)
            if opened_at is None or (asyncio.get_event_loop().time() - opened_at) < self.CIRCUIT_TTL:
                raise CircuitBreakerOpenException()
            logger.info("blockscout_circuit_half_open_probe")

    async def _record_success(self):
        """记录成功,重置失败计数并持久化"""
        if self._failure_count > 0:
            self._failure_count = 0
            if self._circuit_open:
                self._circuit_open = False
                logger.info("blockscout_circuit_closed")
            # [P0-4 Fix] 使用 await 替代 asyncio.create_task() 避免同步上下文中调用竞态
            try:
                await self._save_circuit_state()
            except Exception as e:
                logger.warning("blockscout_circuit_save_failed", error=str(e))

    async def _record_failure(self):
        """记录失败,检查断路器并持久化"""
        self._failure_count += 1
        if self._failure_count >= self._circuit_threshold:
            self._circuit_open = True
            self._circuit_opened_at = asyncio.get_event_loop().time()
            logger.error(
                "blockscout_circuit_opened",
                failure_count=self._failure_count,
                threshold=self._circuit_threshold
            )
        # [P0-4 Fix] 使用 await 替代 asyncio.create_task() 避免同步上下文中调用竞态
        try:
            await self._save_circuit_state()
        except Exception as e:
            logger.warning("blockscout_circuit_save_failed", error=str(e))

    async def _request(
        self,
        method: str,
        endpoint: str,
        params: Optional[Dict[str, Any]] = None,
        json_data: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """发送 HTTP 请求（带限流和断路器）"""
        import asyncio
        
        self._check_circuit()
        
        if self._client is None:
            await self.connect()
        
        url = urljoin(f"{self.base_url}/", endpoint.lstrip('/'))
        
        # [P2-7 Fix] SSRF 二次校验：确保拼接后的 URL 仍在白名单中
        if not _validate_blockscout_url(url):
            logger.error("blockscout_url_blocked_by_ssrf_filter", url=url)
            raise BlockscoutAPIException(
                f"URL '{url}' is not in the allowed Blockscout whitelist",
                status_code=403
            )
        
        async with self._get_semaphore():
            try:
                response = await self._client.request(
                    method=method,
                    url=url,
                    params=params,
                    json=json_data
                )
                response.raise_for_status()
                await self._record_success()
                return response.json()
            except httpx.HTTPStatusError as e:
                await self._record_failure()
                logger.error(
                    "blockscout_http_error",
                    status_code=e.response.status_code,
                    response=e.response.text[:200],
                    url=url
                )
                raise BlockscoutAPIException(
                    f"HTTP {e.response.status_code}: {e.response.text[:200]}",
                    status_code=e.response.status_code
                )
            except httpx.RequestError as e:
                await self._record_failure()
                logger.error("blockscout_request_error", error=str(e), url=url)
                raise BlockscoutAPIException(f"Request failed: {str(e)}")
            except Exception as e:
                await self._record_failure()
                logger.error("blockscout_unexpected_error", error=str(e), url=url)
                raise BlockscoutAPIException(f"Unexpected error: {str(e)}")

    # ==================== 重试策略 ====================

    @staticmethod
    def _should_retry_blockscout(exc: Exception) -> bool:
        """[AUDIT FIX 2026-09-24 B8] 排除断路器开路异常与确定性 4xx。

        原谓词对一切 BlockscoutAPIException（含 404/400/422）都重试 3 次：
        确定性客户端错误不可能重试成功，白白消耗 3 次调用 + 指数退避
        （最坏 ~7s 额外延迟）。现仅对 5xx / 429 / 无状态码（网络错误包装）重试。
        """
        if isinstance(exc, CircuitBreakerOpenException):
            return False
        if not isinstance(exc, BlockscoutAPIException):
            return False
        status = getattr(exc, "status_code", None)
        if status is None:
            return True  # 无状态码（网络错误包装）→ 可重试
        return status >= 500 or status == 429

    # ==================== API 方法 ====================

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=10),
        retry=retry_if_exception(_should_retry_blockscout),
        reraise=True
    )
    async def get_address_info(self, address: str) -> Dict[str, Any]:
        """获取地址基本信息"""
        return await self._request("GET", f"/addresses/{address}")

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=10),
        retry=retry_if_exception(_should_retry_blockscout),
        reraise=True
    )
    async def get_address_transactions(
        self,
        address: str,
        limit: int = 50,
        page: int = 1
    ) -> Dict[str, Any]:
        """获取地址交易历史

        [AUDIT FIX 2026-09-24 B7] 实测当前 Blockscout v2（eth / eth-sepolia
        实例）对 ?limit= / ?page= 返回 422 "Unexpected field"——原参数组合
        恒 422 且被 tenacity 重试 3 次。分页现由调用方用响应中的
        next_page_params 游标实现；limit/page 保留在签名中仅为兼容旧调用方，
        不再发送给上游。
        """
        return await self._request("GET", f"/addresses/{address}/transactions")

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=10),
        retry=retry_if_exception(_should_retry_blockscout),
        reraise=True
    )
    async def get_transaction(self, tx_hash: str) -> Dict[str, Any]:
        """获取交易详情"""
        return await self._request("GET", f"/transactions/{tx_hash}")

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=10),
        retry=retry_if_exception(_should_retry_blockscout),
        reraise=True
    )
    async def get_address_token_transfers(
        self,
        address: str,
        limit: int = 50
    ) -> Dict[str, Any]:
        """获取地址代币转账记录（[AUDIT FIX 2026-09-24 B7] 同上：不发 limit）"""
        return await self._request("GET", f"/addresses/{address}/token-transfers")

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=10),
        retry=retry_if_exception(_should_retry_blockscout),
        reraise=True
    )
    async def get_address_internal_transactions(
        self,
        address: str,
        limit: int = 50
    ) -> Dict[str, Any]:
        """获取地址内部交易记录（[AUDIT FIX 2026-09-24 B7] 同上：不发 limit）"""
        return await self._request("GET", f"/addresses/{address}/internal-transactions")

    # ==================== 聚合查询 ====================

    async def get_address_stats(self, address: str) -> Dict[str, Any]:
        """获取地址统计信息

        [AUDIT FIX 2026-09-24 B7] 原 实现 按旧版 Blockscout schema 读键，实测
        当前 v2（eth / eth-sepolia 实例）已全部漂移，导致本方法要么读到恒定默认值：
          - balance        → 键现为 coin_balance（原键不存在，恒 "0"）
          - transaction_count / token_transfer_count → 移至 /addresses/{hash}/counters
          - first_transaction / last_transaction     → 地址响应已不含这两个键（恒 None）
          - creator_address → 键现为 creator_address_hash
        且原实现还附带一次 get_address_transactions(limit=1) 调用：结果从未被
        使用，且当前 API 对 ?limit= 返回 422（被 tenacity 重试 3 次）——
        每次 age 检查都白白烧掉 3 次请求并制造告警噪音。
        修复：适配当前 schema（coin_balance + counters 端点），first_transaction
        用可靠启发式推导——仅当全部交易都在第一页时取页内最旧时间戳，否则
        置 None（诚实表达"未知"，由调用方按无数据处理）。
        """
        try:
            info = await self.get_address_info(address)

            # 交易计数：当前 schema 在 /addresses/{hash}/counters（值为字符串）
            transaction_count: Any = 0
            token_transfer_count: Any = 0
            try:
                counters = await self._request("GET", f"/addresses/{address}/counters")
                transaction_count = int(counters.get("transactions_count") or 0)
                token_transfer_count = int(counters.get("token_transfers_count") or 0)
            except BlockscoutAPIException as e:
                # 旧版实例无 counters 端点 → 回退旧键（旧 schema 下存在于地址响应中）
                logger.debug("blockscout_counters_unavailable", address=address, error=str(e))
                transaction_count = info.get("transaction_count", 0)
                token_transfer_count = info.get("token_transfer_count", 0)

            # first_transaction：优先旧版键（存在即用）；当前 schema 缺失时
            # 用 tx-list 启发式：全部交易在第一页（counters 数 <= 页内条数）
            # 才能确认页内最旧时间戳为真实首笔，否则 None（未知）。
            first_tx = info.get("first_transaction")
            last_tx = info.get("last_transaction")
            if first_tx is None:
                try:
                    tx_list = await self._request("GET", f"/addresses/{address}/transactions")
                    items = tx_list.get("items") or []
                    total = int(transaction_count) if isinstance(transaction_count, int) else 0
                    if items and (total <= len(items)):
                        # 页内最旧一条即真实首笔（items 按新到旧排序）
                        oldest_ts = items[-1].get("timestamp")
                        if oldest_ts:
                            first_tx = oldest_ts
                    if items and last_tx is None:
                        newest_ts = items[0].get("timestamp")
                        if newest_ts:
                            last_tx = newest_ts
                except BlockscoutAPIException as e:
                    logger.debug("blockscout_tx_list_unavailable", address=address, error=str(e))

            return {
                "address": address,
                "balance": info.get("coin_balance", info.get("balance", "0")),
                "transaction_count": transaction_count,
                "token_transfer_count": token_transfer_count,
                "first_transaction": first_tx,
                "last_transaction": last_tx,
                "is_contract": info.get("is_contract", False),
                "contract_creator": info.get("creator_address_hash", info.get("creator_address")),
            }
        except BlockscoutAPIException:
            raise
        except Exception as e:
            logger.error("blockscout_stats_error", error=str(e), address=address)
            raise BlockscoutAPIException(f"Failed to get stats: {str(e)}")

    # ==================== 批量操作 ====================

    async def batch_get_transactions(
        self,
        tx_hashes: List[str],
        max_concurrent: int = 5
    ) -> List[Optional[Dict[str, Any]]]:
        """批量获取交易详情

        [AUDIT FIX 2026-09-24 B10] 原实现 gather(return_exceptions=True) 后
        `[r for r in results if isinstance(r, dict)]`：
        1. 返回列表与入参 tx_hashes 不对齐——调用方无法得知哪些哈希失败；
        2. fetch_with_limit 未覆盖的意外异常（非 BlockscoutAPIException）
           被 return_exceptions 捕获后静默丢弃，无任何日志。
        修复：按输入顺序对齐返回（失败位为 None），意外异常记日志。
        """
        import asyncio

        semaphore = asyncio.Semaphore(max_concurrent)

        async def fetch_with_limit(tx_hash: str) -> Optional[Dict[str, Any]]:
            async with semaphore:
                try:
                    return await self.get_transaction(tx_hash)
                except BlockscoutAPIException as e:
                    logger.warning(
                        "blockscout_batch_tx_failed",
                        tx_hash=tx_hash,
                        error=str(e)
                    )
                    return None
                except Exception as e:
                    # 意外异常不可静默——记录后按失败处理
                    logger.error(
                        "blockscout_batch_tx_unexpected_error",
                        tx_hash=tx_hash,
                        error=str(e)
                    )
                    return None

        tasks = [fetch_with_limit(tx_hash) for tx_hash in tx_hashes]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        aligned: List[Optional[Dict[str, Any]]] = []
        for tx_hash, r in zip(tx_hashes, results):
            if isinstance(r, BaseException):
                # gather 层面捕获到的异常（理论上 fetch_with_limit 已全覆盖，
                # 防御性兜底）：记日志并对齐为 None
                logger.error(
                    "blockscout_batch_task_crashed",
                    tx_hash=tx_hash,
                    error=str(r)
                )
                aligned.append(None)
            else:
                aligned.append(r)
        return aligned


# ==================== 向后兼容:全局单例管理 ====================

_blockscout_service_instance: Optional[BlockscoutService] = None


def get_blockscout_client() -> BlockscoutService:
    """获取 Blockscout 服务单例(向后兼容旧代码)"""
    global _blockscout_service_instance
    if _blockscout_service_instance is None:
        _blockscout_service_instance = BlockscoutService()
    return _blockscout_service_instance


async def init_blockscout() -> None:
    """初始化 Blockscout 服务"""
    global _blockscout_service_instance
    _blockscout_service_instance = BlockscoutService()
    await _blockscout_service_instance.connect()
    logger.info("blockscout_service_initialized")


async def close_blockscout() -> None:
    """关闭 Blockscout 服务"""
    global _blockscout_service_instance
    if _blockscout_service_instance:
        await _blockscout_service_instance.close()
        _blockscout_service_instance = None
        logger.info("blockscout_service_closed")
