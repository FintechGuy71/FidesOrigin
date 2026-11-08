import pytest

from app.services import chain_registry_service as module
from app.services.chain_registry_service import ChainRegistryService

ADDRESS = "0x175d44451403Edf28469dF03A9280c1197ADb92c"


class FakeResponse:
    def __init__(self, body):
        self._body = body

    def raise_for_status(self):
        return None

    def json(self):
        return self._body


class FakeClient:
    calls = []
    responses = []

    def __init__(self, timeout):
        self.timeout = timeout

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        return None

    async def post(self, url, json):
        self.calls.append((url, json))
        response = self.responses.pop(0)
        if isinstance(response, Exception):
            raise response
        return FakeResponse(response)


@pytest.fixture(autouse=True)
def reset_fake(monkeypatch):
    FakeClient.calls = []
    FakeClient.responses = []
    monkeypatch.setattr(module.httpx, "AsyncClient", FakeClient)
    monkeypatch.setattr(module.settings, "CHAIN_READ_FALLBACK_ENABLED", True)
    monkeypatch.setattr(module.settings, "SEPOLIA_RPC_URLS", "https://rpc-one,https://rpc-two")


@pytest.mark.asyncio
async def test_chain_registry_reads_sanctioned_and_caches_result():
    FakeClient.responses = [{"result": "0x01"}]
    service = ChainRegistryService()
    assert await service.is_sanctioned(ADDRESS, "sepolia") is True
    assert await service.is_sanctioned(ADDRESS, "sepolia") is True
    assert len(FakeClient.calls) == 1
    payload = FakeClient.calls[0][1]
    assert payload["params"][0]["data"].startswith("0xdf592f7d")
    assert ADDRESS.lower()[2:] in payload["params"][0]["data"]


@pytest.mark.asyncio
async def test_chain_registry_uses_backup_rpc():
    FakeClient.responses = [RuntimeError("primary unavailable"), {"result": "0x00"}]
    service = ChainRegistryService()
    assert await service.is_sanctioned(ADDRESS, "sepolia") is False
    assert [call[0] for call in FakeClient.calls] == ["https://rpc-one", "https://rpc-two"]


@pytest.mark.asyncio
async def test_chain_registry_fails_explicitly_instead_of_false_unknown():
    FakeClient.responses = [RuntimeError("one down"), {"error": {"message": "two invalid"}}]
    service = ChainRegistryService()
    with pytest.raises(RuntimeError, match="All Sepolia RPC endpoints failed"):
        await service.is_sanctioned(ADDRESS, "sepolia")
