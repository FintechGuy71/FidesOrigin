"""
FidesOrigin 交易 Repository（重构版）
数据访问层：封装所有交易相关的数据库操作
"""
from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import DatabaseException, NotFoundException
from app.core.logging import get_logger
from app.models import RiskLevel, Transaction

logger = get_logger(__name__)


class TransactionRepository:
    """
    交易数据访问对象
    
    职责：
    - 交易记录的 CRUD
    - 按地址查询交易
    - 分页列表
    - 风险评分更新
    """
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    # ==================== CRUD ====================
    
    async def get_by_tx_hash(
        self,
        tx_hash: str,
        chain: str = "ethereum"
    ) -> Optional[Transaction]:
        """根据交易哈希获取记录"""
        result = await self.db.execute(
            select(Transaction).where(
                Transaction.tx_hash == tx_hash,
                Transaction.chain == chain
            )
        )
        return result.scalar_one_or_none()
    
    async def get_by_id(self, tx_id: UUID) -> Optional[Transaction]:
        """根据 ID 获取记录"""
        result = await self.db.execute(
            select(Transaction).where(Transaction.id == tx_id)
        )
        return result.scalar_one_or_none()
    
    async def create(
        self,
        tx_hash: str,
        chain: str,
        address: str,
        from_address: str,
        to_address: str,
        value: str,
        block_number: int = 0,
        block_timestamp: Optional[datetime] = None,
        risk_score: float = 0,
        risk_level: RiskLevel = RiskLevel.LOW,
        risk_indicators: Optional[list] = None,
        status: str = "pending",
        gas_price: Optional[str] = None,
        gas_used: Optional[int] = None
    ) -> Transaction:
        """创建交易记录"""
        tx = Transaction(
            tx_hash=tx_hash,
            chain=chain,
            address=address,
            from_address=from_address,
            to_address=to_address,
            value=value,
            block_number=block_number,
            block_timestamp=block_timestamp or datetime.now(timezone.utc),
            risk_score=risk_score,
            risk_level=risk_level,
            risk_indicators=risk_indicators or [],
            status=status,
            gas_price=gas_price,
            gas_used=gas_used,
            analyzed_at=datetime.now(timezone.utc)
        )
        self.db.add(tx)
        await self.db.flush()
        await self.db.refresh(tx)
        logger.info(
            "transaction_created",
            tx_hash=tx_hash,
            risk_score=risk_score,
            risk_level=risk_level.value
        )
        return tx
    
    async def update_risk(
        self,
        tx_hash: str,
        chain: str,
        risk_score: float,
        risk_level: RiskLevel,
        risk_indicators: list
    ) -> Transaction:
        """更新交易风险评分"""
        tx = await self.get_by_tx_hash(tx_hash, chain)
        if not tx:
            raise NotFoundException("Transaction", tx_hash)
        
        tx.risk_score = risk_score
        tx.risk_level = risk_level
        tx.risk_indicators = risk_indicators
        tx.analyzed_at = datetime.now(timezone.utc)
        await self.db.flush()
        await self.db.refresh(tx)
        return tx
    
    # ==================== 列表查询 ====================
    
    async def list(
        self,
        chain: str = "ethereum",
        address: Optional[str] = None,
        min_risk_score: float = 0.0,
        max_risk_score: float = 100.0,
        page: int = 1,
        page_size: int = 20
    ) -> tuple[int, list[Transaction]]:
        """
        获取交易列表
        
        Returns:
            (总数, 记录列表)
        """
        query = select(Transaction).where(
            Transaction.chain == chain,
            Transaction.risk_score >= min_risk_score,
            Transaction.risk_score <= max_risk_score
        )
        
        if address:
            query = query.where(
                (Transaction.from_address == address) |
                (Transaction.to_address == address)
            )
        
        # 获取总数
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await self.db.execute(count_query)
        total = total_result.scalar() or 0
        
        # 分页
        offset = (page - 1) * page_size
        result = await self.db.execute(
            query.order_by(Transaction.block_timestamp.desc())
            .offset(offset)
            .limit(page_size)
        )
        items = result.scalars().all()
        
        return total, list(items)
    
    async def get_recent_by_address(
        self,
        address: str,
        chain: str = "ethereum",
        limit: int = 50
    ) -> List[Transaction]:
        """获取地址的最近交易"""
        result = await self.db.execute(
            select(Transaction)
            .where(
                Transaction.chain == chain,
                (Transaction.from_address == address) |
                (Transaction.to_address == address)
            )
            .order_by(Transaction.block_timestamp.desc())
            .limit(limit)
        )
        return list(result.scalars().all())
    
    async def count_by_address(
        self,
        address: str,
        chain: str = "ethereum"
    ) -> int:
        """统计地址的交易数量"""
        result = await self.db.execute(
            select(func.count()).where(
                Transaction.chain == chain,
                (Transaction.from_address == address) |
                (Transaction.to_address == address)
            )
        )
        return result.scalar() or 0
    
    async def get_new_since(
        self,
        since: datetime,
        chain: str = "ethereum"
    ) -> List[Transaction]:
        """获取指定时间后的新交易"""
        result = await self.db.execute(
            select(Transaction)
            .where(
                Transaction.chain == chain,
                Transaction.created_at > since
            )
            .order_by(Transaction.created_at.asc())
        )
        return list(result.scalars().all())
