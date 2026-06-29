/**
 * FidesOrigin Shared Constants
 * Chain IDs, contract addresses, risk level enums, and other shared constants
 */
/** Chain ID mapping for supported networks */
export declare const CHAIN_IDS: Record<string, number>;
/** Chain names for display */
export declare const CHAIN_NAMES: Record<string, string>;
/** Chain native currency symbols */
export declare const CHAIN_CURRENCIES: Record<string, string>;
/** Chain explorer URLs */
export declare const CHAIN_EXPLORERS: Record<string, string>;
/** FidesOrigin registry contract addresses by chain */
export declare const FIDES_REGISTRY_ADDRESSES: Record<string, string>;
/** Risk level definitions with thresholds and display properties */
export declare const RISK_LEVELS: {
    readonly low: {
        readonly name: "Low Risk";
        readonly label: "Low";
        readonly threshold: 0;
        readonly color: "#22c55e";
        readonly bgColor: "bg-green-500";
        readonly textColor: "text-green-500";
        readonly borderColor: "border-green-500";
        readonly icon: "shield-check";
        readonly description: "Address shows normal activity patterns with no significant risk indicators.";
    };
    readonly medium: {
        readonly name: "Medium Risk";
        readonly label: "Medium";
        readonly threshold: 30;
        readonly color: "#eab308";
        readonly bgColor: "bg-yellow-500";
        readonly textColor: "text-yellow-500";
        readonly borderColor: "border-yellow-500";
        readonly icon: "alert-triangle";
        readonly description: "Address has some risk indicators that warrant additional review.";
    };
    readonly high: {
        readonly name: "High Risk";
        readonly label: "High";
        readonly threshold: 70;
        readonly color: "#f97316";
        readonly bgColor: "bg-orange-500";
        readonly textColor: "text-orange-500";
        readonly borderColor: "border-orange-500";
        readonly icon: "alert-octagon";
        readonly description: "Address shows significant risk indicators and requires enhanced due diligence.";
    };
    readonly critical: {
        readonly name: "Critical Risk";
        readonly label: "Critical";
        readonly threshold: 90;
        readonly color: "#ef4444";
        readonly bgColor: "bg-red-500";
        readonly textColor: "text-red-500";
        readonly borderColor: "border-red-500";
        readonly icon: "shield-alert";
        readonly description: "Address has severe risk indicators. Immediate action recommended.";
    };
};
/** Risk level keys in order of severity */
export declare const RISK_LEVEL_ORDER: Array<'low' | 'medium' | 'high' | 'critical'>;
/** Risk score thresholds for classification */
export declare const RISK_THRESHOLDS: {
    readonly low: {
        readonly min: 0;
        readonly max: 29;
    };
    readonly medium: {
        readonly min: 30;
        readonly max: 69;
    };
    readonly high: {
        readonly min: 70;
        readonly max: 89;
    };
    readonly critical: {
        readonly min: 90;
        readonly max: 100;
    };
};
/** All available risk flags with metadata */
export declare const RISK_FLAGS: {
    readonly sanctions: {
        readonly label: "Sanctions";
        readonly description: "Address associated with sanctioned entities";
        readonly severity: "critical";
        readonly category: "compliance";
    };
    readonly fraud: {
        readonly label: "Fraud";
        readonly description: "Address involved in fraudulent activities";
        readonly severity: "high";
        readonly category: "security";
    };
    readonly phishing: {
        readonly label: "Phishing";
        readonly description: "Address used in phishing campaigns";
        readonly severity: "high";
        readonly category: "security";
    };
    readonly hack: {
        readonly label: "Hack";
        readonly description: "Address involved in hacking incidents";
        readonly severity: "critical";
        readonly category: "security";
    };
    readonly mixer: {
        readonly label: "Mixer";
        readonly description: "Address associated with cryptocurrency mixers";
        readonly severity: "high";
        readonly category: "privacy";
    };
    readonly darknet: {
        readonly label: "Darknet";
        readonly description: "Address linked to darknet marketplaces";
        readonly severity: "critical";
        readonly category: "compliance";
    };
    readonly scam: {
        readonly label: "Scam";
        readonly description: "Address involved in scam operations";
        readonly severity: "high";
        readonly category: "security";
    };
    readonly high_risk_exchange: {
        readonly label: "High-Risk Exchange";
        readonly description: "Address associated with high-risk exchanges";
        readonly severity: "medium";
        readonly category: "compliance";
    };
    readonly ransomware: {
        readonly label: "Ransomware";
        readonly description: "Address linked to ransomware operations";
        readonly severity: "critical";
        readonly category: "security";
    };
    readonly terrorism_financing: {
        readonly label: "Terrorism Financing";
        readonly description: "Address suspected of terrorism financing";
        readonly severity: "critical";
        readonly category: "compliance";
    };
    readonly money_laundering: {
        readonly label: "Money Laundering";
        readonly description: "Address involved in money laundering";
        readonly severity: "critical";
        readonly category: "compliance";
    };
    readonly tornado_cash: {
        readonly label: "Tornado Cash";
        readonly description: "Address associated with Tornado Cash";
        readonly severity: "high";
        readonly category: "privacy";
    };
    readonly suspicious_activity: {
        readonly label: "Suspicious Activity";
        readonly description: "Address showing suspicious transaction patterns";
        readonly severity: "medium";
        readonly category: "behavior";
    };
    readonly peeling_chain: {
        readonly label: "Peeling Chain";
        readonly description: "Address involved in peeling chain transactions";
        readonly severity: "medium";
        readonly category: "behavior";
    };
    readonly layering: {
        readonly label: "Layering";
        readonly description: "Address showing layering behavior";
        readonly severity: "medium";
        readonly category: "behavior";
    };
};
/** Address length requirements by chain */
export declare const ADDRESS_LENGTHS: Record<string, {
    min: number;
    max: number;
}>;
/** Address prefix requirements by chain */
export declare const ADDRESS_PREFIXES: Record<string, string[]>;
/** Default API configuration */
export declare const DEFAULT_API_CONFIG: {
    readonly baseUrl: "https://api.fidesorigin.com";
    readonly timeout: 30000;
    readonly maxRetries: 3;
    readonly baseDelayMs: 1000;
    readonly maxDelayMs: 30000;
};
/** API endpoints */
export declare const API_ENDPOINTS: {
    readonly risk: {
        readonly check: "/v1/risk/check";
        readonly batch: "/v1/risk/batch";
        readonly profile: "/v1/risk/profile";
        readonly history: "/v1/risk/history";
    };
    readonly compliance: {
        readonly check: "/v1/compliance/check";
        readonly policies: "/v1/compliance/policies";
    };
    readonly websocket: {
        readonly connect: "/v1/ws";
    };
};
/** WebSocket default configuration */
export declare const WEBSOCKET_CONFIG: {
    readonly reconnectInterval: 5000;
    readonly maxReconnectAttempts: 10;
    readonly heartbeatInterval: 30000;
};
/** Default pagination settings */
export declare const DEFAULT_PAGINATION: {
    readonly page: 1;
    readonly pageSize: 20;
    readonly pageSizeOptions: readonly [10, 20, 50, 100];
};
/** Toast notification durations (ms) */
export declare const TOAST_DURATIONS: {
    readonly info: 5000;
    readonly success: 3000;
    readonly warning: 5000;
    readonly error: 8000;
};
/** Animation durations (ms) */
export declare const ANIMATION_DURATIONS: {
    readonly fast: 150;
    readonly normal: 300;
    readonly slow: 500;
};
/** Supported regulatory frameworks */
export declare const REGULATORY_FRAMEWORKS: {
    readonly FATF: "FATF Travel Rule";
    readonly EU_MICA: "EU MiCA";
    readonly US_BSA: "US BSA/AML";
    readonly UK_MLR: "UK MLRs";
    readonly SG_MAS: "Singapore MAS";
    readonly HK_SFC: "Hong Kong SFC";
};
/** Jurisdiction codes */
export declare const JURISDICTIONS: {
    readonly US: "United States";
    readonly UK: "United Kingdom";
    readonly EU: "European Union";
    readonly SG: "Singapore";
    readonly HK: "Hong Kong";
    readonly JP: "Japan";
    readonly CA: "Canada";
    readonly AU: "Australia";
    readonly CH: "Switzerland";
    readonly DE: "Germany";
    readonly FR: "France";
};
