"""
FidesOrigin 地址 Repository（重构版）
数据访问层：封装所有地址相关的数据库操作
"""
from typing import List, Optional
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import DatabaseException, NotFoundException
from app.core.logging import get_logger
from app.models import Address, AddressReport, AddressRisk, RiskEvent, RiskLevel, RiskStatus
from app.schemas import RiskFactor

logger = get_logger(__name__)


class AddressRepository:
    """
    地址数据访问对象
    
    职责：
    - 地址风险记录的 CRUD
    - 举报记录管理
    - 风险事件查询
    - 分页搜索
    """
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    # ==================== 地址风险 ====================
    
    async def get_by_address(
        self,
        address: str,
        chain: str = "ethereum"
    ) -> Optional[AddressRisk]:
        """根据地址获取风险记录"""
        result = await self.db.execute(
            select(AddressRisk).where(
                AddressRisk.address == address,
                AddressRisk.chain == chain
            )
        )
        return result.scalar_one_or_none()
    
    async def get_by_id(self, risk_id: UUID) -> Optional[AddressRisk]:
        """根据 ID 获取风险记录"""
        result = await self.db.execute(
            select(AddressRisk).where(AddressRisk.id == risk_id)
        )
        return result.scalar_one_or_none()
    
    async def create_or_update(
        self,
        address: str,
        chain: str,
        risk_score: float,
        risk_level: RiskLevel,
        risk_factors: List[RiskFactor],
        status: RiskStatus = RiskStatus.PENDING
    ) -> AddressRisk:
        """创建或更新地址风险记录"""
        existing = await self.get_by_address(address, chain)
        
        if existing:
            existing.risk_score = risk_score
            existing.risk_level = risk_level
            existing.risk_factors = [f.model_dump() for f in risk_factors]
            existing.status = status
            await self.db.flush()
            await self.db.refresh(existing)
            logger.info(
                "address_risk_updated",
                address=address,
                risk_score=risk_score,
                risk_level=risk_level.value
            )
            return existing
        
        new_record = AddressRisk(
            address=address,
            chain=chain,
            risk_score=risk_score,
            risk_level=risk_level,
            risk_factors=[f.model_dump() for f in risk_factors],
            status=status,
            report_count=0
        )
        self.db.add(new_record)
        await self.db.flush()
        await self.db.refresh(new_record)
        logger.info(
            "address_risk_created",
            address=address,
            risk_score=risk_score,
            risk_level=risk_level.value
        )
        return new_record
    
    async def update_risk_score(
        self,
        address: str,
        chain: str,
        risk_score: float,
        risk_level: RiskLevel,
        risk_factors: List[RiskFactor]
    ) -> AddressRisk:
        """更新风险评分"""
        record = await self.get_by_address(address, chain)
        if not record:
            raise NotFoundException("AddressRisk", f"{address}:{chain}")
        
        record.risk_score = risk_score
        record.risk_level = risk_level
        record.risk_factors = [f.model_dump() for f in risk_factors]
        await self.db.flush()
        await self.db.refresh(record)
        return record
    
    async def increment_report_count(
        self,
        address: str,
        chain: str
    ) -> AddressRisk:
        """增加举报计数"""
        record = await self.get_by_address(address, chain)
        if record:
            record.report_count += 1
            await self.db.flush()
            await self.db.refresh(record)
            return record
        
        # 创建新记录
        new_record = AddressRisk(
            address=address,
            chain=chain,
            risk_score=30.0,
            risk_level=RiskLevel.MEDIUM,
            status=RiskStatus.PENDING,
            report_count=1
        )
        self.db.add(new_record)
        await self.db.flush()
        await self.db.refresh(new_record)
        return new_record
    
    # ==================== 搜索 ====================
    
    async def search(
        self,
        query: Optional[str] = None,
        risk_level: Optional[str] = None,
        min_score: float = 0.0,
        max_score: float = 100.0,
        page: int = 1,
        page_size: int = 20
    ) -> tuple[int, list[AddressRisk]]:
        """
        搜索地址风险记录
        
        Returns:
            (总数, 记录列表)
        """
        base_query = select(AddressRisk).where(
            AddressRisk.risk_score >= min_score,
            AddressRisk.risk_score <= max_score
        )
        
        if query:
            # [HIGH Fix #8] 转义 SQL LIKE 通配符，防止注入
            safe_query = query.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
            base_query = base_query.where(
                AddressRisk.address.ilike(f"%{safe_query}%", escape="\\")
            )
        
        if risk_level:
            try:
                level = RiskLevel(risk_level.lower())
                base_query = base_query.where(AddressRisk.risk_level == level)
            except ValueError:
                pass
        
        # 获取总数
        count_query = select(func.count()).select_from(base_query.subquery())
        total_result = await self.db.execute(count_query)
        total = total_result.scalar() or 0
        
        # 分页
        offset = (page - 1) * page_size
        result = await self.db.execute(
            base_query.order_by(AddressRisk.risk_score.desc())
            .offset(offset)
            .limit(page_size)
        )
        items = result.scalars().all()
        
        return total, list(items)
    
    # ==================== 举报 ====================
    
    async def create_report(
        self,
        address: str,
        chain: str,
        report_type: str,
        description: str,
        evidence: Optional[dict] = None,
        reporter_email: Optional[str] = None,
        reporter_wallet: Optional[str] = None
    ) -> AddressReport:
        """创建举报记录"""
        report = AddressReport(
            address=address,
            chain=chain,
            report_type=report_type,
            description=description,
            evidence=evidence,
            reporter_email=reporter_email,
            reporter_wallet=reporter_wallet,
            status="pending"
        )
        self.db.add(report)
        await self.db.flush()
        await self.db.refresh(report)
        return report
    
    async def get_pending_report_by_wallet(
        self,
        address: str,
        reporter_wallet: Optional[str] = None
    ) -> Optional[AddressReport]:
        """获取待处理的举报记录"""
        query = select(AddressReport).where(
            AddressReport.address == address,
            AddressReport.status == "pending"
        )
        if reporter_wallet:
            query = query.where(AddressReport.reporter_wallet == reporter_wallet)
        
        result = await self.db.execute(query)
        return result.scalar_one_or_none()
    
    # ==================== 风险事件 ====================
    
    async def get_events(
        self,
        address: str,
        limit: int = 20,
        severity: Optional[str] = None
    ) -> List[RiskEvent]:
        """获取地址风险事件"""
        query = select(RiskEvent).where(
            RiskEvent.address == address
        ).order_by(RiskEvent.created_at.desc()).limit(limit)
        
        if severity:
            try:
                level = RiskLevel(severity.lower())
                query = query.where(RiskEvent.severity == level)
            except ValueError:
                pass
        
        result = await self.db.execute(query)
        return list(result.scalars().all())
    
    async def create_event(
        self,
        event_type: str,
        severity: RiskLevel,
        address: str,
        description: str,
        tx_hash: Optional[str] = None,
        details: Optional[dict] = None,
        triggered_rules: Optional[list] = None
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
            is_notified=False
        )
        self.db.add(event)
        await self.db.flush()
        await self.db.refresh(event)
        return event
    
    async def get_recent_events(
        self,
        address: str,
        limit: int = 5
    ) -> List[RiskEvent]:
        """获取最近的风险事件"""
        result = await self.db.execute(
            select(RiskEvent)
            .where(RiskEvent.address == address)
            .order_by(RiskEvent.created_at.desc())
            .limit(limit)
        )
        return list(result.scalars().all())
