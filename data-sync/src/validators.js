/**
 * @title Shared Validators
 * @notice Extracted from scheduler.js to break circular dependency
 *         (scheduler ↔ chainSyncer both need these functions)
 */

const { ValidationError } = require('./utils/errors');

function validateEthereumAddress(address) {
  if (!address || typeof address !== 'string')
    throw new ValidationError('地址不能为空', 'address');
  if (!address.match(/^0x[a-fA-F0-9]{40}$/))
    throw new ValidationError('无效的以太坊地址格式', 'address');
  return address.toLowerCase();
}

function validateRiskScore(score) {
  const num = parseInt(score);
  if (isNaN(num) || num < 0 || num > 100)
    throw new ValidationError('风险评分必须在 0-100 之间', 'riskScore');
  return num;
}

function validateUrl(urlStr) {
  let parsed;
  try {
    parsed = new URL(urlStr);
  } catch (e) {
    throw new ValidationError(`无效的 URL: ${urlStr}`);
  }
  // [Fix] Allow HTTP in development/test environments
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new ValidationError(`仅允许 HTTP/HTTPS 协议: ${parsed.protocol}`);
  }
  if (parsed.protocol === 'http:' && process.env.NODE_ENV === 'production') {
    throw new ValidationError(`生产环境仅允许 HTTPS 协议: ${parsed.protocol}`);
  }

  const hostname = parsed.hostname.toLowerCase();
  const blocked = [
    /^localhost$/i, /^127\./, /^10\./, /^172\.(1[6-9]|2[0-9]|3[01])\./,
    /^192\.168\./, /^169\.254\./, /^0\./, /^::1$/, /^fc00:/i,
    /^fd[0-9a-f]{2}:/i, /^fe80:/i, /^0:0:0:0:0:0:0:1$/, /^metadata$/i,
    /^metadata\.google\.internal$/i,
    // [Cross-check fix] CGNAT (100.64.0.0/10) and benchmarking (198.18.0.0/15)
    /^100\.(6[4-9]|[7-9][0-9]|1[0-2][0-7])\./,
    /^198\.(1[89])\./,
  ];
  if (blocked.some((p) => p.test(hostname)))
    throw new ValidationError(`被阻止的主机名（潜在 SSRF）: ${hostname}`);
  return parsed;
}

module.exports = {
  validateEthereumAddress,
  validateRiskScore,
  validateUrl,
};
