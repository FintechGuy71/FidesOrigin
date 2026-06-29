import axios from 'axios';
import { parseStringPromise } from 'xml2js';
import { DataSourceConfig, RawRiskData, RiskTier } from './types';
import logger from './logger';
import { fetchElliptic, fetchTRMLabs, fetchCSV, fetchJSON } from './collectors-extended';

/**
 * Data Collector — fetches risk data from multiple sources
 */
export class DataCollector {
  private configs: Map<string, DataSourceConfig>;

  constructor(configs: DataSourceConfig[]) {
    this.configs = new Map(configs.map(c => [c.id, c]));
  }

  /**
   * Collect data from all enabled sources
   */
  async collectAll(): Promise<RawRiskData[]> {
    const results: RawRiskData[] = [];
    const errors: string[] = [];

    for (const [id, config] of this.configs) {
      if (!config.enabled) {
        logger.debug(`Skipping disabled source: ${id}`);
        continue;
      }

      try {
        logger.info(`Collecting from ${config.name}...`, { source: id });
        const data = await this.collectFromSource(config);
        results.push(...data);
        logger.info(`Collected ${data.length} records from ${config.name}`, { source: id, count: data.length });
      } catch (error) {
        const errMsg = `Failed to collect from ${config.name}: ${(error as Error).message}`;
        logger.error(errMsg, { source: id, error: (error as Error).stack });
        errors.push(errMsg);
      }
    }

    if (errors.length > 0) {
      logger.warn(`Collection completed with ${errors.length} errors`, { errors });
    }

    return results;
  }

  /**
   * Collect from a single source with retry logic
   */
  private async collectFromSource(config: DataSourceConfig): Promise<RawRiskData[]> {
    let lastError: Error | undefined;

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
            return await fetchElliptic(config);
          case 'trm-labs':
            return await fetchTRMLabs(config);
          case 'csv-import':
            return await fetchCSV(config);
          default:
            if (config.endpoint.endsWith('.json') || config.endpoint.startsWith('http')) {
              return await fetchJSON(config);
            }
            throw new Error(`Unknown source: ${config.id}`);
        }
      } catch (error) {
        lastError = error as Error;
        if (attempt < config.retryCount) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1) + Math.random() * 1000, 30000); // Exponential backoff + jitter, max 30s
          logger.warn(`Retry ${attempt}/${config.retryCount} for ${config.name} after ${delay}ms`, { source: config.id });
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error(`Failed to collect from ${config.name} after ${config.retryCount} attempts`);
  }

  /**
   * Fetch OFAC SDN List (XML format)
   */
  private async fetchOFAC(config: DataSourceConfig): Promise<RawRiskData[]> {
    const response = await axios.get(config.endpoint, {
      timeout: config.timeout,
      responseType: 'text',
      maxRedirects: 5, // Allow HTTPS upgrade redirects with limit
      validateStatus: (status) => status === 200,
    });

    const xml = response.data;
    const parsed = await parseStringPromise(xml, { explicitArray: false });

    const results: RawRiskData[] = [];

    // Extract addresses from OFAC SDN XML structure
    // The SDN list has publishInformation and sdnList -> sdnEntry
    const sdnEntries = parsed?.sdnList?.sdnEntry || [];
    const entries = Array.isArray(sdnEntries) ? sdnEntries : [sdnEntries];

    for (const entry of entries) {
      // Extract digital currency addresses from idList
      // OFAC SDN stores crypto addresses in idList.id, NOT addressList.address
      const idList = entry.idList?.id;
      if (idList) {
        const ids = Array.isArray(idList) ? idList : [idList];
        for (const id of ids) {
          const idType: string = id.idType || '';
          const idNumber: string = id.idNumber || '';
          // Match "Digital Currency Address - <CCY>"
          if (idType.toLowerCase().includes('digital currency address')) {
            const address = idNumber.trim().toLowerCase();
            // Validate Ethereum address format
            if (address.match(/^0x[0-9a-f]{40}$/)) {
              results.push({
                address,
                source: 'OFAC-SDN',
                riskScore: 100,
                tier: RiskTier.CRITICAL,
                tags: ['sanctioned', 'ofac'],
                isSanctioned: true,
                reason: entry.sdnName || 'OFAC SDN listed',
                confidence: 0.99,
              });
            }
          }
        }
      }
    }

    return results;
  }

  /**
   * Fetch Chainalysis API
   */
  private async fetchChainalysis(config: DataSourceConfig): Promise<RawRiskData[]> {
    if (!config.apiKey) {
      logger.warn('Chainalysis API key not configured, skipping');
      return [];
    }

    const response = await axios.get(`${config.endpoint}api/v1/risk`, {
      headers: { 'Authorization': `Bearer ${config.apiKey}` },
      timeout: config.timeout,
      maxRedirects: 5, // Allow HTTPS upgrade redirects with limit
      validateStatus: (status) => status === 200,
    });

    // Chainalysis returns risk assessments
    const data = response.data;
    const results: RawRiskData[] = [];

    for (const item of data?.entities || []) {
      if (!item.address || typeof item.address !== 'string') continue;
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
  private async fetchOpenSanctions(config: DataSourceConfig): Promise<RawRiskData[]> {
    const headers: Record<string, string> = {};
    if (config.apiKey) {
      headers['Authorization'] = `ApiKey ${config.apiKey}`;
    }

    const response = await axios.get(`${config.endpoint}entities/?schema=Person&limit=1000`, {
      headers,
      timeout: config.timeout,
      maxRedirects: 5, // Allow HTTPS upgrade redirects with limit
      validateStatus: (status) => status === 200,
    });

    const results: RawRiskData[] = [];

    for (const entity of response.data?.results || []) {
      // Extract Ethereum addresses from properties
      const cryptoAddresses = entity?.properties?.cryptoAddress || [];
      for (const addr of cryptoAddresses) {
        if (typeof addr !== 'string') continue;
        const address = addr.toLowerCase().trim();
        if (address.match(/^0x[0-9a-f]{40}$/)) {
          results.push({
            address,
            source: 'OpenSanctions',
            riskScore: entity?.properties?.riskScore || 80,
            tier: RiskTier.HIGH,
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
  private async fetchEtherscan(config: DataSourceConfig): Promise<RawRiskData[]> {
    if (!config.apiKey) {
      logger.warn('Etherscan API key not configured, skipping');
      return [];
    }

    // Note: Etherscan doesn't have a direct "labels" API endpoint for all addresses
    // This is a placeholder implementation
    logger.warn('Etherscan label fetching not fully implemented — requires custom implementation');
    return [];
  }

  /**
   * Convert score (0-100) to tier
   */
  private scoreToTier(score: number): RiskTier {
    if (score >= 80) return RiskTier.CRITICAL;
    if (score >= 60) return RiskTier.HIGH;
    if (score >= 40) return RiskTier.MEDIUM;
    if (score >= 20) return RiskTier.LOW;
    return RiskTier.UNKNOWN;
  }

  /**
   * Collect from a specific source by ID
   */
  async collectFromSourceId(sourceId: string): Promise<RawRiskData[]> {
    const config = this.configs.get(sourceId);
    if (!config) throw new Error(`Source not found: ${sourceId}`);
    if (!config.enabled) throw new Error(`Source disabled: ${sourceId}`);
    return this.collectFromSource(config);
  }
}

export default DataCollector;
