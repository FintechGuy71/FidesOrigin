// FidesOrigin Sepolia Contract Configuration
// WARNING: This file contains HARDCODED TESTNET (Sepolia) contract addresses.
// These are for TESTING ONLY. For production, use environment variables or
// a configuration management system. Never hardcode mainnet addresses.
// Synced with DEPLOYED.md (v3.1.0 authoritative contract set)
// Last updated: 2026-08-25

// [M-6 Fix] Object.freeze prevents runtime tampering of known addresses
window.SEPOLIA_ADDRESSES = Object.freeze({
    RiskRegistry:         '0x953f985f38f94d6159c0600d1f15D543895cE896',
    PolicyEngine:         '0xCA12BB2daD2a6D429277823366D8C88a490EDDeA',
    ComplianceEngine:     '0xdF36A8b16F064308eeDE21A740FAc4e87b724F0E', // Diamond 引擎
    QuarantineVault:      '0x6803E163259B07F58111f56423aB0732858196Be',
    MerkleRiskRegistry:   '0x31A034efbe22eDc1a78ceb37F52BA869D869c33B',
    CompliantStableCoin:  '0x2245A8FCf6aca017327eA8950Ba510e9596595E9',
    FidesCompliance:      '0x2625eA99A0E7D419b8051C4f2B3cC0b5d78d79D5',
    CompliantSmartWallet: 'PENDING', // v3.1.0 未部署
    TestUSD:              '0x34c76eE51f3A063365279f510dA9503dF809D374',
});
