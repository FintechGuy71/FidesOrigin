import axios from 'axios';
import { isValidEthAddress, normalizeAddress } from './address-utils';
import logger from './logger';

/**
 * A single crypto-related sanctions entry from OpenSanctions.
 */
export interface OpenSanctionsEntry {
  /** OpenSanctions entity ID (e.g. "us-ofac-sdn/xxxxx"). */
  id: string;
  /** Entity / person name. */
  name: string;
  /** Entity type (Person, Organization, Company, etc.). */
  type: string;
  /** Associated countries (ISO2 or full names). */
  countries: string[];
  /** Crypto addresses linked to this entity. */
  cryptoAddresses: { currency: string; address: string }[];
  /** Sanctions programs (e.g. ["SDNTO", "IRAN"]). */
  sanctionsPrograms: string[];
  /** Data source identifier. */
  dataSource: string;
}

/** Primary download URL — FollowTheMoney JSON (entities.ftm.json). */
const FTM_URL = 'https://data.opensanctions.org/datasets/latest/us_ofac_sdn/entities.ftm.json';

/** Fallback — simple CSV (targets.simple.csv). */
const CSV_URL = 'https://data.opensanctions.org/datasets/latest/us_ofac_sdn/targets.simple.csv';

/** Request timeout (49MB file). */
const FETCH_TIMEOUT = 120_000;

/**
 * OpenSanctionsCollector — downloads structured OFAC SDN data from OpenSanctions.org
 * and extracts cryptocurrency wallet entries (~797 entities).
 *
 * Strategy:
 *  1. Try FollowTheMoney JSON (rich schema, reliable).
 *  2. Fall back to simple CSV.
 *  3. Filter to entities that have at least one crypto address.
 */
export class OpenSanctionsCollector {
  private ftmUrl: string;
  private csvUrl: string;
  private timeout: number;

  constructor(opts?: { ftmUrl?: string; csvUrl?: string; timeout?: number }) {
    this.ftmUrl = opts?.ftmUrl ?? FTM_URL;
    this.csvUrl = opts?.csvUrl ?? CSV_URL;
    this.timeout = opts?.timeout ?? FETCH_TIMEOUT;
  }

  /**
   * Download and parse the OFAC SDN dataset, returning only entries
   * that have at least one cryptocurrency address.
   */
  async collectCryptoAddresses(): Promise<OpenSanctionsEntry[]> {
    let entries: OpenSanctionsEntry[];

    try {
      entries = await this.collectFromFTM();
    } catch (ftmErr) {
      logger.warn('OpenSanctionsCollector: FTM JSON failed, falling back to CSV', { error: (ftmErr as Error).message });
      try {
        entries = await this.collectFromCSV();
      } catch (csvErr) {
        logger.error('OpenSanctionsCollector: both FTM and CSV sources failed', {
          ftmError: (ftmErr as Error).message,
          csvError: (csvErr as Error).message,
        });
        throw csvErr;
      }
    }

    logger.info('OpenSanctionsCollector: collection complete', {
      totalCryptoEntries: entries.length,
    });

    return entries;
  }

  /**
   * Parse FollowTheMoney JSON (streaming line-by-line).
   * The file is a JSON array of entity objects, ~49MB.
   */
  private async collectFromFTM(): Promise<OpenSanctionsEntry[]> {
    logger.info('OpenSanctionsCollector: fetching FTM JSON...', { url: this.ftmUrl });

    const response = await axios.get(this.ftmUrl, {
      timeout: this.timeout,
      responseType: 'text', // we'll parse manually for memory efficiency
      maxRedirects: 3,
      validateStatus: s => s === 200,
    });

    const raw = response.data as string;
    logger.info('OpenSanctionsCollector: FTM JSON downloaded', { sizeMB: (raw.length / 1e6).toFixed(1) });

    // The FTM export is a JSON array
    const entities = JSON.parse(raw) as any[];
    const results: OpenSanctionsEntry[] = [];

    for (const ent of entities) {
      const cryptoAddresses = this.extractCryptoFromFTM(ent);
      if (cryptoAddresses.length === 0) continue;

      results.push({
        id: ent.id ?? '',
        name: this.firstValue(ent, ['name', 'caption', 'summary']) ?? 'Unknown',
        type: ent.schema ?? ent.type ?? 'Unknown',
        countries: this.extractCountriesFromFTM(ent),
        cryptoAddresses,
        sanctionsPrograms: this.extractProgramsFromFTM(ent),
        dataSource: 'OpenSanctions-OFAC-SDN',
      });
    }

    return results;
  }

  /**
   * Fallback: parse the simple CSV format using csv-parser (streaming).
   */
  private async collectFromCSV(): Promise<OpenSanctionsEntry[]> {
    const fs = await import('fs');
    const path = await import('path');
    const os = await import('os');
    const { Readable } = await import('stream');
    // Dynamic import of csv-parser (ESM interop)
    const csvParser = (await import('csv-parser')).default;

    logger.info('OpenSanctionsCollector: fetching CSV fallback...', { url: this.csvUrl });

    const response = await axios.get(this.csvUrl, {
      timeout: this.timeout,
      responseType: 'text',
      maxRedirects: 3,
      validateStatus: s => s === 200,
    });

    // Write to a temp file then stream-parse (csv-parser needs a stream)
    const tmpFile = path.join(os.tmpdir(), `opensanctions-${Date.now()}.csv`);
    fs.writeFileSync(tmpFile, response.data);

    return new Promise<OpenSanctionsEntry[]>((resolve, reject) => {
      const results: OpenSanctionsEntry[] = [];
      fs.createReadStream(tmpFile)
        .pipe(csvParser())
        .on('data', (row: Record<string, string>) => {
          // In targets.simple.csv:
          // columns: id, caption, schema, countries, topics, ...
          const cryptoRaw =
            row['crypto_address'] ||
            row['digital_currency_address'] ||
            row['wallets'] ||
            row['address'] ||
            '';

          const cryptoAddresses = this.parseCryptoField(cryptoRaw);
          if (cryptoAddresses.length === 0) return;

          const countries = (row['countries'] || row['country'] || '')
            .split(';')
            .map(c => c.trim())
            .filter(Boolean);

          results.push({
            id: row['id'] || '',
            name: row['caption'] || row['name'] || 'Unknown',
            type: row['schema'] || row['type'] || 'Unknown',
            countries,
            cryptoAddresses,
            sanctionsPrograms: (row['topics'] || '').split(';').map(t => t.trim()).filter(Boolean),
            dataSource: 'OpenSanctions-OFAC-SDN-CSV',
          });
        })
        .on('end', () => {
          // Cleanup temp file
          fs.unlink(tmpFile, () => {});
          resolve(results);
        })
        .on('error', (err: Error) => {
          fs.unlink(tmpFile, () => {});
          reject(err);
        });
    });
  }

  // ─── FTM helpers ───

  /**
   * Extract crypto addresses from a FollowTheMoney entity.
   * FTM stores them under `properties.cryptoAddress` or `properties.cryptoWallet`.
   * Validates Ethereum address format before inclusion.
   */
  private extractCryptoFromFTM(ent: any): { currency: string; address: string }[] {
    const result: { currency: string; address: string }[] = [];
    const props = ent.properties ?? {};

    // Format 1: properties.cryptoAddress = [{ value: "0x...", ... }]
    const cryptoProp = props.cryptoAddress ?? props.cryptoWallet ?? props['properties.cryptoAddress'];
    if (Array.isArray(cryptoProp)) {
      for (const item of cryptoProp) {
        const addr = typeof item === 'string' ? item : item?.value ?? item?.address ?? '';
        const norm = normalizeAddress(addr);
        if (norm) {
          result.push({ currency: this.guessCurrency(norm), address: norm });
        }
      }
    } else if (typeof cryptoProp === 'string' && cryptoProp) {
      const norm = normalizeAddress(cryptoProp);
      if (norm) {
        result.push({ currency: this.guessCurrency(norm), address: norm });
      }
    }

    // Format 2: nested crypto wallets array
    const wallets = ent.cryptoWallets ?? props.cryptoWallets;
    if (Array.isArray(wallets)) {
      for (const w of wallets) {
        const addr = w?.address ?? w?.value ?? '';
        const norm = normalizeAddress(addr);
        if (norm) {
          result.push({ currency: w?.currency ?? this.guessCurrency(norm), address: norm });
        }
      }
    }

    return result;
  }

  /**
   * Extract country codes from FTM entity.
   */
  private extractCountriesFromFTM(ent: any): string[] {
    const props = ent.properties ?? {};
    const countries: string[] = [];

    const countryProp = props.country ?? props.countries ?? props.nationality;
    if (Array.isArray(countryProp)) {
      for (const c of countryProp) {
        const val = typeof c === 'string' ? c : c?.value ?? c?.code ?? '';
        if (val) countries.push(val.trim());
      }
    } else if (typeof countryProp === 'string' && countryProp) {
      countries.push(countryProp.trim());
    }

    // Also check context country
    if (ent.contextCountry) countries.push(ent.contextCountry);
    if (ent.country) countries.push(ent.country);

    return [...new Set(countries)];
  }

  /**
   * Extract sanctions program identifiers from FTM entity.
   */
  private extractProgramsFromFTM(ent: any): string[] {
    const props = ent.properties ?? {};
    const programs: string[] = [];

    const progProp = props.program ?? props.sanctionsProgram ?? props.topics;
    if (Array.isArray(progProp)) {
      for (const p of progProp) {
        const val = typeof p === 'string' ? p : p?.value ?? '';
        if (val) programs.push(val.trim());
      }
    } else if (typeof progProp === 'string' && progProp) {
      programs.push(progProp.trim());
    }

    return [...new Set(programs)];
  }

  /**
   * Heuristic currency guess from address format.
   * Only called after address has been validated.
   */
  private guessCurrency(address: string): string {
    const a = address.trim().toLowerCase();
    if (a.startsWith('0x') && a.length === 42) return 'ETH';
    if (a.startsWith('bc1') || (a.startsWith('1') || a.startsWith('3'))) return 'BTC';
    if (a.startsWith('t1')) return 'ZEC';
    if (a.startsWith('d') || a.startsWith('x')) return 'DASH';
    if (a.startsWith('l') || a.startsWith('m')) return 'LTC';
    return 'UNKNOWN';
  }

  /**
   * Parse a raw crypto field from the CSV format.
   * Validates all extracted addresses.
   */
  private parseCryptoField(raw: string): { currency: string; address: string }[] {
    const trimmed = raw.trim();
    if (!trimmed) return [];

    const results: { currency: string; address: string }[] = [];
    const seen = new Set<string>();

    // Try JSON parse
    if (trimmed.startsWith('[')) {
      try {
        const arr = JSON.parse(trimmed) as any[];
        for (const item of arr) {
          let addr: string | undefined;
          if (typeof item === 'string') {
            addr = normalizeAddress(item);
          } else if (item?.address) {
            addr = normalizeAddress(item.address);
          }
          if (addr && !seen.has(addr)) {
            seen.add(addr);
            results.push({ currency: item?.currency ?? this.guessCurrency(addr), address: addr });
          }
        }
        return results;
      } catch {
        // fall through to semicolon split
      }
    }

    // Semicolon or pipe separated
    for (const part of trimmed.split(/[;|]/)) {
      const addr = normalizeAddress(part);
      if (addr && !seen.has(addr)) {
        seen.add(addr);
        results.push({ currency: this.guessCurrency(addr), address: addr });
      }
    }

    return results;
  }

  /**
   * Get the first non-empty value from an object by trying multiple keys.
   */
  private firstValue(obj: any, keys: string[]): string | undefined {
    for (const k of keys) {
      const v = obj[k];
      if (typeof v === 'string' && v.trim()) return v.trim();
      if (Array.isArray(v) && v.length > 0) {
        const first = v[0];
        if (typeof first === 'string') return first.trim();
        if (first?.value) return String(first.value).trim();
      }
    }
    return undefined;
  }
}

export default OpenSanctionsCollector;


