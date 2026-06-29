import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FidesOriginClient } from './client';
import { FidesOriginError } from './error';
const mockFetch = vi.fn();
global.fetch = mockFetch;
describe('FidesOriginClient', () => {
    let client;
    beforeEach(() => {
        mockFetch.mockClear();
        client = new FidesOriginClient({
            baseUrl: 'https://api.fidesorigin.com',
            apiKey: 'test-api-key',
            debug: false,
        });
    });
    afterEach(() => {
        vi.restoreAllMocks();
    });
    describe('constructor', () => {
        it('should initialize with valid config', () => {
            const c = new FidesOriginClient({ baseUrl: 'https://api.example.com' });
            expect(c.config.baseUrl).toBe('https://api.example.com');
        });
        it('should merge default config', () => {
            const c = new FidesOriginClient({ baseUrl: 'https://api.example.com' });
            expect(c.config.timeout).toBe(30000);
            expect(c.config.maxRetries).toBe(3);
        });
    });
    describe('checkAddress', () => {
        it('should return risk data for valid address', async () => {
            const mockResponse = {
                success: true,
                data: {
                    address: '0x742d35Cc6634C0532925a3b844Bc9e7595f8dEee',
                    chain: 'ethereum',
                    addressType: 'wallet',
                    overallScore: 75,
                    overallLevel: 'high',
                    scores: [],
                    flags: [],
                    timestamp: '2024-01-01T00:00:00Z',
                },
            };
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(mockResponse),
            });
            const result = await client.checkAddress('0x742d35Cc6634C0532925a3b844Bc9e7595f8dEee', 'ethereum');
            expect(result.address).toBe('0x742d35Cc6634C0532925a3b844Bc9e7595f8dEee');
            expect(result.overallScore).toBe(75);
        });
        it('should reject invalid ethereum address', async () => {
            await expect(client.checkAddress('invalid', 'ethereum')).rejects.toThrow(FidesOriginError);
        });
        it('should reject empty address', async () => {
            await expect(client.checkAddress('', 'ethereum')).rejects.toThrow(FidesOriginError);
        });
    });
    describe('API error handling', () => {
        it('should handle 400 Bad Request', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 400,
                statusText: 'Bad Request',
                json: () => Promise.resolve({ message: 'Invalid parameters', code: 'INVALID_ADDRESS' }),
            });
            await expect(client.checkAddress('0x742d35Cc6634C0532925a3b844Bc9e7595f8dEee', 'ethereum')).rejects.toThrow('Invalid parameters');
        });
        it('should handle 401 Unauthorized', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 401,
                statusText: 'Unauthorized',
                json: () => Promise.resolve({ message: 'Invalid API key', code: 'UNAUTHORIZED' }),
            });
            await expect(client.checkAddress('0x742d35Cc6634C0532925a3b844Bc9e7595f8dEee', 'ethereum')).rejects.toThrow('Invalid API key');
        });
        it('should handle 404 Not Found', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 404,
                statusText: 'Not Found',
                json: () => Promise.resolve({ message: 'Address not found', code: 'NOT_FOUND' }),
            });
            await expect(client.checkAddress('0x742d35Cc6634C0532925a3b844Bc9e7595f8dEee', 'ethereum')).rejects.toThrow('Address not found');
        });
        it('should handle 500 Internal Server Error', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 500,
                statusText: 'Internal Server Error',
                json: () => Promise.resolve({ message: 'Server error', code: 'SERVER_ERROR' }),
            });
            await expect(client.checkAddress('0x742d35Cc6634C0532925a3b844Bc9e7595f8dEee', 'ethereum')).rejects.toThrow('Server error');
        });
        it('should handle non-JSON error response', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 502,
                statusText: 'Bad Gateway',
                json: () => Promise.reject(new Error('Not JSON')),
            });
            await expect(client.checkAddress('0x742d35Cc6634C0532925a3b844Bc9e7595f8dEee', 'ethereum')).rejects.toThrow('HTTP 502: Bad Gateway');
        });
        it('should handle network error', async () => {
            mockFetch.mockRejectedValueOnce(new TypeError('fetch failed'));
            await expect(client.checkAddress('0x742d35Cc6634C0532925a3b844Bc9e7595f8dEee', 'ethereum')).rejects.toThrow('Network error');
        });
        it('should handle timeout error', async () => {
            mockFetch.mockRejectedValueOnce(new DOMException('The operation was aborted', 'AbortError'));
            await expect(client.checkAddress('0x742d35Cc6634C0532925a3b844Bc9e7595f8dEee', 'ethereum')).rejects.toThrow('Request timed out');
        });
    });
    describe('batchCheck', () => {
        it('should check multiple addresses', async () => {
            const mockResponse = {
                success: true,
                data: {
                    results: [
                        {
                            address: '0x742d35Cc6634C0532925a3b844Bc9e7595f8dEee',
                            chain: 'ethereum',
                            addressType: 'wallet',
                            overallScore: 75,
                            overallLevel: 'high',
                            scores: [],
                            flags: [],
                            timestamp: '2024-01-01T00:00:00Z',
                        },
                    ],
                    errors: [],
                },
            };
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(mockResponse),
            });
            const result = await client.batchCheck({
                addresses: [
                    { address: '0x742d35Cc6634C0532925a3b844Bc9e7595f8dEee', chain: 'ethereum' },
                ],
            });
            expect(result.results).toHaveLength(1);
        });
    });
    describe('Error class', () => {
        it('should create FidesOriginError with all properties', () => {
            const error = new FidesOriginError('Test error', 'INVALID_ADDRESS', {
                requestId: 'req-123',
            });
            expect(error.message).toBe('Test error');
            expect(error.code).toBe('INVALID_ADDRESS');
            expect(error.status).toBe(400);
        });
        it('should serialize to JSON', () => {
            const error = new FidesOriginError('Test', 'INVALID_ADDRESS');
            const json = error.toJSON();
            expect(json.message).toBe('Test');
            expect(json.code).toBe('INVALID_ADDRESS');
        });
    });
});
