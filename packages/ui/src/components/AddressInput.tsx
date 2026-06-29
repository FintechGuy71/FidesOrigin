import React, { useState, useCallback } from 'react';
import type { Chain } from '@fidesorigin/shared';
import { CHAIN_NAMES, ADDRESS_LENGTHS, ADDRESS_PREFIXES } from '@fidesorigin/shared';

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
export const AddressInput: React.FC<AddressInputProps> = ({
  value,
  onChange,
  chain,
  onChainChange,
  isValid,
  error,
  placeholder = 'Enter blockchain address...',
  disabled = false,
  className = '',
}) => {
  const [touched, setTouched] = useState(false);

  const validateAddress = useCallback(
    (addr: string): boolean => {
      const trimmed = addr.trim();
      if (!trimmed || trimmed.length === 0) return false;
      const lengths = ADDRESS_LENGTHS[chain];
      const prefixes = ADDRESS_PREFIXES[chain];
      if (trimmed.length < lengths.min || trimmed.length > lengths.max) return false;
      if (prefixes.length > 0) {
        return prefixes.some((prefix) => trimmed.startsWith(prefix));
      }
      return true;
    },
    [chain]
  );

  const showError = error || (touched && !validateAddress(value) && value.length > 0);
  const showValid = isValid || (touched && validateAddress(value) && value.length > 0);

  const chains = Object.keys(CHAIN_NAMES) as Chain[];

  return (
    <div className={`space-y-1 ${className}`}>
      <div className="flex gap-2">
        {onChainChange && (
          <select
            value={chain}
            onChange={(e) => onChainChange(e.target.value as Chain)}
            disabled={disabled}
            className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
            aria-label="Select blockchain"
          >
            {chains.map((c) => (
              <option key={c} value={c}>
                {CHAIN_NAMES[c]}
              </option>
            ))}
          </select>
        )}
        <div className="relative flex-1">
          <input
            type="text"
            value={value}
            onChange={(e) => {
              onChange(e.target.value.trim());
              if (!touched) setTouched(true);
            }}
            onBlur={() => setTouched(true)}
            placeholder={placeholder}
            disabled={disabled}
            className={[
              'w-full px-3 py-2 rounded-lg border text-sm font-mono',
              'bg-white dark:bg-gray-800',
              'focus:outline-none focus:ring-2',
              'disabled:opacity-50',
              showError
                ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
                : showValid
                ? 'border-green-500 focus:ring-green-500 focus:border-green-500'
                : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500 focus:border-blue-500',
            ].join(' ')}
            aria-invalid={showError ? 'true' : 'false'}
            aria-describedby={showError ? 'address-error' : undefined}
          />
          {showValid && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500" aria-hidden="true">
              ✓
            </span>
          )}
        </div>
      </div>
      {showError && (
        <p id="address-error" className="text-xs text-red-500" role="alert">
          {error || `Invalid ${CHAIN_NAMES[chain]} address format`}
        </p>
      )}
    </div>
  );
};

export default AddressInput;
