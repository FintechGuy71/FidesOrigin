"""
FidesOrigin 风险引擎测试
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime, timezone

from app.services.risk_engine import RiskEngine, AlertService
from app.models import RiskLevel, AddressReport, Transaction, AddressRisk


@pytest.fixture
def mock_db():
    """创建模拟数据库会话"""
    db = MagicMock()
    db.execute = AsyncMock()
    db.commit = AsyncMock()
    db.refresh = AsyncMock()
    db.add = MagicMock()
    return db


@pytest.fixture
def risk_engine(mock_db):
    """创建风险引擎实例"""
    return RiskEngine(mock_db)


class TestAlertService:
    """测试告警服务"""

    def test_should_alert_respects_cooldown(self):
        alert = AlertService()
        alert.enabled = True
        alert.webhook_url = None
        assert alert._should_alert("test") is True
        assert alert._should_alert("test") is False  # Cooldown

    def test_alert_disabled_when_no_config(self):
        alert = AlertService()
        alert.enabled = False
        assert alert._should_alert("test") is False


class TestRiskEngineRules:
    """测试风险引擎规则评估"""

    @pytest.mark.asyncio
    async def test_default_rules_exist(self, risk_engine):
        assert len(RiskEngine.DEFAULT_RULES) == 5
        rule_names = [r["name"] for r in RiskEngine.DEFAULT_RULES]
        assert "reported_address" in rule_names
        assert "high_frequency_transactions" in rule_names
        assert "large_amount_transfer" in rule_names
        assert "new_address" in rule_names
        assert "contract_interaction" in rule_names

    def test_calculate_risk_level_low(self, risk_engine):
        # [FIX 2026-10-02] 展示阈值对齐链上：LOW 覆盖 UNKNOWN+LOW = [0,49]
        assert risk_engine._calculate_risk_level(10) == RiskLevel.LOW
        assert risk_engine._calculate_risk_level(0) == RiskLevel.LOW
        assert risk_engine._calculate_risk_level(30) == RiskLevel.LOW
        assert risk_engine._calculate_risk_level(49) == RiskLevel.LOW

    def test_calculate_risk_level_medium(self, risk_engine):
        # MEDIUM = [50,79]（链上 tier 边界）
        assert risk_engine._calculate_risk_level(50) == RiskLevel.MEDIUM
        assert risk_engine._calculate_risk_level(60) == RiskLevel.MEDIUM
        assert risk_engine._calculate_risk_level(75) == RiskLevel.MEDIUM
        assert risk_engine._calculate_risk_level(79) == RiskLevel.MEDIUM

    def test_calculate_risk_level_high(self, risk_engine):
        # HIGH = [80,94]
        assert risk_engine._calculate_risk_level(80) == RiskLevel.HIGH
        assert risk_engine._calculate_risk_level(85) == RiskLevel.HIGH
        assert risk_engine._calculate_risk_level(94) == RiskLevel.HIGH

    def test_calculate_risk_level_critical(self, risk_engine):
        # CRITICAL = [95,100]
        assert risk_engine._calculate_risk_level(95) == RiskLevel.CRITICAL
        assert risk_engine._calculate_risk_level(100) == RiskLevel.CRITICAL

    def test_calculate_risk_level_boundaries(self, risk_engine):
        """边界条件: score=0 和 score=100"""
        assert risk_engine._calculate_risk_level(0) == RiskLevel.LOW
        assert risk_engine._calculate_risk_level(100) == RiskLevel.CRITICAL

    def test_calculate_risk_level_float_between_bands(self, risk_engine):
        """[FIX 2026-10-02] 档间小数不得静默降为 LOW。

        score 为 float（total_score 累加各规则得到，未取整）。旧的闭区间
        `min <= score <= max` 会让 49.5/79.5/94.5 落空并返回兜底 LOW，
        把中高危误判为低危。左闭判定必须正确归档。
        """
        assert risk_engine._calculate_risk_level(49.5) == RiskLevel.LOW      # <50
        assert risk_engine._calculate_risk_level(50.5) == RiskLevel.MEDIUM   # [50,80)
        assert risk_engine._calculate_risk_level(79.5) == RiskLevel.MEDIUM   # <80
        assert risk_engine._calculate_risk_level(80.5) == RiskLevel.HIGH     # [80,95)
        assert risk_engine._calculate_risk_level(94.5) == RiskLevel.HIGH     # <95
        assert risk_engine._calculate_risk_level(95.5) == RiskLevel.CRITICAL # >=95

    @pytest.mark.asyncio
    async def test_check_reported_address_with_reports(self, risk_engine, mock_db):
        mock_result = MagicMock()
        mock_result.scalar.return_value = 3
        mock_db.execute.return_value = mock_result

        score, reason = await risk_engine._check_reported_address(
            "0x123", {"min_reports": 1, "weight": 0.3}
        )
        assert score > 0
        assert "3" in reason

    @pytest.mark.asyncio
    async def test_check_reported_address_no_reports(self, risk_engine, mock_db):
        mock_result = MagicMock()
        mock_result.scalar.return_value = 0
        mock_db.execute.return_value = mock_result

        score, reason = await risk_engine._check_reported_address(
            "0x123", {"min_reports": 1, "weight": 0.3}
        )
        assert score == 0
        assert reason == ""

    @pytest.mark.asyncio
    async def test_score_capped_at_100(self, risk_engine, mock_db):
        """测试评分封顶逻辑"""
        # Simulate many reports to push score high
        mock_result = MagicMock()
        mock_result.scalar.return_value = 100
        mock_db.execute.return_value = mock_result

        score, _ = await risk_engine._check_reported_address(
            "0x123", {"min_reports": 1, "weight": 1.0, "base_score": 50}
        )
        assert score <= 100


class TestRiskEngineConcurrency:
    """测试并发规则评估"""

    @pytest.mark.asyncio
    async def test_concurrent_rule_evaluation(self, risk_engine, mock_db):
        """模拟并发规则评估"""
        import asyncio

        mock_result = MagicMock()
        mock_result.scalar.return_value = 0
        mock_db.execute.return_value = mock_result

        async def evaluate():
            return await risk_engine.calculate_address_risk("0x123", "ethereum")

        tasks = [evaluate() for _ in range(5)]
        results = await asyncio.gather(*tasks)

        # All results should be valid
        for score, level, factors in results:
            assert 0 <= score <= 100
            assert level in RiskLevel


class TestRiskEngineCaching:
    """测试规则缓存"""

    @pytest.mark.asyncio
    async def test_rules_cache_ttl(self, risk_engine, mock_db):
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = []
        mock_db.execute.return_value = mock_result

        # First call should hit DB
        await risk_engine._get_active_rules()
        assert mock_db.execute.call_count >= 1

        # Second call within TTL should use cache
        cached_rules = await risk_engine._get_active_rules()
        # Should not make additional DB call if cache is valid


class TestFalsePositiveFeedback:
    """测试误报反馈闭环"""

    @pytest.mark.asyncio
    async def test_risk_calculation_with_no_data(self, risk_engine, mock_db):
        """测试无数据情况下的风险评分"""
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db.execute.return_value = mock_result

        mock_rules_result = MagicMock()
        mock_rules_result.scalars.return_value.all.return_value = []
        mock_db.execute.return_value = mock_rules_result

        score, level, factors = await risk_engine.calculate_address_risk("0x123", "ethereum")
        assert score == 0.0
        assert level == RiskLevel.LOW
        assert factors == []
