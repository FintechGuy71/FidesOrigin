"""
FidesOrigin 告警服务（重构版）
观察者模式：风险引擎异常时自动触发告警
"""
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

import httpx

from app.config import get_settings
from app.core.logging import get_logger

logger = get_logger(__name__)
settings = get_settings()


class AlertService:
    """
    告警服务 - 观察者模式实现
    
    监听风险引擎异常，触发多渠道告警：
    - 结构化日志（始终）
    - Webhook（可选）
    - 可扩展：Slack / 飞书 / PagerDuty
    
    特性：
    - 告警冷却（防止告警风暴）
    - 告警分级（critical / warning / info）
    - 上下文信息自动附加
    """
    
    def __init__(self):
        self.webhook_url = settings.ALERT_WEBHOOK_URL
        self.enabled = settings.ALERT_ENABLED
        self.cooldown_minutes = settings.ALERT_COOLDOWN_MINUTES
        self._last_alert_time: Optional[datetime] = None
        self._alert_counts: Dict[str, int] = {}  # 按类型统计
    
    def _should_alert(self, alert_type: str) -> bool:
        """检查是否需要发送告警（防告警风暴）"""
        if not self.enabled:
            return False
        
        now = datetime.now(timezone.utc)
        if (self._last_alert_time is None or
                now - self._last_alert_time > timedelta(minutes=self.cooldown_minutes)):
            self._last_alert_time = now
            self._alert_counts[alert_type] = self._alert_counts.get(alert_type, 0) + 1
            return True
        return False
    
    async def send_alert(
        self,
        alert_type: str,
        message: str,
        severity: str = "critical",
        details: Optional[Dict[str, Any]] = None,
        exc: Optional[Exception] = None
    ) -> None:
        """
        发送告警
        
        Args:
            alert_type: 告警类型（如 address_risk_calculation_failed）
            message: 告警消息
            severity: 严重级别（critical / warning / info）
            details: 附加详情
            exc: 异常对象（可选）
        """
        payload = {
            "alert_type": alert_type,
            "message": message,
            "service": "fidesorigin-risk-engine",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "severity": severity,
            "details": details or {},
        }

        if exc:
            payload["error"] = str(exc)
            payload["error_type"] = type(exc).__name__

        # 1. 结构化日志（始终执行）
        log_method = getattr(logger, severity, logger.critical)
        log_method(
            "risk_engine_alert",
            alert_type=alert_type,
            message=message,
            severity=severity,
            details=payload["details"],
            error=payload.get("error")
        )

        # 2. Webhook 告警（如果配置了且通过冷却检查）
        if self.webhook_url and self._should_alert(alert_type):
            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    response = await client.post(
                        self.webhook_url,
                        json=payload,
                        headers={"Content-Type": "application/json"}
                    )
                    if response.status_code < 400:
                        logger.info(
                            "alert_webhook_sent",
                            alert_type=alert_type,
                            status_code=response.status_code
                        )
                    else:
                        logger.warning(
                            "alert_webhook_failed",
                            status_code=response.status_code,
                            response=response.text[:200]
                        )
            except Exception as e:
                logger.error("alert_webhook_error", error=str(e))

    async def send_risk_alert(
        self,
        address: str,
        risk_score: float,
        risk_level: str,
        indicators: list
    ) -> None:
        """发送高风险地址告警"""
        if risk_score < 60:
            return  # 只告警中高风险
        
        await self.send_alert(
            alert_type="high_risk_address_detected",
            message=f"High risk address detected: {address}",
            severity="warning" if risk_score < 85 else "critical",
            details={
                "address": address,
                "risk_score": risk_score,
                "risk_level": risk_level,
                "indicators": indicators
            }
        )
    
    def get_stats(self) -> Dict[str, Any]:
        """获取告警统计"""
        return {
            "enabled": self.enabled,
            "webhook_configured": bool(self.webhook_url),
            "cooldown_minutes": self.cooldown_minutes,
            "last_alert_time": self._last_alert_time.isoformat() if self._last_alert_time else None,
            "alert_counts": self._alert_counts.copy()
        }
