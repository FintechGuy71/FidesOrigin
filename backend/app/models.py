"""
FidesOrigin SQLAlchemy ORM 模型
区块链风险分析平台数据库模型
"""

import uuid
from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import Any, Dict, List, Optional

from sqlalchemy import (
    JSON,
    BigInteger,
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import ARRAY, ENUM, INET, UUID
from sqlalchemy.orm import relationship

from .database import Base


# ============================================
# 枚举类型定义
# ============================================

class RiskLevel(str, Enum):
    """风险等级枚举"""
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"
    UNKNOWN = "UNKNOWN"

class EventStatus(str, Enum):
    """事件状态枚举"""
    PENDING = "PENDING"
    CONFIRMED = "CONFIRMED"
    FALSE_POSITIVE = "FALSE_POSITIVE"
    UNDER_REVIEW = "UNDER_REVIEW"

class RuleType(str, Enum):
    """规则类型枚举"""
    PATTERN = "PATTERN"
    THRESHOLD = "THRESHOLD"
    ML_MODEL = "ML_MODEL"
    MANUAL = "MANUAL"

class AuditAction(str, Enum):
    """审计动作枚举"""
    CREATE = "CREATE"
    UPDATE = "UPDATE"
    DELETE = "DELETE"
    LOGIN = "LOGIN"
    LOGOUT = "LOGOUT"
    EXPORT = "EXPORT"

class RiskStatus(str, Enum):
    """风险状态枚举（兼容 AddressRepository）"""
    PENDING = "PENDING"
    CONFIRMED = "CONFIRMED"
    FALSE_POSITIVE = "FALSE_POSITIVE"
    UNDER_REVIEW = "UNDER_REVIEW"


# ============================================
# 核心模型
# ============================================

class APIKey(Base):
    """API密钥模型"""
    __tablename__ = "api_keys"
    
    id = Column(BigInteger, primary_key=True, index=True)
    key_hash = Column(String(255), nullable=False, unique=True)
    name = Column(String(100))
    is_active = Column(Boolean, default=True)
    rate_limit = Column(Integer, default=1000)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    last_used_at = Column(DateTime(timezone=True), nullable=True)
    request_count = Column(Integer, default=0)

    def __repr__(self):
        return f"<APIKey(id={self.id}, name={self.name}, is_active={self.is_active})>"


class Address(Base):
    """地址模型 - 存储区块链地址的基础信息、风险评分和标签"""
    __tablename__ = "addresses"
    
    id = Column(BigInteger, primary_key=True, index=True)
    address = Column(String(255), nullable=False, index=True)
    chain = Column(String(50), nullable=False, index=True)
    address_type = Column(String(50))
    
    # 风险评分
    risk_score = Column(Numeric(5, 2), default=Decimal("0.00"), index=True)
    risk_level = Column(ENUM(RiskLevel, name="risk_level"), default=RiskLevel.UNKNOWN, index=True)
    risk_factors = Column(JSON, default=dict)
    
    # 标签系统
    tags = Column(ARRAY(String), default=list)
    entity_name = Column(String(255), index=True)
    entity_category = Column(String(100))
    
    # 统计数据
    total_transactions = Column(Integer, default=0)
    total_volume_usd = Column(Numeric(24, 8), default=Decimal("0"))
    first_seen_at = Column(DateTime(timezone=True))
    last_seen_at = Column(DateTime(timezone=True))
    
    # 元数据存储（使用 meta_info 避免与 SQLAlchemy 的 metadata 冲突）
    meta_info = Column(JSON, default=dict)
    
    # 审计字段
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    created_by = Column(String(255), default="system")
    updated_by = Column(String(255), default="system")
    
    # 软删除
    deleted_at = Column(DateTime(timezone=True))
    is_active = Column(Boolean, default=True)
    
    # 关系
    incoming_transactions = relationship(
        "Transaction",
        foreign_keys="Transaction.to_address_id",
        back_populates="to_address_obj",
        lazy="dynamic"
    )
    outgoing_transactions = relationship(
        "Transaction",
        foreign_keys="Transaction.from_address_id",
        back_populates="from_address_obj",
        lazy="dynamic"
    )
    risk_events = relationship("RiskEvent", back_populates="address_obj", lazy="dynamic")
    
    __table_args__ = (
        UniqueConstraint("address", "chain", name="uix_address_chain"),
        Index("ix_addresses_risk_score_active", "risk_score", postgresql_where="deleted_at IS NULL"),
        Index("ix_addresses_tags", "tags", postgresql_using="gin"),
    )
    
    def __repr__(self):
        return f"<Address(id={self.id}, address={self.address}, chain={self.chain})>"
    
    # 提供 metadata 属性的兼容访问
    @property
    def extra_metadata(self):
        return self.meta_info
    
    @extra_metadata.setter
    def extra_metadata(self, value):
        self.meta_info = value


class AddressRisk(Base):
    """地址风险记录（兼容 AddressRepository）"""
    __tablename__ = "address_risks"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    address = Column(String(255), nullable=False, index=True)
    chain = Column(String(50), nullable=False, default="ethereum")
    
    risk_score = Column(Numeric(5, 2), default=Decimal("0.00"))
    risk_level = Column(String(20), default="LOW")
    risk_factors = Column(JSON, default=list)
    
    status = Column(String(50), default=RiskStatus.PENDING)
    report_count = Column(Integer, default=0)
    tags = Column(JSON, default=list)
    first_seen_at = Column(DateTime(timezone=True), nullable=True)
    last_updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    __table_args__ = (
        UniqueConstraint("address", "chain", name="uix_address_risk_address_chain"),
    )


class AddressReport(Base):
    """地址举报记录（兼容 AddressRepository）"""
    __tablename__ = "address_reports"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    address = Column(String(255), nullable=False, index=True)
    chain = Column(String(50), nullable=False, default="ethereum")
    
    report_type = Column(String(100), nullable=False)
    description = Column(Text)
    evidence = Column(JSON, default=dict)
    
    reporter_email = Column(String(255))
    reporter_wallet = Column(String(255))
    status = Column(String(50), default="pending")
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class Transaction(Base):
    """交易模型 - 存储区块链交易数据和风险分析结果"""
    __tablename__ = "transactions"
    
    id = Column(BigInteger, primary_key=True, index=True)
    tx_hash = Column(String(255), nullable=False, index=True)
    chain = Column(String(50), nullable=False, index=True)
    
    # 交易参与方
    from_address = Column(String(255), nullable=False)
    to_address = Column(String(255), nullable=False)
    from_address_id = Column(BigInteger, ForeignKey("addresses.id", ondelete="SET NULL"))
    to_address_id = Column(BigInteger, ForeignKey("addresses.id", ondelete="SET NULL"))
    
    # 交易金额
    value = Column(Numeric(36, 18), nullable=False)
    value_usd = Column(Numeric(24, 8))
    token_symbol = Column(String(50))
    token_address = Column(String(255))
    
    # 区块信息
    block_number = Column(BigInteger, nullable=False, index=True)
    block_hash = Column(String(255))
    block_timestamp = Column(DateTime(timezone=True))
    
    # 风险评分
    risk_score = Column(Numeric(5, 2), default=Decimal("0.00"))
    risk_level = Column(ENUM(RiskLevel, name="risk_level"), default=RiskLevel.UNKNOWN)
    risk_factors = Column(JSON, default=dict)
    
    # Gas信息
    gas_used = Column(BigInteger)
    gas_price = Column(Numeric(36, 18))
    tx_fee_usd = Column(Numeric(24, 8))
    
    # 状态
    status = Column(String(50), default="confirmed")
    is_suspicious = Column(Boolean, default=False)
    
    # 审计字段
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # 关系
    from_address_obj = relationship("Address", foreign_keys=[from_address_id], back_populates="outgoing_transactions")
    to_address_obj = relationship("Address", foreign_keys=[to_address_id], back_populates="incoming_transactions")
    
    __table_args__ = (
        UniqueConstraint("tx_hash", "chain", name="uix_tx_hash_chain"),
        Index("ix_transactions_from_address_chain", "from_address", "chain"),
        Index("ix_transactions_to_address_chain", "to_address", "chain"),
        Index("ix_transactions_block_timestamp", "block_timestamp"),
        Index("ix_transactions_risk_score", "risk_score"),
    )
    
    def __repr__(self):
        return f"<Transaction(id={self.id}, tx_hash={self.tx_hash}, chain={self.chain})>"


class RiskRule(Base):
    """风险规则模型"""
    __tablename__ = "risk_rules"
    
    id = Column(BigInteger, primary_key=True, index=True)
    name = Column(String(255), nullable=False, unique=True)
    description = Column(Text)
    rule_type = Column(ENUM(RuleType, name="rule_type"), default=RuleType.PATTERN)
    category = Column(String(100), index=True)
    
    # 规则配置
    pattern = Column(String(500))
    threshold_value = Column(Numeric(24, 8))
    risk_score_increment = Column(Numeric(5, 2), default=Decimal("0"))
    
    # 新增字段以兼容测试和API
    condition = Column(JSON, default=dict)
    risk_weight = Column(Numeric(5, 2), default=Decimal("1.0"))
    risk_score_impact = Column(Numeric(5, 2), default=Decimal("0"))
    tags = Column(ARRAY(String), default=list)
    
    # 状态
    is_active = Column(Boolean, default=True)
    priority = Column(Integer, default=100)
    
    # 审计字段
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    created_by = Column(String(255), default="system")
    updated_by = Column(String(255))
    
    __table_args__ = (
        Index("ix_risk_rules_active_type", "is_active", "rule_type"),
    )
    
    def __repr__(self):
        return f"<RiskRule(id={self.id}, name={self.name}, type={self.rule_type})>"


class RiskEvent(Base):
    """风险事件模型"""
    __tablename__ = "risk_events"
    
    id = Column(BigInteger, primary_key=True, index=True)
    event_type = Column(String(100), nullable=False, index=True)
    severity = Column(ENUM(RiskLevel, name="risk_level"), default=RiskLevel.UNKNOWN)
    
    # 关联地址
    address = Column(String(255), nullable=False, index=True)
    address_id = Column(BigInteger, ForeignKey("addresses.id", ondelete="CASCADE"))
    
    # 事件详情
    description = Column(Text)
    tx_hash = Column(String(255), index=True)
    details = Column(JSON, default=dict)
    triggered_rules = Column(ARRAY(String), default=list)
    
    # 状态
    status = Column(ENUM(EventStatus, name="event_status"), default=EventStatus.PENDING)
    is_notified = Column(Boolean, default=False)
    assigned_to = Column(String(255))
    resolved_at = Column(DateTime(timezone=True))
    resolution_notes = Column(Text)
    
    # 元数据
    event_metadata = Column(JSON, default=dict)
    
    # 审计字段
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    detected_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    
    # 关系
    address_obj = relationship("Address", back_populates="risk_events")
    
    __table_args__ = (
        Index("ix_risk_events_level_detected", "severity", "detected_at"),
    )
    
    def __repr__(self):
        return f"<RiskEvent(id={self.id}, type={self.event_type}, severity={self.severity})>"


class AuditLog(Base):
    """审计日志模型"""
    __tablename__ = "audit_logs"
    
    id = Column(BigInteger, primary_key=True, index=True)
    action = Column(ENUM(AuditAction, name="audit_action"), nullable=False)
    entity_type = Column(String(100), nullable=False)
    entity_id = Column(String(255))
    
    # 操作详情
    description = Column(Text)
    old_values = Column(JSON)
    new_values = Column(JSON)
    
    # 操作者信息
    user_id = Column(String(255), index=True)
    user_email = Column(String(255))
    ip_address = Column(INET)
    user_agent = Column(Text)
    
    # 审计字段
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    
    __table_args__ = (
        Index("ix_audit_logs_user_action", "user_id", "action"),
        Index("ix_audit_logs_entity", "entity_type", "entity_id"),
    )
    
    def __repr__(self):
        return f"<AuditLog(id={self.id}, action={self.action}, entity={self.entity_type})>"


class SanctionsList(Base):
    """制裁名单模型"""
    __tablename__ = "sanctions_lists"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    address = Column(String(255), nullable=False, index=True)
    chain = Column(String(50), nullable=False, index=True)
    source = Column(String(100), nullable=False, index=True)
    list_name = Column(String(255))
    entity_name = Column(String(255))
    entity_type = Column(String(100))
    programs = Column(ARRAY(String), default=list)
    published_at = Column(DateTime(timezone=True))
    sanctions_metadata = Column(JSON, default=dict)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    __table_args__ = (
        UniqueConstraint("address", "chain", "source", name="uix_sanctions_address_chain_source"),
    )
    
    def __repr__(self):
        return f"<SanctionsList(id={self.id}, address={self.address}, source={self.source})>"


class AddressRelationship(Base):
    """地址关联模型"""
    __tablename__ = "address_relationships"
    
    id = Column(BigInteger, primary_key=True, index=True)
    source_address_id = Column(BigInteger, ForeignKey("addresses.id", ondelete="CASCADE"), nullable=False)
    target_address_id = Column(BigInteger, ForeignKey("addresses.id", ondelete="CASCADE"), nullable=False)
    relationship_type = Column(String(100), nullable=False, index=True)
    strength = Column(Numeric(5, 2))
    evidence = Column(JSON, default=dict)
    first_seen_at = Column(DateTime(timezone=True), server_default=func.now())
    last_seen_at = Column(DateTime(timezone=True), server_default=func.now())
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    __table_args__ = (
        UniqueConstraint(
            "source_address_id",
            "target_address_id",
            "relationship_type",
            name="uix_addr_rel_source_target_type"
        ),
    )
    
    def __repr__(self):
        return f"<AddressRelationship(id={self.id}, type={self.relationship_type})>"
