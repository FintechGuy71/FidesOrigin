"""
FidesOrigin 交易 Controller（重构版）
API 层：处理 HTTP 请求，委托 Service 层处理业务逻辑
"""
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.di import get_db, get_risk_engine
from app.core.exceptions import FidesException, NotFoundException
from app.core.logging import get_logger
from app.schemas import (
    ErrorResponse,
    PaginatedResponse,
    TransactionResponse,
    TransactionRiskResponse,
)
from app.services.blockscout_service import BlockscoutService
from app.services.risk_engine_service import RiskEngineService
from app.validators import validate_tx_hash

logger = get_logger(__name__)
router = APIRouter(prefix="/api/v1/transaction", tags=["交易监控"])


from app.core.security import get_current_user


@router.get(
    "/{tx_hash}/risk",
    response_model=TransactionRiskResponse,
    summary="查询交易风险",
    description="获取指定交易的风险分析和相关地址风险信息",
    responses={
        200: {"description": "成功获取交易风险"},
        400: {"model": ErrorResponse, "description": "交易哈希格式错误"},
        401: {"model": ErrorResponse, "description": "未授权"},
        404: {"model": ErrorResponse, "description": "交易未找到"},
        429: {"model": ErrorResponse, "description": "请求过于频繁"},
        500: {"model": ErrorResponse, "description": "服务器内部错误"},
    }
)
async def get_transaction_risk(
    tx_hash: str,
    chain: str = Query(default="ethereum", description="链类型"),
    db: AsyncSession = Depends(get_db),
    engine: RiskEngineService = Depends(get_risk_engine),
    current_user: str = Depends(get_current_user)
):
    """
    查询交易风险
    
    - **tx_hash**: 交易哈希 (0x...)
    - **chain**: 链类型，默认为 ethereum
    """
    tx_hash = validate_tx_hash(tx_hash)
    
    try:
        # 分析交易
        analysis = await engine.analyze_transaction(tx_hash, chain)
        
        # 获取相关地址风险信息
        related_addresses = []
        for indicator in analysis.get("indicators", []):
            if indicator.get("type") in ["high_risk_sender", "high_risk_receiver"]:
                addr = indicator.get("address")
                if addr:
                    from app.core.di import get_container
                    addr_repo = get_container().get_address_repository(db)
                    addr_risk = await addr_repo.get_by_address(addr, chain)
                    if addr_risk:
                        from app.schemas import AddressRiskResponse
                        related_addresses.append(AddressRiskResponse.model_validate(addr_risk))
        
        # 生成分析摘要
        indicators = analysis.get("indicators", [])
        summary_parts = []
        for ind in indicators[:3]:
            if ind.get("type") == "high_risk_sender":
                summary_parts.append(f"发送方风险等级: {ind.get('level', 'unknown')}")
            elif ind.get("type") == "high_risk_receiver":
                summary_parts.append(f"接收方风险等级: {ind.get('level', 'unknown')}")
            elif ind.get("type") == "large_amount":
                summary_parts.append(f"大额转账: {ind.get('value_eth', 0):.2f} ETH")
            elif ind.get("type") == "contract_call":
                summary_parts.append("涉及合约调用")
        
        analysis_summary = "; ".join(summary_parts) if summary_parts else "暂无特殊风险指标"
        
        return TransactionRiskResponse(
            tx_hash=tx_hash,
            chain=chain,
            risk_score=analysis.get("risk_score", 0),
            risk_level=analysis.get("risk_level", "low"),
            indicators=indicators,
            related_addresses=related_addresses,
            analysis_summary=analysis_summary
        )
        
    except FidesException:
        raise
    except Exception as e:
        logger.error("get_transaction_risk_failed", tx_hash=tx_hash, error_type=type(e).__name__)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="分析交易风险失败"
        )


@router.get(
    "/{tx_hash}",
    response_model=TransactionResponse,
    summary="获取交易详情",
    description="获取交易的详细信息",
    responses={
        401: {"model": ErrorResponse, "description": "未授权"},
        429: {"model": ErrorResponse, "description": "请求过于频繁"},
    }
)
async def get_transaction(
    tx_hash: str,
    chain: str = Query(default="ethereum", description="链类型"),
    db: AsyncSession = Depends(get_db),
    current_user: str = Depends(get_current_user)
):
    """
    获取交易详情
    
    - **tx_hash**: 交易哈希
    - **chain**: 链类型
    """
    tx_hash = validate_tx_hash(tx_hash)
    
    try:
        from app.core.di import get_container
        tx_repo = get_container().get_transaction_repository(db)
        tx = await tx_repo.get_by_tx_hash(tx_hash, chain)
        
        if not tx:
            # 尝试从 Blockscout 获取
            blockscout = get_container().blockscout
            try:
                tx_data = await blockscout.get_transaction(tx_hash)
                
                value_wei = int(tx_data.get("value", "0"))
                value_eth = value_wei / 10**18
                
                return TransactionResponse(
                    id=None,
                    tx_hash=tx_hash,
                    chain=chain,
                    address=tx_data.get("from", {}).get("hash", ""),
                    from_address=tx_data.get("from", {}).get("hash", ""),
                    to_address=tx_data.get("to", {}).get("hash", "") if tx_data.get("to") else "",
                    value=str(value_wei),
                    value_eth=value_eth,
                    gas_price=tx_data.get("gas_price"),
                    gas_used=tx_data.get("gas_used"),
                    block_number=tx_data.get("block_number", 0),
                    block_timestamp=datetime.fromisoformat(
                        tx_data.get("timestamp", datetime.now(timezone.utc).isoformat())
                    ),
                    risk_score=0,
                    risk_level="low",
                    risk_indicators=[],
                    status=tx_data.get("status", "pending"),
                    analyzed_at=None,
                    created_at=datetime.now(timezone.utc)
                )
            except Exception:
                raise NotFoundException("Transaction", tx_hash)
        
        # 计算 ETH 值
        value_eth = int(tx.value) / 10**18 if tx.value else 0
        
        response_data = {
            "id": tx.id,
            "tx_hash": tx.tx_hash,
            "chain": tx.chain,
            "address": tx.address,
            "from_address": tx.from_address,
            "to_address": tx.to_address,
            "value": tx.value,
            "value_eth": value_eth,
            "gas_price": tx.gas_price,
            "gas_used": tx.gas_used,
            "block_number": tx.block_number,
            "block_timestamp": tx.block_timestamp,
            "risk_score": tx.risk_score,
            "risk_level": tx.risk_level.value,
            "risk_indicators": tx.risk_indicators or [],
            "status": tx.status,
            "analyzed_at": tx.analyzed_at,
            "created_at": tx.created_at
        }
        
        return TransactionResponse.model_validate(response_data)
        
    except FidesException:
        raise
    except Exception as e:
        logger.error("get_transaction_failed", tx_hash=tx_hash, error_type=type(e).__name__)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="获取交易详情失败"
        )


@router.get(
    "/",
    response_model=PaginatedResponse,
    summary="获取交易列表",
    description="获取监控的交易列表，支持分页和过滤",
    responses={
        401: {"model": ErrorResponse, "description": "未授权"},
        429: {"model": ErrorResponse, "description": "请求过于频繁"},
    }
)
async def list_transactions(
    address: Optional[str] = Query(default=None, description="过滤地址"),
    chain: str = Query(default="ethereum", description="链类型"),
    min_risk_score: float = Query(default=0.0, ge=0, le=100, description="最小风险评分"),
    max_risk_score: float = Query(default=100.0, ge=0, le=100, description="最大风险评分"),
    page: int = Query(default=1, ge=1, description="页码"),
    page_size: int = Query(default=20, ge=1, le=100, description="每页数量"),
    db: AsyncSession = Depends(get_db),
    current_user: str = Depends(get_current_user)
):
    """
    获取交易列表
    
    - **address**: 过滤特定地址的交易
    - **min_risk_score/max_risk_score**: 风险评分范围过滤
    """
    try:
        from app.core.di import get_container
        tx_repo = get_container().get_transaction_repository(db)
        
        total, transactions = await tx_repo.list(
            chain=chain,
            address=address,
            min_risk_score=min_risk_score,
            max_risk_score=max_risk_score,
            page=page,
            page_size=page_size
        )
        
        pages = (total + page_size - 1) // page_size
        
        # 构建响应
        items = []
        for tx in transactions:
            value_eth = int(tx.value) / 10**18 if tx.value else 0
            items.append({
                "id": tx.id,
                "tx_hash": tx.tx_hash,
                "chain": tx.chain,
                "address": tx.from_address,  # 使用 from_address 作为 address
                "from_address": tx.from_address,
                "to_address": tx.to_address,
                "value": str(tx.value),
                "value_eth": value_eth,
                "gas_price": str(tx.gas_price) if tx.gas_price else None,
                "gas_used": tx.gas_used,
                "block_number": tx.block_number,
                "block_timestamp": tx.block_timestamp,
                "risk_score": float(tx.risk_score) if tx.risk_score else 0,
                "risk_level": tx.risk_level.value if hasattr(tx.risk_level, 'value') else tx.risk_level,
                "risk_indicators": tx.risk_factors or [],
                "status": tx.status,
                "analyzed_at": tx.block_timestamp,
                "created_at": tx.created_at
            })
        
        return PaginatedResponse(
            total=total,
            page=page,
            page_size=page_size,
            pages=pages,
            items=[TransactionResponse.model_validate(item) for item in items]
        )
        
    except FidesException:
        raise
    except Exception as e:
        logger.error("list_transactions_failed", error_type=type(e).__name__)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="获取交易列表失败"
        )
