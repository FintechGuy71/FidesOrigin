import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useCallback } from 'react';
import { CHAIN_NAMES, ADDRESS_LENGTHS, ADDRESS_PREFIXES } from '@fidesorigin/shared';
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
export const AddressInput = ({ value, onChange, chain, onChainChange, isValid, error, placeholder = 'Enter blockchain address...', disabled = false, className = '', }) => {
    const [touched, setTouched] = useState(false);
    const validateAddress = useCallback((addr) => {
        if (!addr || addr.length === 0)
            return true;
        const lengths = ADDRESS_LENGTHS[chain];
        const prefixes = ADDRESS_PREFIXES[chain];
        if (addr.length < lengths.min || addr.length > lengths.max)
            return false;
        if (prefixes.length > 0) {
            return prefixes.some((prefix) => addr.startsWith(prefix));
        }
        return true;
    }, [chain]);
    const showError = error || (touched && !validateAddress(value) && value.length > 0);
    const showValid = isValid || (touched && validateAddress(value) && value.length > 0);
    const chains = Object.keys(CHAIN_NAMES);
    return (_jsxs("div", { className: `space-y-1 ${className}`, children: [_jsxs("div", { className: "flex gap-2", children: [onChainChange && (_jsx("select", { value: chain, onChange: (e) => onChainChange(e.target.value), disabled: disabled, className: "px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50", "aria-label": "Select blockchain", children: chains.map((c) => (_jsx("option", { value: c, children: CHAIN_NAMES[c] }, c))) })), _jsxs("div", { className: "relative flex-1", children: [_jsx("input", { type: "text", value: value, onChange: (e) => {
                                    onChange(e.target.value);
                                    if (!touched)
                                        setTouched(true);
                                }, onBlur: () => setTouched(true), placeholder: placeholder, disabled: disabled, className: [
                                    'w-full px-3 py-2 rounded-lg border text-sm font-mono',
                                    'bg-white dark:bg-gray-800',
                                    'focus:outline-none focus:ring-2',
                                    'disabled:opacity-50',
                                    showError
                                        ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
                                        : showValid
                                            ? 'border-green-500 focus:ring-green-500 focus:border-green-500'
                                            : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500 focus:border-blue-500',
                                ].join(' '), "aria-invalid": showError ? 'true' : 'false', "aria-describedby": showError ? 'address-error' : undefined }), showValid && (_jsx("span", { className: "absolute right-3 top-1/2 -translate-y-1/2 text-green-500", "aria-hidden": "true", children: "\u2713" }))] })] }), showError && (_jsx("p", { id: "address-error", className: "text-xs text-red-500", role: "alert", children: error || `Invalid ${CHAIN_NAMES[chain]} address format` }))] }));
};
export default AddressInput;
