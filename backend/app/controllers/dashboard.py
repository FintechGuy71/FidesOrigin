"""
FidesOrigin 业务仪表盘 Controller
聚合真实业务统计数据（地址风险 / 风险事件 / 交易），供后台 Dashboard 展示

[Dashboard Fix] 此前后台"数据不可用"：/api/v1/monitor/stats 只返回 WebSocket
连接统计。本控制器基于数据库真实表（address_risks / risk_events / transactions）
做 COUNT/聚合，绝不返回硬编码假数据；无法从现有表计算的指标如实返回 null。
"""
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.di import get_db
from app.core.logging import get_logger
from app.core.security import get_current_user
from app.models import AddressRisk, RiskEvent, RiskLevel, Transaction

logger = get_logger(__name__)
router = APIRouter(prefix="/api/v1/dashboard", tags=["dashboard"])

# 高风险等级（AddressRisk.risk_level 为 String 列，存储 HIGH/CRITICAL 等值）
_HIGH_RISK_LEVELS = ("HIGH", "CRITICAL")
# RiskEvent.severity 为 PG ENUM（risk_level），过滤时使用枚举成员
_HIGH_RISK_SEVERITIES = (RiskLevel.HIGH, RiskLevel.CRITICAL)


def _metric(value: Any, change: Optional[float] = None) -> Dict[str, Any]:
    """统一指标响应结构：value + change（与前一日差值，不可比时为 null）"""
    return {"value": value, "change": change}


async def _count(db: AsyncSession, stmt) -> int:
    """执行 COUNT 查询并返回整数（SQLAlchemy 参数化，禁止字符串拼接 SQL）"""
    result = await db.execute(stmt)
    return int(result.scalar() or 0)


@router.get(
    "/summary",
    summary="仪表盘汇总统计",
    description="返回真实业务统计：今日拦截、风险地址、合规通过率、监控交易数",
    responses={
        200: {"description": "成功"},
        401: {"description": "未认证"},
    }
)
async def get_dashboard_summary(
    db: AsyncSession = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    """
    仪表盘汇总统计（需鉴权）

    数据来源（全部为现有真实表）：
    - today_blocked: risk_events 表，今日新增的高危（HIGH/CRITICAL）风险事件数
    - risk_addresses: address_risks 表，当前 HIGH/CRITICAL 风险地址总数
    - compliance_rate: address_risks 表，非高危地址占比（= (总数 - 高危数) / 总数），
      无地址数据时返回 null（无法计算，如实表达）
    - monitored_transactions: transactions 表，已入库监控交易总数
    change：与前一自然日对应增量的差值；risk_addresses/compliance_rate 为存量指标，
      无法从现有表回溯历史快照，change 返回 null。
    """
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    yesterday_start = today_start - timedelta(days=1)

    # ---- 今日拦截：今日高危风险事件数（risk_events）----
    blocked_today = await _count(db, select(func.count(RiskEvent.id)).where(
        RiskEvent.detected_at >= today_start,
        RiskEvent.severity.in_(_HIGH_RISK_SEVERITIES),
    ))
    blocked_yesterday = await _count(db, select(func.count(RiskEvent.id)).where(
        RiskEvent.detected_at >= yesterday_start,
        RiskEvent.detected_at < today_start,
        RiskEvent.severity.in_(_HIGH_RISK_SEVERITIES),
    ))

    # ---- 风险地址总数：当前 HIGH/CRITICAL 地址（address_risks）----
    risk_addresses = await _count(db, select(func.count(AddressRisk.id)).where(
        AddressRisk.risk_level.in_(_HIGH_RISK_LEVELS),
    ))

    # ---- 合规通过率：非高危地址占比（address_risks），无数据时为 null ----
    total_addresses = await _count(db, select(func.count(AddressRisk.id)))
    compliance_rate: Optional[float] = None
    if total_addresses > 0:
        compliance_rate = round(
            (total_addresses - risk_addresses) / total_addresses * 100, 2
        )

    # ---- 监控交易数：transactions 总数 + 今日/昨日增量 ----
    monitored_total = await _count(db, select(func.count(Transaction.id)))
    tx_today = await _count(db, select(func.count(Transaction.id)).where(
        Transaction.created_at >= today_start,
    ))
    tx_yesterday = await _count(db, select(func.count(Transaction.id)).where(
        Transaction.created_at >= yesterday_start,
        Transaction.created_at < today_start,
    ))

    return {
        "today_blocked": _metric(blocked_today, change=blocked_today - blocked_yesterday),
        "risk_addresses": _metric(risk_addresses, change=None),
        "compliance_rate": _metric(compliance_rate, change=None),
        "monitored_transactions": _metric(monitored_total, change=tx_today - tx_yesterday),
        "generated_at": now.isoformat(),
    }


@router.get(
    "/events",
    summary="近期风险事件",
    description="返回最近的 20 条风险事件（risk_events），金额取自关联交易（transactions.value_usd）",
    responses={
        200: {"description": "成功"},
        401: {"description": "未认证"},
    }
)
async def get_dashboard_events(
    db: AsyncSession = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    """
    近期风险事件列表（需鉴权）

    数据来源：risk_events 表（按 detected_at 倒序取 20 条）；
    amount 通过事件 tx_hash 关联 transactions.value_usd，无关联交易时为 null。
    """
    result = await db.execute(
        select(RiskEvent).order_by(RiskEvent.detected_at.desc()).limit(20)
    )
    events: List[RiskEvent] = list(result.scalars().all())

    # 批量查询关联交易的 USD 金额（避免 N+1）
    tx_hashes = [e.tx_hash for e in events if e.tx_hash]
    amount_by_hash: Dict[str, Any] = {}
    if tx_hashes:
        tx_result = await db.execute(
            select(Transaction.tx_hash, Transaction.value_usd).where(
                Transaction.tx_hash.in_(tx_hashes)
            )
        )
        for tx_hash, value_usd in tx_result.all():
            if tx_hash not in amount_by_hash and value_usd is not None:
                amount_by_hash[tx_hash] = float(value_usd)

    items = []
    for e in events:
        severity = e.severity.value if hasattr(e.severity, "value") else str(e.severity)
        status_value = e.status.value if hasattr(e.status, "value") else str(e.status)
        items.append({
            "id": e.id,
            "type": e.event_type,
            "address": e.address,
            "amount": amount_by_hash.get(e.tx_hash) if e.tx_hash else None,
            "risk": severity,
            "time": e.detected_at.isoformat() if e.detected_at else None,
            "status": status_value,
        })

    return {"events": items, "total": len(items)}
