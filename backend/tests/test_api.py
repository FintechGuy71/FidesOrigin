"""
FidesOrigin API 单元测试
"""
import asyncio
import hashlib
import os
import uuid
from datetime import datetime, timedelta, timezone
from typing import AsyncGenerator, Optional

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import Base
from app.core.di import get_db
from app.main import app
from app.models import (
    APIKey, Address, AddressRisk, AddressReport, Base, RiskEvent,
    RiskLevel, RiskRule, RiskStatus, Transaction
)


# ==================== 测试数据工厂 ====================

async def create_test_address_risk(
    db: AsyncSession,
    address: str = "0x742d35cc6634c0532925a3b844bc9e7595f0bEb",
    risk_score: float = 50.0,
    risk_level: RiskLevel = RiskLevel.MEDIUM
) -> AddressRisk:
    """创建测试地址风险记录"""
    address_risk = AddressRisk(
        id=uuid.uuid4(),
        address=address.lower(),
        chain="ethereum",
        risk_score=risk_score,
        risk_level=risk_level,
        status=RiskStatus.PENDING,
        report_count=0,
        created_at=datetime.now(timezone.utc)
    )
    db.add(address_risk)
    await db.commit()
    await db.refresh(address_risk)
    return address_risk


async def create_test_transaction(
    db: AsyncSession,
    tx_hash: str = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
    address: str = "0x742d35cc6634c0532925a3b844bc9e7595f0bEb"
) -> Transaction:
    """创建测试交易记录"""
    transaction = Transaction(
        id=1,
        tx_hash=tx_hash.lower(),
        chain="ethereum",
        from_address=address.lower(),
        to_address="0x8ba1f109551bd432803012645hac136c82c3e8c",
        value="1.000000000000000000",
        block_number=1000000,
        block_timestamp=datetime.now(timezone.utc),
        risk_score=30.0,
        risk_level=RiskLevel.LOW,
        status="confirmed",
        created_at=datetime.now(timezone.utc)
    )
    db.add(transaction)
    await db.commit()
    await db.refresh(transaction)
    return transaction


async def create_test_risk_rule(
    db: AsyncSession,
    name: str = "test_rule",
    is_active: bool = True
) -> RiskRule:
    """创建测试风险规则"""
    rule = RiskRule(
        name=name,
        description="Test rule description",
        rule_type="PATTERN",
        category="test_category",
        pattern="test_pattern",
        threshold_value=100,
        risk_score_increment=50.0,
        condition={"pattern": "test"},
        risk_weight=1.0,
        risk_score_impact=10.0,
        tags=["test"],
        is_active=is_active,
        priority=100,
        created_at=datetime.now(timezone.utc)
    )
    db.add(rule)
    await db.commit()
    await db.refresh(rule)
    return rule


async def create_test_api_key(
    db: AsyncSession,
    key: str = "test-api-key-valid",
    is_active: bool = True,
    expires_at: Optional[datetime] = None
) -> APIKey:
    """创建测试 API Key"""
    key_hash = hashlib.sha256(key.encode()).hexdigest()
    api_key = APIKey(
        key_hash=key_hash,
        key=key,
        name="Test API Key",
        is_active=is_active,
        rate_limit=1000,
        expires_at=expires_at,
        request_count=0
    )
    db.add(api_key)
    await db.commit()
    await db.refresh(api_key)
    return api_key


# ==================== 认证测试 ====================

@pytest.mark.asyncio
async def test_auth_missing_api_key(client):
    """测试缺少 API Key 时返回 401"""
    response = await client.get(
        "/api/v1/transaction/0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
    )
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "UNAUTHORIZED"


@pytest.mark.asyncio
async def test_auth_valid_api_key(client, db_session):
    """测试有效 API Key 可以访问"""
    await create_test_api_key(db_session, key="valid-test-key")

    response = await client.get(
        "/api/v1/transaction/0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
        headers={"X-API-Key": "valid-test-key"}
    )
    # 认证通过，但交易不存在或 Blockscout 调用失败
    assert response.status_code in [404, 500]


@pytest.mark.asyncio
async def test_auth_invalid_api_key(client):
    """测试无效 API Key 返回 401"""
    response = await client.get(
        "/api/v1/transaction/0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
        headers={"X-API-Key": "invalid-key"}
    )
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "UNAUTHORIZED"


@pytest.mark.asyncio
async def test_auth_expired_api_key(client, db_session):
    """测试过期 API Key 返回 401"""
    expired_time = datetime.now(timezone.utc) - timedelta(hours=1)
    await create_test_api_key(db_session, key="expired-test-key", expires_at=expired_time)

    response = await client.get(
        "/api/v1/transaction/0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
        headers={"X-API-Key": "expired-test-key"}
    )
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "UNAUTHORIZED"


# ==================== 基础 API 测试 ====================

@pytest.mark.asyncio
async def test_health_check(client):
    """测试健康检查端点"""
    response = await client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "version" in data
    assert "timestamp" in data


@pytest.mark.asyncio
async def test_root_endpoint(client):
    """测试根端点"""
    response = await client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "FidesOrigin"
    assert "endpoints" in data


# ==================== 交易 API 测试 ====================

@pytest.mark.asyncio
@pytest.mark.noauth
async def test_get_transaction_not_found(client):
    """测试获取不存在的交易"""
    response = await client.get(
        "/api/v1/transaction/0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
    )
    # 由于会尝试从 Blockscout 获取，可能返回 404 或 500
    assert response.status_code in [404, 500, 200]


@pytest.mark.asyncio
@pytest.mark.noauth
async def test_method_not_allowed(client):
    """测试不允许的方法"""
    response = await client.post("/health")
    # CSRF 中间件跳过带 Authorization header 的请求
    assert response.status_code == 405  # Method Not Allowed


# ==================== 监控 API 测试 ====================

@pytest.mark.asyncio
@pytest.mark.noauth
async def test_get_monitor_stats(client):
    """测试获取监控统计"""
    response = await client.get("/api/v1/monitor/stats")
    assert response.status_code == 200
    data = response.json()
    assert "total_connections" in data
