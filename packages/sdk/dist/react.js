/**
 * FidesOrigin React Hooks
 * React hooks for risk assessment and batch operations
 */
import { useState, useCallback, useRef } from 'react';
import { FidesOriginClient } from './client';
import { FidesOriginError } from './error';
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
export function useRiskCheck(options = {}) {
    const clientRef = useRef(new FidesOriginClient(options));
    const [state, setState] = useState({
        data: null,
        loading: false,
        error: null,
    });
    // Current query parameters for refetch
    const queryRef = useRef(null);
    const check = useCallback(async (address, chain) => {
        setState((prev) => ({ ...prev, loading: true, error: null }));
        queryRef.current = { address, chain };
        try {
            const result = await clientRef.current.checkAddress(address, chain);
            setState({ data: result, loading: false, error: null });
        }
        catch (err) {
            const error = err instanceof FidesOriginError
                ? err
                : new FidesOriginError(err instanceof Error ? err.message : 'Unknown error', 'UNKNOWN');
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
export function useBatchRiskCheck(options = {}) {
    const clientRef = useRef(new FidesOriginClient(options));
    const [state, setState] = useState({
        data: [],
        loading: false,
        error: null,
        errors: [],
    });
    const check = useCallback(async (request) => {
        setState((prev) => ({ ...prev, loading: true, error: null, errors: [] }));
        try {
            const result = await clientRef.current.batchCheck(request);
            setState({
                data: result.results,
                loading: false,
                error: null,
                errors: result.errors || [],
            });
        }
        catch (err) {
            const error = err instanceof FidesOriginError
                ? err
                : new FidesOriginError(err instanceof Error ? err.message : 'Unknown error', 'UNKNOWN');
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
/**
 * useComplianceCheck - React hook for compliance checking
 *
 * @param options - SDK client options
 * @returns Compliance check state and actions
 */
export function useComplianceCheck(options = {}) {
    const clientRef = useRef(new FidesOriginClient(options));
    const [state, setState] = useState({
        data: null,
        loading: false,
        error: null,
    });
    const check = useCallback(async (address, chain) => {
        setState((prev) => ({ ...prev, loading: true, error: null }));
        try {
            const result = await clientRef.current.checkCompliance(address, chain);
            setState({ data: result, loading: false, error: null });
        }
        catch (err) {
            const error = err instanceof FidesOriginError
                ? err
                : new FidesOriginError(err instanceof Error ? err.message : 'Unknown error', 'UNKNOWN');
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
