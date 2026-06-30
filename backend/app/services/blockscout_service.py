"""
FidesOrigin Blockscout 服务（重构版）
策略模式：封装外部 API 调用，支持重试、限流、断路器
"""
from typing import Any, Dict, List, Optional
from urllib.parse import urljoin

import httpx
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

from app.config import get_settings
from app.core.exceptions import BlockscoutAPIException

# 向后兼容别名：旧代码使用 BlockscoutAPIError
BlockscoutAPIError = BlockscoutAPIException
from app.core.logging import get_logger

# [LOW Fix #25] 不再使用 pickle 进行序列化/反序列化，改用 JSON
# pickle 反序列化存在任意代码执行风险
import json as _json_for_pickle_replacement

logger = get_logger(__name__)
settings = get_settings()


class BlockscoutService:
    """
    Blockscout API 服务
    
    设计模式：策略模式（封装不同数据源策略）
    特性：
    - 连接池管理（httpx.AsyncClient）
    - 信号量限流（并发控制）
    - 指数退避重试（tenacity）
    - 断路器模式（连续失败时快速失败）
    """
    
    def __init__(self):
        self.base_url = settings.BLOCKSCOUT_BASE_URL.rstrip('/')
        self.api_key = settings.BLOCKSCOUT_API_KEY
        self.timeout = settings.BLOCKSCOUT_TIMEOUT
        self._semaphore = None
        self._client: Optional[httpx.AsyncClient] = None
        self._failure_count = 0
        self._circuit_open = False
        self._circuit_threshold = 5  # 连续失败阈值
    
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
            self._semaphore = None  # 延迟初始化
            logger.info("blockscout_service_connected", base_url=self.base_url)
    
    async def close(self) -> None:
        """关闭 HTTP 连接"""
        if self._client and not self._client.is_closed:
            await self._client.aclose()
            self._client = None
            logger.info("blockscout_service_disconnected")
    
    def _get_semaphore(self):
        """延迟初始化信号量"""
        if self._semaphore is None:
            self._semaphore = asyncio.Semaphore(settings.BLOCKSCOUT_RATE_LIMIT)
        return self._semaphore
    
    def _check_circuit(self):
        """检查断路器状态"""
        if self._circuit_open:
            raise BlockscoutAPIException(
                "Circuit breaker is open - too many consecutive failures",
                status_code=503
            )
    
    def _record_success(self):
        """记录成功，重置失败计数"""
        if self._failure_count > 0:
            self._failure_count = 0
            if self._circuit_open:
                self._circuit_open = False
                logger.info("blockscout_circuit_closed")
    
    def _record_failure(self):
        """记录失败，检查断路器"""
        self._failure_count += 1
        if self._failure_count >= self._circuit_threshold:
            self._circuit_open = True
            logger.error(
                "blockscout_circuit_opened",
                failure_count=self._failure_count,
                threshold=self._circuit_threshold
            )
    
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
        
        async with self._get_semaphore():
            try:
                response = await self._client.request(
                    method=method,
                    url=url,
                    params=params,
                    json=json_data
                )
                response.raise_for_status()
                self._record_success()
                return response.json()
            except httpx.HTTPStatusError as e:
                self._record_failure()
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
                self._record_failure()
                logger.error("blockscout_request_error", error=str(e), url=url)
                raise BlockscoutAPIException(f"Request failed: {str(e)}")
            except Exception as e:
                self._record_failure()
                logger.error("blockscout_unexpected_error", error=str(e), url=url)
                raise BlockscoutAPIException(f"Unexpected error: {str(e)}")
    
    # ==================== 地址相关 API ====================
    
    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=10),
        retry=retry_if_exception_type(BlockscoutAPIException),
        reraise=True
    )
    async def get_address_info(self, address: str) -> Dict[str, Any]:
        """获取地址基本信息"""
        return await self._request("GET", f"/addresses/{address}")
    
    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=10),
        retry=retry_if_exception_type(BlockscoutAPIException),
        reraise=True
    )
    async def get_address_transactions(
        self,
        address: str,
        limit: int = 50,
        page: int = 1
    ) -> Dict[str, Any]:
        """获取地址交易历史"""
        return await self._request(
            "GET",
            f"/addresses/{address}/transactions",
            params={"limit": limit, "page": page}
        )
    
    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=10),
        retry=retry_if_exception_type(BlockscoutAPIException),
        reraise=True
    )
    async def get_transaction(self, tx_hash: str) -> Dict[str, Any]:
        """获取交易详情"""
        return await self._request("GET", f"/transactions/{tx_hash}")
    
    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=10),
        retry=retry_if_exception_type(BlockscoutAPIException),
        reraise=True
    )
    async def get_address_token_transfers(
        self,
        address: str,
        limit: int = 50
    ) -> Dict[str, Any]:
        """获取地址代币转账记录"""
        return await self._request(
            "GET",
            f"/addresses/{address}/token-transfers",
            params={"limit": limit}
        )
    
    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=10),
        retry=retry_if_exception_type(BlockscoutAPIException),
        reraise=True
    )
    async def get_address_internal_transactions(
        self,
        address: str,
        limit: int = 50
    ) -> Dict[str, Any]:
        """获取地址内部交易记录"""
        return await self._request(
            "GET",
            f"/addresses/{address}/internal-transactions",
            params={"limit": limit}
        )
    
    # ==================== 聚合查询 ====================
    
    async def get_address_stats(self, address: str) -> Dict[str, Any]:
        """获取地址统计信息"""
        try:
            info = await self.get_address_info(address)
            transactions = await self.get_address_transactions(address, limit=1)
            
            return {
                "address": address,
                "balance": info.get("balance", "0"),
                "transaction_count": info.get("transaction_count", 0),
                "token_transfer_count": info.get("token_transfer_count", 0),
                "first_transaction": info.get("first_transaction"),
                "last_transaction": info.get("last_transaction"),
                "is_contract": info.get("is_contract", False),
                "contract_creator": info.get("creator_address"),
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
        """批量获取交易详情"""
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
        
        tasks = [fetch_with_limit(tx_hash) for tx_hash in tx_hashes]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        return [r for r in results if isinstance(r, dict)]


# ==================== 向后兼容：全局单例管理 ====================

_blockscout_service_instance: Optional[BlockscoutService] = None


def get_blockscout_client() -> BlockscoutService:
    """获取 Blockscout 服务单例（向后兼容旧代码）"""
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
