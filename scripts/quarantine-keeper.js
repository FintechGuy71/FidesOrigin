const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

/**
 * @title QuarantineKeeper
 * @notice 自动化隔离监控服务
 * @dev 监听 Transfer 事件，自动检测污染资金并触发隔离
 * 
 * 运行方式: node scripts/quarantine-keeper.js
 * 环境变量:
 *   - RPC_URL: 节点地址
 *   - PRIVATE_KEY: keeper 私钥（需有 QUARANTINE_ROLE）
 *   - WALLET_FACTORY: 智能钱包工厂地址（用于批量扫描）
 *   - FIDES_COMPLIANCE: FidesCompliance 合约地址
 *   - CHECK_INTERVAL: 扫描间隔（毫秒，默认 30000）
 */

// 配置
const CONFIG = {
    rpcUrl: process.env.RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com',
    privateKey: process.env.PRIVATE_KEY,
    // [M-04 Fix] Support KMS/Vault-derived private keys (preferred for production)
    kmsProvider: process.env.KMS_PROVIDER || '',        // e.g. 'aws', 'gcp', 'vault'
    kmsKeyId: process.env.KMS_KEY_ID || '',             // KMS key ID / Vault key name
    vaultAddr: process.env.VAULT_ADDR || '',            // Vault server address
    vaultToken: process.env.VAULT_TOKEN || '',          // Vault token (transient, not in code)
    vaultSecretPath: process.env.VAULT_SECRET_PATH || '', // Vault secret path
    checkInterval: parseInt(process.env.CHECK_INTERVAL) || 30000,
    batchInterval: parseInt(process.env.BATCH_INTERVAL) || 300000, // [L-06 Fix] separate batch interval (default 5min)
    batchSize: parseInt(process.env.BATCH_SIZE) || 50,
    maxPendingTx: parseInt(process.env.MAX_PENDING_TX) || 5,
};

// ABI 片段
const FIDES_COMPLIANCE_ABI = [
    'function isBlacklisted(address account) view returns (bool)',
    'function getRiskProfile(address account) view returns (uint8 level, uint256 score, string[] tags, uint256 lastUpdated, address updatedBy, bytes32 reasonHash, bool exists)',
    'function isWhitelisted(address account) view returns (bool)',
];

const WALLET_ABI = [
    'function quarantineFunds(address token, uint256 amount, string reason)',
    'function fidesCompliance() view returns (address)',
    'function quarantineVault() view returns (address)',
    'function autoQuarantineEnabled() view returns (bool)',
    'function quarantineThreshold() view returns (uint256)',
    'function frozenBalances(address token) view returns (uint256)',
    'function availableBalances(address token) view returns (uint256)',
    'function getFundStatus(address token) view returns (uint256 total, uint256 available, uint256 frozen, uint256 pending)',
    'event Transfer(address indexed from, address indexed to, uint256 value)',
];

const ERC20_ABI = [
    'event Transfer(address indexed from, address indexed to, uint256 value)',
    'function balanceOf(address account) view returns (uint256)',
    'function decimals() view returns (uint8)',
    'function symbol() view returns (string)',
];

// 状态
const MAX_PROCESSED_TX = 50000; // [High Fix] Cap processedTx to prevent unbounded memory growth

class KeeperState {
    constructor() {
        this.processedTx = new Set(); // 已处理的 tx hash
        this.pendingTx = 0; // 待确认的交易数
        this.lastBlock = 0; // 上次扫描的区块
        this.stats = {
            totalChecked: 0,
            totalQuarantined: 0,
            totalSkipped: 0,
            errors: 0,
        };
        this.knownWallets = new Set(); // 已知的用户钱包
    }

    save() {
        const data = {
            processedTx: Array.from(this.processedTx),
            lastBlock: this.lastBlock,
            stats: this.stats,
            knownWallets: Array.from(this.knownWallets),
        };
        const statePath = path.join(__dirname, '.keeper-state.json');
        fs.writeFileSync(statePath, JSON.stringify(data, null, 2));
        // [M-05 Fix] restrict state file to owner-only (0o600) to prevent tampering
        try { fs.chmodSync(statePath, 0o600); } catch (_e) { /* ignore on Windows */ }
    }

    load() {
        try {
            const file = path.join(__dirname, '.keeper-state.json');
            if (!fs.existsSync(file)) return;
            const data = JSON.parse(fs.readFileSync(file, 'utf8'));
            this.processedTx = new Set(data.processedTx || []);
            this.lastBlock = data.lastBlock || 0;
            this.stats = data.stats || this.stats;
            this.knownWallets = new Set(data.knownWallets || []);
        } catch (e) {
            console.warn('Failed to load state:', e.message);
        }
    }
}

class QuarantineKeeper {
    constructor() {
        this.state = new KeeperState();
        this.provider = null;
        this.signer = null;
        this.fidesCompliance = null;
        this.batchScanLock = false; // [High Fix] Concurrency lock for batch scanning
    }

    async init() {
        console.log('🚀 QuarantineKeeper initializing...');
        
        // 加载状态
        this.state.load();
        
        // 连接网络
        this.provider = new ethers.JsonRpcProvider(CONFIG.rpcUrl);
        const network = await this.provider.getNetwork();
        console.log(`🔗 Connected to ${network.name} (chainId: ${network.chainId})`);
        
        // [M-04 Fix] Resolve signer: prefer KMS/Vault, fallback to plaintext env var (dev only)
        if (CONFIG.kmsProvider && CONFIG.kmsKeyId) {
            console.log(`🔐 Using KMS provider: ${CONFIG.kmsProvider}, keyId: ${CONFIG.kmsKeyId}`);
            // Production path: derive signer via KMS. Implementations omitted for brevity;
            // in production, use AWS KMS (aws-sdk), GCP Cloud KMS, or HashiCorp Vault SDK.
            throw new Error(
                'KMS signer not yet implemented in this script. ' +
                'Please implement the corresponding KMS provider SDK (aws-sdk, @google-cloud/kms, or node-vault) ' +
                'or fall back to plaintext PRIVATE_KEY for dev/test only.'
            );
        } else if (CONFIG.vaultAddr && CONFIG.vaultToken && CONFIG.vaultSecretPath) {
            console.log(`🔐 Using HashiCorp Vault: ${CONFIG.vaultAddr}, path: ${CONFIG.vaultSecretPath}`);
            throw new Error(
                'Vault signer not yet implemented. ' +
                'Please integrate node-vault or @hashicorp/vault-client to fetch the private key at runtime.'
            );
        } else if (CONFIG.privateKey) {
            console.warn('⚠️  WARNING: Using plaintext PRIVATE_KEY from environment variable. ' +
                         'This is acceptable for dev/test ONLY. For production, use KMS or Vault.');
            this.signer = new ethers.Wallet(CONFIG.privateKey, this.provider);
        } else {
            throw new Error(
                'No signing key available. Set one of:\n' +
                '  - KMS_PROVIDER + KMS_KEY_ID (production preferred)\n' +
                '  - VAULT_ADDR + VAULT_TOKEN + VAULT_SECRET_PATH (production preferred)\n' +
                '  - PRIVATE_KEY (dev/test only)'
            );
        }
        console.log(`🔑 Keeper address: ${this.signer.address}`);
        
        // 检查余额
        const balance = await this.provider.getBalance(this.signer.address);
        console.log(`💰 Balance: ${ethers.formatEther(balance)} ETH`);
        
        // 初始化合规引擎
        const fidesAddress = process.env.FIDES_COMPLIANCE;
        if (fidesAddress) {
            this.fidesCompliance = new ethers.Contract(fidesAddress, FIDES_COMPLIANCE_ABI, this.provider);
            console.log(`📋 FidesCompliance: ${fidesAddress}`);
        }
        
        // 获取当前区块
        const currentBlock = await this.provider.getBlockNumber();
        if (this.state.lastBlock === 0) {
            this.state.lastBlock = currentBlock - 100; // 从100个区块前开始
        }
        console.log(`📦 Starting from block ${this.state.lastBlock}, current: ${currentBlock}`);
        
        console.log('✅ Keeper ready\n');
    }

    /**
     * 检查地址风险等级
     */
    async checkRisk(address) {
        if (!this.fidesCompliance) return { isBlacklisted: false, isHighRisk: false };
        
        try {
            const [isBlacklisted, profile] = await Promise.all([
                this.fidesCompliance.isBlacklisted(address),
                this.fidesCompliance.getRiskProfile(address),
            ]);
            
            return {
                isBlacklisted,
                isHighRisk: profile.level >= 4, // HIGH or BLACKLIST
                riskLevel: profile.level,
                riskScore: profile.score,
            };
        } catch (e) {
            // [High Fix] Fail-closed: if risk check fails, treat as high risk rather than safe
            console.error(`⛔ Critical: Risk check failed for ${address}:`, e.message);
            throw new Error(`Risk assessment unavailable for ${address}: ${e.message}`);
        }
    }

    /**
     * 扫描单个钱包的污染资金
     */
    async scanWallet(walletAddress, tokenAddresses) {
        const wallet = new ethers.Contract(walletAddress, WALLET_ABI, this.provider);
        
        // 检查自动隔离是否启用
        const enabled = await wallet.autoQuarantineEnabled();
        if (!enabled) {
            console.log(`⏸️ Auto-quarantine disabled for ${walletAddress}`);
            return [];
        }
        
        const threshold = await wallet.quarantineThreshold();
        const quarantined = [];
        
        for (const tokenAddress of tokenAddresses) {
            // 获取资金状态
            const status = await wallet.getFundStatus(tokenAddress);
            const pendingRisk = status[3]; // pendingRisk
            
            if (pendingRisk === 0n) continue;
            
            // 检查阈值
            if (threshold > 0n && pendingRisk < threshold) {
                console.log(`⏭️ Below threshold: ${pendingRisk} < ${threshold}`);
                this.state.stats.totalSkipped++;
                continue;
            }
            
            quarantined.push({
                token: tokenAddress,
                amount: pendingRisk,
                wallet: walletAddress,
            });
        }
        
        return quarantined;
    }

    /**
     * 执行隔离
     */
    async executeQuarantine(walletAddress, token, amount) {
        if (this.state.pendingTx >= CONFIG.maxPendingTx) {
            console.log(`⏳ Too many pending transactions (${this.state.pendingTx}), waiting...`);
            return false;
        }
        
        try {
            const wallet = new ethers.Contract(walletAddress, WALLET_ABI, this.signer);
            
            // 获取代币信息
            const tokenContract = new ethers.Contract(token, ERC20_ABI, this.provider);
            const [symbol, decimals] = await Promise.all([
                tokenContract.symbol(),
                tokenContract.decimals(),
            ]);
            
            console.log(`🚨 QUARANTINING ${ethers.formatUnits(amount, decimals)} ${symbol}`);
            console.log(`   Wallet: ${walletAddress}`);
            console.log(`   Token:  ${token}`);
            
            // 构建原因
            const reason = `Auto-quarantine: contaminated funds detected at ${new Date().toISOString()}`;
            
            // 发送交易
            // [P2 Fix] gasLimit 从环境变量读取，默认 500000
            const gasLimit = parseInt(process.env.GAS_LIMIT) || 500000;
            const tx = await wallet.quarantineFunds(token, amount, reason, {
                gasLimit,
            });
            
            this.state.pendingTx++;
            console.log(`   TX: ${tx.hash}`);
            
            // 等待确认（不阻塞）
            tx.wait().then((receipt) => {
                this.state.pendingTx--;
                if (receipt.status === 1) {
                    console.log(`   ✅ Confirmed in block ${receipt.blockNumber}`);
                    this.state.stats.totalQuarantined++;
                } else {
                    console.log(`   ❌ Failed`);
                    this.state.stats.errors++;
                }
            }).catch((e) => {
                this.state.pendingTx--;
                console.error(`   ❌ Error:`, e.message);
                this.state.stats.errors++;
            });
            
            return true;
        } catch (e) {
            console.error(`❌ Quarantine failed:`, e.message);
            this.state.stats.errors++;
            return false;
        }
    }

    /**
     * 轮询监听 Transfer 事件（兼容免费 RPC）
     */
    async startPollingListener(tokenAddresses, walletAddresses) {
        console.log('👂 Starting polling listener...');
        
        const walletSet = new Set(walletAddresses.map(w => w.toLowerCase()));
        
        // 每 30 秒轮询一次
        // [P2 Fix] setInterval 回调使用锁防止并发执行
        const pollLock = { locked: false };
        setInterval(async () => {
            if (pollLock.locked) {
                console.log('⏭️ Polling skipped: previous scan still running');
                return;
            }
            pollLock.locked = true;
            try {
                const currentBlock = await this.provider.getBlockNumber();
                const fromBlock = Math.max(this.state.lastBlock, currentBlock - 10); // 最近 10 个区块
                
                if (fromBlock >= currentBlock) return;
                
                for (const tokenAddress of tokenAddresses) {
                    const token = new ethers.Contract(tokenAddress, ERC20_ABI, this.provider);
                    
                    // 使用 getLogs 查询 Transfer 事件
                    const filter = {
                        address: tokenAddress,
                        fromBlock,
                        toBlock: currentBlock,
                        topics: [
                            ethers.id('Transfer(address,address,uint256)'),
                            null, // any from
                            null, // any to
                        ],
                    };
                    
                    const logs = await this.provider.getLogs(filter);
                    
                    for (const log of logs) {
                        const parsed = token.interface.parseLog(log);
                        const from = parsed.args[0];
                        const to = parsed.args[1];
                        const value = parsed.args[2];
                        
                        // 检查是否是向我们监控的钱包转账
                        if (!walletSet.has(to.toLowerCase())) continue;
                        
                        // 检查是否已处理
                        const txHash = log.transactionHash;
                        if (this.state.processedTx.has(txHash)) continue;
                        this.state.processedTx.add(txHash);
                        // [High Fix] Prune old entries when set exceeds cap
                        if (this.state.processedTx.size > MAX_PROCESSED_TX) {
                            const toRemove = this.state.processedTx.size - MAX_PROCESSED_TX;
                            const iter = this.state.processedTx.values();
                            for (let i = 0; i < toRemove; i++) {
                                const val = iter.next().value;
                                this.state.processedTx.delete(val);
                            }
                        }
                        
                        this.state.stats.totalChecked++;
                        
                        // 检查发送方风险
                        let risk;
                        try {
                            risk = await this.checkRisk(from);
                        } catch (riskErr) {
                            // [L-07 Fix] FAIL-CLOSED: if risk check fails, treat as HIGH RISK and quarantine
                            // rather than skipping (which would let a potentially contaminated transfer through)
                            console.warn(`⚠️ Risk check failed for ${from}: ${riskErr.message}. ` +
                                         `Treating as HIGH RISK (fail-closed).`);
                            risk = { isBlacklisted: true, isHighRisk: true, riskLevel: 99, riskScore: 999 };
                        }
                        
                        if (risk.isBlacklisted || risk.isHighRisk) {
                            console.log(`\n🚨 CONTAMINATED TRANSFER DETECTED!`);
                            console.log(`   From: ${from} ${risk.isBlacklisted ? '[BLACKLIST]' : '[HIGH RISK]'}`);
                            console.log(`   To:   ${to}`);
                            console.log(`   Amount: ${ethers.formatUnits(value, 18)}`);
                            console.log(`   TX:   ${txHash}`);
                            
                            // 触发隔离
                            await this.executeQuarantine(to, tokenAddress, value);
                        }
                    }
                }
                
                this.state.lastBlock = currentBlock + 1;
                
            } catch (e) {
                console.warn('⚠️ Polling error:', e.message);
            } finally {
                pollLock.locked = false;
            }
        }, CONFIG.checkInterval);
        
        console.log(`   Polling every ${CONFIG.checkInterval}ms`);
    }

    /**
     * 批量扫描模式（定时巡检）
     */
    async runBatchScan(walletAddresses, tokenAddresses) {
        // [High Fix] Prevent concurrent batch scans
        if (this.batchScanLock) {
            console.log('⏭️ Batch scan skipped: previous scan still running');
            return;
        }
        this.batchScanLock = true;

        try {
            console.log(`\n🔍 Batch scan started (${walletAddresses.length} wallets, ${tokenAddresses.length} tokens)`);
            
            for (const walletAddress of walletAddresses) {
                try {
                    const toQuarantine = await this.scanWallet(walletAddress, tokenAddresses);
                    
                    for (const item of toQuarantine) {
                        await this.executeQuarantine(item.wallet, item.token, item.amount);
                    }
                } catch (e) {
                    console.error(`❌ Error scanning ${walletAddress}:`, e.message);
                }
            }
            
            console.log('✅ Batch scan complete\n');
        } finally {
            this.batchScanLock = false;
        }
    }

    /**
     * 打印统计
     */
    printStats() {
        console.log('\n📊 Keeper Statistics');
        console.log('═══════════════════════════════════════');
        console.log(`Total checked:    ${this.state.stats.totalChecked}`);
        console.log(`Total quarantined: ${this.state.stats.totalQuarantined}`);
        console.log(`Total skipped:    ${this.state.stats.totalSkipped}`);
        console.log(`Errors:           ${this.state.stats.errors}`);
        console.log(`Pending TX:       ${this.state.pendingTx}`);
        console.log(`Processed TX:     ${this.state.processedTx.size}`);
        console.log(`Known wallets:    ${this.state.knownWallets.size}`);
        console.log('═══════════════════════════════════════\n');
    }

    /**
     * 主循环
     */
    async run() {
        // 示例：从环境变量或文件加载监控列表
        const walletList = process.env.WALLET_LIST ? process.env.WALLET_LIST.split(',') : [];
        const tokenList = process.env.TOKEN_LIST ? process.env.TOKEN_LIST.split(',') : [];
        
        if (walletList.length === 0 || tokenList.length === 0) {
            console.log('⚠️ No wallets/tokens configured. Set WALLET_LIST and TOKEN_LIST env vars.');
            console.log('   Example: WALLET_LIST=0x123...,0x456... TOKEN_LIST=0xabc...,0xdef...');
        }
        
        // 启动轮询监听（兼容免费 RPC）
        if (walletList.length > 0) {
            await this.startPollingListener(tokenList, walletList.map(w => w.toLowerCase()));
        }
        
        // 定时扫描（批量模式）
        console.log(`⏰ Batch scan interval: ${CONFIG.batchInterval}ms (poll: ${CONFIG.checkInterval}ms)`);
        
        setInterval(() => {
            if (walletList.length > 0) {
                this.runBatchScan(walletList, tokenList);
            }
            this.printStats();
            this.state.save();
        }, CONFIG.batchInterval);
        
        // 初始扫描
        if (walletList.length > 0) {
            await this.runBatchScan(walletList, tokenList);
        }
        
        // 定期保存状态
        setInterval(() => {
            this.state.save();
            console.log('💾 State saved');
        }, 60000);
        
        console.log('🤖 Keeper running. Press Ctrl+C to stop.\n');
    }
}

// 启动
async function main() {
    const keeper = new QuarantineKeeper();
    
    try {
        await keeper.init();
        await keeper.run();
    } catch (e) {
        console.error('💥 Fatal error:', e);
        process.exit(1);
    }
    
    // 优雅退出
    process.on('SIGINT', () => {
        console.log('\n👋 Shutting down...');
        keeper.state.save();
        process.exit(0);
    });
}

main();
