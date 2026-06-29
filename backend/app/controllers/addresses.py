"""
FidesOrigin 地址 Controller（重构版）
API 层：处理 HTTP 请求，委托 Service 层处理业务逻辑
"""
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.di import get_db, get_risk_engine
from app.core.exceptions import (
    ConflictException,
    FidesException,
    NotFoundException,
    ValidationException,
)
from app.core.logging import get_logger
from app.schemas import (
    AddressRiskDetailResponse,
    AddressRiskReportRequest,
    AddressRiskReportResponse,
    AddressRiskResponse,
    ErrorResponse,
    PaginatedResponse,
    RiskEventResponse,
)
from app.services.risk_engine_service import RiskEngineService
from app.validators import validate_address

logger = get_logger(__name__)
router = APIRouter(prefix="/api/v1/address", tags=["地址风险"])


from app.core.security import get_current_user


@router.get(
    "/{address}/risk",
    response_model=AddressRiskDetailResponse,
    summary="查询地址风险评分",
    description="获取指定地址的风险评分、风险等级和详细分析",
    responses={
        200: {"description": "成功获取风险信息"},
        400: {"model": ErrorResponse, "description": "地址格式错误"},
        401: {"model": ErrorResponse, "description": "未授权"},
        404: {"model": ErrorResponse, "description": "地址未找到"},
        429: {"model": ErrorResponse, "description": "请求过于频繁"},
        500: {"model": ErrorResponse, "description": "服务器内部错误"},
    }
)
async def get_address_risk(
    address: str,
    chain: str = Query(default="ethereum", description="链类型"),
    force_refresh: bool = Query(default=False, description="强制刷新风险数据"),
    db: AsyncSession = Depends(get_db),
    engine: RiskEngineService = Depends(get_risk_engine),
    current_user: str = Depends(get_current_user)
):
    """
    查询地址风险评分
    
    - **address**: 区块链地址 (0x...)
    - **chain**: 链类型，默认为 ethereum
    - **force_refresh**: 是否强制刷新缓存数据
    """
    address = validate_address(address)
    
    try:
        # 计算风险评分
        risk_score, risk_level, risk_factors = await engine.calculate_address_risk(
            address, chain, force_refresh=force_refresh
        )
        
        # 获取风险记录（刚创建/更新的）
        from app.core.di import get_container
        repo = get_container().get_address_repository(db)
        address_risk = await repo.get_by_address(address, chain)
        
        if not address_risk:
            raise NotFoundException("AddressRisk", f"{address}:{chain}")
        
        # 获取交易数量
        tx_count = await get_container().get_transaction_repository(db).count_by_address(address, chain)
        
        # 获取最近风险事件
        recent_events = await repo.get_recent_events(address, limit=5)
        
        return AddressRiskDetailResponse(
            id=address_risk.id,
            address=address_risk.address,
            chain=address_risk.chain,
            risk_score=risk_score,
            risk_level=risk_level.value,
            risk_factors=risk_factors,
            status=address_risk.status.value if hasattr(address_risk.status, 'value') else address_risk.status,
            tags=address_risk.tags or [],
            report_count=address_risk.report_count,
            first_seen_at=address_risk.first_seen_at,
            last_updated_at=address_risk.last_updated_at,
            created_at=address_risk.created_at,
            transactions_count=tx_count,
            recent_events=[
                RiskEventResponse.model_validate(e) for e in recent_events
            ]
        )
        
    except FidesException:
        raise
    except Exception as e:
        logger.error("get_address_risk_failed", address=address, error_type=type(e).__name__)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="获取地址风险信息失败"
        )


@router.post(
    "/{address}/report",
    response_model=AddressRiskReportResponse,
    status_code=status.HTTP_201_CREATED,
    summary="上报可疑地址",
    description="用户上报可疑地址，系统将进行审核",
    responses={
        201: {"description": "上报成功"},
        400: {"model": ErrorResponse, "description": "请求参数错误"},
        401: {"model": ErrorResponse, "description": "未授权"},
        409: {"model": ErrorResponse, "description": "重复上报"},
        429: {"model": ErrorResponse, "description": "请求过于频繁"},
        500: {"model": ErrorResponse, "description": "服务器内部错误"},
    }
)
async def report_address(
    address: str,
    report: AddressRiskReportRequest,
    db: AsyncSession = Depends(get_db),
    current_user: str = Depends(get_current_user)
):
    """
    上报可疑地址
    
    - **address**: 要举报的地址
    - **report_type**: 报告类型 (scam/phishing/hack/mixer/etc)
    - **description**: 详细描述
    - **evidence**: 证据信息（可选）
    """
    address = validate_address(address)
    
    try:
        from app.core.di import get_container
        repo = get_container().get_address_repository(db)
        
        # 检查是否已存在相同的上报
        existing = await repo.get_pending_report_by_wallet(
            address, report.reporter_wallet
        )
        
        if existing:
            raise ConflictException("该地址已有待处理的举报记录")
        
        # 创建举报记录
        address_report = await repo.create_report(
            address=address,
            chain=report.chain,
            report_type=report.report_type,
            description=report.description,
            evidence=report.evidence,
            reporter_email=report.reporter_email,
            reporter_wallet=report.reporter_wallet
        )
        
        # 更新地址举报计数
        await repo.increment_report_count(address, report.chain)
        
        logger.info(
            "address_reported",
            address=address,
            type=report.report_type,
            report_id=str(address_report.id)
        )
        
        return AddressRiskReportResponse(
            id=address_report.id,
            address=address,
            status=address_report.status,
            message="举报已提交，我们将尽快审核",
            created_at=address_report.created_at
        )
        
    except FidesException:
        raise
    except Exception as e:
        logger.error("report_address_failed", address=address, error_type=type(e).__name__)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="上报地址失败"
        )


@router.get(
    "/{address}/events",
    response_model=List[RiskEventResponse],
    summary="获取地址风险事件",
    description="获取指定地址的历史风险事件",
    responses={
        401: {"model": ErrorResponse, "description": "未授权"},
        429: {"model": ErrorResponse, "description": "请求过于频繁"},
    }
)
async def get_address_events(
    address: str,
    limit: int = Query(default=20, ge=1, le=100, description="返回数量限制"),
    severity: Optional[str] = Query(default=None, description="严重程度过滤"),
    db: AsyncSession = Depends(get_db),
    current_user: str = Depends(get_current_user)
):
    """
    获取地址风险事件历史
    
    - **address**: 区块链地址
    - **limit**: 返回数量，默认 20
    - **severity**: 严重程度过滤 (low/medium/high/critical)
    """
    address = validate_address(address)
    
    try:
        from app.core.di import get_container
        repo = get_container().get_address_repository(db)
        events = await repo.get_events(address, limit=limit, severity=severity)
        
        return [RiskEventResponse.model_validate(e) for e in events]
        
    except FidesException:
        raise
    except Exception as e:
        logger.error("get_address_events_failed", address=address, error_type=type(e).__name__)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="获取风险事件失败"
        )


@router.get(
    "/search",
    response_model=PaginatedResponse,
    summary="搜索地址",
    description="搜索风险地址数据库",
    responses={
        401: {"model": ErrorResponse, "description": "未授权"},
        429: {"model": ErrorResponse, "description": "请求过于频繁"},
    }
)
async def search_addresses(
    query: Optional[str] = Query(default=None, description="搜索关键词"),
    risk_level: Optional[str] = Query(default=None, description="风险等级过滤"),
    min_score: float = Query(default=0.0, ge=0, le=100, description="最小风险评分"),
    max_score: float = Query(default=100.0, ge=0, le=100, description="最大风险评分"),
    page: int = Query(default=1, ge=1, description="页码"),
    page_size: int = Query(default=20, ge=1, le=100, description="每页数量"),
    db: AsyncSession = Depends(get_db),
    current_user: str = Depends(get_current_user)
):
    """
    搜索风险地址
    
    - **query**: 地址关键词（支持前缀匹配）
    - **risk_level**: 风险等级过滤
    - **min_score/max_score**: 风险评分范围
    """
    try:
        from app.core.di import get_container
        repo = get_container().get_address_repository(db)
        
        total, items = await repo.search(
            query=query,
            risk_level=risk_level,
            min_score=min_score,
            max_score=max_score,
            page=page,
            page_size=page_size
        )
        
        pages = (total + page_size - 1) // page_size
        
        return PaginatedResponse(
            total=total,
            page=page,
            page_size=page_size,
            pages=pages,
            items=[AddressRiskResponse.model_validate(item) for item in items]
        )
        
    except FidesException:
        raise
    except Exception as e:
        logger.error("search_addresses_failed", error_type=type(e).__name__)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="搜索地址失败"
        )
