// FidesOrigin Address Risk Check - External Script (CSP Compliant)
let addressDB = null;
let addressMap = new Map();

// [H-6 Fix] Subgraph URL from environment variable or backend API proxy — no hardcoded URLs
const SUBGRAPH_URL = (typeof window !== 'undefined' && window.FIDESORIGIN_SUBGRAPH_URL)
    || (typeof process !== 'undefined' && process.env.FIDESORIGIN_SUBGRAPH_URL)
    || '';

const NETWORK = 'sepolia';
let API_KEY = window.FIDESORIGIN_API_KEY || '';
// [LOW-23 FIX] SECURITY WARNING: Never store API keys in localStorage, sessionStorage,
// or global scope. They are vulnerable to XSS attacks. Use one of:
//   1. Backend proxy (recommended): API calls go through your own backend
//   2. httpOnly cookie: Set by backend, inaccessible to JavaScript
//   3. Scoped public token (pk_*): Rotate frequently, minimal permissions
// If window.FIDESORIGIN_API_KEY is set, ensure it comes from a secure build-time injection.
if (typeof window !== 'undefined' && window.localStorage && window.localStorage.getItem('FIDESORIGIN_API_KEY')) {
    console.warn('[SECURITY] API key detected in localStorage. This is insecure. Remove it immediately.');
}

// [M-7 Fix] Backend API base: no hardcoded fallback; must be provided via env/config
const BACKEND_API = (typeof window !== 'undefined' && window.FIDESORIGIN_BACKEND_URL)
    || (typeof process !== 'undefined' && process.env.FIDESORIGIN_BACKEND_URL)
    || '';

// [H-7 Fix] CSRF Token management
let csrfToken = '';
async function fetchCsrfToken() {
    try {
        const res = await fetch('/api/csrf-token', {
            method: 'GET',
            credentials: 'same-origin',
            headers: { 'Accept': 'application/json' }
        });
        if (res.ok) {
            const data = await res.json();
            csrfToken = data.csrfToken || '';
        }
    } catch (e) {
        console.warn('[CSRF] Failed to fetch CSRF token:', e);
    }
}
// Fetch CSRF token on load
fetchCsrfToken();

function getCsrfHeaders() {
    const headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
    };
    if (API_KEY) headers['X-API-Key'] = API_KEY;
    if (csrfToken) headers['X-CSRF-Token'] = csrfToken;
    return headers;
}

function toggleDropdown(id, event) {
    event.stopPropagation();
    const dropdown = document.getElementById(id);
    const isOpen = dropdown.classList.contains('open');
    document.querySelectorAll('.lang-dropdown').forEach(d => d.classList.remove('open'));
    if (!isOpen) dropdown.classList.add('open');
}

document.addEventListener('click', function(e) {
    if (!e.target.closest('.lang-dropdown')) {
        document.querySelectorAll('.lang-dropdown').forEach(d => d.classList.remove('open'));
    }
});

function showToast(message, type = 'error') {
    const toast = document.getElementById('errorToast');
    toast.textContent = message;
    toast.className = 'toast toast-' + type + ' show';
    setTimeout(() => toast.classList.remove('show'), 5000);
}

function setLoading(loading) {
    const btn = document.getElementById('checkBtn');
    const text = document.getElementById('btnText');
    btn.disabled = loading;
    if (loading) {
        // [MEDIUM-6 FIX] 使用 textContent 替代 innerHTML，防止 XSS
        // 动态创建 spinner 元素而不是插入 HTML 字符串
        text.textContent = '';
        const spinner = document.createElement('div');
        spinner.className = 'spinner';
        text.appendChild(spinner);
        text.appendChild(document.createTextNode(' Checking...'));
    } else {
        text.textContent = 'Check Risk Level';
    }
}

async function loadStatsFromSubgraph() {
    if (!SUBGRAPH_URL) {
        console.warn('[Subgraph] No SUBGRAPH_URL configured; skipping subgraph stats.');
        return;
    }
    try {
        const query = `query {
            protocolStats(id: "stats") {
                totalComplianceChecks
                totalBlocked
                totalFlagged
                totalHeld
                totalSanctioned
            }
            sanctionedAddresses(where: {isActive: true}) {
                id
            }
        }`;
        // [M-5 Fix] Use AbortController + setTimeout instead of AbortSignal.timeout for compatibility
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        const res = await fetch(SUBGRAPH_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query }),
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        const data = await res.json();
        if (data.data && data.data.protocolStats) {
            const s = data.data.protocolStats;
            const total = Number(s.totalComplianceChecks || 0);
            const black = Number(s.totalBlocked || 0) + Number(s.totalSanctioned || 0);
            const grey = Number(s.totalFlagged || 0) + Number(s.totalHeld || 0);
            document.getElementById('totalCount').textContent = total.toLocaleString();
            document.getElementById('blackCount').textContent = black.toLocaleString();
            document.getElementById('greyCount').textContent = grey.toLocaleString();
        }
    } catch (e) {
        console.error('Stats load failed:', e);
        if (addressMap.size > 0) {
            let black = 0, grey = 0;
            addressMap.forEach(e => {
                if (e.riskTier === 'BLACK') black++;
                else if (e.riskTier === 'GREY') grey++;
            });
            document.getElementById('totalCount').textContent = addressMap.size.toLocaleString();
            document.getElementById('blackCount').textContent = black.toLocaleString();
            document.getElementById('greyCount').textContent = grey.toLocaleString();
        }
    }
}

async function loadDatabase() {
    try {
        const response = await fetch('./data-sync/cache/address-labels-v11.json');
        if (response.ok) {
            addressDB = await response.json();
            for (const entry of addressDB.addressLabels) {
                addressMap.set(entry.address.toLowerCase(), entry);
            }
            console.log('Database loaded:', addressMap.size, 'addresses');
            loadStatsFromSubgraph();
        }
    } catch (e) {
        console.log('Database not loaded, using fallback');
    }
}

async function fetchBackendRisk(address) {
    const apiBase = BACKEND_API || window.location.origin;
    const url = `${apiBase}/api/v1/address/${address}/risk`;
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        const res = await fetch(url, {
            method: 'GET',
            headers: getCsrfHeaders(),
            signal: controller.signal,
            credentials: 'same-origin'
        });
        clearTimeout(timeoutId);
        if (res.status === 401 || res.status === 403) {
            throw new Error('API key required or invalid');
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
    } catch (e) {
        console.log('Backend API unavailable:', e.message);
        return null;
    }
}

async function fetchSubgraphRisk(address) {
    if (!SUBGRAPH_URL) {
        console.warn('[Subgraph] No SUBGRAPH_URL configured; skipping subgraph query.');
        return null;
    }
    // [MEDIUM-4 FIX] 使用 GraphQL 变量替代字符串插值，防止注入攻击
    const query = `query GetRiskProfile($id: String!) {
        riskProfile(id: $id) {
            id
            riskScore
            tier
            isSanctioned
            tags
        }
    }`;
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(SUBGRAPH_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query, variables: { id: address.toLowerCase() } }),
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        const data = await res.json();
        if (data.data && data.data.riskProfile) {
            return data.data.riskProfile;
        }
    } catch (e) {
        console.log('Subgraph query failed:', e.message);
    }
    return null;
}

async function checkAddress() {
    const input = document.getElementById('addressInput').value.trim().toLowerCase();
    const resultBox = document.getElementById('resultBox');
    const badge = document.getElementById('riskBadge');

    if (!input || !input.match(/^0x[a-f0-9]{40}$/)) {
        badge.className = 'risk-badge risk-grey';
        badge.textContent = 'Invalid Address';
        resultBox.classList.add('show');
        return;
    }

    setLoading(true);
    resultBox.classList.add('show');
    document.getElementById('resultAddr').textContent = input;
    badge.className = 'risk-badge risk-grey';
    badge.textContent = 'Checking...';

    let apiData = await fetchBackendRisk(input);
    let subgraphData = null;
    let entry = addressMap.get(input);

    if (!apiData) {
        subgraphData = await fetchSubgraphRisk(input);
        if (!subgraphData && !entry) {
            showToast('Backend API unavailable. Showing cached data.', 'info');
        }
    }

    if (apiData) {
        const score = apiData.risk_score ?? 0;
        const level = apiData.risk_level || 'UNKNOWN';
        const factors = apiData.risk_factors || [];
        const tags = apiData.tags || [];

        document.getElementById('resultScore').textContent = score;
        document.getElementById('resultTier').textContent = level;
        document.getElementById('resultSource').textContent = 'FidesOrigin Backend';
        document.getElementById('resultTags').textContent = tags.join(', ') || '-';
        document.getElementById('resultEntity').textContent = factors.map(f => f.name || f.type).join(', ') || '-';

        if (level === 'HIGH' || level === 'CRITICAL' || score >= 80) {
            badge.className = 'risk-badge risk-black';
            badge.textContent = '⚠️ High Risk';
        } else if (level === 'MEDIUM' || score >= 40) {
            badge.className = 'risk-badge risk-grey';
            badge.textContent = '⚡ Medium Risk';
        } else {
            badge.className = 'risk-badge risk-safe';
            badge.textContent = '✅ Low Risk';
        }
    } else if (subgraphData) {
        const tier = subgraphData.tier;
        const score = subgraphData.riskScore;
        const tags = subgraphData.tags || [];

        document.getElementById('resultScore').textContent = score;
        document.getElementById('resultTier').textContent = tier;
        document.getElementById('resultSource').textContent = 'FidesOrigin Subgraph (The Graph)';
        document.getElementById('resultTags').textContent = tags.join(', ') || '-';
        document.getElementById('resultEntity').textContent = subgraphData.isSanctioned ? 'Sanctioned' : '-';

        if (tier === 'HIGH' || subgraphData.isSanctioned) {
            badge.className = 'risk-badge risk-black';
            badge.textContent = '⚠️ High Risk - ' + (subgraphData.isSanctioned ? 'Sanctioned' : tier);
        } else if (tier === 'MEDIUM') {
            badge.className = 'risk-badge risk-grey';
            badge.textContent = '⚡ Medium Risk';
        } else {
            badge.className = 'risk-badge risk-safe';
            badge.textContent = '✅ Low Risk';
        }
    } else if (entry) {
        document.getElementById('resultScore').textContent = entry.riskScore || 'N/A';
        document.getElementById('resultTier').textContent = entry.riskTier || 'N/A';
        document.getElementById('resultSource').textContent = entry.source || 'Local Database';
        document.getElementById('resultTags').textContent = (entry.tags || []).join(', ') || '-';
        document.getElementById('resultEntity').textContent = entry.entity || '-';

        if (entry.riskTier === 'BLACK') {
            badge.className = 'risk-badge risk-black';
            badge.textContent = '⚠️ High Risk - Blacklist';
        } else {
            badge.className = 'risk-badge risk-grey';
            badge.textContent = '⚡ Greylist - Caution';
        }
    } else {
        badge.className = 'risk-badge risk-safe';
        badge.textContent = '✅ Not in Database';
        document.getElementById('resultScore').textContent = '-';
        document.getElementById('resultTier').textContent = 'UNKNOWN';
        document.getElementById('resultSource').textContent = '-';
        document.getElementById('resultTags').textContent = '-';
        document.getElementById('resultEntity').textContent = '-';
    }

    setLoading(false);
}

loadDatabase();
document.getElementById('addressInput').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') checkAddress();
});

// [M-4 Fix] Attach event listeners instead of inline onclick
document.addEventListener('DOMContentLoaded', function() {
    var checkBtn = document.getElementById('checkBtn');
    if (checkBtn) checkBtn.addEventListener('click', checkAddress);
    var langBtn = document.getElementById('langDropdownBtn');
    if (langBtn) {
        langBtn.addEventListener('click', function(e) {
            toggleDropdown('langDropdownNav', e);
        });
    }
});
