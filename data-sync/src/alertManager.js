/**
 * Alert Manager — 告警通知系统
 *
 * 负责：Slack / PagerDuty 告警发送
 * 独立 axios 实例，不影响同步服务网络配置
 */

'use strict';

const axios = require('axios');
const { defaultLogger: secureLog } = require('./utils/logger');

// 告警系统专用实例（独立超时配置）
const alertAxios = axios.create({
  timeout: 10000,
});

/**
 * 发送告警到已配置的渠道（Slack / PagerDuty）
 * @param {string} message - 告警消息
 */
async function sendAlert(message) {
  const alerts = [];

  if (process.env.SLACK_WEBHOOK_URL) {
    alerts.push(
      alertAxios
        .post(process.env.SLACK_WEBHOOK_URL, {
          text: message,
          username: 'FidesOrigin Alert',
          icon_emoji: ':warning:',
        })
        .catch((e) => secureLog.error('[Alert] Slack 发送失败:', e.message))
    );
  }

  if (process.env.PAGERDUTY_KEY) {
    alerts.push(
      alertAxios
        .post('https://events.pagerduty.com/v2/enqueue', {
          routing_key: process.env.PAGERDUTY_KEY,
          event_action: 'trigger',
          payload: {
            summary: message,
            severity: 'critical',
            source: 'fidesorigin-sync',
          },
        })
        .catch((e) => secureLog.error('[Alert] PagerDuty 发送失败:', e.message))
    );
  }

  await Promise.all(alerts);
}

module.exports = {
  alertAxios,
  sendAlert,
};
