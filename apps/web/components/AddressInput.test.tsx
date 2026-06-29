import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { useState } from 'react';
import AddressInput, {
  isValidEthereumAddress,
  isValidSolanaAddress,
  isValidBitcoinAddress,
  detectChainType,
  formatAddress,
} from './AddressInput';

describe('AddressInput utility functions', () => {
  describe('isValidEthereumAddress', () => {
    it('should validate correct ethereum address', () => {
      expect(isValidEthereumAddress('0x742d35Cc6634C0532925a3b844Bc9e7595f8dEee')).toBe(true);
    });

    it('should reject invalid ethereum address', () => {
      expect(isValidEthereumAddress('0x123')).toBe(false);
    });

    it('should reject empty string', () => {
      expect(isValidEthereumAddress('')).toBe(false);
    });

    it('should reject address without 0x prefix', () => {
      expect(isValidEthereumAddress('742d35Cc6634C0532925a3b844Bc9e7595f8dEee')).toBe(false);
    });

    it('should reject address with wrong length', () => {
      expect(isValidEthereumAddress('0x742d35Cc6634C0532925a3b844Bc9e7595f8dEe')).toBe(false);
    });

    it('should accept lowercase address', () => {
      expect(isValidEthereumAddress('0x742d35cc6634c0532925a3b844bc9e7595f8deee')).toBe(true);
    });
  });

  describe('isValidSolanaAddress', () => {
    it('should validate correct solana address', () => {
      expect(isValidSolanaAddress('HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe4YWrH')).toBe(true);
    });

    it('should reject invalid solana address', () => {
      expect(isValidSolanaAddress('short')).toBe(false);
    });
  });

  describe('isValidBitcoinAddress', () => {
    it('should validate legacy bitcoin address', () => {
      expect(isValidBitcoinAddress('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa')).toBe(true);
    });

    it('should validate segwit bitcoin address', () => {
      expect(isValidBitcoinAddress('3J98t1WpEZ73CNmYviecrnyiWrnqRhWNLy')).toBe(true);
    });

    it('should validate bech32 bitcoin address', () => {
      expect(isValidBitcoinAddress('bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq')).toBe(true);
    });

    it('should reject invalid bitcoin address', () => {
      expect(isValidBitcoinAddress('invalid')).toBe(false);
    });
  });

  describe('detectChainType', () => {
    it('should detect ethereum', () => {
      expect(detectChainType('0x742d35Cc6634C0532925a3b844Bc9e7595f8dEee')).toBe('ethereum');
    });

    it('should detect solana', () => {
      expect(detectChainType('HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe4YWrH')).toBe('solana');
    });

    it('should detect bitcoin', () => {
      expect(detectChainType('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa')).toBe('bitcoin');
    });

    it('should detect unknown', () => {
      expect(detectChainType('invalid')).toBe('unknown');
    });
  });

  describe('formatAddress', () => {
    it('should format long address', () => {
      expect(formatAddress('0x742d35Cc6634C0532925a3b844Bc9e7595f8dEee')).toBe('0x742d...f8dEee');
    });

    it('should return short address unchanged', () => {
      expect(formatAddress('0x123')).toBe('0x123');
    });

    it('should format with custom chars', () => {
      expect(formatAddress('0x742d35Cc6634C0532925a3b844Bc9e7595f8dEee', 4)).toBe('0x74...dEee');
    });
  });
});

describe('AddressInput component', () => {
  const TestWrapper = () => {
    const [value, setValue] = useState('');
    const [isValid, setIsValid] = useState(false);

    return (
      <AddressInput
        value={value}
        onChange={(val, valid) => {
          setValue(val);
          setIsValid(valid);
        }}
        onSubmit={(val) => {
          console.log('Submitted:', val);
        }}
      />
    );
  };

  it('should render with default placeholder', () => {
    render(<TestWrapper />);
    expect(screen.getByPlaceholderText('输入区块链地址 (0x...)')).toBeInTheDocument();
  });

  it('should render label', () => {
    render(<TestWrapper />);
    expect(screen.getByText('区块链地址')).toBeInTheDocument();
  });

  it('should show validation error for invalid address', async () => {
    render(<TestWrapper />);
    const input = screen.getByPlaceholderText('输入区块链地址 (0x...)');

    await act(async () => {
      fireEvent.change(input, { target: { value: 'invalid' } });
      fireEvent.blur(input);
    });

    expect(screen.getByText('请输入有效的以太坊地址（0x 开头，42 位字符）')).toBeInTheDocument();
  });

  it('should show success for valid address', async () => {
    render(<TestWrapper />);
    const input = screen.getByPlaceholderText('输入区块链地址 (0x...)');

    await act(async () => {
      fireEvent.change(input, { target: { value: '0x742d35Cc6634C0532925a3b844Bc9e7595f8dEee' } });
    });

    expect(screen.getByText('以太坊地址格式正确')).toBeInTheDocument();
  });

  it('should show chain icon for ethereum', async () => {
    render(<TestWrapper />);
    const input = screen.getByPlaceholderText('输入区块链地址 (0x...)');

    await act(async () => {
      fireEvent.change(input, { target: { value: '0x742d35Cc6634C0532925a3b844Bc9e7595f8dEee' } });
    });

    // SVG icon should be present
    expect(document.querySelector('svg')).toBeInTheDocument();
  });

  it('should render example addresses', () => {
    render(<TestWrapper />);
    expect(screen.getByText('示例:')).toBeInTheDocument();
  });

  it('should submit on Enter key', async () => {
    const onSubmit = vi.fn();
    const { container } = render(
      <AddressInput
        value="0x742d35Cc6634C0532925a3b844Bc9e7595f8dEee"
        onChange={() => {}}
        onSubmit={onSubmit}
      />
    );

    const input = container.querySelector('input')!;
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
    });

    expect(onSubmit).toHaveBeenCalledWith('0x742d35Cc6634C0532925a3b844Bc9e7595f8dEee');
  });

  it('should disable input when disabled prop is true', () => {
    render(
      <AddressInput
        value=""
        onChange={() => {}}
        disabled={true}
      />
    );
    const input = screen.getByPlaceholderText('输入区块链地址 (0x...)');
    expect(input).toBeDisabled();
  });

  it('should show loading state', () => {
    render(
      <AddressInput
        value="0x742d35Cc6634C0532925a3b844Bc9e7595f8dEee"
        onChange={() => {}}
        loading={true}
      />
    );
    const input = screen.getByPlaceholderText('输入区块链地址 (0x...)');
    expect(input).toBeDisabled();
  });

  it('should apply custom className', () => {
    const { container } = render(
      <AddressInput
        value=""
        onChange={() => {}}
        className="custom-class"
      />
    );
    expect(container.firstChild).toHaveClass('custom-class');
  });
});
