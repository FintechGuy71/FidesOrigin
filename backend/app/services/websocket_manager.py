"""
FidesOrigin WebSocket 管理器（重构版）
观察者模式：连接管理 + 消息广播 + 订阅过滤
"""
import asyncio
from datetime import datetime, timezone
from typing import Dict, List, Optional, Set

from fastapi import WebSocket, WebSocketDisconnect

from app.config import get_settings
from app.core.logging import get_logger
from app.schemas import MonitorStreamMessage, MonitorSubscription

logger = get_logger(__name__)
# settings = get_settings()  # 不再在模块级别缓存


class WebSocketManager:
    """
    WebSocket 连接管理器
    
    设计模式：观察者模式
    - 客户端订阅特定地址
    - 新交易/风险事件触发时广播给订阅者
    
    特性：
    - 连接数限制（防止资源耗尽）
    - 心跳检测（自动清理死连接）
    - 按地址索引（高效广播）
    - 风险评分过滤（只推送符合条件的）
    - [HIGH Fix #3] 每客户端消息速率限制（30条/分钟）
    """
    
    # [HIGH Fix #3] 每客户端最大消息速率：30条/分钟
    MAX_MESSAGES_PER_MINUTE = 30
    
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.address_subscriptions: Dict[str, Set[str]] = {}
        self.connection_configs: Dict[str, MonitorSubscription] = {}
        self.connection_times: Dict[str, datetime] = {}
        # [HIGH Fix #3] 客户端消息速率限制跟踪
        self._client_message_counts: Dict[str, List[datetime]] = {}
        _settings = get_settings()
        self.max_connections = _settings.MONITOR_MAX_CONNECTIONS
    
    async def connect(
        self,
        websocket: WebSocket,
        client_id: str,
        subscription: MonitorSubscription
    ) -> bool:
        """
        接受新连接
        
        [LOW Fix #1] 注意：WebSocket accept 应由调用方（如 monitor.py）完成，
        本方法不再重复调用 accept()，避免 RuntimeError。
        
        Returns:
            bool: 是否成功连接
        """
        # 检查连接数限制
        if len(self.active_connections) >= self.max_connections:
            logger.warning(
                "websocket_max_connections_reached",
                current=len(self.active_connections),
                max=self.max_connections
            )
            await websocket.close(code=4003, reason="Server capacity exceeded")
            return False
        
        # [LOW Fix #1] 不再调用 websocket.accept() — 调用方已处理
        self.active_connections[client_id] = websocket
        self.connection_configs[client_id] = subscription
        self.connection_times[client_id] = datetime.now(timezone.utc)
        # [HIGH Fix #3] 初始化消息计数
        self._client_message_counts[client_id] = []
        
        # 建立地址索引
        for address in subscription.addresses:
            address_lower = address.lower()
            if address_lower not in self.address_subscriptions:
                self.address_subscriptions[address_lower] = set()
            self.address_subscriptions[address_lower].add(client_id)
        
        logger.info(
            "websocket_client_connected",
            client_id=client_id,
            addresses_count=len(subscription.addresses),
            total_connections=len(self.active_connections)
        )
        return True
    
    def disconnect(self, client_id: str) -> None:
        """断开连接并清理"""
        if client_id in self.active_connections:
            del self.active_connections[client_id]
        
        if client_id in self.connection_configs:
            subscription = self.connection_configs[client_id]
            for address in subscription.addresses:
                address_lower = address.lower()
                if address_lower in self.address_subscriptions:
                    self.address_subscriptions[address_lower].discard(client_id)
                    if not self.address_subscriptions[address_lower]:
                        del self.address_subscriptions[address_lower]
            del self.connection_configs[client_id]
        
        if client_id in self.connection_times:
            del self.connection_times[client_id]
        
        # [HIGH Fix #3] 清理消息计数
        if client_id in self._client_message_counts:
            del self._client_message_counts[client_id]
        
        logger.info(
            "websocket_client_disconnected",
            client_id=client_id,
            remaining_connections=len(self.active_connections)
        )
    
    async def send_message(self, client_id: str, message: MonitorStreamMessage) -> bool:
        """发送消息给特定客户端（带速率限制）"""
        if client_id not in self.active_connections:
            return False
        
        # [HIGH Fix #3] 检查客户端消息速率
        if not self._check_message_rate(client_id):
            logger.warning(
                "websocket_rate_limit_exceeded",
                client_id=client_id,
                max_per_minute=self.MAX_MESSAGES_PER_MINUTE
            )
            return False
        
        try:
            websocket = self.active_connections[client_id]
            await websocket.send_json(message.model_dump())
            return True
        except Exception as e:
            logger.warning(
                "websocket_send_failed",
                client_id=client_id,
                error=str(e)
            )
            self.disconnect(client_id)
            return False
    
    def _check_message_rate(self, client_id: str) -> bool:
        """
        [HIGH Fix #3] 检查客户端消息速率是否超过限制。
        使用滑动窗口：统计最近 60 秒内的消息数。
        """
        now = datetime.now(timezone.utc)
        minute_ago = now - timedelta(seconds=60)
        
        counts = self._client_message_counts.get(client_id, [])
        # 清理过期记录
        counts = [t for t in counts if t > minute_ago]
        
        if len(counts) >= self.MAX_MESSAGES_PER_MINUTE:
            self._client_message_counts[client_id] = counts
            return False
        
        counts.append(now)
        self._client_message_counts[client_id] = counts
        return True
    
    async def broadcast_to_address(
        self,
        address: str,
        message: MonitorStreamMessage,
        min_risk_score: float = 0.0
    ) -> int:
        """
        广播消息给订阅了特定地址的所有客户端
        
        Returns:
            int: 成功发送的客户端数量
        """
        address_lower = address.lower()
        if address_lower not in self.address_subscriptions:
            return 0
        
        client_ids = self.address_subscriptions[address_lower].copy()
        sent_count = 0
        
        for client_id in client_ids:
            config = self.connection_configs.get(client_id)
            if config is None:
                continue
            
            # 检查风险评分过滤
            msg_risk_score = message.data.get("risk_score", 0)
            if msg_risk_score >= max(min_risk_score, config.min_risk_score):
                if await self.send_message(client_id, message):
                    sent_count += 1
        
        return sent_count
    
    async def broadcast(self, message: MonitorStreamMessage) -> int:
        """广播消息给所有客户端"""
        disconnected = []
        sent_count = 0
        
        for client_id in list(self.active_connections.keys()):
            if not await self.send_message(client_id, message):
                disconnected.append(client_id)
            else:
                sent_count += 1
        
        # 清理断开连接
        for client_id in disconnected:
            self.disconnect(client_id)
        
        return sent_count
    
    async def send_heartbeat(self, client_id: str) -> bool:
        """发送心跳消息"""
        return await self.send_message(
            client_id,
            MonitorStreamMessage(
                type="system",
                data={
                    "event": "heartbeat",
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }
            )
        )
    
    def get_stats(self) -> Dict:
        """获取连接统计"""
        return {
            "total_connections": len(self.active_connections),
            "total_subscribed_addresses": len(self.address_subscriptions),
            "max_connections": self.max_connections,
            "connections": list(self.active_connections.keys()),
            "connection_times": {
                k: v.isoformat() for k, v in self.connection_times.items()
            }
        }
    
    async def close_all(self) -> None:
        """关闭所有连接"""
        for client_id in list(self.active_connections.keys()):
            try:
                websocket = self.active_connections[client_id]
                await websocket.close(code=1001, reason="Server shutting down")
            except Exception:
                pass
            self.disconnect(client_id)
        
        logger.info("websocket_all_connections_closed")
    
    async def cleanup_stale_connections(self, max_age_seconds: int = 300) -> int:
        """清理长时间无活动的连接"""
        now = datetime.now(timezone.utc)
        stale_clients = []
        
        for client_id, connect_time in self.connection_times.items():
            if (now - connect_time).total_seconds() > max_age_seconds:
                stale_clients.append(client_id)
        
        for client_id in stale_clients:
            try:
                websocket = self.active_connections.get(client_id)
                if websocket:
                    await websocket.close(code=4002, reason="Connection timeout")
            except Exception:
                pass
            self.disconnect(client_id)
        
        if stale_clients:
            logger.info(
                "websocket_stale_connections_cleaned",
                count=len(stale_clients)
            )
        
        return len(stale_clients)
