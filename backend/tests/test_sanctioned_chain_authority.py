from types import SimpleNamespace

import pytest

from app.services import chain_registry_service as module
from app.services.risk_engine_service import SanctionedListStrategy

ADDRESS = "0x175d44451403Edf28469dF03A9280c1197ADb92c"
RULE = SimpleNamespace(risk_score_impact=100, risk_weight=1)


class FakeResult:
    def __init__(self, tags):
        self.tags = tags

    def scalar(self):
        return self.tags


class FakeDb:
    def __init__(self, tags):
        self.tags = tags

    async def execute(self, _query):
        return FakeResult(self.tags)


@pytest.mark.asyncio
async def test_chain_delisting_overrides_stale_database_hit(monkeypatch):
    async def chain_false(_address, _chain):
        return False

    monkeypatch.setattr(module.chain_registry_service, "is_sanctioned", chain_false)
    score, _ = await SanctionedListStrategy().evaluate(
        ADDRESS, "sepolia", RULE, FakeDb(["sanctioned"]), None
    )
    assert score == 0


@pytest.mark.asyncio
async def test_chain_sanctioned_wins_when_database_misses(monkeypatch):
    async def chain_true(_address, _chain):
        return True

    monkeypatch.setattr(module.chain_registry_service, "is_sanctioned", chain_true)
    score, description = await SanctionedListStrategy().evaluate(
        ADDRESS, "sepolia", RULE, FakeDb([]), None
    )
    assert score == 100
    assert "链上回读" in description


@pytest.mark.asyncio
async def test_database_is_fallback_when_chain_read_is_disabled(monkeypatch):
    async def chain_unavailable(_address, _chain):
        return None

    monkeypatch.setattr(module.chain_registry_service, "is_sanctioned", chain_unavailable)
    score, _ = await SanctionedListStrategy().evaluate(
        ADDRESS, "sepolia", RULE, FakeDb(["sanctioned"]), None
    )
    assert score == 100
