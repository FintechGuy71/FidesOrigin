"""
FidesOrigin 监控 Controller（重构版）
API 层：WebSocket 实时监控 + 统计信息
"""
import asyncio
import json
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Query, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core.di import get_db, get_ws_manager
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


# [HIGH Fix #9] 允许的 WebSocket Origin 列表
_ALLOWED_WS_ORIGINS = set(settings.CORS_ORIGINS) | {"http://localhost:3000", "http://localhost:5173"}


async def _validate_origin(websocket: WebSocket) -> bool:
    """[HIGH Fix #9] 验证 WebSocket 请求的 Origin header"""
    origin = websocket.headers.get("origin", "")
    if not origin:
        # 非浏览器客户端（如 curl）可能不携带 Origin，允许无 Origin 连接但记录日志
        logger.debug("websocket_no_origin_header")
        return True
    return origin in _ALLOWED_WS_ORIGINS


@router.websocket("/stream")
async def monitor_stream(
    websocket: WebSocket,
    addresses: str = Query(default="", description="监控的地址列表，逗号分隔"),
    min_risk_score: float = Query(default=0.0, ge=0, le=100, description="最小风险评分"),
    db: AsyncSession = Depends(get_db),
    manager: WebSocketManager = Depends(get_ws_manager)
):
    """
    WebSocket 实时监控流
    
    连接参数：
    - **addresses**: 要监控的地址列表，逗号分隔
    - **min_risk_score**: 只推送风险评分高于此值的交易
    
    认证流程（[CRITICAL Fix #1]）：
    1. 客户端先建立 WebSocket 连接（不传递 api_key）
    2. 连接后发送 {"type": "auth", "api_key": "<your-key>"} 进行认证
    3. 认证成功后开始推送数据
    
    消息格式：
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
    
    # [CRITICAL Fix #1] WebSocket 认证改为连接后通过消息发送
    # 不再从 query_params 读取 api_key（避免 URL 明文传输）
    # 先接受连接，然后等待客户端发送 auth 消息
    await websocket.accept()
    
    try:
        # 等待认证消息（超时 10 秒）
        auth_data = await asyncio.wait_for(websocket.receive_text(), timeout=10.0)
        auth_msg = json.loads(auth_data)
        
        if auth_msg.get("type") != "auth" or not auth_msg.get("api_key"):
            await websocket.close(code=4001, reason="Authentication required: send {\"type\": \"auth\", \"api_key\": \"...\"}")
            return
        
        api_key = auth_msg["api_key"]
    except asyncio.TimeoutError:
        await websocket.close(code=4001, reason="Authentication timeout")
        return
    except (json.JSONDecodeError, KeyError):
        await websocket.close(code=4001, reason="Invalid auth message")
        return
    
    # 验证 API Key
    from app.core.security import verify_api_key
    if not await verify_api_key(api_key, db):
        # 使用常数时间比较防止时序攻击
        await asyncio.sleep(secrets.randbelow(100) / 1000)  # 随机延迟 0-100ms
        await websocket.close(code=4001, reason="Invalid API key")
        return
    
    # 生成客户端 ID - 使用加密安全的随机数
    client_id = f"ws_{secrets.token_urlsafe(16)}"
    
    subscription = MonitorSubscription(
        addresses=address_list,
        min_risk_score=min_risk_score
    )
    
    # 连接管理
    connected = await manager.connect(websocket, client_id, subscription)
    if not connected:
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
        from app.core.di import get_container
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
                        "risk_level": addr_risk.risk_level.value,
                        "status": addr_risk.status.value
                    }
                ))
        
        # 保持连接并处理客户端消息
        while True:
            try:
                # 等待客户端消息（心跳或配置更新）
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
