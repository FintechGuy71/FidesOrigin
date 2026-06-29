"""
FidesOrigin 输入验证器
强化输入验证，防止注入攻击和格式错误
"""
import re
from typing import Optional

from app.core.exceptions import ValidationException

# 以太坊地址正则（严格校验）
ETH_ADDRESS_RE = re.compile(r"^0x[a-fA-F0-9]{40}$")

# 交易哈希正则（严格校验）
TX_HASH_RE = re.compile(r"^0x[a-fA-F0-9]{64}$")

# 链类型白名单
SUPPORTED_CHAINS = {"ethereum", "bsc", "polygon", "arbitrum", "optimism", "base"}


def validate_address(address: str) -> str:
    """
    验证以太坊地址格式
    
    Args:
        address: 待验证的地址
    
    Returns:
        str: 标准化后的地址（小写）
    
    Raises:
        ValidationException: 地址格式无效
    """
    if not address:
        raise ValidationException("Address is required", field="address")
    
    address = address.strip()
    
    if not ETH_ADDRESS_RE.match(address):
        raise ValidationException(
            f"Invalid Ethereum address format: {address[:20]}...",
            field="address"
        )
    
    return address.lower()


def validate_tx_hash(tx_hash: str) -> str:
    """
    验证交易哈希格式
    
    Args:
        tx_hash: 待验证的交易哈希
    
    Returns:
        str: 标准化后的交易哈希（小写）
    
    Raises:
        ValidationException: 哈希格式无效
    """
    if not tx_hash:
        raise ValidationException("Transaction hash is required", field="tx_hash")
    
    tx_hash = tx_hash.strip()
    
    if not TX_HASH_RE.match(tx_hash):
        raise ValidationException(
            f"Invalid transaction hash format: {tx_hash[:20]}...",
            field="tx_hash"
        )
    
    return tx_hash.lower()


def validate_chain(chain: str) -> str:
    """
    验证链类型
    
    Args:
        chain: 待验证的链类型
    
    Returns:
        str: 标准化后的链类型（小写）
    
    Raises:
        ValidationException: 不支持的链类型
    """
    if not chain:
        return "ethereum"  # 默认链
    
    chain = chain.strip().lower()
    
    if chain not in SUPPORTED_CHAINS:
        raise ValidationException(
            f"Unsupported chain: {chain}. Supported: {', '.join(SUPPORTED_CHAINS)}",
            field="chain"
        )
    
    return chain


def validate_risk_score(score: float) -> float:
    """
    验证风险评分范围
    
    Args:
        score: 风险评分
    
    Returns:
        float: 验证后的评分
    
    Raises:
        ValidationException: 评分超出范围
    """
    if not isinstance(score, (int, float)):
        raise ValidationException("Risk score must be a number", field="risk_score")
    
    if score < 0 or score > 100:
        raise ValidationException(
            f"Risk score must be between 0 and 100, got {score}",
            field="risk_score"
        )
    
    return float(score)


def validate_page(page: int) -> int:
    """验证页码"""
    if page < 1:
        raise ValidationException("Page must be >= 1", field="page")
    return page


def validate_page_size(page_size: int, max_size: int = 100) -> int:
    """验证每页数量"""
    if page_size < 1:
        raise ValidationException("Page size must be >= 1", field="page_size")
    if page_size > max_size:
        raise ValidationException(
            f"Page size must be <= {max_size}",
            field="page_size"
        )
    return page_size


def sanitize_string(value: str, max_length: int = 255) -> str:
    """
    清理字符串输入
    
    - 去除首尾空白
    - 限制长度
    - 去除控制字符
    """
    if not value:
        return ""
    
    # 去除控制字符
    value = "".join(char for char in value if ord(char) >= 32 or char in '\t\n\r')
    
    # 去除首尾空白
    value = value.strip()
    
    # 限制长度
    if len(value) > max_length:
        value = value[:max_length]
    
    return value


def validate_email(email: Optional[str]) -> Optional[str]:
    """
    验证邮箱格式
    
    简单的邮箱格式校验
    """
    if not email:
        return None
    
    email = email.strip().lower()
    
    # 基本格式检查
    if "@" not in email or "." not in email.split("@")[-1]:
        raise ValidationException("Invalid email format", field="email")
    
    # 长度检查
    if len(email) > 254:
        raise ValidationException("Email too long", field="email")
    
    return email


def validate_api_key(api_key: str) -> str:
    """
    验证 API Key 格式
    
    Args:
        api_key: API Key
    
    Returns:
        str: 验证后的 API Key
    
    Raises:
        ValidationException: API Key 格式无效
    """
    if not api_key:
        raise ValidationException("API key is required", field="api_key")
    
    api_key = api_key.strip()
    
    # 最小长度检查
    if len(api_key) < 16:
        raise ValidationException(
            "API key must be at least 16 characters",
            field="api_key"
        )
    
    return api_key
