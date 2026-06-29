import React from 'react';
import type { Chain } from '@fidesorigin/shared';
export interface AddressInputProps {
    /** Current address value */
    value: string;
    /** Change handler */
    onChange: (address: string) => void;
    /** Selected chain */
    chain: Chain;
    /** Chain change handler */
    onChainChange?: (chain: Chain) => void;
    /** Validation state */
    isValid?: boolean;
    /** Error message */
    error?: string;
    /** Placeholder text */
    placeholder?: string;
    /** Whether input is disabled */
    disabled?: boolean;
    /** Additional CSS classes */
    className?: string;
}
/**
 * AddressInput - Blockchain address input with validation and chain selection
 *
 * Provides address validation feedback and optional chain selector dropdown.
 * Supports all chains defined in the shared constants.
 *
 * @example
 * ```tsx
 * <AddressInput
 *   value={address}
 *   onChange={setAddress}
 *   chain="ethereum"
 *   onChainChange={setChain}
 * />
 * ```
 */
export declare const AddressInput: React.FC<AddressInputProps>;
export default AddressInput;
