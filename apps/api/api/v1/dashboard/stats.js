const {
  withMiddleware,
  sendError,
  getRiskData,
} = require('../../../lib/utils');

// GET /v1/dashboard/stats
async function handler(req, res) {
  if (req.method !== 'GET') {
    return sendError(res, 405, 'BAD_REQUEST', 'Method not allowed');
  }

  const riskData = await getRiskData();
  const addresses = riskData.list;

  const highRiskCount = addresses.filter((a) => ['CRITICAL', 'HIGH'].includes(a.risk)).length;
  const mediumRiskCount = addresses.filter((a) => a.risk === 'MEDIUM').length;
  const lowRiskCount = addresses.filter((a) => a.risk === 'LOW' || a.risk === 'WHITELIST').length;

  const stats = {
    totalAddresses: addresses.length,
    highRiskCount,
    mediumRiskCount,
    lowRiskCount,
    lastUpdated: new Date().toISOString(),
  };

  return res.status(200).json(stats);
}

module.exports = withMiddleware(handler);
