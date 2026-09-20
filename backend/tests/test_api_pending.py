"""
FidesOrigin API 待定测试 → 已落地（2026-09-20）

原两个测试是纯占位（pass + TODO + pytest.skip），是测试盲区：
- test_monitor_websocket_stream：声称"需要真实 WS 握手"而跳过。但 R3 修复的
  H1（timedelta 限速）、M12（活跃刷新）、H3（预认证计数器释放）、M9（risk_level
  安全取值）全部是可在事件循环内单测的纯逻辑，无需真实握手。改为用 FakeWebSocket
  直接驱动 WebSocketManager + monitor 辅助函数。
- test_get_transaction_from_blockscout：声称"需要外部 Blockscout 权限"而跳过。
  实际用 conftest 的 client fixture + 返回数据的 mock 即可覆盖成功路径
  （并借此暴露了 id=None 撞 id:int 的 500 缺陷，已在 schemas.py 修复）。
"""
import json
from datetime import datetime, timezone

import pytest

from app.schemas import MonitorStreamMessage, MonitorSubscription
from app.services.websocket_manager import WebSocketManager


class FakeWebSocket:
    """记录发送内容的最小 WebSocket 替身（无需真实网络握手）"""

    def __init__(self):
        self.sent = []
        self.closed = None

    async def send_json(self, payload):
        self.sent.append(payload)

    async def close(self, code=1000, reason=""):
        self.closed = (code, reason)


@pytest.mark.asyncio
async def test_ws_send_message_and_rate_limit():
    """H1/M12：send_message 正常投递、刷新活跃时间，且超过 30 条/分钟触发限速"""
    manager = WebSocketManager()
    ws = FakeWebSocket()
    sub = MonitorSubscription(addresses=["0xabc"], min_risk_score=0.0)

    assert await manager.connect(ws, "client_1", sub) is True
    connect_time = manager.connection_times["client_1"]

    # 正常发送：投递成功 + 活跃时间刷新（M12）
    msg = MonitorStreamMessage(type="system", data={"event": "connected"})
    assert await manager.send_message("client_1", msg) is True
    assert len(ws.sent) == 1
    assert manager.connection_times["client_1"] >= connect_time

    # H1：_check_message_rate 依赖 timedelta 滑窗——连发到超过上限后返回 False
    # （connect 已发 1 条，再发到第 30 条仍 True，第 31 条被限速）
    ok_count = 1
    for _ in range(40):
        if await manager.send_message("client_1", msg):
            ok_count += 1
    assert ok_count == WebSocketManager.MAX_MESSAGES_PER_MINUTE, (
        f"应恰好放行 {WebSocketManager.MAX_MESSAGES_PER_MINUTE} 条，实际 {ok_count}"
    )


@pytest.mark.asyncio
async def test_ws_stale_cleanup_respects_activity_refresh():
    """M12：刚发过消息的连接不应被 stale 清理误杀"""
    manager = WebSocketManager()
    ws = FakeWebSocket()
    await manager.connect(ws, "client_active", MonitorSubscription(addresses=["0x1"]))
    await manager.send_message("client_active", MonitorStreamMessage(type="system", data={}))

    # max_age=300，连接刚活跃 → 不应被清理
    cleaned = await manager.cleanup_stale_connections(max_age_seconds=300)
    assert cleaned == 0
    assert "client_active" in manager.active_connections


@pytest.mark.asyncio
async def test_ws_max_connections_capacity():
    """连接数达上限时拒绝新连接并 close(4003)"""
    manager = WebSocketManager()
    manager.max_connections = 1
    await manager.connect(FakeWebSocket(), "c1", MonitorSubscription(addresses=["0x1"]))
    ws2 = FakeWebSocket()
    assert await manager.connect(ws2, "c2", MonitorSubscription(addresses=["0x2"])) is False
    assert ws2.closed is not None and ws2.closed[0] == 4003


@pytest.mark.asyncio
async def test_ws_broadcast_to_address_filters_by_min_score():
    """broadcast_to_address 按订阅的 min_risk_score 过滤"""
    manager = WebSocketManager()
    ws = FakeWebSocket()
    await manager.connect(ws, "c1", MonitorSubscription(addresses=["0xabc"], min_risk_score=50.0))

    low = MonitorStreamMessage(type="risk_alert", data={"risk_score": 10})
    high = MonitorStreamMessage(type="risk_alert", data={"risk_score": 80})
    assert await manager.broadcast_to_address("0xABC", low) == 0   # 低于阈值不推
    assert await manager.broadcast_to_address("0xabc", high) == 1  # 达到阈值推送


@pytest.mark.asyncio
async def test_monitor_pending_auth_counter_release():
    """H3：_release_pending_auth 递减计数器且不为负（早退路径释放口）"""
    import app.controllers.monitor as monitor

    monitor._pending_auth_count = 5
    await monitor._release_pending_auth()
    assert monitor._pending_auth_count == 4
    monitor._pending_auth_count = 0
    await monitor._release_pending_auth()
    assert monitor._pending_auth_count == 0, "计数器不得为负"


@pytest.mark.asyncio
async def test_monitor_validate_origin():
    """H-1：非生产环境放行 localhost origin，未知 origin 拒绝"""
    import app.controllers.monitor as monitor

    class WS:
        def __init__(self, headers):
            self.headers = headers

    # 无 Origin（非浏览器客户端）放行
    assert await monitor._validate_origin(WS({})) is True
    # 允许的 localhost（非生产）
    assert await monitor._validate_origin(WS({"origin": "http://localhost:3000"})) is True
    # 未知 origin 拒绝
    assert await monitor._validate_origin(WS({"origin": "http://evil.example.com"})) is False


@pytest.mark.asyncio
@pytest.mark.noauth
async def test_get_transaction_from_blockscout_success(client):
    """Blockscout 回退成功路径：DB 无记录时从上游取并返回 200（非 500）。

    覆盖此前被 skip 的成功分支，并回归 id=None 的 schema 修复。
    """
    from app.core.di import get_container

    tx_hash = "0x" + "a" * 64

    class DataBlockscout:
        async def get_transaction(self, h):
            return {
                "value": "1000000000000000000",  # 1 ETH
                "from": {"hash": "0x" + "1" * 40},
                "to": {"hash": "0x" + "2" * 40},
                "gas_price": "20000000000",
                "gas_used": "21000",
                "block_number": 12345,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "status": "confirmed",
            }

    container = get_container()
    original = container._blockscout
    container._blockscout = DataBlockscout()
    try:
        resp = await client.get(f"/api/v1/transaction/{tx_hash}")
    finally:
        container._blockscout = original

    assert resp.status_code == 200, f"期望 200，实际 {resp.status_code}: {resp.text[:200]}"
    body = resp.json()
    assert body["tx_hash"] == tx_hash
    assert body["id"] is None, "blockscout 回退路径 id 应为 null（schema 已允许）"
    assert body["value_eth"] == 1.0
    assert body["from_address"] == "0x" + "1" * 40


@pytest.mark.asyncio
@pytest.mark.noauth
async def test_get_transaction_blockscout_upstream_error_is_502_or_500(client):
    """R3-M8：上游故障不再伪装成 404——非 NotFound 异常如实上抛（500/502）"""
    from app.core.di import get_container

    tx_hash = "0x" + "b" * 64

    class BoomBlockscout:
        async def get_transaction(self, h):
            raise RuntimeError("upstream timeout")

    container = get_container()
    original = container._blockscout
    container._blockscout = BoomBlockscout()
    try:
        resp = await client.get(f"/api/v1/transaction/{tx_hash}")
    finally:
        container._blockscout = original

    assert resp.status_code in (500, 502), (
        f"上游错误不应伪装成 404，实际 {resp.status_code}"
    )
