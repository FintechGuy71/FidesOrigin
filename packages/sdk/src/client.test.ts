import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FidesOriginClient } from './client';
import { isSafe } from './risk';
import { toAddressRisk } from './risk-mapper';

const ADDRESS = '0x742d35cc6634c0532925a3b844bc9e7595f8deee';
const mockFetch = vi.fn();
global.fetch = mockFetch;

function jsonResponse(data: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(JSON.stringify(data)),
  };
}

describe('FidesOriginClient contracts', () => {
  let client: FidesOriginClient;

  beforeEach(() => {
    mockFetch.mockReset();
    client = new FidesOriginClient({
      baseUrl: 'https://api.fidesorigin.com',
      apiKey: 'test-api-key',
      hmacSecret: 'audit-hmac-secret-at-least-32-characters',
      retryConfig: { maxRetries: 0 },
    });
  });

  it('maps Sepolia chain ID to the backend chain parameter', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({
      address: ADDRESS,
      chain: 'sepolia',
      risk_score: 0,
      risk_level: 'unknown',
      risk_factors: [],
      known_address: false,
      confidence: null,
    }));
    await client.checkRisk({ address: ADDRESS, chainId: 11155111 });
    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain('chain=sepolia');
    expect(url).not.toContain('chainId=');
  });

  it('does not convert unknown evidence into low risk or fabricated confidence', () => {
    const result = toAddressRisk({
      address: ADDRESS,
      chain: 'sepolia',
      risk_score: 0,
      risk_level: 'unknown',
      risk_factors: [],
      knownAddress: false,
      confidence: null,
    });
    expect(result.risk.level).toBe('unknown');
    expect(result.risk.confidence).toBeNull();
    expect(result.knownAddress).toBe(false);
    expect(isSafe(result)).toBe(false);
  });

  it('requires positive evidence before reporting safe', () => {
    const result = toAddressRisk({
      address: ADDRESS,
      chain: 'sepolia',
      risk_score: 20,
      risk_level: 'low',
      risk_factors: [],
      known_address: true,
      confidence: 0.95,
    });
    expect(isSafe(result)).toBe(true);
    expect(isSafe(result.risk.level)).toBe(false);
  });

  it('signs batch risk queries with HMAC', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ results: [], summary: {} }));
    await client.batchCheckRisk({ addresses: [ADDRESS], chainId: 11155111 });
    const [, options] = mockFetch.mock.calls[0];
    expect(options.headers.get('X-Request-Signature')).toMatch(/^[a-f0-9]{64}$/);
    expect(options.headers.get('X-Request-Timestamp')).toBeTruthy();
  });

  it('signs and normalizes executable rule creation', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({
      id: 7,
      name: 'sanctioned_list',
      is_active: true,
      priority: 100,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    }, 201));
    const rule = await client.createRule({
      name: 'sanctioned_list',
      rule_type: 'sanctions',
      category: 'compliance',
      condition: {},
      risk_score_impact: 100,
      priority: 100,
    });
    expect(rule.id).toBe('7');
    expect(rule.status).toBe('active');
    const [, options] = mockFetch.mock.calls[0];
    expect(options.headers.get('X-Request-Signature')).toMatch(/^[a-f0-9]{64}$/);
  });

  it('rejects non-executable legacy rules before making a request', async () => {
    await expect(client.createRule({
      name: 'legacy-rule',
      rule_type: 'custom',
      category: 'custom',
      condition: {},
      conditions: [{ field: 'risk.score', operator: 'greater_than', value: 80 }],
      actions: [{ type: 'block' }],
    })).rejects.toThrow('not executable');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('normalizes FastAPI rule list responses', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({
      items: [{ id: 3, name: 'scam_list', is_active: false, priority: 50 }],
      total: 1,
      page: 1,
      page_size: 20,
      pages: 1,
    }));
    const result = await client.listRules();
    expect(result.rules).toHaveLength(1);
    expect(result.rules[0].id).toBe('3');
    expect(result.rules[0].status).toBe('inactive');
    expect(result.limit).toBe(20);
  });
});
