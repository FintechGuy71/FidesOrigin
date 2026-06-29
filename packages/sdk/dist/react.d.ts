/**
 * FidesOrigin React Hooks
 * React hooks for risk assessment and batch operations
 */
import type { AddressRisk, Chain, BatchRiskCheckRequest } from '@fidesorigin/shared';
import type { ClientOptions } from './client';
import { FidesOriginError } from './error';
export interface UseRiskCheckState {
    /** Risk assessment result */
    data: AddressRisk | null;
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
export interface UseRiskCheckResult extends UseRiskCheckState, UseRiskCheckActions {
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
export declare function useRiskCheck(options?: ClientOptions): UseRiskCheckResult;
export interface UseBatchRiskCheckState {
    /** Risk assessment results */
    data: AddressRisk[];
    /** Loading state */
    loading: boolean;
    /** Error state */
    error: FidesOriginError | null;
    /** Failed address checks */
    errors: Array<{
        address: string;
        error: string;
    }>;
}
export interface UseBatchRiskCheckActions {
    /** Execute batch risk check */
    check: (request: BatchRiskCheckRequest) => Promise<void>;
    /** Reset state */
    reset: () => void;
}
export interface UseBatchRiskCheckResult extends UseBatchRiskCheckState, UseBatchRiskCheckActions {
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
export declare function useBatchRiskCheck(options?: ClientOptions): UseBatchRiskCheckResult;
export interface UseComplianceCheckState {
    /** Compliance check results */
    data: import('@fidesorigin/shared').ComplianceCheck[] | null;
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
export interface UseComplianceCheckResult extends UseComplianceCheckState, UseComplianceCheckActions {
}
/**
 * useComplianceCheck - React hook for compliance checking
 *
 * @param options - SDK client options
 * @returns Compliance check state and actions
 */
export declare function useComplianceCheck(options?: ClientOptions): UseComplianceCheckResult;
export default useRiskCheck;
