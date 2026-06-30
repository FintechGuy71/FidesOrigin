"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DataCollector = void 0;
const axios_1 = __importDefault(require("axios"));
const xml2js_1 = require("xml2js");
const types_1 = require("./types");
const logger_1 = __importDefault(require("./logger"));
const collectors_extended_1 = require("./collectors-extended");
/**
 * Data Collector — fetches risk data from multiple sources
 */
class DataCollector {
    configs;
    constructor(configs) {
        this.configs = new Map(configs.map(c => [c.id, c]));
    }
    /**
     * Collect data from all enabled sources
     */
    async collectAll() {
        const results = [];
        const errors = [];
        for (const [id, config] of this.configs) {
            if (!config.enabled) {
                logger_1.default.debug(`Skipping disabled source: ${id}`);
                continue;
            }
            try {
                logger_1.default.info(`Collecting from ${config.name}...`, { source: id });
                const data = await this.collectFromSource(config);
                results.push(...data);
                logger_1.default.info(`Collected ${data.length} records from ${config.name}`, { source: id, count: data.length });
            }
            catch (error) {
                const errMsg = `Failed to collect from ${config.name}: ${error.message}`;
                logger_1.default.error(errMsg, { source: id, error: error.stack });
                errors.push(errMsg);
            }
        }
        if (errors.length > 0) {
            logger_1.default.warn(`Collection completed with ${errors.length} errors`, { errors });
        }
        return results;
    }
    /**
     * Collect from a single source with retry logic
     */
    async collectFromSource(config) {
        let lastError;
        for (let attempt = 1; attempt <= config.retryCount; attempt++) {
            try {
                switch (config.id) {
                    case 'ofac-sdn':
                        return await this.fetchOFAC(config);
                    case 'chainalysis':
                        return await this.fetchChainalysis(config);
                    case 'opensanctions':
                        return await this.fetchOpenSanctions(config);
                    case 'etherscan':
                        return await this.fetchEtherscan(config);
                    case 'elliptic':
                        return await (0, collectors_extended_1.fetchElliptic)(config);
                    case 'trm-labs':
                        return await (0, collectors_extended_1.fetchTRMLabs)(config);
                    case 'csv-import':
                        return await (0, collectors_extended_1.fetchCSV)(config);
                    default:
                        if (config.endpoint.endsWith('.json') || config.endpoint.startsWith('http')) {
                            return await (0, collectors_extended_1.fetchJSON)(config);
                        }
                        throw new Error(`Unknown source: ${config.id}`);
                }
            }
            catch (error) {
                lastError = error;
                if (attempt < config.retryCount) {
                    const delay = Math.min(1000 * Math.pow(2, attempt - 1), 30000); // Exponential backoff, max 30s
                    logger_1.default.warn(`Retry ${attempt}/${config.retryCount} for ${config.name} after ${delay}ms`, { source: config.id });
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }
        throw lastError || new Error(`Failed to collect from ${config.name} after ${config.retryCount} attempts`);
    }
    /**
     * Fetch OFAC SDN List (XML format)
     */
    async fetchOFAC(config) {
        const response = await axios_1.default.get(config.endpoint, {
            timeout: config.timeout,
            responseType: 'text',
            maxRedirects: 0, // Prevent SSRF
            validateStatus: (status) => status === 200,
        });
        const xml = response.data;
        const parsed = await (0, xml2js_1.parseStringPromise)(xml, { explicitArray: false });
        const results = [];
        // Extract addresses from OFAC SDN XML structure
        // The SDN list has publishInformation and sdnList -> sdnEntry
        const sdnEntries = parsed?.sdnList?.sdnEntry || [];
        const entries = Array.isArray(sdnEntries) ? sdnEntries : [sdnEntries];
        for (const entry of entries) {
            // Check if entry has addresses
            const addresses = entry.addressList?.address;
            if (!addresses)
                continue;
            const addrList = Array.isArray(addresses) ? addresses : [addresses];
            for (const addr of addrList) {
                if (addr?.address) {
                    const address = addr.address.toLowerCase().trim();
                    // Validate Ethereum address format
                    if (address.match(/^0x[0-9a-f]{40}$/)) {
                        results.push({
                            address,
                            source: 'OFAC-SDN',
                            riskScore: 100,
                            tier: types_1.RiskTier.CRITICAL,
                            tags: ['sanctioned', 'ofac'],
                            isSanctioned: true,
                            reason: entry.sdnName || 'OFAC SDN listed',
                            confidence: 0.99,
                        });
                    }
                }
            }
        }
        return results;
    }
    /**
     * Fetch Chainalysis API
     */
    async fetchChainalysis(config) {
        if (!config.apiKey) {
            logger_1.default.warn('Chainalysis API key not configured, skipping');
            return [];
        }
        const response = await axios_1.default.get(`${config.endpoint}api/v1/risk`, {
            headers: { 'Authorization': `Bearer ${config.apiKey}` },
            timeout: config.timeout,
            maxRedirects: 0,
            validateStatus: (status) => status === 200,
        });
        // Chainalysis returns risk assessments
        const data = response.data;
        const results = [];
        for (const item of data?.entities || []) {
            const riskScore = item.riskScore || 0;
            const tier = this.scoreToTier(riskScore);
            results.push({
                address: item.address.toLowerCase(),
                source: 'Chainalysis',
                riskScore,
                tier,
                tags: item.categories || [],
                isSanctioned: item.sanctioned || false,
                reason: item.description || 'Chainalysis risk assessment',
                confidence: 0.9,
            });
        }
        return results;
    }
    /**
     * Fetch OpenSanctions API
     */
    async fetchOpenSanctions(config) {
        const headers = {};
        if (config.apiKey) {
            headers['Authorization'] = `ApiKey ${config.apiKey}`;
        }
        const response = await axios_1.default.get(`${config.endpoint}entities/?schema=Person&limit=1000`, {
            headers,
            timeout: config.timeout,
            maxRedirects: 0,
            validateStatus: (status) => status === 200,
        });
        const results = [];
        for (const entity of response.data?.results || []) {
            // Extract Ethereum addresses from properties
            const cryptoAddresses = entity?.properties?.cryptoAddress || [];
            for (const addr of cryptoAddresses) {
                const address = addr.toLowerCase().trim();
                if (address.match(/^0x[0-9a-f]{40}$/)) {
                    results.push({
                        address,
                        source: 'OpenSanctions',
                        riskScore: entity?.properties?.riskScore || 80,
                        tier: types_1.RiskTier.HIGH,
                        tags: ['sanctioned', 'opensanctions'],
                        isSanctioned: true,
                        reason: entity?.caption || 'OpenSanctions listed entity',
                        confidence: 0.85,
                    });
                }
            }
        }
        return results;
    }
    /**
     * Fetch Etherscan labels
     */
    async fetchEtherscan(config) {
        if (!config.apiKey) {
            logger_1.default.warn('Etherscan API key not configured, skipping');
            return [];
        }
        // Note: Etherscan doesn't have a direct "labels" API endpoint for all addresses
        // This is a placeholder implementation
        logger_1.default.warn('Etherscan label fetching not fully implemented — requires custom implementation');
        return [];
    }
    /**
     * Convert score (0-100) to tier
     */
    scoreToTier(score) {
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
    /**
     * Collect from a specific source by ID
     */
    async collectFromSourceId(sourceId) {
        const config = this.configs.get(sourceId);
        if (!config)
            throw new Error(`Source not found: ${sourceId}`);
        if (!config.enabled)
            throw new Error(`Source disabled: ${sourceId}`);
        return this.collectFromSource(config);
    }
}
exports.DataCollector = DataCollector;
exports.default = DataCollector;
//# sourceMappingURL=collector.js.map