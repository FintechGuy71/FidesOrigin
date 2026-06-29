"use client";

import { useState, useCallback, useEffect } from "react";

interface AddressInputProps {
  value: string;
  onChange: (value: string, isValid: boolean) => void;
  onSubmit?: (value: string) => void;
  placeholder?: string;
  label?: string;
  showExamples?: boolean;
  showValidation?: boolean;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
}

// 验证以太坊地址
export function isValidEthereumAddress(address: string): boolean {
  if (!address) return false;
  const cleanAddress = address.trim();
  return /^0x[a-fA-F0-9]{40}$/.test(cleanAddress);
}

// 验证 Solana 地址
export function isValidSolanaAddress(address: string): boolean {
  if (!address) return false;
  const cleanAddress = address.trim();
  // Solana 地址是 32-44 个字符的 base58 编码
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(cleanAddress);
}

// 验证 Bitcoin 地址
export function isValidBitcoinAddress(address: string): boolean {
  if (!address) return false;
  const cleanAddress = address.trim();
  // 支持 legacy, segwit, bech32 格式
  return (
    /^1[a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(cleanAddress) || // Legacy
    /^3[a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(cleanAddress) || // SegWit
    /^bc1[a-z0-9]{39,59}$/i.test(cleanAddress) // Bech32
  );
}

// 地址类型检测
type ChainType = "ethereum" | "solana" | "bitcoin" | "unknown";

export function detectChainType(address: string): ChainType {
  if (isValidEthereumAddress(address)) return "ethereum";
  if (isValidBitcoinAddress(address)) return "bitcoin";
  if (isValidSolanaAddress(address)) return "solana";
  return "unknown";
}

// 格式化地址（缩短显示）
export function formatAddress(address: string, chars = 6): string {
  if (!address || address.length < chars * 2 + 4) return address;
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

// 示例地址
const EXAMPLE_ADDRESSES = [
  {
    address: "0x742d35Cc6634C0532925a3b844Bc9e7595f8dEee",
    label: "高风险地址",
    chain: "ethereum" as ChainType,
  },
  {
    address: "0x8ba1f109551bD432803012645fac136c82C3e8Cf",
    label: "中风险地址",
    chain: "ethereum" as ChainType,
  },
  {
    address: "0x1f9090aaE28b8a3dCeaDf281B0F12828E676c326",
    label: "低风险地址",
    chain: "ethereum" as ChainType,
  },
];

// 链图标
const ChainIcon = ({ chain }: { chain: ChainType }) => {
  const icons = {
    ethereum: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2L4.5 12.5L12 16.5L19.5 12.5L12 2Z" />
        <path d="M4.5 13.5L12 22L19.5 13.5L12 17.5L4.5 13.5Z" />
      </svg>
    ),
    solana: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M4 6.5L8 2.5H20L16 6.5H4Z" />
        <path d="M4 13.5L8 9.5H20L16 13.5H4Z" />
        <path d="M4 20.5L8 16.5H20L16 20.5H4Z" />
      </svg>
    ),
    bitcoin: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v2h-2zm0 3h2v6h-2zm0 3h2v2h-2z" />
      </svg>
    ),
    unknown: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z" />
      </svg>
    ),
  };

  return icons[chain] || icons.unknown;
};

export default function AddressInput({
  value,
  onChange,
  onSubmit,
  placeholder = "输入区块链地址 (0x...)",
  label = "区块链地址",
  showExamples = true,
  showValidation = true,
  disabled = false,
  loading = false,
  className = "",
}: AddressInputProps) {
  const [touched, setTouched] = useState(false);
  const [chainType, setChainType] = useState<ChainType>("unknown");

  const isValid = isValidEthereumAddress(value);
  const showError = touched && showValidation && value && !isValid;

  useEffect(() => {
    setChainType(detectChainType(value));
    onChange(value, isValid);
  }, [value, isValid, onChange]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value.trim();
      onChange(newValue, isValidEthereumAddress(newValue));
    },
    [onChange]
  );

  const handleBlur = useCallback(() => {
    setTouched(true);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && isValid && onSubmit) {
        onSubmit(value);
      }
    },
    [isValid, onSubmit, value]
  );

  const setExampleAddress = (addr: string) => {
    onChange(addr, isValidEthereumAddress(addr));
    if (onSubmit) {
      onSubmit(addr);
    }
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-gray-300">
          {label}
        </label>
      )}

      <div className="relative">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <input
              type="text"
              value={value}
              onChange={handleChange}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              disabled={disabled || loading}
              placeholder={placeholder}
              className={`
                w-full rounded-lg border bg-gray-800 px-4 py-3 pr-12 text-white
                placeholder-gray-500 focus:outline-none focus:ring-1
                transition-colors
                ${
                  showError
                    ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                    : isValid && showValidation
                    ? "border-green-500/50 focus:border-green-500 focus:ring-green-500"
                    : "border-gray-700 focus:border-indigo-500 focus:ring-indigo-500"
                }
                ${disabled || loading ? "opacity-50 cursor-not-allowed" : ""}
              `}
            />

            {/* 链类型图标 */}
            {value && (
              <div
                className={`absolute right-3 top-1/2 -translate-y-1/2 ${
                  chainType === "ethereum"
                    ? "text-blue-400"
                    : chainType === "solana"
                    ? "text-purple-400"
                    : chainType === "bitcoin"
                    ? "text-orange-400"
                    : "text-gray-500"
                }`}
              >
                <ChainIcon chain={chainType} />
              </div>
            )}
          </div>

          {onSubmit && (
            <button
              onClick={() => isValid && onSubmit(value)}
              disabled={!isValid || disabled || loading}
              className="
                rounded-lg bg-indigo-600 px-6 py-3 font-medium text-white
                transition-colors hover:bg-indigo-500
                disabled:cursor-not-allowed disabled:opacity-50
                flex items-center gap-2
              "
            >
              {loading ? (
                <>
                  <svg
                    className="h-4 w-4 animate-spin"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  分析中...
                </>
              ) : (
                "检测风险"
              )}
            </button>
          )}
        </div>

        {/* 验证提示 */}
        {showValidation && (
          <div className="mt-2 h-5">
            {showError && (
              <p className="text-sm text-red-400">
                请输入有效的以太坊地址（0x 开头，42 位字符）
              </p>
            )}
            {isValid && (
              <p className="text-sm text-green-400 flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {chainType === "ethereum" && "以太坊地址格式正确"}
                {chainType === "solana" && "Solana 地址格式正确"}
                {chainType === "bitcoin" && "Bitcoin 地址格式正确"}
              </p>
            )}
          </div>
        )}
      </div>

      {/* 示例地址 */}
      {showExamples && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-gray-500">示例:</span>
          {EXAMPLE_ADDRESSES.map((item) => (
            <button
              key={item.address}
              onClick={() => setExampleAddress(item.address)}
              disabled={disabled || loading}
              className="
                inline-flex items-center gap-1.5 px-2 py-1 rounded
                text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10
                transition-colors disabled:opacity-50
              "
              title={item.label}
            >
              <span className="font-mono">{formatAddress(item.address, 6)}</span>
              <span className="text-xs text-gray-500">({item.label})</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// 工具函数已在上面定义并导出
