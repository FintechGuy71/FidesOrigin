"""
风险评分引擎
实现地址和交易的风险评估算法
"""
import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple
from decimal import Decimal

import httpx
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models import (
    AddressRisk, 
    AddressReport, 
    RiskEvent, 
    RiskLevel, 
    RiskRule, 
    RiskStatus,
    Transaction
)
from app.schemas import RiskFactor
from app.services.blockscout_service import BlockscoutAPIError, BlockscoutService

logger = logging.getLogger(__name__)
settings = get_settings()


class AlertService:
    """异常告警服务 - 当风险计算失败时发送告警"""

    def __init__(self):
        self.webhook_url = settings.ALERT_WEBHOOK_URL
        self.enabled = settings.ALERT_ENABLED
        self._last_alert_time: Optional[datetime] = None
        self._alert_cooldown = timedelta(minutes=5)  # 同类型告警冷却时间

    def _should_alert(self, alert_type: str) -> bool:
        """检查是否需要发送告警（防告警风暴）"""
        if not self.enabled:
            return False
        now = datetime.now(timezone.utc)
        if (self._last_alert_time is None or
                now - self._last_alert_time > self._alert_cooldown):
            self._last_alert_time = now
            return True
        return False

    async def send_alert(
        self,
        alert_type: str,
        message: str,
        details: Optional[Dict[str, Any]] = None,
        exc: Optional[Exception] = None
    ):
        """发送告警通知"""
        payload = {
            "alert_type": alert_type,
            "message": message,
            "service": "fidesorigin-risk-engine",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "severity": "critical",
            "details": details or {},
        }

        if exc:
            payload["error"] = str(exc)
            payload["error_type"] = type(exc).__name__

        # 1. 日志记录（始终执行）
        logger.critical(
            "RISK_ENGINE_ALERT: %s | %s | details=%s",
            alert_type,
            message,
            payload["details"],
            extra={"alert": True, "alert_type": alert_type}
        )

        # 2. Webhook 告警（如果配置了）
        if self.webhook_url and self._should_alert(alert_type):
            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    response = await client.post(
                        self.webhook_url,
                        json=payload,
                        headers={"Content-Type": "application/json"}
                    )
                    if response.status_code < 400:
                        logger.info(
                            "Alert sent successfully",
                            alert_type=alert_type,
                            status_code=response.status_code
                        )
                    else:
                        logger.warning(
                            "Alert webhook returned non-OK status",
                            status_code=response.status_code,
                            response=response.text[:200]
                        )
            except Exception as e:
                logger.error("Failed to send alert webhook", error=str(e))

        # 3. 如果配置了 Slack/飞书等，可以在这里扩展


# 全局告警服务实例
alert_service = AlertService()


class RiskEngine:
    """风险评分引擎"""
    
    # 风险等级阈值
    RISK_THRESHOLDS = {
        RiskLevel.LOW: (0, 30),
        RiskLevel.MEDIUM: (30, 60),
        RiskLevel.HIGH: (60, 85),
        RiskLevel.CRITICAL: (85, 100),
    }
    
    # 预定义风险规则
    DEFAULT_RULES = [
        {
            "name": "reported_address",
            "description": "地址被多次举报",
            "category": "reputation",
            "condition": {"min_reports": 1, "weight": 0.3},
            "base_score": 50,
        },
        {
            "name": "high_frequency_transactions",
            "description": "高频交易模式",
            "category": "behavior",
            "condition": {"max_transactions_per_hour": 10, "weight": 0.2},
            "base_score": 40,
        },
        {
            "name": "large_amount_transfer",
            "description": "大额转账",
            "category": "amount",
            "condition": {"threshold_eth": 100, "weight": 0.15},
            "base_score": 30,
        },
        {
            "name": "new_address",
            "description": "新创建地址",
            "category": "age",
            "condition": {"min_days": 7, "weight": 0.1},
            "base_score": 20,
        },
        {
            "name": "contract_interaction",
            "description": "可疑合约交互",
            "category": "contract",
            "condition": {"suspicious_opcodes": ["SELFDESTRUCT", "DELEGATECALL"], "weight": 0.25},
            "base_score": 45,
        },
    ]
    
    def __init__(self, db_session: AsyncSession):
        self.db = db_session
        self._blockscout = None
        self._rules_cache: Optional[List[RiskRule]] = None
        self._cache_timestamp: Optional[datetime] = None
        self._cache_ttl = timedelta(minutes=5)
    
    @property
    async def blockscout(self):
        """懒加载 Blockscout 客户端"""
        if self._blockscout is None:
            self._blockscout = BlockscoutService()
            await self._blockscout.connect()
        return self._blockscout
    
    async def _get_active_rules(self) -> List[RiskRule]:
        """获取活跃的风险规则（带缓存）"""
        now = datetime.now(timezone.utc)
        
        if (self._rules_cache is None or 
            self._cache_timestamp is None or 
            now - self._cache_timestamp > self._cache_ttl):
            
            result = await self.db.execute(
                select(RiskRule)
                .where(RiskRule.is_active == True)
                .order_by(RiskRule.priority)
            )
            self._rules_cache = result.scalars().all()
            self._cache_timestamp = now
            logger.debug(f"Loaded {len(self._rules_cache)} active risk rules")
        
        return self._rules_cache
    
    def _calculate_risk_level(self, score: float) -> RiskLevel:
        """根据评分计算风险等级"""
        for level, (min_score, max_score) in self.RISK_THRESHOLDS.items():
            if min_score <= score <= max_score:
                return level
        return RiskLevel.LOW
    
    async def _check_reported_address(
        self,
        address: str,
        rule_config: Dict[str, Any]
    ) -> Tuple[float, str]:
        """检查地址是否被举报"""
        result = await self.db.execute(
            select(func.count(AddressReport.id))
            .where(
                AddressReport.address == address,
                AddressReport.status.in_(["pending", "confirmed"])
            )
        )
        report_count = result.scalar() or 0
        
        min_reports = rule_config.get("min_reports", 1)
        weight = rule_config.get("weight", 0.3)
        base_score = 50
        
        if report_count >= min_reports:
            score = min(base_score + (report_count - min_reports) * 10, 100) * weight
            return score, f"地址被举报 {report_count} 次"
        
        return 0, ""
    
    async def _check_transaction_patterns(
        self,
        address: str,
        rule_config: Dict[str, Any]
    ) -> Tuple[float, str]:
        """检查交易模式"""
        # 获取最近24小时的交易数
        day_ago = datetime.now(timezone.utc) - timedelta(hours=24)
        
        result = await self.db.execute(
            select(func.count(Transaction.id))
            .where(
                Transaction.address == address,
                Transaction.block_timestamp >= day_ago
            )
        )
        tx_count_24h = result.scalar() or 0
        
        max_tx_per_hour = rule_config.get("max_transactions_per_hour", 10)
        weight = rule_config.get("weight", 0.2)
        
        if tx_count_24h > max_tx_per_hour * 24:
            score = min(tx_count_24h / (max_tx_per_hour * 24) * 50, 100) * weight
            return score, f"24小时内交易 {tx_count_24h} 笔"
        
        return 0, ""
    
    async def _check_address_age(
        self,
        address: str,
        rule_config: Dict[str, Any]
    ) -> Tuple[float, str]:
        """检查地址年龄"""
        try:
            client = await self.blockscout
            stats = await client.get_address_stats(address)
            
            first_tx = stats.get("first_transaction")
            if first_tx:
                # 解析时间
                try:
                    first_tx_time = datetime.fromisoformat(first_tx.replace('Z', '+00:00'))
                    age_days = (datetime.now(timezone.utc) - first_tx_time.replace(tzinfo=None)).days
                    
                    min_days = rule_config.get("min_days", 7)
                    weight = rule_config.get("weight", 0.1)
                    
                    if age_days < min_days:
                        score = (1 - age_days / min_days) * 50 * weight
                        return score, f"地址创建仅 {age_days} 天"
                except (ValueError, TypeError):
                    pass
        except BlockscoutAPIError as e:
            logger.warning(f"Failed to check address age: {e}")
        
        return 0, ""
    
    async def _check_large_transfers(
        self,
        address: str,
        rule_config: Dict[str, Any]
    ) -> Tuple[float, str]:
        """检查大额转账"""
        threshold_eth = rule_config.get("threshold_eth", 100)
        threshold_wei = int(threshold_eth * 10**18)
        weight = rule_config.get("weight", 0.15)
        
        # 查询最近的大额交易
        result = await self.db.execute(
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
            score = min(max_value / threshold_eth * 30, 100) * weight
            return score, f"发现 {len(large_txs)} 笔大额交易，最大 {max_value:.2f} ETH"
        
        return 0, ""
    
    async def calculate_address_risk(
        self,
        address: str,
        chain: str = "ethereum",
        force_refresh: bool = False
    ) -> Tuple[float, RiskLevel, List[RiskFactor]]:
        """
        计算地址风险评分
        
        Args:
            address: 区块链地址
            chain: 链类型
            force_refresh: 是否强制刷新
            
        Returns:
            (风险评分, 风险等级, 风险因子列表)
        """
        logger.info(f"Calculating risk for address: {address}")
        
        try:
            # 检查现有记录
            if not force_refresh:
                result = await self.db.execute(
                    select(AddressRisk)
                    .where(
                        AddressRisk.address == address,
                        AddressRisk.chain == chain
                    )
                )
                existing = result.scalar_one_or_none()
                
                if existing and existing.last_updated_at:
                    # 检查缓存是否有效（5分钟内）
                    if datetime.now(timezone.utc) - existing.last_updated_at.replace(tzinfo=None) < timedelta(minutes=5):
                        logger.info(f"Using cached risk data for {address}")
                        factors = existing.risk_factors or []
                        return existing.risk_score, existing.risk_level, [
                            RiskFactor(**f) for f in factors
                        ]
            
            # 获取活跃规则
            rules = await self._get_active_rules()
            
            # 计算各项风险因子
            risk_factors: List[RiskFactor] = []
            total_score = 0.0
            
            for rule in rules:
                score = 0.0
                description = ""
                
                if rule.name == "reported_address":
                    score, description = await self._check_reported_address(
                        address, rule.condition
                    )
                elif rule.name == "high_frequency_transactions":
                    score, description = await self._check_transaction_patterns(
                        address, rule.condition
                    )
                elif rule.name == "new_address":
                    score, description = await self._check_address_age(
                        address, rule.condition
                    )
                elif rule.name == "large_amount_transfer":
                    score, description = await self._check_large_transfers(
                        address, rule.condition
                    )
                elif rule.name == "contract_interaction":
                    # 简化处理，实际需要分析合约代码
                    score = 0
                else:
                    # 自定义规则处理
                    score = rule.risk_score_impact * rule.risk_weight
                
                if score > 0:
                    total_score += score
                    risk_factors.append(RiskFactor(
                        name=rule.name,
                        weight=rule.risk_weight,
                        score=score,
                        description=description or rule.description
                    ))
            
            # 确保评分在 0-100 范围内
            total_score = min(total_score, 100)
            risk_level = self._calculate_risk_level(total_score)
            
            logger.info(f"Risk calculation complete: {address} -> score={total_score}, level={risk_level}")
            
            return total_score, risk_level, risk_factors
            
        except Exception as e:
            # 发送告警
            await alert_service.send_alert(
                alert_type="address_risk_calculation_failed",
                message=f"地址风险计算失败: {address}",
                details={"address": address, "chain": chain, "force_refresh": force_refresh},
                exc=e,
            )
            logger.error(f"Risk calculation failed for {address}: {e}", exc_info=True)
            raise
    
    async def analyze_transaction(
        self,
        tx_hash: str,
        chain: str = "ethereum"
    ) -> Dict[str, Any]:
        """
        分析交易风险
        
        Args:
            tx_hash: 交易哈希
            chain: 链类型
            
        Returns:
            风险分析结果
        """
        logger.info(f"Analyzing transaction: {tx_hash}")
        
        try:
            indicators = []
            total_score = 0.0
            
            # 从 Blockscout 获取交易详情
            client = await self.blockscout
            tx_data = await client.get_transaction(tx_hash)
            
            # 分析发送方和接收方
            from_addr = tx_data.get("from", {}).get("hash", "")
            to_addr = tx_data.get("to", {}).get("hash", "")
            value_wei = int(tx_data.get("value", "0"))
            value_eth = value_wei / 10**18
            
            # 检查发送方风险
            if from_addr:
                from_score, from_level, from_factors = await self.calculate_address_risk(
                    from_addr, chain
                )
                if from_score > 50:
                    indicators.append({
                        "type": "high_risk_sender",
                        "address": from_addr,
                        "score": from_score,
                        "level": from_level.value,
                    })
                    total_score = max(total_score, from_score * 0.6)
            
            # 检查接收方风险
            if to_addr:
                to_score, to_level, to_factors = await self.calculate_address_risk(
                    to_addr, chain
                )
                if to_score > 50:
                    indicators.append({
                        "type": "high_risk_receiver",
                        "address": to_addr,
                        "score": to_score,
                        "level": to_level.value,
                    })
                    total_score = max(total_score, to_score * 0.6)
            
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
            
            # 确定风险等级
            risk_level = self._calculate_risk_level(min(total_score, 100))
            
            return {
                "tx_hash": tx_hash,
                "chain": chain,
                "risk_score": min(total_score, 100),
                "risk_level": risk_level.value,
                "indicators": indicators,
                "from_address": from_addr,
                "to_address": to_addr,
                "value_eth": value_eth,
                "analyzed_at": datetime.now(timezone.utc).isoformat(),
            }
            
        except Exception as e:
            # 发送告警
            await alert_service.send_alert(
                alert_type="transaction_analysis_failed",
                message=f"交易风险分析失败: {tx_hash}",
                details={"tx_hash": tx_hash, "chain": chain},
                exc=e,
            )
            logger.error(f"Transaction analysis failed for {tx_hash}: {e}", exc_info=True)
            raise
    
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
        event = RiskEvent(
            event_type=event_type,
            severity=severity,
            address=address,
            tx_hash=tx_hash,
            description=description,
            details=details or {},
            triggered_rules=triggered_rules or [],
            is_notified=False,
            created_at=datetime.now(timezone.utc)
        )
        
        self.db.add(event)
        await self.db.commit()
        await self.db.refresh(event)
        
        logger.info(f"Created risk event: {event.id} for address {address}")
        
        return event


# 辅助函数
from sqlalchemy import Numeric

def cast(value, type_):
    """类型转换辅助函数"""
    from sqlalchemy import cast as sql_cast
    return sql_cast(value, type_)
