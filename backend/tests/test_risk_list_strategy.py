"""RiskListStrategy 独立打分通道测试（链上风险名单，PR #57）"""
import pytest
from unittest.mock import AsyncMock, MagicMock

from app.services.risk_engine_service import RiskListStrategy, SanctionedListStrategy
from app.models import RiskRule


def _make_db(tags):
    """构造 mock db：execute 返回 scalar() = tags"""
    db = MagicMock()
    result = MagicMock()
    result.scalar.return_value = tags
    db.execute = AsyncMock(return_value=result)
    return db


def _make_rule(name, impact):
    return RiskRule(name=name, risk_score_impact=impact, risk_weight=1.0)


@pytest.mark.asyncio
async def test_risk_list_hits_scam_sniffer():
    s = RiskListStrategy()
    score, desc = await s.evaluate(
        '0xabc', 'ethereum', _make_rule('scam_list', 75.0),
        _make_db(['SCAM_SNIFFER', 'scam']), None,
    )
    assert score == 75.0, f"期望 75 得 {score}"
    assert '风险名单' in desc


@pytest.mark.asyncio
async def test_risk_list_hits_phishing():
    s = RiskListStrategy()
    score, _ = await s.evaluate(
        '0xabc', 'ethereum', _make_rule('scam_list', 75.0),
        _make_db(['phishing']), None,
    )
    assert score == 75.0


@pytest.mark.asyncio
async def test_risk_list_does_not_hit_sanctioned_address():
    """制裁地址（带 sanctioned 标记）不应被 scam 策略命中"""
    s = RiskListStrategy()
    score, _ = await s.evaluate(
        '0xabc', 'ethereum', _make_rule('scam_list', 75.0),
        _make_db(['OFAC_SDN_ADVANCED', 'sanctioned']), None,
    )
    assert score == 0, "制裁地址不应被 scam 策略误判"


@pytest.mark.asyncio
async def test_sanctioned_list_does_not_hit_scam_address():
    """scam 地址（带 scam 标记）不应被制裁策略命中（防误封）"""
    s = SanctionedListStrategy()
    score, _ = await s.evaluate(
        '0xabc', 'ethereum', _make_rule('sanctioned_list', 100.0),
        _make_db(['SCAM_SNIFFER', 'scam']), None,
    )
    assert score == 0, "scam 地址不应被制裁策略命中（会误封）"


@pytest.mark.asyncio
async def test_risk_list_impact_caps_at_100():
    """impact 上限封顶 100"""
    s = RiskListStrategy()
    score, _ = await s.evaluate(
        '0xabc', 'ethereum', _make_rule('scam_list', 150.0),
        _make_db(['scam']), None,
    )
    assert score == 100.0
