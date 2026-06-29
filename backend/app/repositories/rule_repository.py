"""
FidesOrigin 规则 Repository（重构版）
数据访问层：封装所有风险规则相关的数据库操作
"""
from typing import List, Optional, Tuple, Tuple
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictException, DatabaseException, NotFoundException
from app.core.logging import get_logger
from app.models import RiskRule

logger = get_logger(__name__)


class RuleRepository:
    """
    风险规则数据访问对象
    
    职责：
    - 风险规则的 CRUD
    - 按类别/类型过滤
    - 名称唯一性检查
    - 状态切换
    """
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    # ==================== CRUD ====================
    
    async def get_by_id(self, rule_id: int) -> Optional[RiskRule]:
        """根据 ID 获取规则"""
        result = await self.db.execute(
            select(RiskRule).where(RiskRule.id == rule_id)
        )
        return result.scalar_one_or_none()
    
    async def get_by_name(self, name: str) -> Optional[RiskRule]:
        """根据名称获取规则"""
        result = await self.db.execute(
            select(RiskRule).where(RiskRule.name == name)
        )
        return result.scalar_one_or_none()
    
    async def create(
        self,
        name: str,
        description: Optional[str] = None,
        rule_type: str = "",
        category: str = "",
        condition: dict = None,
        risk_weight: float = 1.0,
        risk_score_impact: float = 0.0,
        priority: int = 100,
        tags: List[str] = None,
        created_by: str = "system"
    ) -> RiskRule:
        """创建规则"""
        # 检查名称是否已存在
        existing = await self.get_by_name(name)
        if existing:
            raise ConflictException(f"Rule name already exists: {name}")
        
        rule = RiskRule(
            name=name,
            description=description,
            rule_type=rule_type,
            category=category,
            condition=condition or {},
            risk_weight=risk_weight,
            risk_score_impact=risk_score_impact,
            priority=priority,
            is_active=True,
            tags=tags or [],
            created_by=created_by
        )
        self.db.add(rule)
        await self.db.flush()
        await self.db.refresh(rule)
        logger.info("rule_created", rule_id=str(rule.id), name=name, created_by=created_by)
        return rule
    
    async def update(
        self,
        rule_id: int,
        name: Optional[str] = None,
        description: Optional[str] = None,
        condition: Optional[dict] = None,
        risk_weight: Optional[float] = None,
        risk_score_impact: Optional[float] = None,
        is_active: Optional[bool] = None,
        priority: Optional[int] = None,
        tags: Optional[List[str]] = None,
        updated_by: str = "system"
    ) -> RiskRule:
        """更新规则"""
        rule = await self.get_by_id(rule_id)
        if not rule:
            raise NotFoundException("RiskRule", str(rule_id))
        
        # 检查名称冲突
        if name and name != rule.name:
            existing = await self.get_by_name(name)
            if existing and existing.id != rule_id:
                raise ConflictException(f"Rule name already exists: {name}")
            rule.name = name
        
        if description is not None:
            rule.description = description
        if condition is not None:
            rule.condition = condition
        if risk_weight is not None:
            rule.risk_weight = risk_weight
        if risk_score_impact is not None:
            rule.risk_score_impact = risk_score_impact
        if is_active is not None:
            rule.is_active = is_active
        if priority is not None:
            rule.priority = priority
        if tags is not None:
            rule.tags = tags
        
        rule.updated_by = updated_by
        await self.db.flush()
        await self.db.refresh(rule)
        logger.info("rule_updated", rule_id=str(rule_id), name=rule.name, updated_by=updated_by)
        return rule
    
    async def delete(self, rule_id: int) -> None:
        """删除规则"""
        rule = await self.get_by_id(rule_id)
        if not rule:
            raise NotFoundException("RiskRule", str(rule_id))
        
        await self.db.delete(rule)
        await self.db.flush()
        logger.info("rule_deleted", rule_id=str(rule_id), name=rule.name)
    
    async def toggle(self, rule_id: UUID, updated_by: str = "system") -> RiskRule:
        """切换规则状态"""
        rule = await self.get_by_id(rule_id)
        if not rule:
            raise NotFoundException("RiskRule", str(rule_id))
        
        rule.is_active = not rule.is_active
        rule.updated_by = updated_by
        await self.db.flush()
        await self.db.refresh(rule)
        logger.info(
            "rule_toggled",
            rule_id=str(rule_id),
            name=rule.name,
            is_active=rule.is_active,
            updated_by=updated_by
        )
        return rule
    
    # ==================== 列表查询 ====================
    
    async def list(
        self,
        active_only: bool = True,
        category: Optional[str] = None,
        rule_type: Optional[str] = None,
        page: int = 1,
        page_size: int = 20
    ) -> Tuple[int, List[RiskRule]]:
        """
        获取规则列表
        
        Returns:
            (总数, 规则列表)
        """
        query = select(RiskRule)
        
        if active_only:
            query = query.where(RiskRule.is_active == True)
        
        if category:
            query = query.where(RiskRule.category == category)
        
        if rule_type:
            query = query.where(RiskRule.rule_type == rule_type)
        
        # 获取总数
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await self.db.execute(count_query)
        total = total_result.scalar() or 0
        
        # 分页
        offset = (page - 1) * page_size
        result = await self.db.execute(
            query.order_by(RiskRule.priority, RiskRule.name)
            .offset(offset)
            .limit(page_size)
        )
        items = result.scalars().all()
        
        return total, list(items)
    
    async def get_active_rules(self) -> List[RiskRule]:
        """获取所有活跃规则（按优先级排序）"""
        result = await self.db.execute(
            select(RiskRule)
            .where(RiskRule.is_active == True)
            .order_by(RiskRule.priority)
        )
        return list(result.scalars().all())
    
    async def get_categories(self) -> List[str]:
        """获取所有规则类别"""
        result = await self.db.execute(
            select(RiskRule.category).distinct()
        )
        return [row[0] for row in result.all() if row[0]]
    
    async def get_types(self) -> List[str]:
        """获取所有规则类型"""
        result = await self.db.execute(
            select(RiskRule.rule_type).distinct()
        )
        return [row[0] for row in result.all() if row[0]]
