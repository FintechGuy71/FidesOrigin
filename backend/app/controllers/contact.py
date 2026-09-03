"""
FidesOrigin 联系表单 Controller
官网 Contact 收单端点：校验 -> 蜜罐过滤 -> 落库 -> Webhook/邮件通知
"""
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core.di import get_container, get_db
from app.core.logging import get_logger
from app.models import ContactInquiry
from app.validators import validate_email

logger = get_logger(__name__)
router = APIRouter(prefix="/api/v1/contact", tags=["contact"])

# 成功响应统一文案（蜜罐命中与正常提交返回一致，避免向机器人泄露检测逻辑）
_SUCCESS_MESSAGE = "Thank you. We will get back to you within 24 hours."


class ContactRequest(BaseModel):
    """联系表单请求模型（website 为蜜罐字段，正常用户不会填写）"""
    name: str = Field(..., min_length=1, max_length=100, description="姓名")
    email: str = Field(..., max_length=255, description="邮箱")
    company: Optional[str] = Field(default=None, max_length=100, description="公司（可选）")
    use_case: Optional[str] = Field(default=None, max_length=50, description="使用场景（可选）")
    message: str = Field(..., min_length=1, max_length=5000, description="留言内容")
    # [Contact Fix] 蜜罐字段：前端隐藏，机器人填充后直接静默丢弃
    website: str = Field(default="", description="蜜罐字段（请勿填写）")

    @field_validator("email")
    @classmethod
    def _validate_email(cls, v: str) -> str:
        """复用 app/validators.py 的邮箱校验器"""
        result = validate_email(v)
        if not result:
            raise ValueError("Invalid email format")
        return result


async def _send_notify_email(inquiry: ContactInquiry) -> None:
    """
    [Contact Fix] 可选邮件通知（Resend）。

    仅在配置了 RESEND_API_KEY 时发送；任何失败都只记日志，
    不影响端点的 200 返回。
    """
    settings = get_settings()
    if not settings.RESEND_API_KEY:
        return

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                "https://api.resend.com/emails",
                headers={
                    "Authorization": f"Bearer {settings.RESEND_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "from": f"FidesOrigin Contact <{settings.CONTACT_NOTIFY_EMAIL}>",
                    "to": [settings.CONTACT_NOTIFY_EMAIL],
                    "subject": f"New contact inquiry from {inquiry.name}",
                    "text": (
                        f"Name: {inquiry.name}\n"
                        f"Email: {inquiry.email}\n"
                        f"Company: {inquiry.company or '-'}\n"
                        f"Use case: {inquiry.use_case or '-'}\n"
                        f"IP: {inquiry.ip or '-'}\n\n"
                        f"Message:\n{inquiry.message}"
                    ),
                },
            )
            if response.status_code >= 400:
                logger.warning(
                    "contact_notify_email_failed",
                    status_code=response.status_code,
                    response=response.text[:200],
                )
    except Exception as e:
        # 邮件失败不影响收单结果，只记日志
        logger.error("contact_notify_email_error", error=str(e))


@router.post(
    "",
    summary="提交联系表单",
    description="官网 Contact 表单收单：校验后落库并发送通知（Webhook + 可选邮件）",
    responses={
        200: {"description": "提交成功（蜜罐命中时同样返回成功但不处理）"},
        422: {"description": "请求参数校验失败"},
        429: {"description": "请求过于频繁"},
    }
)
async def submit_contact(
    body: ContactRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    联系表单收单

    [Contact Fix] 处理流程：
    1. 蜜罐检测：website 非空 -> 静默丢弃（返回 200 但不落库、不通知）
    2. 落库 contact_inquiries（记录提交者 IP）
    3. AlertService 发送 "contact_inquiry" webhook 告警
    4. 可选：配置 RESEND_API_KEY 后发送邮件通知（失败不影响返回）
    """
    # 1. 蜜罐：命中则静默丢弃，返回与正常提交一致的响应
    if body.website:
        logger.info("contact_honeypot_triggered", name=body.name[:16])
        return {"success": True, "message": _SUCCESS_MESSAGE}

    # 2. 落库
    client_ip = request.client.host if request.client else None
    inquiry = ContactInquiry(
        name=body.name,
        email=body.email,
        company=body.company,
        use_case=body.use_case,
        message=body.message,
        ip=client_ip,
    )
    db.add(inquiry)
    await db.commit()

    logger.info("contact_inquiry_received", inquiry_id=str(inquiry.id), email=body.email)

    # 3. Webhook 告警通知（AlertService 内部已处理失败容错）
    try:
        await get_container().alert.send_alert(
            alert_type="contact_inquiry",
            message=f"New contact inquiry from {body.name} <{body.email}>",
            severity="info",
            details={
                "inquiry_id": str(inquiry.id),
                "name": body.name,
                "email": body.email,
                "company": body.company,
                "use_case": body.use_case,
                "message_preview": body.message[:200],
            },
        )
    except Exception as e:
        # 告警失败不影响收单结果，只记日志
        logger.error("contact_alert_error", error=str(e))

    # 4. 可选邮件通知（未配置 RESEND_API_KEY 时自动跳过）
    await _send_notify_email(inquiry)

    return {"success": True, "message": _SUCCESS_MESSAGE}
