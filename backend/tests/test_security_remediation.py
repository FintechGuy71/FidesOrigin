"""Regression tests for the 2026-11 remediation security contracts."""
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.core.exceptions import AuthenticationException
from app.core.security import (
    create_refresh_token,
    revoke_refresh_token,
    rotate_refresh_token,
)
from app.models import RiskLevel
from app.services.risk_engine_service import RiskEngineService
from app.services.risk_sync_service import RiskSyncService


def _store(fake_redis, connected=True):
    return SimpleNamespace(redis=fake_redis, is_connected=connected)


@pytest.mark.asyncio
async def test_refresh_rotation_rejects_replay_and_logout_revokes_family(fake_redis, monkeypatch):
    monkeypatch.setattr(
        "app.core.security._get_redis_refresh_client",
        lambda: _store(fake_redis),
    )
    original = (await create_refresh_token("admin"))["token"]
    rotated = (await rotate_refresh_token(original))["token"]

    with pytest.raises(AuthenticationException, match="reuse"):
        await rotate_refresh_token(original)

    # The replay attempt revokes the complete family, including the rotated token.
    with pytest.raises(AuthenticationException):
        await rotate_refresh_token(rotated)

    another = (await create_refresh_token("admin"))["token"]
    await revoke_refresh_token(another)
    with pytest.raises(AuthenticationException):
        await rotate_refresh_token(another)


@pytest.mark.asyncio
async def test_refresh_fails_closed_when_store_is_unavailable(fake_redis, monkeypatch):
    monkeypatch.setattr(
        "app.core.security._get_redis_refresh_client",
        lambda: _store(fake_redis, connected=False),
    )
    with pytest.raises(AuthenticationException, match="store unavailable"):
        await create_refresh_token("admin")


class _Cache:
    def __init__(self):
        self.values = {}

    def risk_key(self, address, chain):
        return f"risk:{chain}:{address}"

    async def get_json(self, key):
        return self.values.get(key)

    async def set_json(self, key, value, expire=None):
        self.values[key] = value
        return True

    async def delete(self, key):
        self.values.pop(key, None)


class _Repo:
    def __init__(self):
        self.updated = None

    async def get_active_rules(self):
        return []

    async def create_or_update(self, **kwargs):
        self.updated = kwargs


class _Alert:
    async def send_alert(self, **kwargs):
        return None

    async def send_risk_alert(self, **kwargs):
        return None


@pytest.mark.asyncio
async def test_no_evidence_returns_unknown_not_low():
    cache = _Cache()
    repo = _Repo()
    engine = RiskEngineService(
        db=AsyncMock(),
        blockscout=AsyncMock(),
        cache=cache,
        alert=_Alert(),
        address_repo=repo,
        transaction_repo=AsyncMock(),
        rule_repo=repo,
    )
    score, level, factors = await engine.calculate_address_risk(
        "0x0000000000000000000000000000000000000001", "sepolia"
    )
    assert score == 0
    assert level == RiskLevel.UNKNOWN
    assert factors == []


@pytest.mark.asyncio
async def test_direct_write_never_reports_simulated_success():
    lock = AsyncMock()
    lock.acquire_chain_write_lock.return_value = "lock-token"
    lock.release_chain_write_lock.return_value = True
    queue = AsyncMock()
    service = RiskSyncService(
        db=AsyncMock(),
        cache=_Cache(),
        alert=_Alert(),
        address_repo=AsyncMock(),
        lock_manager=lock,
        message_queue=queue,
    )
    result = await service._direct_write_to_chain(
        "0x0000000000000000000000000000000000000001", 80, RiskLevel.HIGH
    )
    assert result["success"] is False
    assert "not configured" in result["error"]
    assert "tx_hash" not in result or result["tx_hash"] != "simulated_tx_hash"
