"use strict";
/**
 * FidesOrigin Shared Constants
 * Chain IDs, contract addresses, risk level enums, and other shared constants
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.JURISDICTIONS = exports.REGULATORY_FRAMEWORKS = exports.ANIMATION_DURATIONS = exports.TOAST_DURATIONS = exports.DEFAULT_PAGINATION = exports.WEBSOCKET_CONFIG = exports.API_ENDPOINTS = exports.DEFAULT_API_CONFIG = exports.ADDRESS_PREFIXES = exports.ADDRESS_LENGTHS = exports.RISK_FLAGS = exports.RISK_THRESHOLDS = exports.RISK_LEVEL_ORDER = exports.RISK_LEVELS = exports.FIDES_REGISTRY_ADDRESSES = exports.CHAIN_EXPLORERS = exports.CHAIN_CURRENCIES = exports.CHAIN_NAMES = exports.CHAIN_IDS = void 0;
// ============================================================================
// Chain IDs (EIP-155 compatible)
// ============================================================================
/** Chain ID mapping for supported networks */
exports.CHAIN_IDS = {
    ethereum: 1,
    bitcoin: 0, // Bitcoin doesn't use EIP-155
    polygon: 137,
    bsc: 56,
    arbitrum: 42161,
    optimism: 10,
    base: 8453,
    solana: 0, // Solana doesn't use EIP-155
};
/** Chain names for display */
exports.CHAIN_NAMES = {
    ethereum: 'Ethereum',
    bitcoin: 'Bitcoin',
    polygon: 'Polygon',
    bsc: 'BNB Chain',
    arbitrum: 'Arbitrum',
    optimism: 'Optimism',
    base: 'Base',
    solana: 'Solana',
};
/** Chain native currency symbols */
exports.CHAIN_CURRENCIES = {
    ethereum: 'ETH',
    bitcoin: 'BTC',
    polygon: 'MATIC',
    bsc: 'BNB',
    arbitrum: 'ETH',
    optimism: 'ETH',
    base: 'ETH',
    solana: 'SOL',
};
/** Chain explorer URLs */
exports.CHAIN_EXPLORERS = {
    ethereum: 'https://etherscan.io',
    bitcoin: 'https://blockchain.info',
    polygon: 'https://polygonscan.com',
    bsc: 'https://bscscan.com',
    arbitrum: 'https://arbiscan.io',
    optimism: 'https://optimistic.etherscan.io',
    base: 'https://basescan.org',
    solana: 'https://solscan.io',
};
// ============================================================================
// Contract Addresses (Sample / Placeholder)
// ============================================================================
/** FidesOrigin registry contract addresses by chain */
exports.FIDES_REGISTRY_ADDRESSES = {
    ethereum: '0xFidesOriginRegistry...',
    polygon: '0xFidesOriginRegistry...',
    bsc: '0xFidesOriginRegistry...',
    arbitrum: '0xFidesOriginRegistry...',
    optimism: '0xFidesOriginRegistry...',
    base: '0xFidesOriginRegistry...',
};
// ============================================================================
// Risk Level Configuration
// ============================================================================
/** Risk level definitions with thresholds and display properties */
exports.RISK_LEVELS = {
    low: {
        name: 'Low Risk',
        label: 'Low',
        threshold: 0,
        color: '#22c55e',
        bgColor: 'bg-green-500',
        textColor: 'text-green-500',
        borderColor: 'border-green-500',
        icon: 'shield-check',
        description: 'Address shows normal activity patterns with no significant risk indicators.',
    },
    medium: {
        name: 'Medium Risk',
        label: 'Medium',
        threshold: 30,
        color: '#eab308',
        bgColor: 'bg-yellow-500',
        textColor: 'text-yellow-500',
        borderColor: 'border-yellow-500',
        icon: 'alert-triangle',
        description: 'Address has some risk indicators that warrant additional review.',
    },
    high: {
        name: 'High Risk',
        label: 'High',
        threshold: 70,
        color: '#f97316',
        bgColor: 'bg-orange-500',
        textColor: 'text-orange-500',
        borderColor: 'border-orange-500',
        icon: 'alert-octagon',
        description: 'Address shows significant risk indicators and requires enhanced due diligence.',
    },
    critical: {
        name: 'Critical Risk',
        label: 'Critical',
        threshold: 90,
        color: '#ef4444',
        bgColor: 'bg-red-500',
        textColor: 'text-red-500',
        borderColor: 'border-red-500',
        icon: 'shield-alert',
        description: 'Address has severe risk indicators. Immediate action recommended.',
    },
};
/** Risk level keys in order of severity */
exports.RISK_LEVEL_ORDER = [
    'low',
    'medium',
    'high',
    'critical',
];
/** Risk score thresholds for classification */
exports.RISK_THRESHOLDS = {
    low: { min: 0, max: 29 },
    medium: { min: 30, max: 69 },
    high: { min: 70, max: 89 },
    critical: { min: 90, max: 100 },
};
// ============================================================================
// Risk Flags
// ============================================================================
/** All available risk flags with metadata */
exports.RISK_FLAGS = {
    sanctions: {
        label: 'Sanctions',
        description: 'Address associated with sanctioned entities',
        severity: 'critical',
        category: 'compliance',
    },
    fraud: {
        label: 'Fraud',
        description: 'Address involved in fraudulent activities',
        severity: 'high',
        category: 'security',
    },
    phishing: {
        label: 'Phishing',
        description: 'Address used in phishing campaigns',
        severity: 'high',
        category: 'security',
    },
    hack: {
        label: 'Hack',
        description: 'Address involved in hacking incidents',
        severity: 'critical',
        category: 'security',
    },
    mixer: {
        label: 'Mixer',
        description: 'Address associated with cryptocurrency mixers',
        severity: 'high',
        category: 'privacy',
    },
    darknet: {
        label: 'Darknet',
        description: 'Address linked to darknet marketplaces',
        severity: 'critical',
        category: 'compliance',
    },
    scam: {
        label: 'Scam',
        description: 'Address involved in scam operations',
        severity: 'high',
        category: 'security',
    },
    high_risk_exchange: {
        label: 'High-Risk Exchange',
        description: 'Address associated with high-risk exchanges',
        severity: 'medium',
        category: 'compliance',
    },
    ransomware: {
        label: 'Ransomware',
        description: 'Address linked to ransomware operations',
        severity: 'critical',
        category: 'security',
    },
    terrorism_financing: {
        label: 'Terrorism Financing',
        description: 'Address suspected of terrorism financing',
        severity: 'critical',
        category: 'compliance',
    },
    money_laundering: {
        label: 'Money Laundering',
        description: 'Address involved in money laundering',
        severity: 'critical',
        category: 'compliance',
    },
    tornado_cash: {
        label: 'Tornado Cash',
        description: 'Address associated with Tornado Cash',
        severity: 'high',
        category: 'privacy',
    },
    suspicious_activity: {
        label: 'Suspicious Activity',
        description: 'Address showing suspicious transaction patterns',
        severity: 'medium',
        category: 'behavior',
    },
    peeling_chain: {
        label: 'Peeling Chain',
        description: 'Address involved in peeling chain transactions',
        severity: 'medium',
        category: 'behavior',
    },
    layering: {
        label: 'Layering',
        description: 'Address showing layering behavior',
        severity: 'medium',
        category: 'behavior',
    },
};
// ============================================================================
// Address Validation
// ============================================================================
/** Address length requirements by chain */
exports.ADDRESS_LENGTHS = {
    ethereum: { min: 42, max: 42 },
    bitcoin: { min: 26, max: 62 },
    polygon: { min: 42, max: 42 },
    bsc: { min: 42, max: 42 },
    arbitrum: { min: 42, max: 42 },
    optimism: { min: 42, max: 42 },
    base: { min: 42, max: 42 },
    solana: { min: 32, max: 44 },
};
/** Address prefix requirements by chain */
exports.ADDRESS_PREFIXES = {
    ethereum: ['0x'],
    bitcoin: ['1', '3', 'bc1'],
    polygon: ['0x'],
    bsc: ['0x'],
    arbitrum: ['0x'],
    optimism: ['0x'],
    base: ['0x'],
    solana: [],
};
// ============================================================================
// API Configuration
// ============================================================================
/** Default API configuration */
exports.DEFAULT_API_CONFIG = {
    baseUrl: 'https://api.fidesorigin.com',
    timeout: 30000,
    maxRetries: 3,
    baseDelayMs: 1000,
    maxDelayMs: 30000,
};
/** API endpoints */
exports.API_ENDPOINTS = {
    risk: {
        check: '/v1/risk/check',
        batch: '/v1/risk/batch',
        profile: '/v1/risk/profile',
        history: '/v1/risk/history',
    },
    compliance: {
        check: '/v1/compliance/check',
        policies: '/v1/compliance/policies',
    },
    websocket: {
        connect: '/v1/ws',
    },
};
// ============================================================================
// WebSocket Configuration
// ============================================================================
/** WebSocket default configuration */
exports.WEBSOCKET_CONFIG = {
    reconnectInterval: 5000,
    maxReconnectAttempts: 10,
    heartbeatInterval: 30000,
};
// ============================================================================
// UI Constants
// ============================================================================
/** Default pagination settings */
exports.DEFAULT_PAGINATION = {
    page: 1,
    pageSize: 20,
    pageSizeOptions: [10, 20, 50, 100],
};
/** Toast notification durations (ms) */
exports.TOAST_DURATIONS = {
    info: 5000,
    success: 3000,
    warning: 5000,
    error: 8000,
};
/** Animation durations (ms) */
exports.ANIMATION_DURATIONS = {
    fast: 150,
    normal: 300,
    slow: 500,
};
// ============================================================================
// Regulatory Frameworks
// ============================================================================
/** Supported regulatory frameworks */
exports.REGULATORY_FRAMEWORKS = {
    FATF: 'FATF Travel Rule',
    EU_MICA: 'EU MiCA',
    US_BSA: 'US BSA/AML',
    UK_MLR: 'UK MLRs',
    SG_MAS: 'Singapore MAS',
    HK_SFC: 'Hong Kong SFC',
};
/** Jurisdiction codes */
exports.JURISDICTIONS = {
    US: 'United States',
    UK: 'United Kingdom',
    EU: 'European Union',
    SG: 'Singapore',
    HK: 'Hong Kong',
    JP: 'Japan',
    CA: 'Canada',
    AU: 'Australia',
    CH: 'Switzerland',
    DE: 'Germany',
    FR: 'France',
};
