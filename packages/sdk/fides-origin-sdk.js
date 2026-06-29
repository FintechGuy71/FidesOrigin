// 修复：移除 hardhat 重型依赖污染，改为直接依赖 ethers
const { ethers } = require('ethers');

/**
 * @title FidesOrigin SDK
 * @notice JavaScript SDK for interacting with FidesOrigin Compliance Protocol
 * @dev 支持资产发行方和钱包运营方集成
 */
class FidesOriginSDK {
    /**
     * @param provider - ethers provider
     * @param contracts - 部署的合约地址
     * @param options - 可选配置
     */
    constructor(provider, contracts, options = {}) {
        if (!provider) {
            throw new Error('FidesOriginSDK: provider is required.');
        }
        if (!contracts) {
            throw new Error('FidesOriginSDK: contracts is required.');
        }

        // [Fix] 校验合约地址合法性
        const requiredContracts = ['complianceEngine', 'riskRegistry', 'policyEngine'];
        for (const name of requiredContracts) {
            const addr = contracts[name];
            if (!addr) {
                throw new Error(`FidesOriginSDK: contracts.${name} is required.`);
            }
            if (!ethers.isAddress || !ethers.isAddress(addr)) {
                throw new Error(`FidesOriginSDK: contracts.${name} is not a valid address: ${addr}`);
            }
        }

        this.provider = provider;
        this.contracts = contracts;
        this.options = options;

        // 事件监听器存储（业务层回调）
        this.eventListeners = new Map();

        // 修复：链上监听器初始化标记，防止重复绑定导致内存泄漏与回调指数级重复触发
        this.chainListenersSetup = new Set();

        // Load ABIs - 支持外部传入或默认加载
        this.abis = options.abis || require('./abis');
        this.signer = null;

        // 兼容性：检测 ethers 版本并保存可用 API
        this._ethersCompat = this._buildEthersCompat();

        // 初始化合约实例（若已传入 provider 可用）
        this._initContracts();
    }

    /**
     * 构建 ethers v5/v6 兼容性工具集
     */
    _buildEthersCompat() {
        const isAddrFn =
            typeof ethers.isAddress === 'function'
                ? ethers.isAddress.bind(ethers)
                : (ethers.utils && typeof ethers.utils.isAddress === 'function')
                    ? ethers.utils.isAddress.bind(ethers.utils)
                    : null;

        const encodeBytes32 =
            typeof ethers.encodeBytes32String === 'function'
                ? ethers.encodeBytes32String.bind(ethers)
                : (ethers.utils && typeof ethers.utils.formatBytes32String === 'function')
                    ? ethers.utils.formatBytes32String.bind(ethers.utils)
                    : null;

        const decodeBytes32 =
            typeof ethers.decodeBytes32String === 'function'
                ? ethers.decodeBytes32String.bind(ethers)
                : (ethers.utils && typeof ethers.utils.parseBytes32String === 'function')
                    ? ethers.utils.parseBytes32String.bind(ethers.utils)
                    : null;

        return { isAddress: isAddrFn, encodeBytes32, decodeBytes32 };
    }

    /**
     * 安全地把字符串编码为 bytes32，兼容 ethers v5 / v6
     */
    _toBytes32(str) {
        if (this._ethersCompat.encodeBytes32) {
            return this._ethersCompat.encodeBytes32(str);
        }
        throw new Error(
            'FidesOriginSDK: 当前 ethers 版本不支持 encodeBytes32String / formatBytes32String'
        );
    }

    /**
     * 初始化合约实例
     */
    _initContracts() {
        const providerOrSigner = this.signer || this.provider;

        this.complianceEngine = new ethers.Contract(
            this.contracts.complianceEngine,
            this.abis.ComplianceEngine,
            providerOrSigner
        );

        this.riskRegistry = new ethers.Contract(
            this.contracts.riskRegistry,
            this.abis.RiskRegistry,
            providerOrSigner
        );

        this.policyEngine = new ethers.Contract(
            this.contracts.policyEngine,
            this.abis.PolicyEngine,
            providerOrSigner
        );
    }

    /**
     * 连接到合约实例（绑定 signer 或更换 provider）
     */
    connect(signerOrProvider) {
        // 更严谨的 Signer/Provider 判断逻辑
        if (
            signerOrProvider &&
            (signerOrProvider._isSigner ||
                typeof signerOrProvider.signMessage === 'function' ||
                typeof signerOrProvider.signTransaction === 'function')
        ) {
            this.signer = signerOrProvider;
            this.provider = this.signer.provider || this.provider;
        } else {
            this.provider = signerOrProvider;
            this.signer = null;
        }

        // 修复 [MUST_FIX]：在重新初始化合约实例之前，清理旧合约实例的事件监听器，防止幽灵订阅
        if (this.complianceEngine && typeof this.complianceEngine.removeAllListeners === 'function') {
            this.complianceEngine.removeAllListeners();
        }
        if (this.riskRegistry && typeof this.riskRegistry.removeAllListeners === 'function') {
            this.riskRegistry.removeAllListeners();
        }
        if (this.policyEngine && typeof this.policyEngine.removeAllListeners === 'function') {
            this.policyEngine.removeAllListeners();
        }

        // 重新初始化合约实例，绑定新的 signer/provider
        this._initContracts();

        // 修复：重新连接后清理旧的链上监听器绑定记录
        // 业务层 listener 已存于 eventListeners，连接后需要重新绑定到底层
        this.chainListenersSetup.clear();
        for (const eventName of this.eventListeners.keys()) {
            this._setupChainListener(eventName);
        }

        return this;
    }

    /**
     * 完整销毁实例，释放所有资源（推荐在 SPA / 频繁创建场景下调用）
     */
    async destroy() {
        try {
            if (typeof this.complianceEngine.removeAllListeners === 'function') {
                this.complianceEngine.removeAllListeners();
            }
            if (typeof this.riskRegistry.removeAllListeners === 'function') {
                this.riskRegistry.removeAllListeners();
            }
            if (typeof this.policyEngine.removeAllListeners === 'function') {
                this.policyEngine.removeAllListeners();
            }
        } catch (_) {
            // 忽略解绑过程中的异常
        }
        this.eventListeners.clear();
        this.chainListenersSetup.clear();
    }

    // ==================== Asset Issuer Functions ====================

    /**
     * 地址参数安全校验
     */
    _validateAddress(address, paramName = 'address') {
        const isValid = this._ethersCompat.isAddress
            ? this._ethersCompat.isAddress(address)
            : false;
        if (!isValid) {
            throw new Error(
                `Invalid address provided for ${paramName}: ${address}`
            );
        }
    }

    /**
     * 数值参数安全校验
     */
    _validateAmount(amount, paramName = 'amount') {
        if (amount === null || amount === undefined) {
            throw new Error(`Invalid ${paramName}: value is required`);
        }
        const num = Number(amount);
        if (isNaN(num) || num < 0) {
            throw new Error(`Invalid ${paramName}: must be a non-negative number, got ${amount}`);
        }
    }

    /**
     * 统一封装合约调用异常，避免底层错误/堆栈泄露
     */
    _wrapCallError(action, err) {
        const reason = err && (err.reason || err.shortMessage);
        return new Error(
            `FidesOriginSDK ${action} 失败: ${reason || '未知错误'}`
        );
    }

    _parseDecision(decision) {
        const decisions = {
            0: 'ALLOW',
            1: 'BLOCK',
            2: 'REVIEW',
            3: 'HOLD',
        };
        return Object.prototype.hasOwnProperty.call(decisions, decision)
            ? decisions[decision]
            : 'UNKNOWN';
    }

    _parseRiskTier(tier) {
        const tiers = {
            0: 'LOW',
            1: 'MEDIUM',
            2: 'HIGH',
            3: 'CRITICAL',
        };
        return Object.prototype.hasOwnProperty.call(tiers, tier)
            ? tiers[tier]
            : 'UNKNOWN';
    }

    _setupChainListener(eventName) {
        if (this.chainListenersSetup.has(eventName)) {
            return;
        }
        const contracts = ['complianceEngine', 'riskRegistry', 'policyEngine'];
        for (const name of contracts) {
            const contract = this[name];
            if (!contract || typeof contract.on !== 'function') {
                continue;
            }
            contract.on(eventName, (...args) => {
                const callbacks = this.eventListeners.get(eventName);
                if (!callbacks) return;
                for (const cb of callbacks) {
                    try {
                        cb(...args);
                    } catch (err) {
                        console.error(`FidesOriginSDK: event listener error for ${eventName}:`, err);
                    }
                }
            });
        }
        this.chainListenersSetup.add(eventName);
    }

    /**
     * 检查转账是否合规
     * @param from - 发送方地址
     * @param to - 接收方地址
     * @param amount - 转账金额
     * @param assetContract - 资产合约地址
     */
    async validateTransfer(from, to, amount, assetContract) {
        this._validateAddress(from, 'from');
        this._validateAddress(to, 'to');
        this._validateAddress(assetContract, 'assetContract');
        this._validateAmount(amount, 'amount');

        try {
            const [decision, reason] = await this.complianceEngine.validateTransfer(
                from,
                to,
                amount,
                assetContract
            );

            return {
                allowed: Number(decision) === 0, // Decision.ALLOW = 0
                decision: this._parseDecision(decision),
                decisionCode: Number(decision),
                reason: reason,
                blocked: Number(decision) === 1, // Decision.BLOCK = 1
                held: Number(decision) === 3, // Decision.HOLD = 3
            };
        } catch (err) {
            console.error('FidesOrigin SDK: validateTransfer failed', err);
            return {
                allowed: false,
                decision: 'ERROR',
                decisionCode: -1,
                // 修复：使用 ethers 的 reason/shortMessage，避免直接暴露内部 Error
                reason: err.reason || err.shortMessage || 'SDK validation error',
                blocked: true,
                held: false,
                // 修复：移除 error: err，防止底层内部错误信息泄露
            };
        }
    }

    /**
     * 获取地址风险信息
     */
    async getAddressRisk(address) {
        this._validateAddress(address, 'address');

        try {
            const profile = await this.complianceEngine.getAddressRisk(address);

            return {
                riskScore: profile.riskScore,
                tier: this._parseRiskTier(profile.tier),
                tierCode: profile.tier,
                tags: profile.tags,
                lastUpdated: new Date(Number(profile.lastUpdated) * 1000),
                isSanctioned: profile.isSanctioned,
            };
        } catch (err) {
            throw this._wrapCallError('getAddressRisk', err);
        }
    }

    /**
     * 检查地址是否在制裁名单
     */
    async isSanctioned(address) {
        this._validateAddress(address, 'address');
        try {
            return await this.complianceEngine.isSanctioned(address);
        } catch (err) {
            throw this._wrapCallError('isSanctioned', err);
        }
    }

    /**
     * 获取发行方策略配置
     */
    async getIssuerPolicy(issuerAddress) {
        this._validateAddress(issuerAddress, 'issuerAddress');

        try {
            const policy = await this.complianceEngine.getIssuerPolicy(issuerAddress);

            return {
                maxTxAmount: policy.maxTxAmount.toString(),
                dailyLimit: policy.dailyLimit.toString(),
                allowMediumRisk: policy.allowMediumRisk,
                allowHighRisk: policy.allowHighRisk,
                blockMixer: policy.blockMixer,
                requireDestinationKYC: policy.requireDestinationKYC,
                cooldownPeriod: policy.cooldownPeriod.toString(),
            };
        } catch (err) {
            throw this._wrapCallError('getIssuerPolicy', err);
        }
    }

    /**
     * 设置发行方策略
     */
    async setIssuerPolicy(issuerAddress, policy) {
        this._validateAddress(issuerAddress, 'issuerAddress');
        if (!policy || typeof policy !== 'object') {
            throw new Error('Invalid policy: expected object');
        }

        try {
            const tx = await this.policyEngine.setIssuerPolicy(issuerAddress, policy);
            return await tx.wait();
        } catch (err) {
            throw this._wrapCallError('setIssuerPolicy', err);
        }
    }

    /**
     * 获取地址日累计转账额
     */
    async getDailySpent(address, asset) {
        this._validateAddress(address, 'address');
        this._validateAddress(asset, 'asset');

        try {
            const spent = await this.complianceEngine.getDailySpent(address, asset);
            return spent.toString();
        } catch (err) {
            throw this._wrapCallError('getDailySpent', err);
        }
    }
}
