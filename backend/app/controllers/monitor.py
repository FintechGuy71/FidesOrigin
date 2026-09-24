"""
FidesOrigin 监控 Controller(重构版)
API 层:WebSocket 实时监控 + 统计信息
"""
import asyncio
import json
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Query, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core.di import get_db, get_ws_manager, get_container
from app.core.exceptions import AuthenticationException, FidesException
from app.core.logging import get_logger
from app.models import AddressRisk, RiskEvent, Transaction
from app.schemas import MonitorStreamMessage, MonitorSubscription
from app.services.websocket_manager import WebSocketManager
from app.validators import validate_address

logger = get_logger(__name__)
settings = get_settings()
router = APIRouter(prefix="/api/v1/monitor", tags=["实时监控"])


import secrets

from app.core.security import get_current_user


# [HIGH Fix #9] 允许的 WebSocket Origin 列表 — [H-1 Fix] 生产环境不添加 localhost
def _get_allowed_ws_origins():
    origins = set(settings.CORS_ORIGINS)
    if not settings.is_production:
        origins |= {"http://localhost:3000", "http://localhost:5173"}
    return origins

# [S-5 Fix] Pre-auth connection limit to prevent connection exhaustion DoS
_MAX_PENDING_AUTH = 100
_pending_auth_count = 0
_pending_auth_lock = asyncio.Lock()


async def _release_pending_auth():
    # [AUDIT FIX 2026-09-18 R3] 预认证计数器统一释放口。
    # 原实现仅在主循环 finally 递减，认证失败/超时/连接失败的早退路径
    # 全部跳过递减 → 100 次失败尝试后计数器永久占满，端点假死。
    global _pending_auth_count
    async with _pending_auth_lock:
        _pending_auth_count = max(0, _pending_auth_count - 1)


async def _validate_origin(websocket: WebSocket) -> bool:
    """[HIGH Fix #9] 验证 WebSocket 请求的 Origin header"""
    origin = websocket.headers.get("origin", "")
    if not origin:
        # 非浏览器客户端(如 curl)可能不携带 Origin,允许无 Origin 连接但记录日志
        logger.debug("websocket_no_origin_header")
        return True
    return origin in _get_allowed_ws_origins()


@router.websocket("/stream")
async def monitor_stream(
    websocket: WebSocket,
    addresses: str = Query(default="", description="监控的地址列表,逗号分隔"),
    min_risk_score: float = Query(default=0.0, ge=0, le=100, description="最小风险评分"),
    db: AsyncSession = Depends(get_db),
    manager: WebSocketManager = Depends(get_ws_manager)
):
    """
    WebSocket 实时监控流

    连接参数:
    - **addresses**: 要监控的地址列表,逗号分隔
    - **min_risk_score**: 只推送风险评分高于此值的交易

    认证流程([CRITICAL Fix #1]):
    1. 客户端先建立 WebSocket 连接(不传递 api_key)
    2. 连接后发送 {"type": "auth", "api_key": "<your-key>"} 进行认证
    3. 认证成功后开始推送数据

    消息格式:
    ```json
    {
        "type": "transaction|risk_alert|system",
        "timestamp": "2024-01-01T00:00:00Z",
        "data": {...}
    }
    ```
    """
    # [HIGH Fix #9] 验证 Origin header
    if not await _validate_origin(websocket):
        await websocket.close(code=4003, reason="Origin not allowed")
        return

    # 解析地址列表
    address_list = [addr.strip().lower() for addr in addresses.split(",") if addr.strip()]

    if not address_list:
        await websocket.close(code=4000, reason="No addresses provided")
        return

    # 验证地址格式
    for addr in address_list:
        try:
            validate_address(addr)
        except Exception:
            await websocket.close(code=4001, reason="Invalid address format")
            return

    # [S-5 Fix] Enforce pre-auth connection limit before accepting
    global _pending_auth_count
    async with _pending_auth_lock:
        if _pending_auth_count >= _MAX_PENDING_AUTH:
            logger.warning("websocket_pending_auth_limit_exceeded", max_pending=_MAX_PENDING_AUTH)
            return
        _pending_auth_count += 1

    # [CRITICAL Fix #1] WebSocket 认证改为连接后通过消息发送
    # 不再从 query_params 读取 api_key(避免 URL 明文传输)
    # 先接受连接,然后等待客户端发送 auth 消息
    await websocket.accept()

    # [AUDIT FIX 2026-09-24 B5] 认证等待期间客户端断开（WebSocketDisconnect，
    # 如用户直接关标签页）原不在任何 except 分支内 → 计数器 +1 泄漏，
    # 100 次后端点假死（R3 修复遗漏的早退路径）。补上该分支。
    try:
        # 等待认证消息(超时 10 秒)
        auth_data = await asyncio.wait_for(websocket.receive_text(), timeout=10.0)
        auth_msg = json.loads(auth_data)

        if auth_msg.get("type") != "auth" or not auth_msg.get("api_key"):
            await websocket.close(code=4001, reason="Authentication required: send {\"type\": \"auth\", \"api_key\": \"...\"}")
            await _release_pending_auth()
            return

        api_key = auth_msg["api_key"]
    except asyncio.TimeoutError:
        await websocket.close(code=4001, reason="Authentication timeout")
        await _release_pending_auth()
        return
    except (json.JSONDecodeError, KeyError):
        await websocket.close(code=4001, reason="Invalid auth message")
        await _release_pending_auth()
        return
    except WebSocketDisconnect:
        # 客户端在认证等待期内断开——释放配额后静默结束
        await _release_pending_auth()
        return

    # [Audit Fix #9] 验证 API Key
    from app.core.security import verify_api_key
    if not await verify_api_key(api_key, db):
        # [INFO-1 FIX] 原实现试图用 auth_msg.clear()/del "擦除密钥内存"——
        # CPython 中字符串不可变且 GC 不保证回收，该操作是安慰剂。
        # 诚实的做法：尽快解除本地引用（del），不宣称安全擦除；
        # 真正的密钥保护依赖传输层（wss）+ 认证消息不落日志。
        del auth_msg, auth_data, api_key
        # [Audit Fix #9] 增加随机延迟到 100-500ms，防止时序攻击
        await asyncio.sleep(secrets.randbelow(400) / 1000 + 0.1)
        await websocket.close(code=4001, reason="Invalid API key")
        await _release_pending_auth()
        return

    # [INFO-1 FIX] 验证通过后解除引用（非安全擦除，仅缩短生命周期）
    del auth_msg, auth_data, api_key

    # [AUDIT FIX 2026-09-24 B5] 认证已成功——该连接不再是"待认证"，
    # 立即释放 pending 配额。原实现把释放推迟到连接断开的 finally：
    # 长生命周期的已认证连接会一直占用 100 个 pending-auth 槽位，
    # 100 个正常在线客户端即可让新连接再也建立不起来。
    # 此后所有早退路径均不再调用 _release_pending_auth（避免双重释放
    # ——release 只做 max(0, count-1)，双释放会偷走其它待认证连接的配额）。
    await _release_pending_auth()

    # 生成客户端 ID - 使用加密安全的随机数
    client_id = f"ws_{secrets.token_urlsafe(16)}"

    subscription = MonitorSubscription(
        addresses=address_list,
        min_risk_score=min_risk_score
    )

    # 连接管理
    connected = await manager.connect(websocket, client_id, subscription)
    if not connected:
        # [AUDIT FIX 2026-09-24 B5] pending 配额已在认证成功后释放，此处不可
        # 再释放（见上文注释）。连接数满由 manager.connect 内部 close 处理。
        return

    try:
        # 发送连接成功消息
        await manager.send_message(client_id, MonitorStreamMessage(
            type="system",
            data={
                "event": "connected",
                "client_id": client_id,
                "monitored_addresses": address_list,
                "min_risk_score": min_risk_score
            }
        ))

        # 发送初始地址风险信息
        addr_repo = get_container().get_address_repository(db)

        for address in address_list:
            addr_risk = await addr_repo.get_by_address(address)

            if addr_risk:
                await manager.send_message(client_id, MonitorStreamMessage(
                    type="risk_alert",
                    data={
                        "event": "initial_risk",
                        "address": address,
                        "risk_score": addr_risk.risk_score,
                        # [AUDIT FIX 2026-09-18 R3-M9] ORM String 列读回为 plain str 时
                        # .value 抛 AttributeError → 初始推送崩溃断连
                        "risk_level": addr_risk.risk_level.value if hasattr(addr_risk.risk_level, "value") else addr_risk.risk_level,
                        "status": addr_risk.status.value if hasattr(addr_risk.status, "value") else addr_risk.status
                    }
                ))

        # 保持连接并处理客户端消息
        while True:
            try:
                # 等待客户端消息(心跳或配置更新)
                data = await asyncio.wait_for(
                    websocket.receive_text(),
                    timeout=settings.MONITOR_WS_PING_INTERVAL
                )

                try:
                    message = json.loads(data)
                    msg_type = message.get("type")

                    if msg_type == "ping":
                        await manager.send_message(client_id, MonitorStreamMessage(
                            type="system",
                            data={"event": "pong", "timestamp": datetime.now(timezone.utc).isoformat()}
                        ))

                    elif msg_type == "update_subscription":
                        # 更新订阅配置
                        new_addresses = message.get("addresses", [])
                        new_min_score = message.get("min_risk_score", min_risk_score)

                        # [AUDIT FIX 2026-09-24 B6] 原实现完全信任客户端消息：
                        # 地址不做格式校验、数量无上限（可一次推送数万个任意
                        # 字符串进 address_subscriptions 索引）。与初始连接路径
                        # 的校验（validate_address 逐个校验）对齐，并施加同样的
                        # 数量上限（MonitorSubscription 语义为少量监控地址）。
                        if not isinstance(new_addresses, list) or len(new_addresses) > 100:
                            await manager.send_message(client_id, MonitorStreamMessage(
                                type="system",
                                data={"event": "error", "message": "addresses must be a list of at most 100 items"}
                            ))
                            continue
                        try:
                            new_addresses = [validate_address(a) for a in new_addresses]
                        except Exception:
                            await manager.send_message(client_id, MonitorStreamMessage(
                                type="system",
                                data={"event": "error", "message": "Invalid address format in subscription"}
                            ))
                            continue
                        if not isinstance(new_min_score, (int, float)) or new_min_score < 0 or new_min_score > 100:
                            await manager.send_message(client_id, MonitorStreamMessage(
                                type="system",
                                data={"event": "error", "message": "min_risk_score must be a number in [0, 100]"}
                            ))
                            continue

                        # 重新建立连接
                        manager.disconnect(client_id)
                        new_subscription = MonitorSubscription(
                            addresses=new_addresses,
                            min_risk_score=new_min_score
                        )
                        await manager.connect(websocket, client_id, new_subscription)

                        await manager.send_message(client_id, MonitorStreamMessage(
                            type="system",
                            data={
                                "event": "subscription_updated",
                                "addresses": new_addresses
                            }
                        ))

                    elif msg_type == "get_stats":
                        stats = manager.get_stats()
                        await manager.send_message(client_id, MonitorStreamMessage(
                            type="system",
                            data={"event": "stats", "stats": stats}
                        ))

                except json.JSONDecodeError:
                    await manager.send_message(client_id, MonitorStreamMessage(
                        type="system",
                        data={"event": "error", "message": "Invalid JSON"}
                    ))

            except asyncio.TimeoutError:
                # 发送心跳
                try:
                    await manager.send_heartbeat(client_id)
                except Exception:
                    break

    except WebSocketDisconnect:
        logger.info("websocket_client_disconnected", client_id=client_id)
    except Exception as e:
        logger.error("websocket_error", client_id=client_id, error=str(e))
    finally:
        # [AUDIT FIX 2026-09-24 B5] pending-auth 配额已在认证成功后释放
        # （见上文），此处只做连接清理。
        manager.disconnect(client_id)


@router.get(
    "/stats",
    summary="获取监控统计",
    description="获取当前 WebSocket 连接的统计信息",
    responses={
        401: {"description": "未授权"},
        429: {"description": "请求过于频繁"},
    }
)
async def get_monitor_stats(
    manager: WebSocketManager = Depends(get_ws_manager),
    current_user: str = Depends(get_current_user)
):
    """获取监控统计信息"""
    return manager.get_stats()
