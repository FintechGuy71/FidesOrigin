/**
 * FidesOrigin React Hooks
 * React hooks for risk assessment and batch operations
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import type { Chain } from '@fidesorigin/shared';
import { FidesOriginClient } from './client';
import type { ClientOptions, RiskCheckResult, BatchRiskCheckResult } from './types';
import { FidesOriginError } from './error';

// [MEDIUM Fix #14] 定义明确的 batch response 类型替代 any
interface BatchRiskItem {
  address?: string;
  chain?: string;
  risk?: {
    score?: number;
    level?: string;
  };
  scores?: Array<{ name?: string; score?: number; weight?: number; description?: string }>;
  flags?: string[];
  type?: string;
  assessedAt?: string;
  entities?: Array<{ name?: string; category?: string }>;
  stats?: {
    totalTransactions?: number;
    totalVolumeUsd?: number;
    firstSeenAt?: string;
    lastSeenAt?: string;
  };
}

interface BatchRiskErrorResponse {
  address?: string;
  error?: string;
}

interface BatchRiskAPIResponse {
  results: BatchRiskItem[];
  errors?: BatchRiskErrorResponse[];
}

export interface UseRiskCheckState {
  /** Risk assessment result */
  data: RiskCheckResult | null;
  /** Loading state */
  loading: boolean;
  /** Error state */
  error: FidesOriginError | null;
}

export interface UseRiskCheckActions {
  /** Execute risk check */
  check: (address: string, chain: Chain) => Promise<void>;
  /** Reset state */
  reset: () => void;
  /** Refetch current address */
  refetch: () => Promise<void>;
}

export interface UseRiskCheckResult extends UseRiskCheckState, UseRiskCheckActions {}

// [P2 Fix] Deep-equal comparison for options, avoiding JSON.stringify quirks
function isOptionsEqual(a: ClientOptions, b: ClientOptions): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;

  for (const k of keysA) {
    if (!keysB.includes(k)) return false;
    const valA = (a as any)[k];
    const valB = (b as any)[k];
    if (typeof valA === 'object' && typeof valB === 'object' && valA !== null && valB !== null) {
      if (!isOptionsEqual(valA, valB)) return false;
    } else if (valA !== valB) {
      return false;
    }
  }
  return true;
}

/**
 * useRiskCheck - React hook for single address risk assessment
 *
 * Provides reactive state management for address risk checks with
 * loading, error, and data states.
 *
 * @param options - SDK client options
 * @returns Risk check state and actions
 *
 * @example
 * ```tsx
 * const { data, loading, error, check } = useRiskCheck({ apiKey: '...' });
 *
 * useEffect(() => {
 *   check('0x...', 'ethereum');
 * }, []);
 *
 * if (loading) return <Spinner />;
 * if (error) return <Error message={error.message} />;
 * return <RiskScore risk={data} />;
 * ```
 */
const CHAIN_TO_CHAIN_ID: Record<Chain, number> = {
  ethereum: 1,
  polygon: 137,
  bsc: 56,
  arbitrum: 42161,
  optimism: 10,
  base: 8453,
  bitcoin: 0,   // Not EVM — will throw
  solana: 0,    // Not EVM — will throw
};

function resolveChainId(chain: Chain): number {
  const id = CHAIN_TO_CHAIN_ID[chain];
  if (id === 0) {
    throw new FidesOriginError(
      `Chain '${chain}' is not supported by the EVM risk check API`,
      'INVALID_CHAIN_ID'
    );
  }
  return id;
}

export function useRiskCheck(options: ClientOptions = {}): UseRiskCheckResult {
  const clientRef = useRef<FidesOriginClient | null>(null);
  const optionsRef = useRef(options);
  const [state, setState] = useState<UseRiskCheckState>({
    data: null,
    loading: false,
    error: null,
  });

  // Re-create client when options change
  useEffect(() => {
    if (!clientRef.current || !isOptionsEqual(optionsRef.current, options)) {
      clientRef.current = new FidesOriginClient(options);
      optionsRef.current = options;
    }
  }, [options]);

  // Current query parameters for refetch
  const queryRef = useRef<{ address: string; chain: Chain } | null>(null);
  const requestIdRef = useRef(0);

  const check = useCallback(async (address: string, chain: Chain) => {
    const requestId = ++requestIdRef.current;
    setState((prev) => ({ ...prev, loading: true, error: null }));
    queryRef.current = { address, chain };

    try {
      const result = await clientRef.current!.checkRisk({ address, chainId: resolveChainId(chain) });
      // [High Fix] Discard stale responses from earlier requests
      if (requestId !== requestIdRef.current) return;
      setState({ data: result, loading: false, error: null });
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      const error = err instanceof FidesOriginError
        ? err
        : new FidesOriginError(
            err instanceof Error ? err.message : 'Unknown error',
            'UNKNOWN'
          );
      setState((prev) => ({ ...prev, loading: false, error }));
    }
  }, []);

  const reset = useCallback(() => {
    setState({ data: null, loading: false, error: null });
    queryRef.current = null;
  }, []);

  const refetch = useCallback(async () => {
    if (queryRef.current) {
      await check(queryRef.current.address, queryRef.current.chain);
    }
  }, [check]);

  return {
    ...state,
    check,
    reset,
    refetch,
  };
}

export interface UseBatchRiskCheckState {
  /** Risk assessment results */
  data: RiskCheckResult[];
  /** Loading state */
  loading: boolean;
  /** Error state */
  error: FidesOriginError | null;
  /** Failed address checks */
  errors: Array<{ address: string; error: string }>;
}

export interface UseBatchRiskCheckActions {
  /** Execute batch risk check */
  check: (addresses: string[], chainId: string | number) => Promise<void>;
  /** Reset state */
  reset: () => void;
}

export interface UseBatchRiskCheckResult extends UseBatchRiskCheckState, UseBatchRiskCheckActions {}

/**
 * useBatchRiskCheck - React hook for batch address risk assessment
 *
 * Provides reactive state management for batch risk checks with
 * support for multiple addresses and chains.
 *
 * @param options - SDK client options
 * @returns Batch risk check state and actions
 *
 * @example
 * ```tsx
 * const { data, loading, error, check } = useBatchRiskCheck({ apiKey: '...' });
 *
 * useEffect(() => {
 *   check({
 *     addresses: [
 *       { address: '0x...', chain: 'ethereum' },
 *       { address: '0x...', chain: 'polygon' },
 *     ]
 *   });
 * }, []);
 * ```
 */
export function useBatchRiskCheck(options: ClientOptions = {}): UseBatchRiskCheckResult {
  const clientRef = useRef<FidesOriginClient | null>(null);
  const optionsRef = useRef(options);
  const [state, setState] = useState<UseBatchRiskCheckState>({
    data: [],
    loading: false,
    error: null,
    errors: [],
  });

  // Re-create client when options change
  useEffect(() => {
    if (!clientRef.current || !isOptionsEqual(optionsRef.current, options)) {
      clientRef.current = new FidesOriginClient(options);
      optionsRef.current = options;
    }
  }, [options]);

  const requestIdRef = useRef(0);

  const check = useCallback(async (addresses: string[], chainId: string | number) => {
    const requestId = ++requestIdRef.current;
    setState((prev) => ({ ...prev, loading: true, error: null, errors: [] }));

    try {
      const result = await clientRef.current!.batchCheckRisk({ addresses, chainId });
      // [MEDIUM Fix #14] 使用明确的类型替代 any
      const typedResult = result as unknown as BatchRiskAPIResponse;
      // [High Fix] Discard stale responses from earlier requests
      if (requestId !== requestIdRef.current) return;
      setState({
        data: typedResult.results.map((r: BatchRiskItem) => ({
          address: r.address || '',
          chain: r.chain || 'ethereum',
          overallScore: r.risk?.score || 0,
          overallLevel: (r.risk?.level as 'low' | 'medium' | 'high' | 'critical') || 'medium',
          scores: r.scores || [],
          flags: r.flags || [],
          addressType: r.type || 'unknown',
          timestamp: r.assessedAt || new Date().toISOString(),
          relatedEntities: r.entities || [],
          transactionStats: r.stats || undefined,
        })) as RiskCheckResult[],
        loading: false,
        error: null,
        errors: (typedResult.errors || []).map((e: BatchRiskErrorResponse) => ({ address: e.address || '', error: e.error || '' })),
      });
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      const error = err instanceof FidesOriginError
        ? err
        : new FidesOriginError(
            err instanceof Error ? err.message : 'Unknown error',
            'UNKNOWN'
          );
      setState((prev) => ({ ...prev, loading: false, error }));
    }
  }, []);

  const reset = useCallback(() => {
    setState({ data: [], loading: false, error: null, errors: [] });
  }, []);

  return {
    ...state,
    check,
    reset,
  };
}

export interface UseComplianceCheckState {
  /** Compliance check results */
  data: RiskCheckResult | null;
  /** Loading state */
  loading: boolean;
  /** Error state */
  error: FidesOriginError | null;
}

export interface UseComplianceCheckActions {
  /** Execute compliance check */
  check: (address: string, chain: Chain) => Promise<void>;
  /** Reset state */
  reset: () => void;
}

export interface UseComplianceCheckResult extends UseComplianceCheckState, UseComplianceCheckActions {}

/**
 * useComplianceCheck - React hook for compliance checking
 *
 * @param options - SDK client options
 * @returns Compliance check state and actions
 */
export function useComplianceCheck(options: ClientOptions = {}): UseComplianceCheckResult {
  const clientRef = useRef<FidesOriginClient | null>(null);
  const optionsRef = useRef(options);
  const [state, setState] = useState<UseComplianceCheckState>({
    data: null,
    loading: false,
    error: null,
  });

  // Re-create client when options change
  useEffect(() => {
    if (!clientRef.current || !isOptionsEqual(optionsRef.current, options)) {
      clientRef.current = new FidesOriginClient(options);
      optionsRef.current = options;
    }
  }, [options]);

  const requestIdRef = useRef(0);

  const check = useCallback(async (address: string, chain: Chain) => {
    const requestId = ++requestIdRef.current;
    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const result = await clientRef.current!.checkRisk({ address, chainId: resolveChainId(chain) });
      // [High Fix] Discard stale responses from earlier requests
      if (requestId !== requestIdRef.current) return;
      setState({ data: result, loading: false, error: null });
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      const error = err instanceof FidesOriginError
        ? err
        : new FidesOriginError(
            err instanceof Error ? err.message : 'Unknown error',
            'UNKNOWN'
          );
      setState((prev) => ({ ...prev, loading: false, error }));
    }
  }, []);

  const reset = useCallback(() => {
    setState({ data: null, loading: false, error: null });
  }, []);

  return {
    ...state,
    check,
    reset,
  };
}

export default useRiskCheck;
