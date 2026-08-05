// FidesOrigin Admin Configuration - External config file (L-08 fix)
// Replace with your actual contract addresses or load from backend API
const SEPOLIA_ADDRESSES = {
    CompliantStableCoin: localStorage.getItem('contractAddress') || '0x1234567890123456789012345678901234567890',
    // Add other contract addresses here
};

window.SEPOLIA_ADDRESSES = SEPOLIA_ADDRESSES;
