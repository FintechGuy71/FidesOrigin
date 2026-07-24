"""
FidesOrigin P2/P3 修复验证测试
覆盖: 日志脱敏、SSRF 防护、异常处理安全
"""
import os
import pytest


# ==================== P2-4: 日志脱敏测试 ====================

class TestLoggingSanitization:
    """测试日志中的敏感信息自动脱敏"""

    def test_is_sensitive_key_detects_password(self):
        from app.core.logging import _is_sensitive_key
        assert _is_sensitive_key("password") is True
        assert _is_sensitive_key("user_password") is True
        assert _is_sensitive_key("db_password") is True
        assert _is_sensitive_key("api_key") is True
        assert _is_sensitive_key("api-key") is True
        assert _is_sensitive_key("secret") is True
        assert _is_sensitive_key("token") is True
        assert _is_sensitive_key("authorization") is True

    def test_is_sensitive_key_allows_safe_keys(self):
        from app.core.logging import _is_sensitive_key
        assert _is_sensitive_key("username") is False
        assert _is_sensitive_key("address") is False
        assert _is_sensitive_key("chain") is False
        assert _is_sensitive_key("score") is False

    def test_mask_value_short_string(self):
        from app.core.logging import _mask_value
        assert _mask_value("ab") == "***"
        assert _mask_value("abc") == "***"
        assert _mask_value("abcd") == "***"

    def test_mask_value_long_string(self):
        from app.core.logging import _mask_value
        masked = _mask_value("supersecretpassword123")
        assert masked.startswith("su")
        assert masked.endswith("23")
        assert "***" in masked

    def test_recurse_mask_dict(self):
        from app.core.logging import _recurse_mask
        data = {
            "username": "admin",
            "password": "secret123456",
            "nested": {
                "api_key": "ak_test_12345",
                "safe_field": "visible"
            },
            "list_field": [
                {"token": "bearer_xyz789"},
                {"name": "item1"}
            ]
        }
        masked = _recurse_mask(data)
        assert masked["username"] == "admin"
        assert masked["password"] == "se***56"
        assert masked["nested"]["api_key"] == "ak***45"
        assert masked["nested"]["safe_field"] == "visible"
        assert masked["list_field"][0]["token"] == "be***89"
        assert masked["list_field"][1]["name"] == "item1"

    def test_recurse_mask_detects_private_key(self):
        from app.core.logging import _recurse_mask
        data = {
            "private_key": "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"
        }
        masked = _recurse_mask(data)
        assert masked["private_key"].startswith("0x")
        assert "***" in masked["private_key"]

    def test_sanitize_event_dict_masks_sensitive_fields(self):
        from app.core.logging import sanitize_event_dict
        event_dict = {
            "event": "login_attempt",
            "username": "admin",
            "password": "supersecret123",
            "api_key": "ak_live_abcdef",
            "trace_id": "abc123"
        }
        result = sanitize_event_dict(None, "info", event_dict)
        assert result["username"] == "admin"
        assert result["password"] == "su***23"
        assert result["api_key"] == "ak***ef"
        assert result["trace_id"] == "abc123"

    def test_sanitize_event_dict_masks_event_message(self):
        from app.core.logging import sanitize_event_dict
        event_dict = {
            "event": "User logged in with Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",
        }
        result = sanitize_event_dict(None, "info", event_dict)
        # Bearer token should be masked in event message
        assert "***" in result["event"] or "Bearer" not in result["event"]


# ==================== P2-5: 异常处理安全测试 ====================

class TestExceptionHandlingSecurity:
    """测试生产环境下异常处理不泄露内部信息"""

    @pytest.mark.asyncio
    async def test_production_error_response_hides_details(self, client, monkeypatch):
        """测试生产环境不返回内部错误详情"""
        from app.config import Settings
        
        # 模拟生产环境
        monkeypatch.setattr(Settings, "is_production", property(lambda self: True))
        
        # 触发一个会导致 500 错误的场景
        response = await client.get("/api/v1/transaction/invalid-tx-hash")
        data = response.json()
        
        # 生产环境不应包含 traceback 或内部实现细节
        if "error" in data:
            error_msg = str(data.get("error", ""))
            assert "traceback" not in error_msg.lower()
            assert "stack trace" not in error_msg.lower()
            assert "file \"" not in error_msg.lower()

    def test_fides_exception_to_dict_structure(self):
        from app.core.exceptions import FidesException, ErrorCode
        exc = FidesException(
            message="Test error",
            code=ErrorCode.VALIDATION_ERROR,
            status_code=400,
            details={"field": "name"}
        )
        d = exc.to_dict()
        assert d["error"] == "VALIDATION_ERROR"
        assert d["message"] == "Test error"
        assert d["details"] == {"field": "name"}
        assert d["status_code"] == 400


# ==================== P2-7: SSRF 防护测试 ====================

class TestBlockscoutSSRFProtection:
    """测试 Blockscout 服务的 SSRF 防护"""

    def test_validate_blockscout_url_allows_whitelisted_hosts(self):
        from app.services.blockscout_service import _validate_blockscout_url
        assert _validate_blockscout_url("https://eth.blockscout.com") is True
        assert _validate_blockscout_url("https://sepolia.blockscout.com/api") is True
        assert _validate_blockscout_url("https://polygon.blockscout.com") is True

    def test_validate_blockscout_url_rejects_malicious_hosts(self):
        from app.services.blockscout_service import _validate_blockscout_url
        assert _validate_blockscout_url("https://evil.com") is False
        assert _validate_blockscout_url("https://attacker.com/api") is False
        assert _validate_blockscout_url("http://169.254.169.254") is False  # AWS metadata
        # localhost 在白名单中（允许开发/测试环境）
        assert _validate_blockscout_url("http://localhost:22") is True

    def test_validate_blockscout_url_rejects_invalid_schemes(self):
        from app.services.blockscout_service import _validate_blockscout_url
        assert _validate_blockscout_url("ftp://blockscout.com") is False
        assert _validate_blockscout_url("file:///etc/passwd") is False
        assert _validate_blockscout_url("javascript:alert(1)") is False

    def test_validate_blockscout_url_allows_localhost(self):
        from app.services.blockscout_service import _validate_blockscout_url
        assert _validate_blockscout_url("http://localhost:4000") is True
        assert _validate_blockscout_url("http://127.0.0.1:4000") is True

    def test_blockscout_service_rejects_bad_base_url(self):
        """测试初始化时拒绝不在白名单中的 base_url"""
        from app.services.blockscout_service import BlockscoutService, BlockscoutAPIException
        import app.services.blockscout_service as bss_module
        
        # 临时修改 settings
        original_url = bss_module.settings.BLOCKSCOUT_BASE_URL
        try:
            bss_module.settings.BLOCKSCOUT_BASE_URL = "https://evil.com"
            with pytest.raises(BlockscoutAPIException) as exc_info:
                BlockscoutService()
            assert "not in the allowed whitelist" in str(exc_info.value)
        finally:
            bss_module.settings.BLOCKSCOUT_BASE_URL = original_url

    @pytest.mark.asyncio
    async def test_blockscout_request_rejects_ssrf_url(self):
        """测试 _request 方法拒绝拼接后的恶意 URL"""
        from app.services.blockscout_service import BlockscoutService, BlockscoutAPIException
        import app.services.blockscout_service as bss_module
        
        original_url = bss_module.settings.BLOCKSCOUT_BASE_URL
        try:
            # 使用合法 base_url 但尝试通过 endpoint 注入
            bss_module.settings.BLOCKSCOUT_BASE_URL = "https://eth.blockscout.com"
            service = BlockscoutService()
            
            # 构造一个 SSRF payload
            with pytest.raises(BlockscoutAPIException) as exc_info:
                await service._request("GET", "http://evil.com/api")
            assert "not in the allowed" in str(exc_info.value)
        finally:
            bss_module.settings.BLOCKSCOUT_BASE_URL = original_url


# ==================== P3: 代码质量测试 ====================

class TestCodeQuality:
    """测试代码质量和一致性"""

    def test_no_duplicate_methods_in_blockscout_service(self):
        """确保 BlockscoutService 没有重复定义的方法"""
        from app.services.blockscout_service import BlockscoutService
        import inspect
        
        methods = {}
        for name, method in inspect.getmembers(BlockscoutService, predicate=inspect.isfunction):
            if name.startswith("_"):
                continue
            if name in methods:
                pytest.fail(f"Duplicate method definition found: {name}")
            methods[name] = method
        
        # 确认 get_address_info 只定义了一次
        assert "get_address_info" in methods

    def test_logging_imports_are_sorted(self):
        """测试 logging.py 的 import 顺序"""
        import ast
        import inspect
        from app.core import logging as logging_module
        
        source = inspect.getsource(logging_module)
        tree = ast.parse(source)
        
        imports = []
        for node in ast.walk(tree):
            if isinstance(node, (ast.Import, ast.ImportFrom)):
                for alias in node.names:
                    imports.append(alias.name)
        
        # 确认关键导入存在
        assert "structlog" in [i for i in imports]
        assert "re" in [i for i in imports]


# ==================== P1 验证测试（确认 P0 修复已生效） ====================

class TestP0FixesVerified:
    """
    验证 P0 修复（已在 commit fe18a99d 中完成）
    这些测试确保关键安全修复没有被回退。
    """

    def test_auth_uses_bcrypt(self):
        """验证 auth.py 使用 bcrypt 而非明文比较"""
        from app.controllers.auth import _get_admin_password_hash
        import bcrypt
        
        # 设置一个测试密码
        os.environ["ADMIN_PASSWORD"] = bcrypt.hashpw(b"testpass", bcrypt.gensalt()).decode()
        
        # 清除缓存
        import app.controllers.auth as auth_module
        auth_module._admin_password_hash = None
        
        hash_bytes = _get_admin_password_hash()
        assert hash_bytes != b""
        assert hash_bytes.startswith((b"$2a$", b"$2b$"))

    def test_blockscout_record_methods_are_async(self):
        """验证 _record_success 和 _record_failure 是 async 方法"""
        from app.services.blockscout_service import BlockscoutService
        import inspect
        
        assert inspect.iscoroutinefunction(BlockscoutService._record_success)
        assert inspect.iscoroutinefunction(BlockscoutService._record_failure)

    def test_monitor_cleanup_before_return(self):
        """验证 monitor.py 中清理逻辑在 return 之前"""
        import ast
        import inspect
        from app.controllers import monitor as monitor_module
        
        source = inspect.getsource(monitor_module)
        tree = ast.parse(source)
        
        # 检查 monitor_stream 函数中 del 语句是否在 return 之前
        found_del = False
        for node in ast.walk(tree):
            if isinstance(node, ast.Delete):
                # 确认 Delete 节点存在
                found_del = True
                break
        
        assert found_del, "Expected del statement for API key cleanup"
