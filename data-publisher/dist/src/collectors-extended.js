"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchElliptic = fetchElliptic;
exports.fetchTRMLabs = fetchTRMLabs;
exports.fetchCSV = fetchCSV;
exports.fetchJSON = fetchJSON;
exports.getFlashbotsProvider = getFlashbotsProvider;
const axios_1 = __importDefault(require("axios"));
const promises_1 = __importDefault(require("fs/promises"));
const fs_1 = require("fs");
const csv_parser_1 = __importDefault(require("csv-parser"));
const types_1 = require("./types");
const logger_1 = __importDefault(require("./logger"));
/**
 * Extended Data Collectors — additional sources beyond the base set
 */
// ============================================
// Elliptic API
// ============================================
async function fetchElliptic(config) {
    if (!config.apiKey) {
        logger_1.default.warn('Elliptic API key not configured');
        return [];
    }
    const response = await axios_1.default.get(`${config.endpoint}v2/wallet Screening`, {
        headers: {
            'x-api-key': config.apiKey,
            'Content-Type': 'application/json',
        },
        timeout: config.timeout,
        maxRedirects: 0,
    });
    const results = [];
    for (const item of response.data?.entities || []) {
        const riskScore = item.riskScore || 0;
        results.push({
            address: item.address.toLowerCase(),
            source: 'Elliptic',
            riskScore,
            tier: scoreToTier(riskScore),
            tags: item.tags || [],
            isSanctioned: item.sanctions || false,
            reason: item.description || 'Elliptic risk assessment',
            confidence: 0.92,
        });
    }
    return results;
}
// ============================================
// TRM Labs API
// ============================================
async function fetchTRMLabs(config) {
    if (!config.apiKey) {
        logger_1.default.warn('TRM Labs API key not configured');
        return [];
    }
    const response = await axios_1.default.post(`${config.endpoint}v1/screening/addresses`, {
        addresses: [], // Would batch addresses for screening
    }, {
        headers: {
            'Authorization': `Bearer ${config.apiKey}`,
            'Content-Type': 'application/json',
        },
        timeout: config.timeout,
        maxRedirects: 0,
    });
    const results = [];
    for (const item of response.data?.results || []) {
        const riskScore = item.riskScore || 0;
        results.push({
            address: item.address.toLowerCase(),
            source: 'TRM-Labs',
            riskScore,
            tier: scoreToTier(riskScore),
            tags: item.categories || [],
            isSanctioned: item.sanctions || false,
            reason: item.description || 'TRM Labs risk assessment',
            confidence: 0.90,
        });
    }
    return results;
}
// ============================================
// Local CSV File
// ============================================
async function fetchCSV(config) {
    const filePath = config.endpoint.replace('file://', '');
    try {
        await promises_1.default.access(filePath);
    }
    catch {
        logger_1.default.error(`CSV file not found: ${filePath}`);
        return [];
    }
    return new Promise((resolve, reject) => {
        const results = [];
        (0, fs_1.createReadStream)(filePath)
            .pipe((0, csv_parser_1.default)())
            .on('data', (row) => {
            try {
                const address = (row.address || row.addr || row.wallet)?.toLowerCase().trim();
                if (!address || !address.match(/^0x[0-9a-f]{40}$/))
                    return;
                const riskScore = parseInt(row.riskScore || row.riskScore || '0', 10);
                const tags = (row.tags || row.categories || '')
                    .split(',')
                    .map((t) => t.trim().toLowerCase())
                    .filter((t) => t.length > 0);
                results.push({
                    address,
                    source: row.source || 'CSV-Import',
                    riskScore,
                    tier: scoreToTier(riskScore),
                    tags,
                    isSanctioned: row.sanctioned?.toLowerCase() === 'true' || tags.includes('sanctioned'),
                    reason: row.reason || row.description || 'CSV imported risk data',
                    confidence: parseFloat(row.confidence || '0.8'),
                });
            }
            catch (err) {
                logger_1.default.warn(`Failed to parse CSV row`, { row, error: err.message });
            }
        })
            .on('end', () => {
            logger_1.default.info(`Parsed ${results.length} records from CSV: ${filePath}`);
            resolve(results);
        })
            .on('error', reject);
    });
}
// ============================================
// JSON File (local or remote URL)
// ============================================
async function fetchJSON(config) {
    let data;
    if (config.endpoint.startsWith('http')) {
        const response = await axios_1.default.get(config.endpoint, {
            timeout: config.timeout,
            maxRedirects: 0,
        });
        data = response.data;
    }
    else {
        const filePath = config.endpoint.replace('file://', '');
        const content = await promises_1.default.readFile(filePath, 'utf-8');
        data = JSON.parse(content);
    }
    const results = [];
    const items = Array.isArray(data) ? data : data.addresses || data.results || [];
    for (const item of items) {
        const address = (item.address || item.addr || item.wallet)?.toLowerCase().trim();
        if (!address || !address.match(/^0x[0-9a-f]{40}$/))
            continue;
        const riskScore = item.riskScore || item.riskScore || 0;
        const tags = Array.isArray(item.tags) ? item.tags :
            (item.tags || item.categories || '').split(',').map((t) => t.trim()).filter(Boolean);
        results.push({
            address,
            source: item.source || 'JSON-Import',
            riskScore,
            tier: scoreToTier(riskScore),
            tags,
            isSanctioned: item.sanctioned === true || tags.includes('sanctioned'),
            reason: item.reason || item.description || 'JSON imported risk data',
            confidence: item.confidence || 0.8,
        });
    }
    return results;
}
// ============================================
// Flashbots Protect RPC (MEV protection)
// ============================================
function getFlashbotsProvider(rpcUrl) {
    // Replace standard RPC with Flashbots Protect for transaction privacy
    if (rpcUrl.includes('mainnet')) {
        return 'https://rpc.flashbots.net';
    }
    return rpcUrl;
}
// ============================================
// Helper
// ============================================
function scoreToTier(score) {
    if (score >= 80)
        return types_1.RiskTier.CRITICAL;
    if (score >= 60)
        return types_1.RiskTier.HIGH;
    if (score >= 40)
        return types_1.RiskTier.MEDIUM;
    if (score >= 20)
        return types_1.RiskTier.LOW;
    return types_1.RiskTier.UNKNOWN;
}
//# sourceMappingURL=collectors-extended.js.map