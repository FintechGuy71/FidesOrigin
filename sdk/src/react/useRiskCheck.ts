import { useState, useEffect, useCallback, useRef } from 'react';
import {
  AddressRisk,
  RiskCheckOptions,
  ApiError,
  UseRiskCheckOptions,
  UseRiskCheckReturn
} from '../types';

/**
 * React Hook for risk assessment
 * 
 * Provides reactive risk checking with polling support
 * 
 * @example
 * ```tsx
 * import { useRiskCheck } from '@fidesorigin/sdk/react';
 * 
 * function RiskIndicator({ address }: { address: string }) {
 *   const { data, loading, error, refetch } = useRiskCheck(address, {
 *     client,
 *     pollInterval: 30000 // Refresh every 30 seconds
 *   });
 * 
 *   if (loading) return <Spinner />;
 *   if (error) return <Error message={error.message} />;
 *   if (!data) return null;
 * 
 *   return (
 *     <div className={`risk-${data.risk.level}`}>
 *       Risk Level: {data.risk.level}
 *       <button onClick={refetch}>Refresh</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useRiskCheck(
  address: string | null | undefined,
  options: UseRiskCheckOptions & RiskCheckOptions
): UseRiskCheckReturn {
  const {
    client,
    pollInterval = 0,
    enabled = true,
    ...riskOptions
  } = options;

  const [state, setState] = useState<{
    loading: boolean;
    error: ApiError | null;
    data: AddressRisk | null;
  }>({
    loading: false,
    error: null,
    data: null
  });

  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchRisk = useCallback(async () => {
    if (!address || !enabled) return;

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const result = await client.checkAddress(address, riskOptions);
      
      setState({
        loading: false,
        error: null,
        data: result
      });
    } catch (err) {
      const error = err as ApiError;
      
      setState({
        loading: false,
        error: {
          code: error.code || 'UNKNOWN_ERROR',
          message: error.message || 'An error occurred',
          details: error.details
        },
        data: null
      });
    }
  }, [address, client, enabled, ...Object.values(riskOptions)]);

  const clear = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    setState({
      loading: false,
      error: null,
      data: null
    });
  }, []);

  // Initial fetch
  useEffect(() => {
    if (enabled && address) {
      fetchRisk();
    }

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [address, enabled, fetchRisk]);

  // Setup polling
  useEffect(() => {
    if (pollInterval > 0 && enabled && address) {
      pollTimerRef.current = setInterval(fetchRisk, pollInterval);
    }

    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [pollInterval, enabled, address, fetchRisk]);

  return {
    loading: state.loading,
    error: state.error,
    data: state.data,
    refetch: fetchRisk,
    clear
  };
}

/**
 * React Hook for batch risk assessment
 * 
 * @example
 * ```tsx
 * import { useBatchRiskCheck } from '@fidesorigin/sdk/react';
 * 
 * function RiskList({ addresses }: { addresses: string[] }) {
 *   const { data, loading, error } = useBatchRiskCheck(addresses, { client });
 * 
 *   if (loading) return <Spinner />;
 *   if (error) return <Error message={error.message} />;
 * 
 *   return (
 *     <ul>
 *       {data?.results.map(risk => (
 *         <li key={risk.address}>
 *           {risk.address}: {risk.risk.level}
 *         </li>
 *       ))}
 *     </ul>
 *   );
 * }
 * ```
 */
export function useBatchRiskCheck(
  addresses: string[],
  options: UseRiskCheckOptions & { chain?: import('../types').Chain; detailed?: boolean }
): {
  loading: boolean;
  error: ApiError | null;
  data: { results: AddressRisk[]; failed: string[] } | null;
  refetch: () => Promise<void>;
} {
  const { client, chain, detailed } = options;

  const [state, setState] = useState<{
    loading: boolean;
    error: ApiError | null;
    data: { results: AddressRisk[]; failed: string[] } | null;
  }>({
    loading: false,
    error: null,
    data: null
  });

  const fetchRisk = useCallback(async () => {
    if (!addresses.length) return;

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const result = await client.checkBatchAddresses({
        addresses,
        chain,
        detailed
      });

      setState({
        loading: false,
        error: null,
        data: {
          results: result.results,
          failed: result.failed || []
        }
      });
    } catch (err) {
      const error = err as ApiError;
      setState({
        loading: false,
        error: {
          code: error.code || 'UNKNOWN_ERROR',
          message: error.message || 'An error occurred'
        },
        data: null
      });
    }
  }, [addresses, client, chain, detailed]);

  useEffect(() => {
    if (addresses.length > 0) {
      fetchRisk();
    }
  }, [addresses.join(','), fetchRisk]);

  return {
    loading: state.loading,
    error: state.error,
    data: state.data,
    refetch: fetchRisk
  };
}

/**
 * React Hook for risk level display
 * 
 * Returns human-readable labels and colors for risk levels
 */
export function useRiskDisplay() {
  const getColor = useCallback((level: string): string => {
    const colors: Record<string, string> = {
      low: '#10B981',
      medium: '#F59E0B',
      high: '#EF4444',
      critical: '#7C2D12'
    };
    return colors[level] || '#6B7280';
  }, []);

  const getLabel = useCallback((level: string): string => {
    const labels: Record<string, string> = {
      low: 'Low Risk',
      medium: 'Medium Risk',
      high: 'High Risk',
      critical: 'Critical Risk'
    };
    return labels[level] || 'Unknown';
  }, []);

  const getIcon = useCallback((level: string): string => {
    const icons: Record<string, string> = {
      low: '✓',
      medium: '⚠',
      high: '⚠',
      critical: '✕'
    };
    return icons[level] || '?';
  }, []);

  return { getColor, getLabel, getIcon };
}

// Re-export types
export * from '../types';
