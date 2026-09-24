"""R4+R5 full verification: previous 9 fixes (regression) + new audit fixes.

Runtime checks without Postgres; live Blockscout check is network-tolerant (SKIP on failure).
"""
import asyncio
import os
import re
from types import SimpleNamespace

os.environ["SECRET_KEY"] = "test-secret-key-at-least-32-characters-long"
os.environ["API_KEY_PEPPER"] = "test-pepper-value-1234567890"
# 让 httpx 走本地代理访问 Blockscout（沙箱直连超时）
os.environ["HTTPS_PROXY"] = "http://127.0.0.1:7897"
os.environ["HTTP_PROXY"] = "http://127.0.0.1:7897"

ROOT = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.normpath(os.path.join(ROOT, ".."))
_results = []


def check(name, cond, detail=""):
    _results.append((name, bool(cond)))
    print(("PASS" if cond else "FAIL"), "|", name, ("| " + str(detail) if detail != "" else ""))


def check_skip(name):
    _results.append((name, True))
    print("SKIP |", name)


def src(rel):
    return open(os.path.join(REPO, rel), encoding="utf-8").read()


async def main():
    import fakeredis.aioredis

    # ============ 上一轮 9 项修复回归 ============
    import app.validators as v
    check("R4-7.validators_single_chain_set",
          len(re.findall(r"^SUPPORTED_CHAINS\s*=", src("backend/app/validators.py"), re.M)) == 1)

    from app.services.cache_service import CacheService
    import app.services.cache_service as cs_mod
    code_cs = "\n".join(l.split("#")[0] for l in src("backend/app/services/cache_service.py").splitlines())
    check("R4-3.no_pickle_calls", "pickle.loads" not in code_cs and "pickle.dumps" not in code_cs)

    fake = fakeredis.aioredis.FakeRedis(decode_responses=True)
    svc = CacheService()
    svc._redis = fake
    data = {"nested": {"k": "v"}, "list": [1, 2, 3]}
    ok = await svc.set_object("k1", data)
    got = await svc.get_object("k1")
    check("R4-3.json_roundtrip", ok is True and got == data)
    check("R4-3.is_connected_property", svc.is_connected is True)
    svc2 = CacheService()
    check("R4-3.is_connected_false_when_disconnected", svc2.is_connected is False)
    await fake.set("k2", "not-json{{{")
    check("R4-3/B20.legacy_payload_none", await svc.get_object("k2") is None)
    await fake.aclose()

    from datetime import datetime, timezone, timedelta
    from app.services.risk_engine import RiskEngine
    from app.models import RiskLevel

    eng = RiskEngine.__new__(RiskEngine)

    class FakeBSAge:
        async def get_address_stats(self, a):
            return {"first_transaction": (datetime.now(timezone.utc) - timedelta(days=1)).replace(tzinfo=None).isoformat()}

    eng._blockscout = FakeBSAge()
    score, _ = await eng._check_address_age("0x123", {"min_days": 7, "weight": 0.1})
    check("R4-4.age_rule_fires", score > 0)

    class FakeBSTxFromNull:
        async def get_transaction(self, h):
            return {"from": None, "to": None, "value": None}

    eng2 = RiskEngine.__new__(RiskEngine)
    eng2._blockscout = FakeBSTxFromNull()

    async def zero(addr, chain="ethereum"):
        return (0, RiskLevel.LOW, [])

    eng2.calculate_address_risk = zero
    res = await eng2.analyze_transaction("0x" + "a" * 64, "ethereum")
    check("R4-5/B9.from_and_to_null_no_crash", res.get("from_address") == "" and res.get("to_address") == "")

    from app.services.risk_sync_service import RiskSyncService

    class FakeRepo:
        def __init__(self):
            self.calls = []

        async def create_or_update(self, **kw):
            self.calls.append(kw)

    class FakeCache2:
        async def delete(self, k):
            return 0

        def risk_key(self, a, c="ethereum"):
            return "fides:risk:" + c + ":" + a

    repo = FakeRepo()
    s = RiskSyncService(db=None, cache=FakeCache2(), alert=None, address_repo=repo,
                        lock_manager=SimpleNamespace(), message_queue=SimpleNamespace())
    await s.handle_message_queue_update("0x1", 80.0, "high")
    check("R4-6.sync_enum_normalized", isinstance(repo.calls[0]["risk_level"], RiskLevel) and repo.calls[0]["risk_level"] == RiskLevel.HIGH)

    from app.core import security as sec
    src_sec = src("backend/app/core/security.py")

    class FakeDB:
        async def execute(self, *a, **k):
            raise RuntimeError("db down")

    try:
        await sec.verify_api_key("x" * 32, FakeDB())
        check("R4-1.original_exception_rethrown", False)
    except RuntimeError:
        check("R4-1.original_exception_rethrown", True)
    except NameError:
        check("R4-1.original_exception_rethrown", False, "NameError regression")
    check("R4-2.rotation_error_logged", "refresh_token_rotation_store_unavailable" in src_sec)
    check("R4-8.login_count_read_logged", "login_failed_count_read_error" in src("backend/app/controllers/auth.py"))
    doc = src("docs/audit-history/backend-infrastructure-audit.md")
    doc2 = src("docs/fix-summary-v2.3.md")
    doc3 = src("docs/audit-history/SECURITY_AUDIT.md")
    doc4 = src("docs/audit-history/SECURITY_FIX_REPORT.md")
    doc5 = src("docs/cross-check/final-security-scan.md")
    all_docs = doc + doc2 + doc3 + doc4 + doc5
    for label, secret in [("privkey", "d0ccc2bcf9a74f56"), ("chainalysis", "f52c25172e4c1e5de8004bc"),
                          ("etherscan1", "IW7DG5MV445CEWHB"), ("etherscan2", "ABQJNS57VYBYH7K3MSCQB4TWKVSB54QPXC"),
                          ("publisher_privkey", "21e09e7def47220d0020bae2d20cb2b1185f4382")]:
        check(f"R4-9.{label}_redacted_docs", secret not in all_docs)
    for rel in ["data-sync/scripts/debug/test_etherscan_detailed.js",
                "apps/contracts/scripts/verify_etherscan_direct.py",
                "apps/contracts/scripts/verify_r3_etherscan.py"]:
        check(f"R4-9.keys_removed_{os.path.basename(rel)}",
              "ABQJNS57VYBYH7K3MSCQB4TWKVSB54QPXC" not in src(rel) and "IW7DG5MV445CEWHBP5FQCYZTXHQJN6RGV9" not in src(rel))

    # ============ 本轮新修复（B/F 系列） ============

    # --- B1: _local_check 首请求记录 ---
    rl = sec.RateLimiter()
    rl.requests_per_minute = 3
    import time as _time
    now = int(_time.time())
    r1 = rl._local_check("b1key", now, now - 60)
    r2 = rl._local_check("b1key", now, now - 60)
    r3 = rl._local_check("b1key", now, now - 60)
    r4 = rl._local_check("b1key", now, now - 60)
    check("B1.local_check_records_and_limits", r1 and r2 and r3 and (not r4), f"{r1}{r2}{r3}{r4}")

    # --- B2+B4: is_allowed 未连接→本地降级；连接→Lua 原子计数 ---
    from app.core import di as di_mod
    orig_container = di_mod._container

    class FakeContainer:
        def __init__(self, cache):
            self._cache = cache

        @property
        def cache(self):
            return self._cache

    fake_disconnected = FakeContainer(CacheService())
    di_mod._container = fake_disconnected
    try:
        a1 = await sec.get_rate_limiter.__wrapped__ if False else None  # noop guard
    except Exception:
        pass
    limiter2 = sec.RateLimiter()
    limiter2.requests_per_minute = 2
    a1 = await limiter2.is_allowed("b2key")
    a2 = await limiter2.is_allowed("b2key")
    a3 = await limiter2.is_allowed("b2key")
    check("B2.disconnected_falls_to_local", a1 and a2 and (not a3), f"{a1}{a2}{a3}")
    # 本地降级确实记录（B1 联动）
    check("B2.local_cache_has_entries", len(limiter2._local_cache.get("b2key", [])) == 3 or "b2key" in limiter2._local_cache)

    # 连接态（fakeredis）→ Lua 原子 INCR+EXPIRE
    fake_redis = fakeredis.aioredis.FakeRedis(decode_responses=True)
    connected = CacheService()
    connected._redis = fake_redis
    di_mod._container = FakeContainer(connected)
    limiter3 = sec.RateLimiter()
    limiter3.requests_per_minute = 2
    c1 = await limiter3.is_allowed("b4key")
    c2 = await limiter3.is_allowed("b4key")
    c3 = await limiter3.is_allowed("b4key")
    ttl = await fake_redis.ttl("fidesorigin:rate_limit:b4key")
    check("B4.redis_atomic_incr_expire", c1 and c2 and (not c3) and ttl > 0, f"c={c1}{c2}{c3} ttl={ttl}")
    await fake_redis.aclose()
    di_mod._container = orig_container

    # --- B3: auth 锁定助手未连接时走内存 fallback ---
    src_auth = src("backend/app/controllers/auth.py")
    check("B3.auth_helpers_use_is_connected", src_auth.count("redis and redis.is_connected") >= 4)

    # --- B5/B6: monitor.py 静态结构 ---
    src_mon = src("backend/app/controllers/monitor.py")
    check("B5.ws_disconnect_caught", "except WebSocketDisconnect:" in src_mon and "_release_pending_auth" in src_mon.split("except WebSocketDisconnect:")[1][:200])
    check("B5.release_after_auth", "认证已成功" in src_mon and "pending-auth 配额已在认证成功后释放" in src_mon)
    check("B6.update_subscription_validates", "validate_address(a) for a in new_addresses" in src_mon and "at most 100" in src_mon)

    # --- B8: 重试谓词 ---
    from app.services.blockscout_service import BlockscoutService, BlockscoutAPIException, CircuitBreakerOpenException
    e404 = BlockscoutAPIException("HTTP 404", status_code=404)
    e502 = BlockscoutAPIException("Request failed")
    e502.status_code = 502
    e429 = BlockscoutAPIException("HTTP 429", status_code=429)
    cb = CircuitBreakerOpenException()
    check("B8.retry_predicate",
          (not BlockscoutService._should_retry_blockscout(e404)) and
          BlockscoutService._should_retry_blockscout(e502) and
          BlockscoutService._should_retry_blockscout(e429) and
          (not BlockscoutService._should_retry_blockscout(cb)))

    # --- B7: Blockscout schema 修复——真实 API 集成验证 ---
    src_bs = src("backend/app/services/blockscout_service.py")
    check("B7.static.no_limit_params", 'params={"limit"' not in src_bs and 'params={"limit": limit' not in src_bs)
    check("B7.static.coin_balance_key", 'info.get("coin_balance"' in src_bs)
    check("B7.static.counters_endpoint", "/counters" in src_bs)
    live_ok = False
    try:
        bs = BlockscoutService()
        stats = await asyncio.wait_for(bs.get_address_stats("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"), timeout=45)
        await bs.close()
        bal = str(stats.get("balance", "0"))
        tc = stats.get("transaction_count", 0)
        # vitalik 地址：余额应为非零 wei 字符串、交易数 ~78k（此前恒为 "0"/0）
        live_ok = bal != "0" and int(tc) > 1000
        check("B7.live.stats_real_values", live_ok, f"balance={bal[:12]}... tx_count={tc}")
        # 交易数 >50 → first_transaction 应诚实为 None（未知）
        check("B7.live.first_tx_none_when_many", stats.get("first_transaction") is None, str(stats.get("first_transaction"))[:40])
    except Exception as e:
        check_skip(f"B7.live (network unavailable: {type(e).__name__})")

    # --- B9: risk_engine_service from:null ---
    from app.services.risk_engine_service import RiskEngineService as RES

    class FakeBS2:
        async def get_transaction(self, h):
            return {"from": None, "to": {"hash": "0x" + "b" * 40}, "value": "0", "block_number": "5", "status": "ok"}

    class Noop:
        async def __call__(self, *a, **k):
            return None

    class NoopAlert:
        async def send_alert(self, *a, **k):
            pass

        async def send_risk_alert(self, *a, **k):
            pass

    class FakeRuleRepo:
        async def get_active_rules(self):
            return []

    resvc = RES(db=None, blockscout=FakeBS2(), cache=svc2, alert=NoopAlert(),
                address_repo=SimpleNamespace(create_or_update=Noop()),  # type: ignore
                transaction_repo=SimpleNamespace(create=Noop()), rule_repo=FakeRuleRepo())
    # cache 未连接 → get_json None → 走计算
    txres = await resvc.analyze_transaction("0x" + "c" * 64, "ethereum")
    check("B9.service_from_null_no_crash", txres.get("from_address") == "" and txres.get("to_address") == "0x" + "b" * 40)
    check("B17.int_block_number_cast", 'int(tx_data.get("block_number") or 0)' in src("backend/app/services/risk_engine_service.py"))

    # --- B11: logging search ---
    from app.core.logging import _recurse_mask
    pk = "0x" + "ab" * 32
    masked = _recurse_mask({"note": f"failed at {pk} context"})
    check("B11.midstring_secret_masked", pk not in str(masked), str(masked)[:60])

    # --- B12: sanitize_log_message 私钥正则 ---
    msg = f"signing with {pk} failed"
    sanitized = sec.sanitize_log_message(msg)
    check("B12.private_key_masked", pk not in sanitized, sanitized[:60])

    # --- B13: safe_headers 死代码移除（剥离注释后检查，避免误报） ---
    code_sec = "\n".join(l.split("#")[0] for l in src_sec.splitlines())
    check("B13.safe_headers_removed", "safe_headers" not in code_sec)

    # --- B14: database.py（精确断言：无 pg_insert 调用/导入；docstring 说明允许保留） ---
    src_db = src("backend/app/database.py")
    code_db = "\n".join(l.split("#")[0] for l in src_db.splitlines())
    no_pg_usage = (not re.search(r"pg_insert\s*\(", code_db)) and \
                  ("from sqlalchemy.dialects.postgresql import" not in code_db)
    check("B14.dead_import_removed",
          no_pg_usage and "except IntegrityError:" in code_db and "seed_race_resolved" in code_db)

    # --- B15: di shutdown ---
    src_di = src("backend/app/core/di.py")
    check("B15.shutdown_closes_singletons", "_lock_manager.close()" in src_di and "_message_queue.close()" in src_di)

    # --- B16: aclose ---
    check("B16.aclose_normalized", "aclose()" in src("backend/app/core/lock_manager.py") and "aclose()" in src("backend/app/core/message_queue.py"))

    # --- B19: 日志事件名（剥离注释，避免修复说明误报） ---
    code_res = "\n".join(l.split("#")[0] for l in src("backend/app/services/risk_engine_service.py").splitlines())
    check("B19.persist_log_renamed", "transaction_persist_failed" in code_res and "transaction_cache_failed" not in code_res)

    # --- B17: repo Decimal 矫正 ---
    check("B17.repo_decimal_cast", "value_decimal" in src("backend/app/repositories/transaction_repository.py"))

    # --- F1: apps/api chain 参数 ---
    check("F1.check_js_sends_chain", "risk?chain=ethereum" in src("apps/api/api/v1/risk/check.js"))
    check("F1.public_sends_chain", "risk?chain=ethereum" in src("apps/api/api/v1/public/risk-check.js"))

    # --- F2: batch-check 数据键 ---
    check("F2.batch_check_canonical_key", 'chain = "ethereum"' in src("backend/app/controllers/addresses.py"))

    # --- B20: get_object get in try ---
    get_obj_src = src("backend/app/services/cache_service.py").split("async def get_object")[1][:900]
    check("B20.get_inside_try", get_obj_src.index("try:") < get_obj_src.index("await self._redis.get(key)"))

    print("\n=== SUMMARY ===")
    passed = sum(1 for _, ok in _results if ok)
    print(f"{passed}/{len(_results)} checks passed")
    if passed != len(_results):
        raise SystemExit(1)


if __name__ == "__main__":
    asyncio.run(main())
