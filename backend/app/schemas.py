"""
FidesOrigin Pydantic 数据模型（用于 API 请求/响应）
"""
from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


# ==================== 基础响应模型 ====================

class BaseResponse(BaseModel):
    """基础响应模型"""
    model_config = ConfigDict(from_attributes=True)


class PaginatedResponse(BaseModel):
    """分页响应模型"""
    total: int = Field(..., description="总记录数")
    page: int = Field(..., description="当前页码")
    page_size: int = Field(..., description="每页大小")
    pages: int = Field(..., description="总页数")
    items: List[Any] = Field(..., description="数据列表")


# ==================== 地址风险相关模型 ====================

class RiskFactor(BaseModel):
    """风险因子模型"""
    name: str = Field(..., description="因子名称")
    weight: float = Field(..., ge=0, le=1, description="权重")
    score: float = Field(..., ge=0, le=100, description="评分")
    description: Optional[str] = Field(None, description="描述")


class AddressRiskBase(BaseModel):
    """地址风险基础模型"""
    address: str = Field(..., min_length=42, max_length=42, description="区块链地址")
    chain: str = Field(default="ethereum", description="链类型")


class AddressRiskCreate(AddressRiskBase):
    """创建地址风险记录"""
    pass


class AddressRiskResponse(BaseResponse):
    """地址风险响应模型"""
    id: UUID
    address: str
    chain: str
    risk_score: float = Field(..., ge=0, le=100, description="风险评分 0-100")
    risk_level: str = Field(..., description="风险等级: low/medium/high/critical")
    risk_factors: List[RiskFactor] = Field(default_factory=list, description="风险因子")
    status: str = Field(..., description="风险状态")
    tags: List[str] = Field(default_factory=list, description="标签")
    report_count: int = Field(default=0, description="被报告次数")
    first_seen_at: Optional[datetime] = None
    last_updated_at: Optional[datetime] = None
    created_at: Optional[datetime] = None


class AddressRiskDetailResponse(AddressRiskResponse):
    """地址风险详情响应"""
    transactions_count: int = Field(default=0, description="关联交易数")
    recent_events: List["RiskEventResponse"] = Field(default_factory=list, description="最近风险事件")


class AddressRiskReportRequest(BaseModel):
    """上报可疑地址请求"""
    address: str = Field(..., min_length=42, max_length=42, description="可疑地址")
    chain: str = Field(default="ethereum", description="链类型")
    report_type: str = Field(..., description="报告类型: scam/phishing/hack/etc")
    description: str = Field(..., min_length=10, max_length=5000, description="详细描述")
    evidence: Optional[Dict[str, Any]] = Field(default=None, description="证据信息")
    reporter_email: Optional[str] = Field(None, description="报告人邮箱")
    reporter_wallet: Optional[str] = Field(None, description="报告人钱包地址")
    
    @field_validator('address')
    @classmethod
    def validate_address(cls, v: str) -> str:
        if not v.startswith('0x'):
            raise ValueError('地址必须以 0x 开头')
        if len(v) != 42:
            raise ValueError('地址长度必须为 42 个字符')
        return v.lower()


class AddressRiskReportResponse(BaseResponse):
    """上报可疑地址响应"""
    id: UUID
    address: str
    status: str = Field(..., description="处理状态")
    message: str = Field(..., description="提示信息")
    created_at: datetime


# ==================== 交易相关模型 ====================

class TransactionBase(BaseModel):
    """交易基础模型"""
    tx_hash: str = Field(..., description="交易哈希")
    chain: str = Field(default="ethereum", description="链类型")


class TransactionResponse(BaseResponse):
    """交易响应模型"""
    id: int  # 改为 int 匹配 BigInteger
    tx_hash: str
    chain: str
    address: str
    from_address: str
    to_address: str
    value: str = Field(..., description="交易金额（wei）")
    value_eth: float = Field(..., description="交易金额（ETH）")
    gas_price: Optional[str] = None
    gas_used: Optional[int] = None
    block_number: int
    block_timestamp: datetime
    risk_score: float = Field(..., ge=0, le=100)
    risk_level: str
    risk_indicators: List[Dict[str, Any]] = Field(default_factory=list)
    status: str
    analyzed_at: Optional[datetime] = None
    created_at: datetime


class TransactionRiskResponse(BaseResponse):
    """交易风险响应"""
    tx_hash: str
    chain: str
    risk_score: float = Field(..., ge=0, le=100)
    risk_level: str
    indicators: List[Dict[str, Any]] = Field(default_factory=list, description="风险指标")
    related_addresses: List[AddressRiskResponse] = Field(default_factory=list, description="关联地址风险")
    analysis_summary: str = Field(..., description="分析摘要")


class TransactionMonitorRequest(BaseModel):
    """交易监控请求"""
    addresses: List[str] = Field(..., min_length=1, max_length=100, description="要监控的地址列表")
    min_risk_level: str = Field(default="medium", description="最小风险等级")
    include_pending: bool = Field(default=True, description="是否包含待确认交易")


# ==================== 风险规则相关模型 ====================

class RiskRuleBase(BaseModel):
    """风险规则基础模型"""
    name: str = Field(..., min_length=3, max_length=100, description="规则名称")
    description: Optional[str] = Field(None, max_length=1000, description="规则描述")
    rule_type: str = Field(..., description="规则类型")
    category: str = Field(..., description="规则类别")
    condition: Dict[str, Any] = Field(..., description="规则条件配置")
    risk_weight: float = Field(default=1.0, ge=0, le=10, description="风险权重")
    risk_score_impact: float = Field(default=0.0, ge=-100, le=100, description="风险评分影响")
    priority: int = Field(default=100, ge=1, le=1000, description="优先级")


class RiskRuleCreate(RiskRuleBase):
    """创建风险规则"""
    pass


class RiskRuleUpdate(BaseModel):
    """更新风险规则"""
    name: Optional[str] = Field(None, min_length=3, max_length=100)
    description: Optional[str] = Field(None, max_length=1000)
    condition: Optional[Dict[str, Any]] = None
    risk_weight: Optional[float] = Field(None, ge=0, le=10)
    risk_score_impact: Optional[float] = Field(None, ge=-100, le=100)
    is_active: Optional[bool] = None
    priority: Optional[int] = Field(None, ge=1, le=1000)
    tags: Optional[List[str]] = None


class RiskRuleResponse(BaseResponse):
    """风险规则响应"""
    id: int
    name: str
    description: Optional[str]
    rule_type: str
    category: str
    condition: Optional[Dict[str, Any]] = None
    risk_weight: Optional[float] = None
    risk_score_impact: Optional[float] = None
    is_active: bool
    priority: int
    tags: Optional[List[str]] = None
    created_by: Optional[str]
    updated_by: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class RiskRuleListResponse(BaseModel):
    """风险规则列表响应"""
    total: int
    items: List[RiskRuleResponse]


# ==================== 风险事件相关模型 ====================

class RiskEventResponse(BaseResponse):
    """风险事件响应"""
    id: UUID
    event_type: str
    severity: str
    address: str
    tx_hash: Optional[str]
    description: str
    details: Dict[str, Any]
    triggered_rules: List[str]
    is_notified: bool
    created_at: datetime


# ==================== 监控相关模型 ====================

class MonitorStreamMessage(BaseModel):
    """监控流消息"""
    type: str = Field(..., description="消息类型: transaction/risk_alert/system")
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    data: Dict[str, Any] = Field(..., description="消息数据")


class MonitorSubscription(BaseModel):
    """监控订阅配置"""
    addresses: List[str] = Field(default_factory=list, description="订阅的地址")
    min_risk_score: float = Field(default=0.0, ge=0, le=100, description="最小风险评分")
    event_types: List[str] = Field(default_factory=lambda: ["high_risk_transaction"], description="事件类型")


# ==================== 通用模型 ====================

class HealthCheckResponse(BaseModel):
    """健康检查响应"""
    status: str = Field(..., description="服务状态")
    version: str = Field(..., description="版本号")
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    database: str = Field(..., description="数据库状态")
    services: Dict[str, str] = Field(default_factory=dict, description="服务状态")


class ErrorResponse(BaseModel):
    """错误响应"""
    error: str = Field(..., description="错误类型")
    message: str = Field(..., description="错误消息")
    details: Optional[Dict[str, Any]] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class APIInfoResponse(BaseModel):
    """API 信息响应"""
    name: str
    version: str
    description: str
    docs_url: str
    endpoints: Dict[str, str]
