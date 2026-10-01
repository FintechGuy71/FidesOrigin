"""
FidesOrigin 公开只读统计 Controller

面向官网（fidesorigin.com）构建期/运行期拉取的免鉴权公开指标。
只暴露聚合计数（总量级数字），不含任何地址级、事件级明细。

安全边界：
- 只读 COUNT 聚合，无参数、无写入面；
- 网关侧另有 CORS 白名单 + 限流（apps/api/api/v1/public/stats.js），
  本端点本身不返回任何可识别个体信息。
"""
from datetime import datetime, timezone
from typing import Any, Dict

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.di import get_db
from app.core.logging import get_logger
from app.models import AddressRisk, RiskLevel, RiskEvent, Transaction

logger = get_logger(__name__)
router = APIRouter(prefix="/api/v1/public", tags=["public"])

_HIGH_RISK_LEVELS = ("HIGH", "CRITICAL")
_HIGH_RISK_SEVERITIES = (RiskLevel.HIGH, RiskLevel.CRITICAL)


async def _count(db: AsyncSession, stmt) -> int:
    result = await db.execute(stmt)
    return int(result.scalar() or 0)


@router.get(
    "/stats",
    summary="公开聚合统计",
    description="官网展示用聚合计数：风险地址总数、高危地址数、监控交易总数、今日拦截数",
    responses={200: {"description": "成功"}},
)
async def get_public_stats(db: AsyncSession = Depends(get_db)) -> Dict[str, Any]:
    """
    公开聚合统计（免鉴权）

    数据来源（全部为现有真实表，与 dashboard.summary 同口径）：
    - risk_addresses_total: address_risks 表全部地址数
    - risk_addresses_high: address_risks 表中 HIGH/CRITICAL 地址数
    - monitored_transactions: transactions 表总数
    - blocked_today: risk_events 表今日 HIGH/CRITICAL 事件数
    """
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    risk_total = await _count(db, select(func.count(AddressRisk.id)))
    risk_high = await _count(
        db,
        select(func.count(AddressRisk.id)).where(
            AddressRisk.risk_level.in_(_HIGH_RISK_LEVELS)
        ),
    )
    monitored_total = await _count(db, select(func.count(Transaction.id)))
    blocked_today = await _count(
        db,
        select(func.count(RiskEvent.id)).where(
            RiskEvent.detected_at >= today_start,
            RiskEvent.severity.in_(_HIGH_RISK_SEVERITIES),
        ),
    )

    return {
        "risk_addresses_total": risk_total,
        "risk_addresses_high": risk_high,
        "monitored_transactions": monitored_total,
        "blocked_today": blocked_today,
        "generated_at": now.isoformat(),
    }
