"""
FidesOrigin 风险引擎服务（重构版）
策略模式：累加制风险评分 + 缓存优化 + 告警集成
"""
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core.exceptions import RiskCalculationException
from app.core.logging import get_logger
from app.models import Address, AddressRisk, RiskEvent, RiskLevel, RiskRule, RiskStatus, Transaction
from app.repositories.address_repository import AddressRepository
from app.repositories.rule_repository import RuleRepository
from app.repositories.transaction_repository import TransactionRepository
from app.schemas import RiskFactor
from app.services.alert_service import AlertService
from app.services.blockscout_service import BlockscoutService
from app.services.cache_service import CacheService

logger = get_logger(__name__)
settings = get_settings()


class RiskRuleStrategy:
    """
    风险规则策略接口
    策略模式：每个规则类型实现独立的评估逻辑
    """
    
    async def evaluate(
        self,
        address: str,
        chain: str,
        rule: RiskRule,
        db: AsyncSession,
        blockscout: BlockscoutService
    ) -> Tuple[float, str]:
        """
        评估风险
        
        Returns:
            (score, description)
        """
        raise NotImplementedError


class ReportedAddressStrategy(RiskRuleStrategy):
    """被举报地址策略"""
    
    async def evaluate(
        self,
        address: str,
        chain: str,
        rule: RiskRule,
        db: AsyncSession,
        blockscout: BlockscoutService
    ) -> Tuple[float, str]:
        # AddressReport 模型不存在，跳过举报检查
        return 0, ""


class TransactionPatternStrategy(RiskRuleStrategy):
    """交易模式策略（高频交易）"""
    
    async def evaluate(
        self,
        address: str,
        chain: str,
        rule: RiskRule,
        db: AsyncSession,
        blockscout: BlockscoutService
    ) -> Tuple[float, str]:
        day_ago = datetime.now(timezone.utc) - timedelta(hours=24)
        
        result = await db.execute(
            select(func.count(Transaction.id))
            .where(
                (Transaction.from_address == address) | (Transaction.to_address == address),
                Transaction.block_timestamp >= day_ago
            )
        )
        tx_count_24h = result.scalar() or 0
        
        condition = rule.condition or {}
        max_tx_per_hour = condition.get("max_transactions_per_hour", 10)
        weight = rule.risk_weight
        
        threshold = max_tx_per_hour * 24
        if tx_count_24h > threshold:
            impact = rule.risk_score_impact or 40
            score = min(tx_count_24h / threshold * impact, 100) * weight
            return score, f"24小时内交易 {tx_count_24h} 笔"
        
        return 0, ""


class AddressAgeStrategy(RiskRuleStrategy):
    """地址年龄策略"""
    
    async def evaluate(
        self,
        address: str,
        chain: str,
        rule: RiskRule,
        db: AsyncSession,
        blockscout: BlockscoutService
    ) -> Tuple[float, str]:
        try:
            stats = await blockscout.get_address_stats(address)
            first_tx = stats.get("first_transaction")
            
            if first_tx:
                try:
                    first_tx_time = datetime.fromisoformat(first_tx.replace('Z', '+00:00'))
                    age_days = (datetime.now(timezone.utc) - first_tx_time.replace(tzinfo=None)).days
                    
                    condition = rule.condition or {}
                    min_days = condition.get("min_days", 7)
                    weight = rule.risk_weight
                    
                    if age_days < min_days:
                        impact = rule.risk_score_impact or 20
                        score = (1 - age_days / min_days) * impact * weight
                        return score, f"地址创建仅 {age_days} 天"
                except (ValueError, TypeError):
                    pass
        except Exception as e:
            logger.warning("address_age_check_failed", address=address, error=str(e))
        
        return 0, ""


class LargeTransferStrategy(RiskRuleStrategy):
    """大额转账策略"""
    
    async def evaluate(
        self,
        address: str,
        chain: str,
        rule: RiskRule,
        db: AsyncSession,
        blockscout: BlockscoutService
    ) -> Tuple[float, str]:
        condition = rule.condition or {}
        threshold_eth = condition.get("threshold_eth", 100)
        threshold_wei = int(threshold_eth * 10**18)
        weight = rule.risk_weight
        
        from sqlalchemy import cast, Numeric
        
        result = await db.execute(
            select(Transaction)
            .where(
                Transaction.address == address,
                cast(Transaction.value, Numeric) >= threshold_wei
            )
            .order_by(Transaction.block_timestamp.desc())
            .limit(10)
        )
        large_txs = result.scalars().all()
        
        if large_txs:
            max_value = max(int(tx.value) for tx in large_txs) / 10**18
            impact = rule.risk_score_impact or 30
            score = min(max_value / threshold_eth * impact, 100) * weight
            return score, f"发现 {len(large_txs)} 笔大额交易，最大 {max_value:.2f} ETH"
        
        return 0, ""


class RiskEngineService:
    """
    风险评分引擎（重构版）
    
    核心改进：
    1. 累加制风险评分（而非平均制）
    2. 使用 risk_score_impact 字段
    3. Redis 缓存层（TTL 5分钟）
    4. 策略模式：规则评估可扩展
    5. 告警集成（计算失败时自动告警）
    """
    
    # 风险等级阈值
    RISK_THRESHOLDS = {
        RiskLevel.LOW: (0, 30),
        RiskLevel.MEDIUM: (30, 60),
        RiskLevel.HIGH: (60, 85),
        RiskLevel.CRITICAL: (85, 100),
    }
    
    # 策略映射表
    STRATEGIES: Dict[str, type] = {
        "reported_address": ReportedAddressStrategy,
        "high_frequency_transactions": TransactionPatternStrategy,
        "new_address": AddressAgeStrategy,
        "large_amount_transfer": LargeTransferStrategy,
    }
    
    def __init__(
        self,
        db: AsyncSession,
        blockscout: BlockscoutService,
        cache: CacheService,
        alert: AlertService,
        address_repo: AddressRepository,
        transaction_repo: TransactionRepository,
        rule_repo: RuleRepository
    ):
        self.db = db
        self.blockscout = blockscout
        self.cache = cache
        self.alert = alert
        self.address_repo = address_repo
        self.transaction_repo = transaction_repo
        self.rule_repo = rule_repo
    
    def _calculate_risk_level(self, score: float) -> RiskLevel:
        """根据评分计算风险等级"""
        for level, (min_score, max_score) in self.RISK_THRESHOLDS.items():
            if min_score <= score <= max_score:
                return level
        return RiskLevel.LOW
    
    async def _evaluate_rule(
        self,
        address: str,
        chain: str,
        rule: RiskRule
    ) -> Tuple[float, str]:
        """评估单个规则"""
        strategy_class = self.STRATEGIES.get(rule.name)
        
        if strategy_class:
            strategy = strategy_class()
            return await strategy.evaluate(address, chain, rule, self.db, self.blockscout)
        
        # 自定义规则：使用 risk_score_impact 累加
        impact = rule.risk_score_impact or 0
        weight = rule.risk_weight
        score = impact * weight
        return score, rule.description or ""
    
    async def calculate_address_risk(
        self,
        address: str,
        chain: str = "ethereum",
        force_refresh: bool = False
    ) -> Tuple[float, RiskLevel, List[RiskFactor]]:
        """
        计算地址风险评分（累加制）
        
        改进：
        - 累加制：final_score = min(100, sum(rule.risk_score_impact * weight))
        - 缓存：Redis 缓存 5 分钟
        - 缓存穿透保护：空值也缓存
        """
        cache_key = self.cache.risk_key(address, chain)
        
        # 检查缓存（非强制刷新）
        if not force_refresh:
            cached = await self.cache.get_json(cache_key)
            if cached is not None:
                if cached == "__NULL__":
                    return 0, RiskLevel.LOW, []
                
                logger.info("risk_cache_hit", address=address, chain=chain)
                return (
                    cached["score"],
                    RiskLevel(cached["level"]),
                    [RiskFactor(**f) for f in cached["factors"]]
                )
        
        logger.info("risk_calculation_started", address=address, chain=chain)
        
        try:
            # 获取活跃规则
            rules = await self.rule_repo.get_active_rules()
            
            # 计算各项风险因子（累加制）
            risk_factors: List[RiskFactor] = []
            total_score = 0.0
            
            for rule in rules:
                score, description = await self._evaluate_rule(address, chain, rule)
                
                if score > 0:
                    total_score += score
                    risk_factors.append(RiskFactor(
                        name=rule.name,
                        weight=rule.risk_weight,
                        score=score,
                        description=description or rule.description
                    ))
            
            # 封顶 100
            total_score = min(total_score, 100)
            risk_level = self._calculate_risk_level(total_score)
            
            # 缓存结果
            cache_data = {
                "score": total_score,
                "level": risk_level.value,
                "factors": [f.model_dump() for f in risk_factors]
            }
            await self.cache.set_json(
                cache_key,
                cache_data,
                expire=settings.RISK_CACHE_TTL
            )
            
            # 更新数据库记录
            await self.address_repo.create_or_update(
                address=address,
                chain=chain,
                risk_score=total_score,
                risk_level=risk_level,
                risk_factors=risk_factors
            )
            
            # 高风险告警
            if total_score >= 60:
                await self.alert.send_risk_alert(
                    address=address,
                    risk_score=total_score,
                    risk_level=risk_level.value,
                    indicators=[f.model_dump() for f in risk_factors]
                )
            
            logger.info(
                "risk_calculation_complete",
                address=address,
                score=total_score,
                level=risk_level.value,
                factors_count=len(risk_factors)
            )
            
            return total_score, risk_level, risk_factors
            
        except Exception as e:
            await self.alert.send_alert(
                alert_type="address_risk_calculation_failed",
                message=f"地址风险计算失败: {address}",
                details={"address": address, "chain": chain},
                exc=e
            )
            logger.error(
                "risk_calculation_failed",
                address=address,
                error=str(e)
            )
            raise RiskCalculationException(
                message=f"Risk calculation failed for {address}",
                address=address
            ) from e
    
    async def analyze_transaction(
        self,
        tx_hash: str,
        chain: str = "ethereum"
    ) -> Dict[str, Any]:
        """
        分析交易风险
        
        改进：
        - 缓存 Blockscout 查询结果
        - 累加关联地址风险
        """
        cache_key = self.cache.tx_key(tx_hash, chain)
        
        # 检查缓存
        cached = await self.cache.get_json(cache_key)
        if cached is not None:
            return cached
        
        logger.info("transaction_analysis_started", tx_hash=tx_hash, chain=chain)
        
        try:
            indicators = []
            total_score = 0.0
            
            # 从 Blockscout 获取交易详情
            tx_data = await self.blockscout.get_transaction(tx_hash)
            
            from_addr = tx_data.get("from", {}).get("hash", "")
            to_addr = tx_data.get("to", {}).get("hash", "")
            value_wei = int(tx_data.get("value", "0"))
            value_eth = value_wei / 10**18
            
            # 检查发送方风险
            if from_addr:
                from_score, from_level, _ = await self.calculate_address_risk(from_addr, chain)
                if from_score > 50:
                    indicators.append({
                        "type": "high_risk_sender",
                        "address": from_addr,
                        "score": from_score,
                        "level": from_level.value,
                    })
                    total_score += from_score * 0.6
            
            # 检查接收方风险
            if to_addr:
                to_score, to_level, _ = await self.calculate_address_risk(to_addr, chain)
                if to_score > 50:
                    indicators.append({
                        "type": "high_risk_receiver",
                        "address": to_addr,
                        "score": to_score,
                        "level": to_level.value,
                    })
                    total_score += to_score * 0.6
            
            # 检查大额交易
            if value_eth > 100:
                indicators.append({
                    "type": "large_amount",
                    "value_eth": value_eth,
                })
                total_score += min(value_eth / 1000 * 20, 30)
            
            # 检查合约调用
            if tx_data.get("to", {}).get("is_contract"):
                indicators.append({
                    "type": "contract_call",
                    "contract": to_addr,
                })
            
            # 封顶
            total_score = min(total_score, 100)
            risk_level = self._calculate_risk_level(total_score)
            
            result = {
                "tx_hash": tx_hash,
                "chain": chain,
                "risk_score": total_score,
                "risk_level": risk_level.value,
                "indicators": indicators,
                "from_address": from_addr,
                "to_address": to_addr,
                "value_eth": value_eth,
                "analyzed_at": datetime.now(timezone.utc).isoformat(),
            }
            
            # 缓存结果
            await self.cache.set_json(cache_key, result, expire=settings.RISK_CACHE_TTL)
            
            # 保存到数据库
            try:
                await self.transaction_repo.create(
                    tx_hash=tx_hash,
                    chain=chain,
                    address=from_addr,
                    from_address=from_addr,
                    to_address=to_addr,
                    value=str(value_wei),
                    block_number=tx_data.get("block_number", 0),
                    risk_score=total_score,
                    risk_level=risk_level,
                    risk_indicators=indicators,
                    status=tx_data.get("status", "pending")
                )
            except Exception as e:
                logger.warning("transaction_cache_failed", tx_hash=tx_hash, error=str(e))
            
            return result
            
        except Exception as e:
            await self.alert.send_alert(
                alert_type="transaction_analysis_failed",
                message=f"交易风险分析失败: {tx_hash}",
                details={"tx_hash": tx_hash, "chain": chain},
                exc=e
            )
            logger.error("transaction_analysis_failed", tx_hash=tx_hash, error=str(e))
            raise RiskCalculationException(
                message=f"Transaction analysis failed for {tx_hash}"
            ) from e
    
    async def create_risk_event(
        self,
        event_type: str,
        severity: RiskLevel,
        address: str,
        description: str,
        tx_hash: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
        triggered_rules: Optional[List[str]] = None
    ) -> RiskEvent:
        """创建风险事件"""
        return await self.address_repo.create_event(
            event_type=event_type,
            severity=severity,
            address=address,
            description=description,
            tx_hash=tx_hash,
            details=details,
            triggered_rules=triggered_rules
        )
