"""
FidesOrigin 规则 Controller（重构版）
API 层：处理 HTTP 请求，委托 Service 层处理业务逻辑
"""
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.di import get_db
from app.core.exceptions import ConflictException, FidesException, NotFoundException
from app.core.logging import get_logger
from app.schemas import (
    ErrorResponse,
    PaginatedResponse,
    RiskRuleCreate,
    RiskRuleListResponse,
    RiskRuleResponse,
    RiskRuleUpdate,
)
from app.repositories.rule_repository import RuleRepository

logger = get_logger(__name__)
router = APIRouter(prefix="/api/v1/rules", tags=["风险规则"])


from app.core.security import get_current_user


def get_rule_repo(db: AsyncSession = Depends(get_db)) -> RuleRepository:
    """获取规则 Repository 依赖"""
    from app.core.di import get_container
    return get_container().get_rule_repository(db)


@router.get(
    "/",
    response_model=PaginatedResponse,
    summary="获取规则列表",
    description="获取所有风险规则列表，支持过滤和分页",
    responses={
        200: {"description": "成功获取规则列表"},
        401: {"model": ErrorResponse, "description": "未授权"},
        429: {"model": ErrorResponse, "description": "请求过于频繁"},
        500: {"model": ErrorResponse, "description": "服务器内部错误"},
    }
)
async def get_rules(
    active_only: bool = Query(default=True, description="仅显示启用的规则"),
    category: Optional[str] = Query(default=None, description="按类别过滤"),
    rule_type: Optional[str] = Query(default=None, description="按类型过滤"),
    page: int = Query(default=1, ge=1, description="页码"),
    page_size: int = Query(default=20, ge=1, le=100, description="每页数量"),
    repo: RuleRepository = Depends(get_rule_repo),
    current_user: str = Depends(get_current_user)
):
    """
    获取风险规则列表
    
    - **active_only**: 是否只显示启用的规则，默认 true
    - **category**: 按类别过滤
    - **rule_type**: 按规则类型过滤
    - **page**: 页码，默认 1
    - **page_size**: 每页数量，默认 20
    """
    try:
        total, items = await repo.list(
            active_only=active_only,
            category=category,
            rule_type=rule_type,
            page=page,
            page_size=page_size
        )
        
        pages = (total + page_size - 1) // page_size
        
        return PaginatedResponse(
            total=total,
            page=page,
            page_size=page_size,
            pages=pages,
            items=[RiskRuleResponse.model_validate(rule) for rule in items]
        )
        
    except FidesException:
        raise
    except Exception as e:
        logger.error("get_rules_failed", error_type=type(e).__name__)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="获取规则列表失败"
        )


@router.get(
    "/{rule_id}",
    response_model=RiskRuleResponse,
    summary="获取规则详情",
    description="获取指定规则的详细信息",
    responses={
        200: {"description": "成功获取规则详情"},
        401: {"model": ErrorResponse, "description": "未授权"},
        404: {"model": ErrorResponse, "description": "规则未找到"},
        429: {"model": ErrorResponse, "description": "请求过于频繁"},
        500: {"model": ErrorResponse, "description": "服务器内部错误"},
    }
)
async def get_rule(
    rule_id: int,
    repo: RuleRepository = Depends(get_rule_repo),
    current_user: str = Depends(get_current_user)
):
    """
    获取规则详情
    
    - **rule_id**: 规则 ID
    """
    try:
        rule = await repo.get_by_id(rule_id)
        
        if not rule:
            raise NotFoundException("RiskRule", str(rule_id))
        
        return RiskRuleResponse.model_validate(rule)
        
    except FidesException:
        raise
    except Exception as e:
        logger.error("get_rule_failed", rule_id=str(rule_id), error_type=type(e).__name__)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="获取规则详情失败"
        )


@router.post(
    "/",
    response_model=RiskRuleResponse,
    status_code=status.HTTP_201_CREATED,
    summary="创建风险规则",
    description="创建新的风险规则",
    responses={
        201: {"description": "规则创建成功"},
        400: {"model": ErrorResponse, "description": "请求参数错误"},
        401: {"model": ErrorResponse, "description": "未授权"},
        409: {"model": ErrorResponse, "description": "规则名称已存在"},
        429: {"model": ErrorResponse, "description": "请求过于频繁"},
        500: {"model": ErrorResponse, "description": "服务器内部错误"},
    }
)
async def create_rule(
    rule: RiskRuleCreate,
    repo: RuleRepository = Depends(get_rule_repo),
    current_user: str = Depends(get_current_user)
):
    """
    创建风险规则
    
    - **name**: 规则名称（唯一）
    - **description**: 规则描述
    - **rule_type**: 规则类型
    - **category**: 规则类别
    - **condition**: 规则条件配置（JSON）
    - **risk_weight**: 风险权重 (0-10)
    - **risk_score_impact**: 风险评分影响 (-100 到 100)
    - **priority**: 优先级 (1-1000，越小越优先)
    """
    try:
        new_rule = await repo.create(
            name=rule.name,
            description=rule.description,
            rule_type=rule.rule_type,
            category=rule.category,
            condition=rule.condition,
            risk_weight=rule.risk_weight,
            risk_score_impact=rule.risk_score_impact,
            priority=rule.priority,
            tags=[],
            created_by=current_user
        )
        
        return RiskRuleResponse.model_validate(new_rule)
        
    except FidesException:
        raise
    except Exception as e:
        logger.error("create_rule_failed", name=rule.name, error_type=type(e).__name__)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="创建规则失败"
        )


@router.patch(
    "/{rule_id}",
    response_model=RiskRuleResponse,
    summary="更新规则配置",
    description="更新指定规则的配置",
    responses={
        200: {"description": "规则更新成功"},
        400: {"model": ErrorResponse, "description": "请求参数错误"},
        401: {"model": ErrorResponse, "description": "未授权"},
        404: {"model": ErrorResponse, "description": "规则未找到"},
        409: {"model": ErrorResponse, "description": "规则名称已存在"},
        429: {"model": ErrorResponse, "description": "请求过于频繁"},
        500: {"model": ErrorResponse, "description": "服务器内部错误"},
    }
)
async def update_rule(
    rule_id: int,
    rule_update: RiskRuleUpdate,
    repo: RuleRepository = Depends(get_rule_repo),
    current_user: str = Depends(get_current_user)
):
    """
    更新风险规则
    
    - **rule_id**: 规则 ID
    - **name**: 规则名称（可选）
    - **description**: 规则描述（可选）
    - **condition**: 规则条件（可选）
    - **risk_weight**: 风险权重（可选）
    - **risk_score_impact**: 风险评分影响（可选）
    - **is_active**: 是否启用（可选）
    - **priority**: 优先级（可选）
    - **tags**: 标签列表（可选）
    """
    try:
        updated = await repo.update(
            rule_id=rule_id,
            name=rule_update.name,
            description=rule_update.description,
            condition=rule_update.condition,
            risk_weight=rule_update.risk_weight,
            risk_score_impact=rule_update.risk_score_impact,
            is_active=rule_update.is_active,
            priority=rule_update.priority,
            tags=rule_update.tags,
            updated_by=current_user
        )
        
        return RiskRuleResponse.model_validate(updated)
        
    except FidesException:
        raise
    except Exception as e:
        logger.error("update_rule_failed", rule_id=str(rule_id), error_type=type(e).__name__)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="更新规则失败"
        )


@router.delete(
    "/{rule_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="删除风险规则",
    description="删除指定的风险规则",
    responses={
        204: {"description": "规则删除成功"},
        401: {"model": ErrorResponse, "description": "未授权"},
        404: {"model": ErrorResponse, "description": "规则未找到"},
        429: {"model": ErrorResponse, "description": "请求过于频繁"},
        500: {"model": ErrorResponse, "description": "服务器内部错误"},
    }
)
async def delete_rule(
    rule_id: int,
    repo: RuleRepository = Depends(get_rule_repo),
    current_user: str = Depends(get_current_user)
):
    """
    删除风险规则
    
    - **rule_id**: 规则 ID
    """
    try:
        await repo.delete(rule_id)
        
    except FidesException:
        raise
    except Exception as e:
        logger.error("delete_rule_failed", rule_id=str(rule_id), error_type=type(e).__name__)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="删除规则失败"
        )


@router.get(
    "/categories",
    response_model=List[str],
    summary="获取规则类别列表",
    description="获取所有可用的规则类别",
    responses={
        401: {"model": ErrorResponse, "description": "未授权"},
        429: {"model": ErrorResponse, "description": "请求过于频繁"},
    }
)
async def get_rule_categories(
    repo: RuleRepository = Depends(get_rule_repo),
    current_user: str = Depends(get_current_user)
):
    """获取规则类别列表"""
    try:
        return await repo.get_categories()
        
    except Exception as e:
        logger.error("get_categories_failed", error_type=type(e).__name__)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="获取规则类别失败"
        )


@router.post(
    "/{rule_id}/toggle",
    response_model=RiskRuleResponse,
    summary="切换规则状态",
    description="启用或禁用指定规则",
    responses={
        401: {"model": ErrorResponse, "description": "未授权"},
        429: {"model": ErrorResponse, "description": "请求过于频繁"},
    }
)
async def toggle_rule(
    rule_id: int,
    repo: RuleRepository = Depends(get_rule_repo),
    current_user: str = Depends(get_current_user)
):
    """
    切换规则启用状态
    
    - **rule_id**: 规则 ID
    """
    try:
        rule = await repo.toggle(rule_id, updated_by=current_user)
        return RiskRuleResponse.model_validate(rule)
        
    except FidesException:
        raise
    except Exception as e:
        logger.error("toggle_rule_failed", rule_id=str(rule_id), error_type=type(e).__name__)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="切换规则状态失败"
        )
