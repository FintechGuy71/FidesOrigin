"""Read-only Sepolia RiskRegistry fallback for official sanctions queries."""

import logging
import re
import time
from urllib.parse import urlsplit

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


def _redact_url(value: str) -> str:
    """Log only scheme/host/port, never credentials, paths, or query strings."""
    try:
        parsed = urlsplit(value)
        host = parsed.hostname or "unknown"
        port = f":{parsed.port}" if parsed.port else ""
        return f"{parsed.scheme}://{host}{port}"
    except Exception:
        return "[invalid-url]"


def _safe_error(error: Exception) -> str:
    return re.sub(r"https?://\S+", "[redacted-url]", str(error))[:300]


class ChainRegistryService:
    _IS_SANCTIONED_SELECTOR = "0xdf592f7d"  # isSanctioned(address)

    def __init__(self) -> None:
        self._cache: dict[str, tuple[float, bool]] = {}
        self._cache_ttl = 60

    def _rpc_urls(self) -> list[str]:
        configured = settings.SEPOLIA_RPC_URLS or settings.SEPOLIA_RPC_URL
        return [value.strip() for value in configured.split(",") if value.strip()]

    async def is_sanctioned(self, address: str, chain: str) -> bool | None:
        if chain.lower() != "sepolia" or not settings.CHAIN_READ_FALLBACK_ENABLED:
            return None
        if not re.fullmatch(r"0x[a-fA-F0-9]{40}", address):
            raise ValueError("Invalid EVM address")

        key = address.lower()
        cached = self._cache.get(key)
        if cached and time.monotonic() - cached[0] < self._cache_ttl:
            return cached[1]

        calldata = self._IS_SANCTIONED_SELECTOR + key[2:].rjust(64, "0")
        payload = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "eth_call",
            "params": [{"to": settings.RISK_REGISTRY_ADDRESS, "data": calldata}, "latest"],
        }
        errors = []
        for rpc_url in self._rpc_urls():
            try:
                async with httpx.AsyncClient(timeout=settings.CHAIN_READ_TIMEOUT) as client:
                    response = await client.post(rpc_url, json=payload)
                    response.raise_for_status()
                    body = response.json()
                if "error" in body:
                    raise RuntimeError(str(body["error"]))
                result = body.get("result")
                if not isinstance(result, str) or not result.startswith("0x"):
                    raise RuntimeError("Invalid eth_call result")
                value = bool(int(result, 16))
                if len(self._cache) >= 10000:
                    self._cache.clear()
                self._cache[key] = (time.monotonic(), value)
                return value
            except Exception as exc:
                errors.append(_safe_error(exc))
                logger.warning(
                    "chain_registry_rpc_failed rpc=%s error=%s",
                    _redact_url(rpc_url),
                    _safe_error(exc),
                )
        raise RuntimeError("All Sepolia RPC endpoints failed: " + " | ".join(errors))


chain_registry_service = ChainRegistryService()
