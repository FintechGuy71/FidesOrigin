import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

/**
 * AddressInput 组件测试
 * 验证地址输入组件的校验和错误处理
 */

// 模拟 AddressInput 组件
const AddressInput = ({
  value,
  onChange,
  onValidate,
  placeholder = 'Enter address...',
  error,
}: {
  value: string;
  onChange: (value: string) => void;
  onValidate?: (isValid: boolean) => void;
  placeholder?: string;
  error?: string;
}) => {
  const [localError, setLocalError] = React.useState(error || '');

  const validateAddress = (addr: string) => {
    if (!addr) return false;
    if (!addr.startsWith('0x')) return false;
    if (addr.length !== 42) return false;
    const hexPart = addr.slice(2);
    if (!/^[0-9a-fA-F]+$/.test(hexPart)) return false;
    return true;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
    const isValid = validateAddress(newValue);
    if (!isValid && newValue.length > 0) {
      setLocalError('Invalid Ethereum address');
    } else {
      setLocalError('');
    }
    onValidate?.(isValid);
  };

  return (
    <div>
      <input
        type="text"
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        data-testid="address-input"
        aria-invalid={!!localError}
      />
      {localError && <span data-testid="address-error">{localError}</span>}
    </div>
  );
};

describe('AddressInput Component', () => {
  it('renders with placeholder', () => {
    render(
      <AddressInput
        value=""
        onChange={() => {}}
        placeholder="Enter wallet address"
      />
    );
    expect(screen.getByPlaceholderText('Enter wallet address')).toBeInTheDocument();
  });

  it('validates correct Ethereum address', async () => {
    const handleValidate = vi.fn();
    render(
      <AddressInput
        value=""
        onChange={() => {}}
        onValidate={handleValidate}
      />
    );

    const input = screen.getByTestId('address-input');
    fireEvent.change(input, { target: { value: '0x742d35cc6634c0532925a3b844bc9e7595f0bEb' } });

    await waitFor(() => {
      expect(handleValidate).toHaveBeenCalledWith(true);
    });
    expect(screen.queryByTestId('address-error')).not.toBeInTheDocument();
  });

  it('shows error for address without 0x prefix', async () => {
    const handleValidate = vi.fn();
    render(
      <AddressInput
        value=""
        onChange={() => {}}
        onValidate={handleValidate}
      />
    );

    const input = screen.getByTestId('address-input');
    fireEvent.change(input, { target: { value: '742d35cc6634c0532925a3b844bc9e7595f0bEb' } });

    await waitFor(() => {
      expect(screen.getByTestId('address-error')).toHaveTextContent('Invalid Ethereum address');
    });
    expect(handleValidate).toHaveBeenCalledWith(false);
  });

  it('shows error for address with wrong length', async () => {
    render(
      <AddressInput
        value=""
        onChange={() => {}}
      />
    );

    const input = screen.getByTestId('address-input');
    fireEvent.change(input, { target: { value: '0x742d35cc6634c0532925a3b844bc9e7595f0bE' } });

    await waitFor(() => {
      expect(screen.getByTestId('address-error')).toHaveTextContent('Invalid Ethereum address');
    });
  });

  it('shows error for address with invalid characters', async () => {
    render(
      <AddressInput
        value=""
        onChange={() => {}}
      />
    );

    const input = screen.getByTestId('address-input');
    fireEvent.change(input, { target: { value: '0x742d35cc6634c0532925a3b844bc9e7595f0bEg' } });

    await waitFor(() => {
      expect(screen.getByTestId('address-error')).toHaveTextContent('Invalid Ethereum address');
    });
  });

  it('clears error when valid address is entered', async () => {
    render(
      <AddressInput
        value=""
        onChange={() => {}}
      />
    );

    const input = screen.getByTestId('address-input');
    fireEvent.change(input, { target: { value: 'invalid' } });
    await waitFor(() => {
      expect(screen.getByTestId('address-error')).toBeInTheDocument();
    });

    fireEvent.change(input, { target: { value: '0x742d35cc6634c0532925a3b844bc9e7595f0bEb' } });
    await waitFor(() => {
      expect(screen.queryByTestId('address-error')).not.toBeInTheDocument();
    });
  });

  it('calls onChange with the new value', () => {
    const handleChange = vi.fn();
    render(
      <AddressInput
        value=""
        onChange={handleChange}
      />
    );

    const input = screen.getByTestId('address-input');
    fireEvent.change(input, { target: { value: '0x123' } });
    expect(handleChange).toHaveBeenCalledWith('0x123');
  });

  it('handles empty input without error', () => {
    render(
      <AddressInput
        value=""
        onChange={() => {}}
      />
    );

    const input = screen.getByTestId('address-input');
    fireEvent.change(input, { target: { value: '' } });
    expect(screen.queryByTestId('address-error')).not.toBeInTheDocument();
  });
});
