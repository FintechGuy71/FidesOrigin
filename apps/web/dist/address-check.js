// FidesOrigin Address Risk Check - External Script (CSP Compliant)
let addressDB = null;
let addressMap = new Map();

const SUBGRAPH_URLS = {
    sepolia: 'https://api.studio.thegraph.com/query/1749664/fidesorigin-sepolia/v0.0.3',
    mainnet: 'https://api.studio.thegraph.com/query/1749664/fidesorigin/v0.0.1'
};

const NETWORK = 'sepolia';
const SUBGRAPH_URL = SUBGRAPH_URLS[NETWORK] || SUBGRAPH_URLS.sepolia;
let API_KEY = window.FIDESORIGIN_API_KEY || localStorage.getItem('fidesorigin_api_key') || '';

const BACKEND_API = (window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1'))
    ? 'http://localhost:8000'
    : '';

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
        text.innerHTML = '<div class="spinner"></div> Checking...';
    } else {
        text.textContent = 'Check Risk Level';
    }
}

async function loadStatsFromSubgraph() {
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
        const res = await fetch(SUBGRAPH_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query })
        });
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
        const headers = { 
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        };
        if (API_KEY) headers['X-API-Key'] = API_KEY;
        
        const res = await fetch(url, {
            method: 'GET',
            headers: headers,
            signal: AbortSignal.timeout(8000)
        });
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
    const query = `query {
        riskProfile(id: "${address.toLowerCase()}") {
            id
            riskScore
            tier
            isSanctioned
            tags
        }
    }`;
    try {
        const res = await fetch(SUBGRAPH_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query }),
            signal: AbortSignal.timeout(5000)
        });
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
