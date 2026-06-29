/**
 * FidesOrigin SDK - React Example
 * 
 * This example demonstrates how to use the FidesOrigin SDK with React
 * 
 * Prerequisites:
 *   npm install @fidesorigin/sdk react react-dom
 * 
 * Usage:
 *   - Import the hooks and components from this file
 *   - Wrap your app with FidesOriginProvider
 *   - Use useRiskCheck hook in your components
 */

import React, { createContext, useContext, ReactNode } from 'react';
import { 
  FidesOriginClient, 
  useRiskCheck, 
  useBatchRiskCheck, 
  useRiskDisplay 
} from '../dist/esm/index.js';

// ============================================================================
// Provider Setup
// ============================================================================

interface FidesOriginContextType {
  client: FidesOriginClient;
}

const FidesOriginContext = createContext<FidesOriginContextType | null>(null);

interface FidesOriginProviderProps {
  client: FidesOriginClient;
  children: ReactNode;
}

/**
 * Provider component for FidesOrigin SDK
 * 
 * @example
 * ```tsx
 * import { FidesOriginClient } from '@fidesorigin/sdk';
 * import { FidesOriginProvider } from './fides-origin';
 * 
 * const client = new FidesOriginClient({
 *   baseUrl: 'https://api.fidesorigin.com',
 *   apiKey: process.env.REACT_APP_FIDES_API_KEY
 * });
 * 
 * function App() {
 *   return (
 *     <FidesOriginProvider client={client}>
 *       <YourApp />
 *     </FidesOriginProvider>
 *   );
 * }
 * ```
 */
export function FidesOriginProvider({ client, children }: FidesOriginProviderProps) {
  return (
    <FidesOriginContext.Provider value={{ client }}>
      {children}
    </FidesOriginContext.Provider>
  );
}

export function useFidesOrigin() {
  const context = useContext(FidesOriginContext);
  if (!context) {
    throw new Error('useFidesOrigin must be used within FidesOriginProvider');
  }
  return context;
}

// ============================================================================
// Example Components
// ============================================================================

/**
 * Risk Badge Component
 * 
 * Displays a colored badge indicating risk level
 */
interface RiskBadgeProps {
  address: string;
  showDetails?: boolean;
}

export function RiskBadge({ address, showDetails = false }: RiskBadgeProps) {
  const { client } = useFidesOrigin();
  const { data, loading, error, refetch } = useRiskCheck(address, { 
    client,
    pollInterval: 30000 // Refresh every 30 seconds
  });
  const { getColor, getLabel, getIcon } = useRiskDisplay();

  if (loading) {
    return (
      <span style={{ 
        padding: '4px 12px', 
        borderRadius: '4px', 
        background: '#e5e7eb',
        fontSize: '14px'
      }}>
        Loading...
      </span>
    );
  }

  if (error) {
    return (
      <span 
        onClick={refetch}
        style={{ 
          padding: '4px 12px', 
          borderRadius: '4px', 
          background: '#fee2e2',
          color: '#991b1b',
          fontSize: '14px',
          cursor: 'pointer'
        }}
        title="Click to retry"
      >
        ⚠️ Error
      </span>
    );
  }

  if (!data) {
    return null;
  }

  const backgroundColor = getColor(data.risk.level);
  const label = getLabel(data.risk.level);
  const icon = getIcon(data.risk.level);

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', gap: '8px' }}>
      <span 
        onClick={refetch}
        style={{ 
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          padding: '4px 12px', 
          borderRadius: '4px', 
          background: backgroundColor + '20',
          color: backgroundColor,
          fontSize: '14px',
          fontWeight: 600,
          cursor: 'pointer',
          border: `1px solid ${backgroundColor}`
        }}
        title="Click to refresh"
      >
        {icon} {label}
      </span>
      
      {showDetails && (
        <div style={{ 
          padding: '12px', 
          background: '#f9fafb', 
          borderRadius: '6px',
          fontSize: '13px'
        }}>
          <div>Score: {data.risk.score}/100</div>
          <div>Type: {data.type}</div>
          <div>Confidence: {(data.risk.confidence * 100).toFixed(1)}%</div>
          
          {data.flags.length > 0 && (
            <div style={{ marginTop: '8px' }}>
              <strong>Flags:</strong>
              <ul style={{ margin: '4px 0', paddingLeft: '20px' }}>
                {data.flags.map(flag => (
                  <li key={flag.id}>{flag.name}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Risk List Component
 * 
 * Displays a list of addresses with their risk assessments
 */
interface RiskListProps {
  addresses: string[];
  chain?: string;
}

export function RiskList({ addresses, chain = 'ethereum' }: RiskListProps) {
  const { client } = useFidesOrigin();
  const { data, loading, error } = useBatchRiskCheck(addresses, { 
    client,
    chain 
  });

  if (loading) {
    return <div>Loading risk assessments...</div>;
  }

  if (error) {
    return <div style={{ color: 'red' }}>Error: {error.message}</div>;
  }

  if (!data || data.results.length === 0) {
    return <div>No addresses to check</div>;
  }

  return (
    <div>
      <h3>Risk Assessment Results</h3>
      
      <div style={{ marginBottom: '16px' }}>
        <strong>Summary:</strong> {' '}
        {data.results.length} checked, {data.failed.length} failed
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {data.results.map(result => (
          <RiskListItem key={result.address} result={result} />
        ))}
      </div>

      {data.failed.length > 0 && (
        <div style={{ marginTop: '16px', color: 'red' }}>
          <strong>Failed to check:</strong>
          <ul>
            {data.failed.map(addr => (
              <li key={addr}>{addr}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * Risk List Item Component
 */
interface RiskListItemProps {
  result: import('../src/types').AddressRisk;
}

function RiskListItem({ result }: RiskListItemProps) {
  const { getColor, getLabel } = useRiskDisplay();
  const color = getColor(result.risk.level);

  return (
    <div style={{ 
      padding: '12px', 
      border: '1px solid #e5e7eb',
      borderRadius: '6px',
      borderLeft: `4px solid ${color}`
    }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '8px'
      }}>
        <span style={{ fontFamily: 'monospace', fontSize: '14px' }}>
          {result.address.slice(0, 20)}...{result.address.slice(-6)}
        </span>
        <span style={{ 
          padding: '2px 8px',
          borderRadius: '4px',
          background: color + '20',
          color: color,
          fontSize: '12px',
          fontWeight: 600
        }}>
          {getLabel(result.risk.level)}
        </span>
      </div>
      
      <div style={{ fontSize: '13px', color: '#6b7280' }}>
        Score: {result.risk.score}/100 • Type: {result.type}
        {result.flags.length > 0 && ` • Flags: ${result.flags.length}`}
      </div>
    </div>
  );
}

/**
 * Transaction Validation Component
 * 
 * Validates a transaction destination before sending
 */
interface TransactionValidatorProps {
  toAddress: string;
  amount: string;
  onValidated: (isSafe: boolean) => void;
}

export function TransactionValidator({ 
  toAddress, 
  amount, 
  onValidated 
}: TransactionValidatorProps) {
  const { client } = useFidesOrigin();
  const { data, loading, error } = useRiskCheck(toAddress, { 
    client,
    enabled: toAddress.length >= 20
  });

  const isSafe = data?.risk.level === 'low';
  const isRisky = data && ['high', 'critical'].includes(data.risk.level);

  React.useEffect(() => {
    if (data) {
      onValidated(isSafe);
    }
  }, [data, isSafe, onValidated]);

  if (!toAddress || toAddress.length < 20) {
    return null;
  }

  return (
    <div style={{ 
      padding: '16px', 
      background: isRisky ? '#fee2e2' : isSafe ? '#d1fae5' : '#fef3c7',
      borderRadius: '8px',
      marginTop: '12px'
    }}>
      <div style={{ fontWeight: 600, marginBottom: '8px' }}>
        🔍 Risk Validation
      </div>
      
      {loading && <div>Checking destination address...</div>}
      
      {error && (
        <div style={{ color: '#dc2626' }}>
          Unable to validate address: {error.message}
        </div>
      )}
      
      {data && (
        <div>
          <div>
            Risk Level: <strong>{data.risk.level.toUpperCase()}</strong>
          </div>
          <div>Score: {data.risk.score}/100</div>
          
          {isRisky && (
            <div style={{ 
              marginTop: '8px', 
              color: '#dc2626',
              fontWeight: 600 
            }}>
              ⚠️ Warning: This address is flagged as high risk. Proceed with caution.
            </div>
          )}
          
          {data.flags.length > 0 && (
            <div style={{ marginTop: '12px' }}>
              <strong>Risk Flags:</strong>
              <ul style={{ margin: '4px 0', paddingLeft: '20px' }}>
                {data.flags.map(flag => (
                  <li key={flag.id}>
                    {flag.name} ({flag.severity})
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Example App
// ============================================================================

/**
 * Example App demonstrating all features
 */
export function ExampleApp() {
  const [addresses, setAddresses] = React.useState([
    '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
    '0xdAC17F958D2ee523a2206206994597C13D831ec7'
  ]);
  const [newAddress, setNewAddress] = React.useState('');

  const addAddress = () => {
    if (newAddress && !addresses.includes(newAddress)) {
      setAddresses([...addresses, newAddress]);
      setNewAddress('');
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
      <h1>🛡️ FidesOrigin React Example</h1>
      
      <section style={{ marginTop: '24px' }}>
        <h2>Single Address Check</h2>
        <RiskBadge 
          address="0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb" 
          showDetails={true}
        />
      </section>

      <section style={{ marginTop: '32px' }}>
        <h2>Batch Address Check</h2>
        
        <div style={{ marginBottom: '16px' }}>
          <input
            type="text"
            value={newAddress}
            onChange={(e) => setNewAddress(e.target.value)}
            placeholder="Enter address (0x...)"
            style={{ 
              padding: '8px 12px', 
              marginRight: '8px',
              borderRadius: '4px',
              border: '1px solid #d1d5db'
            }}
          />
          <button 
            onClick={addAddress}
            style={{
              padding: '8px 16px',
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Add Address
          </button>
        </div>

        <RiskList addresses={addresses} />
      </section>
    </div>
  );
}

// Export everything
export { useRiskCheck, useBatchRiskCheck, useRiskDisplay } from '../dist/esm/index.js';
export type { 
  FidesOriginConfig,
  AddressRisk,
  RiskLevel,
  Rule,
  WebSocketMessage 
} from '../dist/esm/index.js';
