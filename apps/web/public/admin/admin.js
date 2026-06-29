        // Contract ABI (简化版，实际使用时需要完整 ABI)
        const CONTRACT_ABI = [
            "function getContractInfo() view returns (string name, string symbol, uint8 decimals, uint256 totalSupply, uint256 vipCount, uint256 greyCount, uint256 blackCount, bool paused, uint256 timelockDelay, uint256 requiredSigs, uint256 signerCount)",
            "function getRiskLevel(address account) view returns (uint8)",
            "function getRiskLevelName(address account) view returns (string)",
            "function getLimitInfo(address account) view returns (string levelName, uint256 dailyLimit, uint256 singleLimit, uint256 dailyUsed, uint256 remaining, bool limited)",
            "function getVIPList() view returns (address[])",
            "function getGreyList() view returns (address[])",
            "function getBlackList() view returns (address[])",
            "function tagAddress(address account, uint8 level, string reason)",
            "function untagAddress(address account)",
            "function mint(address to, uint256 amount)",
            "function emergencyPause()",
            "function emergencyUnpause()",
            "function addSigner(address signer)",
            "function removeSigner(address signer)",
            "function updateRequiredSignatures(uint256 newRequired)",
            "function getSigners() view returns (address[])",
            "function isSigner(address account) view returns (bool)",
            "function scheduleOperation(uint8 operationType, address target, uint256 value, bytes data) returns (bytes32)",
            "function signOperation(bytes32 operationId)",
            "function executeOperation(bytes32 operationId)",
            "function getPendingOperations() view returns (bytes32[])",
            "function getOperationDetails(bytes32 operationId) view returns (uint8 operationType, address target, uint256 value, bytes data, uint256 timestamp, bool executed, uint256 signatureCount, uint256 requiredSignatures)",
            "function updateTimelockDelay(uint256 newDelay)",
            "function hasRole(bytes32 role, address account) view returns (bool)",
            "event AddressTagged(address indexed account, uint8 level, string reason, address indexed operator)",
            "event TransferBlocked(address indexed from, address indexed to, uint256 amount, string reason)"
        ];

// SECURITY NOTE: Load contract addresses from external config file.
// See admin-config.js for configuration.
const SEPOLIA_ADDRESSES = window.SEPOLIA_ADDRESSES || {
            RiskRegistry: '0xdA4D86D812b4AdF3e0023a6D4b1FF20139abD3b3',
            PolicyEngine: '0xF8f89120f5628aE3De747f55e7d00D79633002c4',
            ComplianceEngine: '0xd978f3246c56d7E3c3fF326e9fDe539f91F39ACa',
            CompliantStableCoin: '0x5028Dc7DA99bf461ed60a226c7CEf0bf7f77BF9A',
            CompliantSmartWallet: '0xbe33EBA3e0d6Dc324aBF1DE1aD0E1e65DcA526AB',
            FidesCompliance: '0xaEB8ffDC51C62c37b456593F4C5E68D291Ce552b'
        };
        
        const SUBGRAPH_URL = 'https://api.studio.thegraph.com/query/1749664/fidesorigin-sepolia/v0.0.3';
        
        // Contract Address - defaults to Sepolia CompliantStableCoin
        const CONTRACT_ADDRESS = localStorage.getItem('contractAddress') || SEPOLIA_ADDRESSES.CompliantStableCoin;
        
        let provider, signer, contract, userAddress;
        let charts = {};
        
        // ========== The Graph Subgraph Queries ==========
        async function querySubgraph(query) {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 10000);
            try {
                const response = await fetch(SUBGRAPH_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query }),
                    signal: controller.signal
                });
                clearTimeout(timeout);
                const data = await response.json();
                if (data.errors) {
                    console.error('Subgraph errors:', data.errors);
                    return null;
                }
                return data.data;
            } catch (error) {
                clearTimeout(timeout);
                console.error('Subgraph query failed:', error);
                return null;
            }
        }

        function showToast(message, type = 'error') {
            const toast = document.getElementById('toast');
            toast.textContent = message;
            toast.className = 'toast toast-' + type + ' show';
            setTimeout(() => toast.classList.remove('show'), 5000);
        }
        
        async function loadSubgraphStats() {
            try {
                const data = await querySubgraph(`
                    query {
                        protocolStats(id: "stats") {
                            totalComplianceChecks
                            totalBlocked
                            totalFlagged
                            totalHeld
                            totalSanctioned
                            totalFundsHeld
                            lastUpdated
                        }
                    }
                `);
                if (data && data.protocolStats) {
                    const s = data.protocolStats;
                    document.getElementById('subgraphTotalChecks').textContent = s.totalComplianceChecks || '0';
                    document.getElementById('subgraphBlocked').textContent = s.totalBlocked || '0';
                    document.getElementById('subgraphSanctioned').textContent = s.totalSanctioned || '0';
                    document.getElementById('subgraphHeld').textContent = s.totalFundsHeld || '0';
                }
            } catch (error) {
                console.error('加载统计失败:', error);
                showToast('统计数据加载失败', 'error');
            }
        }
        
        async function loadSubgraphRiskProfiles() {
            try {
                const data = await querySubgraph(`
                    query {
                        riskProfiles(first: 50, orderBy: lastUpdated, orderDirection: desc) {
                            id
                            riskScore
                            tier
                            isSanctioned
                            tags
                            lastUpdated
                            createdAt
                        }
                    }
                `);
                if (data && data.riskProfiles) {
                    const tbody = document.getElementById('customersTable');
                    tbody.innerHTML = '';
                    
                    // Also get last compliance check for each profile
                    const checkData = await querySubgraph(`
                        query {
                            complianceChecks(first: 200, orderBy: timestamp, orderDirection: desc) {
                                id
                                riskProfile { id }
                                timestamp
                            }
                        }
                    `);
                    const lastCheckMap = {};
                    if (checkData && checkData.complianceChecks) {
                        checkData.complianceChecks.forEach(c => {
                            const addr = c.riskProfile?.id;
                            if (addr && !lastCheckMap[addr]) {
                                lastCheckMap[addr] = c.timestamp;
                            }
                        });
                    }
                    
                    data.riskProfiles.forEach(profile => {
                        const tierColors = { UNKNOWN: '#94a3b8', LOW: '#22c55e', MEDIUM: '#f59e0b', HIGH: '#ef4444' };
                        const tagTime = new Date(Number(profile.createdAt) * 1000).toLocaleString();
                        const lastTx = lastCheckMap[profile.id] 
                            ? new Date(Number(lastCheckMap[profile.id]) * 1000).toLocaleString() 
                            : '-';
                        const tags = (profile.tags || []).join(', ') || '-';
                        
                        tbody.innerHTML += `
                            <tr>
                                <td class="address-cell">${profile.id.slice(0, 10)}...${profile.id.slice(-4)}</td>
                                <td><span style="color:${tierColors[profile.tier] || '#94a3b8'}">${profile.tier}</span> (${profile.riskScore})</td>
                                <td>${lastTx}</td>
                                <td>${tagTime}</td>
                                <td>${tags}</td>
                                <td>
                                    <button class="btn btn-sm btn-primary" onclick="viewProfile('${profile.id}')">查看</button>
                                    ${profile.isSanctioned ? '<span class="badge badge-danger">已制裁</span>' : ''}
                                </td>
                            </tr>
                        `;
                    });
                }
            } catch (error) {
                console.error('加载客户列表失败:', error);
                showToast('客户列表加载失败', 'error');
            }
        }
        
        async function loadSubgraphComplianceChecks(decision = '') {
            let whereClause = '';
            if (decision) whereClause = `, where: { decision: "${decision}" }`;
            
            try {
                const data = await querySubgraph(`
                    query {
                        complianceChecks(first: 50, orderBy: timestamp, orderDirection: desc${whereClause}) {
                            id
                            operator
                            from
                            to
                            amount
                            decision
                            reason
                            timestamp
                        }
                    }
                `);
                if (data && data.complianceChecks) {
                    const checks = data.complianceChecks;
                    
                    // Update dashboard transactions table
                    const tbody = document.getElementById('transactionsTable');
                    if (tbody) {
                        tbody.innerHTML = '';
                        checks.slice(0, 20).forEach(check => {
                            const decisionColors = { ALLOW: 'var(--success)', BLOCK: 'var(--danger)', FLAG: 'var(--warning)', HOLD: 'var(--accent-cyan)' };
                            const date = new Date(check.timestamp * 1000).toLocaleString();
                            tbody.innerHTML += `
                                <tr>
                                    <td class="address-cell">${check.from.slice(0, 10)}...</td>
                                    <td class="address-cell">${check.to.slice(0, 10)}...</td>
                                    <td>${ethers.formatUnits(check.amount, 6)}</td>
                                    <td><span style="color:${decisionColors[check.decision] || '#94a3b8'}">${check.decision}</span></td>
                                    <td>${check.reason || '-'}</td>
                                    <td>${date}</td>
                                    <td><span class="badge badge-success">已处理</span></td>
                                </tr>
                            `;
                        });
                    }
                    
                    // Update compliance logs page table
                    const logsTbody = document.getElementById('complianceLogsTable');
                    if (logsTbody) {
                        logsTbody.innerHTML = '';
                        checks.forEach(check => {
                            const decisionColors = { ALLOW: 'var(--success)', BLOCK: 'var(--danger)', FLAG: 'var(--warning)', HOLD: 'var(--accent-cyan)' };
                            const date = new Date(check.timestamp * 1000).toLocaleString();
                            logsTbody.innerHTML += `
                                <tr>
                                    <td class="address-cell">${check.from.slice(0, 10)}...</td>
                                    <td class="address-cell">${check.to.slice(0, 10)}...</td>
                                    <td>${ethers.formatUnits(check.amount, 6)}</td>
                                    <td><span style="color:${decisionColors[check.decision] || '#94a3b8'}">${check.decision}</span></td>
                                    <td>${check.reason || '-'}</td>
                                    <td>${date}</td>
                                </tr>
                            `;
                        });
                    }
                }
            } catch (error) {
                console.error('加载合规检查失败:', error);
                showToast('合规检查数据加载失败', 'error');
            }
        }
        
        async function loadSubgraphPolicies() {
            const data = await querySubgraph(`
                query {
                    policies(first: 10) {
                        id
                        issuer
                        version
                        maxTxAmount
                        dailyLimit
                        allowMediumRisk
                        allowHighRisk
                        blockMixer
                        updatedAt
                    }
                }
            `);
            if (data && data.policies) {
                console.log('Subgraph policies:', data.policies);
            }
        }

        async function loadSubgraphChartData() {
            try {
                // Risk distribution from subgraph
                const riskData = await querySubgraph(`
                    query {
                        riskProfiles(first: 1000) {
                            id
                            tier
                            isSanctioned
                        }
                    }
                `);
                if (riskData && riskData.riskProfiles && charts.risk) {
                    const profiles = riskData.riskProfiles;
                    const vip = profiles.filter(p => p.tier === 'LOW').length;
                    const normal = profiles.filter(p => p.tier === 'UNKNOWN').length;
                    const grey = profiles.filter(p => p.tier === 'MEDIUM').length;
                    const black = profiles.filter(p => p.tier === 'HIGH' || p.isSanctioned).length;
                    charts.risk.data.datasets[0].data = [vip, normal, grey, black];
                    charts.risk.update();
                }

                // 24h transaction data
                const now = Math.floor(Date.now() / 1000);
                const dayAgo = now - 86400;
                const txData = await querySubgraph(`
                    query {
                        complianceChecks(
                            first: 200,
                            orderBy: timestamp,
                            orderDirection: desc,
                            where: { timestamp_gte: ${dayAgo} }
                        ) {
                            id
                            decision
                            timestamp
                        }
                    }
                `);
                if (txData && txData.complianceChecks && charts.tx) {
                    const bins = [
                        { label: '00:00', allow: 0, block: 0 },
                        { label: '04:00', allow: 0, block: 0 },
                        { label: '08:00', allow: 0, block: 0 },
                        { label: '12:00', allow: 0, block: 0 },
                        { label: '16:00', allow: 0, block: 0 },
                        { label: '20:00', allow: 0, block: 0 }
                    ];
                    txData.complianceChecks.forEach(c => {
                        const h = new Date(c.timestamp * 1000).getHours();
                        const binIndex = Math.floor(h / 4);
                        if (bins[binIndex]) {
                            if (c.decision === 'ALLOW') bins[binIndex].allow++;
                            else bins[binIndex].block++;
                        }
                    });
                    charts.tx.data.labels = bins.map(b => b.label);
                    charts.tx.data.datasets[0].data = bins.map(b => b.allow);
                    charts.tx.data.datasets[1].data = bins.map(b => b.block);
                    charts.tx.update();
                }

                // Role distribution from contract
                if (contract && charts.role) {
                    const signers = await contract.getSigners();
                    const ADMIN_ROLE = ethers.keccak256(ethers.toUtf8Bytes('ADMIN_ROLE'));
                    const OPERATOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes('OPERATOR_ROLE'));
                    const VIEWER_ROLE = ethers.keccak256(ethers.toUtf8Bytes('VIEWER_ROLE'));
                    
                    let adminCount = 0, operatorCount = 0, viewerCount = 0, signerCount = 0;
                    for (const addr of signers) {
                        const [isAdmin, isOperator, isViewer] = await Promise.all([
                            contract.hasRole(ADMIN_ROLE, addr),
                            contract.hasRole(OPERATOR_ROLE, addr),
                            contract.hasRole(VIEWER_ROLE, addr)
                        ]);
                        if (isAdmin) adminCount++;
                        else if (isOperator) operatorCount++;
                        else if (isViewer) viewerCount++;
                        else signerCount++;
                    }
                    charts.role.data.datasets[0].data = [adminCount, operatorCount, viewerCount, signerCount];
                    charts.role.update();
                }
            } catch (error) {
                console.error('Chart data load failed:', error);
                showToast('图表数据加载失败', 'error');
            }
        }
        
        // ========== Sepolia Network Detection ==========
        async function checkNetwork() {
            if (!provider) return;
            try {
                const network = await provider.getNetwork();
                const chainId = network.chainId;
                const networkBadge = document.getElementById('networkBadge');
                if (networkBadge) {
                    if (chainId === 11155111n) {
                        networkBadge.textContent = 'Sepolia';
                        networkBadge.style.background = 'var(--success)';
                        networkBadge.style.color = '#fff';
                    } else {
                        networkBadge.textContent = 'Network: ' + chainId.toString();
                        networkBadge.style.background = 'var(--warning)';
                        networkBadge.style.color = '#000';
                    }
                }
            } catch(e) {
                console.error('Network check failed:', e);
            }
        }
        
        // ========== Original Functions ==========

        // 初始化
        document.addEventListener('DOMContentLoaded', () => {
            initCharts();
            loadSettings();
        });

        // 初始化图表
        function initCharts() {
            const chartConfig = {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: { color: '#94a3b8' }
                    }
                },
                scales: {
                    x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(148, 163, 184, 0.1)' } },
                    y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(148, 163, 184, 0.1)' } }
                }
            };

            // 风险分布饼图
            charts.risk = new Chart(document.getElementById('riskChart'), {
                type: 'doughnut',
                data: {
                    labels: ['VIP', '普通', '灰名单', '黑名单'],
                    datasets: [{
                        data: [0, 0, 0, 0],
                        backgroundColor: ['#f59e0b', '#22c55e', '#94a3b8', '#ef4444'],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { labels: { color: '#94a3b8' } } }
                }
            });

            // 角色分布饼图
            charts.role = new Chart(document.getElementById('roleChart'), {
                type: 'pie',
                data: {
                    labels: ['Admin', 'Operator', 'Viewer', 'Signer'],
                    datasets: [{
                        data: [0, 0, 0, 0],
                        backgroundColor: ['#8b5cf6', '#06b6d4', '#94a3b8', '#ec4899'],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { labels: { color: '#94a3b8' } } }
                }
            });

            // 交易监控折线图
            charts.tx = new Chart(document.getElementById('txChart'), {
                type: 'line',
                data: {
                    labels: ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00'],
                    datasets: [
                        {
                            label: '正常交易',
                            data: [0, 0, 0, 0, 0, 0],
                            borderColor: '#22c55e',
                            backgroundColor: 'rgba(34, 197, 94, 0.1)',
                            fill: true,
                            tension: 0.4
                        },
                        {
                            label: '拦截次数',
                            data: [0, 0, 0, 0, 0, 0],
                            borderColor: '#ef4444',
                            backgroundColor: 'rgba(239, 68, 68, 0.1)',
                            fill: true,
                            tension: 0.4
                        }
                    ]
                },
                options: chartConfig
            });

            // 实时监控图表
            charts.realtime = new Chart(document.getElementById('realtimeChart'), {
                type: 'line',
                data: {
                    labels: Array.from({length: 20}, (_, i) => i),
                    datasets: [{
                        label: '实时TPS',
                        data: Array.from({length: 20}, () => 0),
                        borderColor: '#8b5cf6',
                        backgroundColor: 'rgba(139, 92, 246, 0.1)',
                        fill: true,
                        tension: 0.4
                    }]
                },
                options: {
                    ...chartConfig,
                    animation: { duration: 0 },
                    scales: {
                        x: { display: false },
                        y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(148, 163, 184, 0.1)' } }
                    }
                }
            });

            // 实时更新
            setInterval(() => {
                if (charts.realtime) {
                    const data = charts.realtime.data.datasets[0].data;
                    data.shift();
                    data.push(Math.floor(Math.random() * 10) + 5);
                    charts.realtime.update();
                }
            }, 2000);
        }

        // 连接钱包
        async function connectWallet() {
            document.getElementById('connectModal').classList.add('active');
        }

        async function connectMetaMask() {
            try {
                if (!window.ethereum) {
                    alert('请安装 MetaMask!');
                    return;
                }

                provider = new ethers.BrowserProvider(window.ethereum);
                await provider.send('eth_requestAccounts', []);
                signer = await provider.getSigner();
                userAddress = await signer.getAddress();
                
                contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

                // 更新UI
                document.getElementById('walletStatus').className = 'wallet-status connected';
                document.getElementById('walletStatus').querySelector('.status-dot').className = 'status-dot connected';
                document.getElementById('walletAddress').textContent = 
                    userAddress.slice(0, 6) + '...' + userAddress.slice(-4);
                document.getElementById('connectBtn').style.display = 'none';

                closeModal('connectModal');
                
                // 检查网络并加载 The Graph 数据
                await checkNetwork();
                await loadSubgraphStats();
                await loadSubgraphRiskProfiles();
                await loadSubgraphComplianceChecks();
                await loadSubgraphChartData();
                await loadQuarantineRecordsFromSubgraph();
                await loadIncomingBlocksFromSubgraph();
                await loadBlockedTransfers();
                
                // 加载数据
                await loadContractData();
                await loadUserRole();
                
                // 开始轮询更新
                startDataPolling();
                
            } catch (error) {
                console.error('连接失败:', error);
                alert('连接失败: ' + error.message);
            }
        }

        // 加载合约数据
        async function loadContractData() {
            if (!contract) return;
            
            try {
                const info = await contract.getContractInfo();
                
                document.getElementById('totalSupply').textContent = 
                    Number(ethers.formatUnits(info.totalSupply, 18)).toLocaleString();
                
                const totalTagged = Number(info.vipCount) + Number(info.greyCount) + Number(info.blackCount);
                document.getElementById('totalTagged').textContent = totalTagged;
                document.getElementById('vipCount').textContent = info.vipCount;
                document.getElementById('blackCount').textContent = info.blackCount;
                
                document.getElementById('contractStatus').textContent = info.paused ? '已暂停' : '正常';
                document.getElementById('contractStatus').style.color = info.paused ? 'var(--danger)' : 'var(--success)';
                document.getElementById('signerStatus').textContent = `签名者: ${info.signerCount}`;
                
                // 更新图表数据
                if (charts.risk) {
                    charts.risk.data.datasets[0].data = [
                        Number(info.vipCount),
                        0, // Normal 未存储在合约中
                        Number(info.greyCount),
                        Number(info.blackCount)
                    ];
                    charts.risk.update();
                }
                
                // 更新时间锁数据
                const pending = await contract.getPendingOperations();
                document.getElementById('pendingOps').textContent = pending.length;
                document.getElementById('pendingCount').textContent = pending.length;
                
            } catch (error) {
                console.error('加载数据失败:', error);
            }
        }

        // 加载用户角色
        async function loadUserRole() {
            if (!contract || !userAddress) return;
            
            try {
                const ADMIN_ROLE = ethers.keccak256(ethers.toUtf8Bytes('ADMIN_ROLE'));
                const OPERATOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes('OPERATOR_ROLE'));
                const VIEWER_ROLE = ethers.keccak256(ethers.toUtf8Bytes('VIEWER_ROLE'));
                
                const [isAdmin, isOperator, isViewer] = await Promise.all([
                    contract.hasRole(ADMIN_ROLE, userAddress),
                    contract.hasRole(OPERATOR_ROLE, userAddress),
                    contract.hasRole(VIEWER_ROLE, userAddress)
                ]);
                
                let role = '无权限';
                if (isAdmin) role = '管理员 (Admin)';
                else if (isOperator) role = '操作员 (Operator)';
                else if (isViewer) role = '查看者 (Viewer)';
                
                document.getElementById('userRole').textContent = role;
                
            } catch (error) {
                console.error('加载角色失败:', error);
            }
        }

        // ========== Quarantine Functions ==========
        async function loadQuarantineRecords() {
            await loadQuarantineRecordsFromSubgraph();
        }
        
        async function loadQuarantineRecordsFromSubgraph() {
            const tbody = document.getElementById('quarantineTable');
            tbody.innerHTML = '<tr><td colspan="8" class="table-loading"><div class="spinner"></div><div>加载中...</div></td></tr>';
            
            try {
                const data = await querySubgraph(`
                    query {
                        holdRecords(first: 50, orderBy: timestamp, orderDirection: desc) {
                            id
                            holder { id }
                            token
                            amount
                            reason
                            timestamp
                            isActive
                            releasedAt
                            permanentlyFrozen
                        }
                    }
                `);
                
                if (data && data.holdRecords) {
                    tbody.innerHTML = '';
                    let totalHeld = 0n;
                    let pendingCount = 0;
                    let frozenCount = 0;
                    
                    data.holdRecords.forEach(record => {
                        const amount = BigInt(record.amount);
                        const amountFormatted = ethers.formatUnits(amount, 6);
                        totalHeld += amount;
                        if (record.permanentlyFrozen) frozenCount++;
                        else if (record.isActive) pendingCount++;
                        
                        const status = record.permanentlyFrozen 
                            ? '<span class="tag tag-danger">永久冻结</span>'
                            : record.isActive 
                                ? '<span class="tag tag-warning">待处理</span>'
                                : '<span class="tag tag-success">已释放</span>';
                        
                        const date = new Date(Number(record.timestamp) * 1000).toLocaleString();
                        const holder = record.holder?.id || record.id;
                        const actions = record.permanentlyFrozen 
                            ? '<td>-</td>' 
                            : `<td><button class="btn btn-sm btn-success" onclick="releaseFunds('${record.id}')">释放</button><button class="btn btn-sm btn-danger" onclick="freezePermanently('${record.id}')">永久冻结</button></td>`;
                        
                        tbody.innerHTML += `
                            <tr>
                                <td class="address-cell">${record.id.slice(0, 10)}...${record.id.slice(-4)}</td>
                                <td class="address-cell">${holder.slice(0, 10)}...${holder.slice(-4)}</td>
                                <td>${record.token || 'TUSD'}</td>
                                <td>${amountFormatted}</td>
                                <td>${date}</td>
                                <td>${record.reason || '-'}</td>
                                <td>${status}</td>
                                ${actions}
                            </tr>
                        `;
                    });
                    
                    document.getElementById('totalQuarantined').textContent = ethers.formatUnits(totalHeld, 6);
                    document.getElementById('recordCount').textContent = data.holdRecords.length;
                    document.getElementById('pendingRelease').textContent = pendingCount;
                    document.getElementById('permanentlyFrozen').textContent = frozenCount;
                } else {
                    tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: var(--text-secondary);">暂无隔离记录</td></tr>';
                }
            } catch (error) {
                console.error('加载隔离记录失败:', error);
                showToast('隔离记录加载失败', 'error');
                tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: var(--danger);">加载失败，请重试</td></tr>';
            }
        }
        
        async function releaseFunds(recordId) {
            if (!confirm(`确认释放记录 ${recordId} 的隔离资金？`)) return;
            alert('释放交易已提交（演示模式）');
        }
        
        async function freezePermanently(recordId) {
            if (!confirm(`⚠️ 警告：永久冻结后资金将无法恢复！\n\n确认永久冻结记录 ${recordId}？`)) return;
            alert('永久冻结交易已提交（演示模式）');
        }
        
        async function filterQuarantineRecords() {
            loadQuarantineRecords();
        }
        
        async function loadIncomingBlocks() {
            await loadIncomingBlocksFromSubgraph();
        }
        
        async function loadIncomingBlocksFromSubgraph() {
            const tbody = document.getElementById('incomingBlocksTable');
            tbody.innerHTML = '<tr><td colspan="6" class="table-loading"><div class="spinner"></div><div>加载中...</div></td></tr>';
            
            try {
                const data = await querySubgraph(`
                    query {
                        complianceChecks(
                            first: 50,
                            orderBy: timestamp,
                            orderDirection: desc,
                            where: { decision: "BLOCK" }
                        ) {
                            id
                            txHash
                            from
                            to
                            amount
                            decision
                            reason
                            timestamp
                        }
                    }
                `);
                
                if (data && data.complianceChecks) {
                    tbody.innerHTML = '';
                    data.complianceChecks.forEach(check => {
                        const date = new Date(Number(check.timestamp) * 1000).toLocaleString();
                        tbody.innerHTML += `
                            <tr>
                                <td>${date}</td>
                                <td class="address-cell">${check.from.slice(0, 10)}...${check.from.slice(-4)}</td>
                                <td class="address-cell">${check.to.slice(0, 10)}...${check.to.slice(-4)}</td>
                                <td>${ethers.formatUnits(check.amount, 6)}</td>
                                <td><span class="tag tag-black">黑名单</span></td>
                                <td class="address-cell">${check.txHash.slice(0, 10)}...${check.txHash.slice(-4)}</td>
                            </tr>
                        `;
                    });
                } else {
                    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-secondary);">暂无拦截记录</td></tr>';
                }
            } catch (error) {
                console.error('加载拦截记录失败:', error);
                showToast('拦截记录加载失败', 'error');
                tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--danger);">加载失败，请重试</td></tr>';
            }
        }

        async function loadBlockedTransfers() {
            const tbody = document.getElementById('blockedTable');
            tbody.innerHTML = '<tr><td colspan="5" class="table-loading"><div class="spinner"></div><div>加载中...</div></td></tr>';
            
            try {
                const data = await querySubgraph(`
                    query {
                        complianceChecks(
                            first: 20,
                            orderBy: timestamp,
                            orderDirection: desc,
                            where: { decision_in: ["BLOCK", "FLAG"] }
                        ) {
                            id
                            txHash
                            from
                            to
                            amount
                            decision
                            reason
                            timestamp
                        }
                    }
                `);
                
                if (data && data.complianceChecks) {
                    tbody.innerHTML = '';
                    data.complianceChecks.forEach(check => {
                        const date = new Date(Number(check.timestamp) * 1000).toLocaleString();
                        const tagClass = check.decision === 'BLOCK' ? 'tag-black' : 'tag-grey';
                        const tagLabel = check.decision === 'BLOCK' ? '黑名单' : '标记';
                        tbody.innerHTML += `
                            <tr>
                                <td>${date}</td>
                                <td class="address-cell">${check.from.slice(0, 10)}...${check.from.slice(-4)}</td>
                                <td><span class="tag ${tagClass}">${tagLabel}</span></td>
                                <td>${check.reason || '-'}</td>
                                <td>${ethers.formatUnits(check.amount, 6)}</td>
                            </tr>
                        `;
                    });
                } else {
                    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-secondary);">暂无拦截记录</td></tr>';
                }
            } catch (error) {
                console.error('加载拦截记录失败:', error);
                showToast('拦截记录加载失败', 'error');
                tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--danger);">加载失败，请重试</td></tr>';
            }
        }

        async function refreshMonitor() {
            const tbody = document.getElementById('monitorTable');
            tbody.innerHTML = '<tr><td colspan="6" class="table-loading"><div class="spinner"></div><div>加载中...</div></td></tr>';
            
            try {
                const data = await querySubgraph(`
                    query {
                        complianceChecks(
                            first: 20,
                            orderBy: timestamp,
                            orderDirection: desc
                        ) {
                            id
                            txHash
                            from
                            to
                            amount
                            decision
                            reason
                            timestamp
                        }
                    }
                `);
                
                if (data && data.complianceChecks) {
                    tbody.innerHTML = '';
                    data.complianceChecks.forEach(check => {
                        const date = new Date(Number(check.timestamp) * 1000).toLocaleString();
                        const statusColors = { ALLOW: 'tag-success', BLOCK: 'tag-black', FLAG: 'tag-grey', HOLD: 'tag-warning' };
                        const statusLabels = { ALLOW: '允许', BLOCK: '拦截', FLAG: '标记', HOLD: '冻结' };
                        tbody.innerHTML += `
                            <tr>
                                <td>${check.id.slice(0, 10)}...${check.id.slice(-4)}</td>
                                <td class="address-cell">${check.txHash.slice(0, 10)}...${check.txHash.slice(-4)}</td>
                                <td class="address-cell">${check.from.slice(0, 10)}...${check.from.slice(-4)}</td>
                                <td class="address-cell">${check.to.slice(0, 10)}...${check.to.slice(-4)}</td>
                                <td>${ethers.formatUnits(check.amount, 6)}</td>
                                <td><span class="tag ${statusColors[check.decision] || 'tag-grey'}">${statusLabels[check.decision] || check.decision}</span></td>
                            </tr>
                        `;
                    });
                } else {
                    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-secondary);">暂无数据</td></tr>';
                }
            } catch (error) {
                console.error('加载监控数据失败:', error);
                showToast('监控数据加载失败', 'error');
                tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--danger);">加载失败，请重试</td></tr>';
            }
        }

        // 页面切换
        function toggleMobileSidebar() {
            const sidebar = document.querySelector('.sidebar');
            const overlay = document.getElementById('overlay');
            sidebar.classList.toggle('mobile-open');
            overlay.classList.toggle('show');
        }

        function showPage(pageId) {
            document.querySelectorAll('.page-section').forEach(section => {
                section.classList.remove('active');
            });
            document.getElementById(pageId).classList.add('active');
            
            document.querySelectorAll('.nav-item').forEach(item => {
                item.classList.remove('active');
            });
            event.target.classList.add('active');
            
            // Close mobile sidebar after navigation
            document.querySelector('.sidebar').classList.remove('mobile-open');
            document.getElementById('overlay').classList.remove('show');
            
            // 加载对应页面数据
            if (pageId === 'tags') loadTags();
            if (pageId === 'multisig') loadSigners();
            if (pageId === 'timelock') loadPendingOperations();
            if (pageId === 'logs') loadLogsFromSubgraph();
            if (pageId === 'customers') loadSubgraphRiskProfiles();
            if (pageId === 'monitor') refreshMonitor();
            if (pageId === 'dashboard') loadBlockedTransfers();
            if (pageId === 'quarantine') loadQuarantineRecordsFromSubgraph();
            if (pageId === 'incomingBlocks') loadIncomingBlocksFromSubgraph();
            if (pageId === 'complianceLogs') loadSubgraphComplianceChecks();
            if (pageId === 'policies') loadPolicies();
        }

        // 标签管理
        async function loadTags() {
            if (!contract) return;
            
            try {
                const [vips, greys, blacks] = await Promise.all([
                    contract.getVIPList(),
                    contract.getGreyList(),
                    contract.getBlackList()
                ]);
                
                const tbody = document.getElementById('tagsTable');
                tbody.innerHTML = '';
                
                [...vips.map(a => ({addr: a, level: 1, reason: 'VIP User'})),
                 ...greys.map(a => ({addr: a, level: 3, reason: 'Risk Observation'})),
                 ...blacks.map(a => ({addr: a, level: 4, reason: 'Known Risk'}))]
                .forEach(item => {
                    const tagClass = ['', 'tag-vip', '', 'tag-grey', 'tag-black'][item.level];
                    const tagName = ['', 'VIP', '', '灰名单', '黑名单'][item.level];
                    
                    tbody.innerHTML += `
                        <tr>
                            <td class="address-cell">${item.addr}</td>
                            <td><span class="tag ${tagClass}">${tagName}</span></td>
                            <td>${item.reason}</td>
                            <td>--</td>
                            <td>
                                <button class="btn btn-sm btn-secondary" onclick="removeTag('${item.addr}')">移除</button>
                            </td>
                        </tr>
                    `;
                });
                
            } catch (error) {
                console.error('加载标签失败:', error);
            }
        }

        function openTagModal() {
            document.getElementById('tagModal').classList.add('active');
        }

        function isValidAddress(addr) {
            return /^0x[a-fA-F0-9]{40}$/.test(addr);
        }

        async function submitTag() {
            const address = document.getElementById('tagAddress').value.trim();
            if (!isValidAddress(address)) {
                alert('无效的以太坊地址，请输入以0x开头的40位十六进制地址');
                return;
            }
            const level = document.getElementById('tagLevel').value;
            const reason = document.getElementById('tagReason').value;
            
            if (!contract) {
                alert('请先连接钱包');
                return;
            }
            
            try {
                const tx = await contract.tagAddress(address, level, reason);
                await tx.wait();
                alert('标签添加成功!');
                closeModal('tagModal');
                loadTags();
            } catch (error) {
                alert('添加失败: ' + error.message);
            }
        }

        // 多签管理
        async function loadSigners() {
            if (!contract) return;
            
            try {
                const signers = await contract.getSigners();
                const info = await contract.getContractInfo();
                
                document.getElementById('signerCount').textContent = info.signerCount;
                
                const tbody = document.getElementById('signersTable');
                tbody.innerHTML = '';
                
                signers.forEach(addr => {
                    const isCurrentUser = addr.toLowerCase() === userAddress?.toLowerCase();
                    tbody.innerHTML += `
                        <tr>
                            <td class="address-cell">${addr} ${isCurrentUser ? '(你)' : ''}</td>
                            <td><span class="tag tag-admin">签名者</span></td>
                            <td><span class="tag tag-success">活跃</span></td>
                            <td>
                                <button class="btn btn-sm btn-danger" onclick="removeSigner('${addr}')">移除</button>
                            </td>
                        </tr>
                    `;
                });
                
            } catch (error) {
                console.error('加载签名者失败:', error);
            }
        }

        function openAddSignerModal() {
            document.getElementById('signerModal').classList.add('active');
        }

        async function submitAddSigner() {
            const address = document.getElementById('signerAddress').value.trim();
            if (!isValidAddress(address)) {
                alert('无效的以太坊地址，请输入以0x开头的40位十六进制地址');
                return;
            }
            
            if (!contract) {
                alert('请先连接钱包');
                return;
            }
            
            try {
                const tx = await contract.addSigner(address);
                await tx.wait();
                alert('签名者添加成功!');
                closeModal('signerModal');
                loadSigners();
            } catch (error) {
                alert('添加失败: ' + error.message);
            }
        }

        async function updateRequiredSigs() {
            const newRequired = document.getElementById('requiredSigs').value;
            
            if (!contract) {
                alert('请先连接钱包');
                return;
            }
            
            try {
                const tx = await contract.updateRequiredSignatures(newRequired);
                await tx.wait();
                alert('更新成功!');
            } catch (error) {
                alert('更新失败: ' + error.message);
            }
        }

        // 时间锁管理
        async function loadPendingOperations() {
            if (!contract) return;
            
            try {
                const pending = await contract.getPendingOperations();
                const tbody = document.getElementById('pendingOpsTable');
                tbody.innerHTML = '';
                
                for (const opId of pending) {
                    const details = await contract.getOperationDetails(opId);
                    const opType = ['MINT', 'BURN', 'OWNERSHIP', 'LIMITS', 'TAG', 'UNTAG', 'TIMELOCK', 'PAUSE', 'UNPAUSE'][details.operationType] || 'UNKNOWN';
                    const executeTime = new Date(Number(details.timestamp) * 1000).toLocaleString();
                    
                    tbody.innerHTML += `
                        <tr>
                            <td class="address-cell">${opId.slice(0, 10)}...</td>
                            <td>${opType}</td>
                            <td class="address-cell">${details.target.slice(0, 10)}...</td>
                            <td>${executeTime}</td>
                            <td>${details.signatureCount}/${details.requiredSignatures}</td>
                            <td>
                                <button class="btn btn-sm btn-primary" onclick="signOperation('${opId}')">签名</button>
                                <button class="btn btn-sm btn-success" onclick="executeOperation('${opId}')">执行</button>
                            </td>
                        </tr>
                    `;
                }
                
                if (pending.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-secondary);">暂无待执行操作</td></tr>';
                }
                
            } catch (error) {
                console.error('加载待执行操作失败:', error);
            }
        }

        function openTimelockConfigModal() {
            document.getElementById('timelockConfigModal').classList.add('active');
        }

        async function submitTimelockConfig() {
            const days = document.getElementById('timelockDays').value;
            
            if (!contract) {
                alert('请先连接钱包');
                return;
            }
            
            try {
                const delayInSeconds = days * 24 * 60 * 60;
                const tx = await contract.updateTimelockDelay(delayInSeconds);
                await tx.wait();
                alert('时间锁配置已提交，等待多签确认!');
                closeModal('timelockConfigModal');
            } catch (error) {
                alert('配置失败: ' + error.message);
            }
        }

        async function signOperation(opId) {
            if (!contract) return;
            
            try {
                const tx = await contract.signOperation(opId);
                await tx.wait();
                alert('签名成功!');
                loadPendingOperations();
            } catch (error) {
                alert('签名失败: ' + error.message);
            }
        }

        async function executeOperation(opId) {
            if (!contract) return;
            
            try {
                const tx = await contract.executeOperation(opId);
                await tx.wait();
                alert('执行成功!');
                loadPendingOperations();
            } catch (error) {
                alert('执行失败: ' + error.message);
            }
        }

        // 紧急暂停
        async function emergencyPause() {
            if (!contract) {
                alert('请先连接钱包');
                return;
            }
            
            if (!confirm('确定要紧急暂停合约吗？此操作需要多签确认。')) return;
            
            try {
                const tx = await contract.emergencyPause();
                await tx.wait();
                alert('紧急暂停已执行!');
                loadContractData();
            } catch (error) {
                alert('操作失败: ' + error.message);
            }
        }

        async function emergencyUnpause() {
            if (!contract) {
                alert('请先连接钱包');
                return;
            }
            
            if (!confirm('确定要解除暂停吗？')) return;
            
            try {
                const tx = await contract.emergencyUnpause();
                await tx.wait();
                alert('合约已恢复运行!');
                loadContractData();
            } catch (error) {
                alert('操作失败: ' + error.message);
            }
        }

        // 日志
        async function loadLogs() {
            await loadLogsFromSubgraph();
        }
        
        async function loadLogsFromSubgraph() {
            const container = document.getElementById('logsTimeline');
            container.innerHTML = '<div class="table-loading"><div class="spinner"></div><div>加载日志...</div></div>';
            
            try {
                const data = await querySubgraph(`
                    query {
                        operationLogs(first: 50, orderBy: timestamp, orderDirection: desc) {
                            id
                            logType
                            operator
                            target
                            details
                            timestamp
                            blockNumber
                            txHash
                        }
                    }
                `);
                
                if (data && data.operationLogs) {
                    container.innerHTML = '';
                    data.operationLogs.forEach(log => {
                        const date = new Date(Number(log.timestamp) * 1000).toLocaleString();
                        const typeLabels = {
                            TAG_ADDRESS: '地址标签',
                            MINT: '铸造',
                            EMERGENCY_PAUSE: '紧急暂停',
                            SET_POLICY: '策略更新',
                            SIGN_OPERATION: '签名操作',
                            EXECUTE_OPERATION: '执行操作',
                            UNLOCK_FUNDS: '释放资金',
                            FREEZE_FUNDS: '冻结资金'
                        };
                        const typeLabel = typeLabels[log.logType] || log.logType;
                        
                        container.innerHTML += `
                            <div class="timeline-item">
                                <div class="timeline-time">${date}</div>
                                <div class="timeline-content">
                                    <strong>${typeLabel}</strong> - ${log.details || '-'}<br>
                                    <span style="color: var(--text-muted);">操作者: ${log.operator?.slice(0, 10)}...${log.operator?.slice(-4)}</span>
                                    ${log.blockNumber ? `<br><span style="color: var(--text-muted);">区块: ${log.blockNumber}</span>` : ''}
                                </div>
                            </div>
                        `;
                    });
                } else {
                    container.innerHTML = '<div style="text-align: center; color: var(--text-secondary); padding: 24px;">暂无日志</div>';
                }
            } catch (error) {
                console.error('加载日志失败:', error);
                showToast('日志加载失败', 'error');
                container.innerHTML = '<div style="text-align: center; color: var(--danger); padding: 24px;">加载失败，请重试</div>';
            }
        }

        // 设置
        function loadSettings() {
            const savedAddress = localStorage.getItem('contractAddress');
            if (savedAddress) {
                document.getElementById('contractAddress').value = savedAddress;
            }
        }

        function saveSettings() {
            const address = document.getElementById('contractAddress').value;
            localStorage.setItem('contractAddress', address);
            alert('设置已保存，刷新页面后生效');
        }

        // 轮询更新
        function startDataPolling() {
            setInterval(() => {
                loadContractData();
                loadSubgraphStats();
                loadSubgraphChartData();
                loadBlockedTransfers();
                if (document.getElementById('monitor').classList.contains('active')) {
                    refreshMonitor();
                }
            }, 30000); // 每30秒更新
        }

        // 策略配置
        async function loadPolicies() {
            if (!contract) return;
            try {
                const info = await contract.getContractInfo();
                document.getElementById('policyMaxTx').textContent = info.maxTxAmount ? ethers.formatUnits(info.maxTxAmount, 6) + ' fUSD' : '--';
                document.getElementById('policyDailyLimit').textContent = info.dailyLimit ? ethers.formatUnits(info.dailyLimit, 6) + ' fUSD' : '--';
                document.getElementById('policyAllowMedium').textContent = info.allowMediumRisk !== undefined ? (info.allowMediumRisk ? '✅ 允许' : '❌ 禁止') : '--';
                document.getElementById('policyAllowHigh').textContent = info.allowHighRisk !== undefined ? (info.allowHighRisk ? '✅ 允许' : '❌ 禁止') : '--';
                document.getElementById('policyBlockMixer').textContent = info.blockMixer !== undefined ? (info.blockMixer ? '✅ 拦截' : '❌ 放行') : '--';
                document.getElementById('policyRequireKYC').textContent = info.requireKYC !== undefined ? (info.requireKYC ? '✅ 需要' : '❌ 不需要') : '--';
                
                // 加载版本历史
                const tbody = document.getElementById('policyHistoryTable');
                tbody.innerHTML = `
                    <tr>
                        <td>v${info.policyVersion || 0}</td>
                        <td>${info.maxTxAmount ? ethers.formatUnits(info.maxTxAmount, 6) : '--'}</td>
                        <td>${info.dailyLimit ? ethers.formatUnits(info.dailyLimit, 6) : '--'}</td>
                        <td>${info.allowMediumRisk !== undefined ? (info.allowMediumRisk ? '是' : '否') : '--'}</td>
                        <td>${info.allowHighRisk !== undefined ? (info.allowHighRisk ? '是' : '否') : '--'}</td>
                        <td>${new Date().toLocaleString()}</td>
                        <td><button class="btn btn-sm btn-secondary" onclick="rollbackPolicy(0)">回滚</button></td>
                    </tr>
                `;
            } catch (error) {
                console.error('加载策略失败:', error);
            }
        }

        function openPolicyModal() {
            document.getElementById('policyModal').classList.add('active');
        }

        async function submitPolicy() {
            if (!contract) { alert('请先连接钱包'); return; }
            try {
                const maxTx = document.getElementById('policyMaxTxInput').value;
                const dailyLimit = document.getElementById('policyDailyLimitInput').value;
                const allowMedium = document.getElementById('policyAllowMediumInput').checked;
                const allowHigh = document.getElementById('policyAllowHighInput').checked;
                const blockMixer = document.getElementById('policyBlockMixerInput').checked;
                const requireKYC = document.getElementById('policyRequireKYCInput').checked;
                
                const tx = await contract.setIssuerPolicy(
                    await signer.getAddress(),
                    ethers.parseUnits(maxTx || '1000000', 6),
                    ethers.parseUnits(dailyLimit || '500', 6),
                    allowMedium,
                    allowHigh,
                    blockMixer,
                    requireKYC
                );
                await tx.wait();
                alert('策略更新成功!');
                closeModal('policyModal');
                loadPolicies();
            } catch (error) {
                alert('策略更新失败: ' + error.message);
            }
        }

        async function rollbackPolicy(version) {
            if (!contract) { alert('请先连接钱包'); return; }
            if (!confirm('确定要回滚到版本 ' + version + ' 吗?')) return;
            try {
                const tx = await contract.rollbackToVersion(await signer.getAddress(), version);
                await tx.wait();
                alert('回滚成功!');
                loadPolicies();
            } catch (error) {
                alert('回滚失败: ' + error.message);
            }
        }

        // 合规日志筛选
        async function filterComplianceLogs() {
            const decision = document.getElementById('filterDecision').value;
            await loadSubgraphComplianceChecks(decision);
        }

        // Modal 控制
        function closeModal(modalId) {
            document.getElementById(modalId).classList.remove('active');
        }

        // 关闭 modal 点击外部
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.remove('active');
                }
