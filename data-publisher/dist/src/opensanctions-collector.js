"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenSanctionsCollector = void 0;
const axios_1 = __importDefault(require("axios"));
const logger_1 = __importDefault(require("./logger"));
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
class OpenSanctionsCollector {
    ftmUrl;
    csvUrl;
    timeout;
    constructor(opts) {
        this.ftmUrl = opts?.ftmUrl ?? FTM_URL;
        this.csvUrl = opts?.csvUrl ?? CSV_URL;
        this.timeout = opts?.timeout ?? FETCH_TIMEOUT;
    }
    /**
     * Download and parse the OFAC SDN dataset, returning only entries
     * that have at least one cryptocurrency address.
     */
    async collectCryptoAddresses() {
        let entries;
        try {
            entries = await this.collectFromFTM();
        }
        catch (ftmErr) {
            logger_1.default.warn('OpenSanctionsCollector: FTM JSON failed, falling back to CSV', { error: ftmErr.message });
            try {
                entries = await this.collectFromCSV();
            }
            catch (csvErr) {
                logger_1.default.error('OpenSanctionsCollector: both FTM and CSV sources failed', {
                    ftmError: ftmErr.message,
                    csvError: csvErr.message,
                });
                throw csvErr;
            }
        }
        logger_1.default.info('OpenSanctionsCollector: collection complete', {
            totalCryptoEntries: entries.length,
        });
        return entries;
    }
    /**
     * Parse FollowTheMoney JSON (streaming line-by-line).
     * The file is a JSON array of entity objects, ~49MB.
     */
    async collectFromFTM() {
        logger_1.default.info('OpenSanctionsCollector: fetching FTM JSON...', { url: this.ftmUrl });
        const response = await axios_1.default.get(this.ftmUrl, {
            timeout: this.timeout,
            responseType: 'text', // we'll parse manually for memory efficiency
            maxRedirects: 3,
            validateStatus: s => s === 200,
        });
        const raw = response.data;
        logger_1.default.info('OpenSanctionsCollector: FTM JSON downloaded', { sizeMB: (raw.length / 1e6).toFixed(1) });
        // The FTM export is a JSON array
        const entities = JSON.parse(raw);
        const results = [];
        for (const ent of entities) {
            const cryptoAddresses = this.extractCryptoFromFTM(ent);
            if (cryptoAddresses.length === 0)
                continue;
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
    async collectFromCSV() {
        const fs = await Promise.resolve().then(() => __importStar(require('fs')));
        const path = await Promise.resolve().then(() => __importStar(require('path')));
        const os = await Promise.resolve().then(() => __importStar(require('os')));
        const { Readable } = await Promise.resolve().then(() => __importStar(require('stream')));
        // Dynamic import of csv-parser (ESM interop)
        const csvParser = (await Promise.resolve().then(() => __importStar(require('csv-parser')))).default;
        logger_1.default.info('OpenSanctionsCollector: fetching CSV fallback...', { url: this.csvUrl });
        const response = await axios_1.default.get(this.csvUrl, {
            timeout: this.timeout,
            responseType: 'text',
            maxRedirects: 3,
            validateStatus: s => s === 200,
        });
        // Write to a temp file then stream-parse (csv-parser needs a stream)
        const tmpFile = path.join(os.tmpdir(), `opensanctions-${Date.now()}.csv`);
        fs.writeFileSync(tmpFile, response.data);
        return new Promise((resolve, reject) => {
            const results = [];
            fs.createReadStream(tmpFile)
                .pipe(csvParser())
                .on('data', (row) => {
                // In targets.simple.csv:
                // columns: id, caption, schema, countries, topics, ...
                const cryptoRaw = row['crypto_address'] ||
                    row['digital_currency_address'] ||
                    row['wallets'] ||
                    row['address'] ||
                    '';
                const cryptoAddresses = this.parseCryptoField(cryptoRaw);
                if (cryptoAddresses.length === 0)
                    return;
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
                fs.unlink(tmpFile, () => { });
                resolve(results);
            })
                .on('error', (err) => {
                fs.unlink(tmpFile, () => { });
                reject(err);
            });
        });
    }
    // ─── FTM helpers ───
    /**
     * Extract crypto addresses from a FollowTheMoney entity.
     * FTM stores them under `properties.cryptoAddress` or `properties.cryptoWallet`.
     */
    extractCryptoFromFTM(ent) {
        const result = [];
        const props = ent.properties ?? {};
        // Format 1: properties.cryptoAddress = [{ value: "0x...", ... }]
        const cryptoProp = props.cryptoAddress ?? props.cryptoWallet ?? props['properties.cryptoAddress'];
        if (Array.isArray(cryptoProp)) {
            for (const item of cryptoProp) {
                const addr = typeof item === 'string' ? item : item?.value ?? item?.address ?? '';
                if (addr) {
                    result.push({ currency: this.guessCurrency(addr), address: addr });
                }
            }
        }
        else if (typeof cryptoProp === 'string' && cryptoProp) {
            result.push({ currency: this.guessCurrency(cryptoProp), address: cryptoProp });
        }
        // Format 2: nested crypto wallets array
        const wallets = ent.cryptoWallets ?? props.cryptoWallets;
        if (Array.isArray(wallets)) {
            for (const w of wallets) {
                const addr = w?.address ?? w?.value ?? '';
                if (addr) {
                    result.push({ currency: w?.currency ?? this.guessCurrency(addr), address: addr });
                }
            }
        }
        return result;
    }
    /**
     * Extract country codes from FTM entity.
     */
    extractCountriesFromFTM(ent) {
        const props = ent.properties ?? {};
        const countries = [];
        const countryProp = props.country ?? props.countries ?? props.nationality;
        if (Array.isArray(countryProp)) {
            for (const c of countryProp) {
                const val = typeof c === 'string' ? c : c?.value ?? c?.code ?? '';
                if (val)
                    countries.push(val.trim());
            }
        }
        else if (typeof countryProp === 'string' && countryProp) {
            countries.push(countryProp.trim());
        }
        // Also check context country
        if (ent.contextCountry)
            countries.push(ent.contextCountry);
        if (ent.country)
            countries.push(ent.country);
        return [...new Set(countries)];
    }
    /**
     * Extract sanctions program identifiers from FTM entity.
     */
    extractProgramsFromFTM(ent) {
        const props = ent.properties ?? {};
        const programs = [];
        const progProp = props.program ?? props.sanctionsProgram ?? props.topics;
        if (Array.isArray(progProp)) {
            for (const p of progProp) {
                const val = typeof p === 'string' ? p : p?.value ?? '';
                if (val)
                    programs.push(val.trim());
            }
        }
        else if (typeof progProp === 'string' && progProp) {
            programs.push(progProp.trim());
        }
        return [...new Set(programs)];
    }
    /**
     * Heuristic currency guess from address format.
     */
    guessCurrency(address) {
        const a = address.trim().toLowerCase();
        if (a.startsWith('0x') && a.length === 42)
            return 'ETH';
        if (a.startsWith('bc1') || (a.startsWith('1') || a.startsWith('3')))
            return 'BTC';
        if (a.startsWith('t1'))
            return 'ZEC';
        if (a.startsWith('D') || a.startsWith('X'))
            return 'DASH';
        if (a.startsWith('L') || a.startsWith('M'))
            return 'LTC';
        return 'UNKNOWN';
    }
    /**
     * Parse a raw crypto field from the CSV format.
     */
    parseCryptoField(raw) {
        const trimmed = raw.trim();
        if (!trimmed)
            return [];
        const results = [];
        // Try JSON parse
        if (trimmed.startsWith('[')) {
            try {
                const arr = JSON.parse(trimmed);
                for (const item of arr) {
                    if (typeof item === 'string') {
                        results.push({ currency: this.guessCurrency(item), address: item });
                    }
                    else if (item?.address) {
                        results.push({ currency: item.currency ?? this.guessCurrency(item.address), address: item.address });
                    }
                }
                return results;
            }
            catch {
                // fall through to semicolon split
            }
        }
        // Semicolon or pipe separated
        for (const part of trimmed.split(/[;|]/)) {
            const addr = part.trim();
            if (addr) {
                results.push({ currency: this.guessCurrency(addr), address: addr });
            }
        }
        return results;
    }
    /**
     * Get the first non-empty value from an object by trying multiple keys.
     */
    firstValue(obj, keys) {
        for (const k of keys) {
            const v = obj[k];
            if (typeof v === 'string' && v.trim())
                return v.trim();
            if (Array.isArray(v) && v.length > 0) {
                const first = v[0];
                if (typeof first === 'string')
                    return first.trim();
                if (first?.value)
                    return String(first.value).trim();
            }
        }
        return undefined;
    }
}
exports.OpenSanctionsCollector = OpenSanctionsCollector;
exports.default = OpenSanctionsCollector;
//# sourceMappingURL=opensanctions-collector.js.map