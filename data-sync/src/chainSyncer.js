/**
 * Chain Syncer — 链上同步模块
 *
 * 负责：
 * 1. 初始化区块链连接（provider, signer, contract）
 * 2. 将 Merkle Root 同步到链上
 * 3. KMS 签名器（AWS KMS / Azure / GCP / Vault / Local）
 * 4. DER 签名解析（严格边界校验）
 */

'use strict';

const { createLogger, defaultLogger: secureLog } = require('./utils/logger');
const { ethers } = require('ethers');
const { NonceManager } = require('./utils/nonceManager');
const { ValidationError, withErrorHandling } = require('./utils/errors');
const { sendAlert } = require('./alertManager');

const logger = createLogger('ChainSyncer');

// ==================== 合约 ABI ====================
const RISK_REGISTRY_ABI = [
  'function updateMerkleRoot(bytes32 merkleRoot, uint256 totalAddresses, uint256 version) external',
  'function getCurrentMerkleRoot() external view returns (bytes32)',
  'function getTotalAddresses() external view returns (uint256)',
  'function getVersion() external view returns (uint256)',
  'function owner() external view returns (address)',
  'event MerkleRootUpdated(bytes32 indexed merkleRoot, uint256 totalAddresses, uint256 version, uint256 timestamp)',
];

// ==================== 模块状态 ====================
let provider = null;
let signer = null;
let contract = null;
let nonceManager = null;

// ==================== DER 签名解析（严格边界校验）====================

/**
 * 解析 ASN.1 DER 编码的 ECDSA 签名，提取 r 和 s 值
 * 对所有 offset + length 操作添加严格的越界校验
 */
function parseDerSignature(derHex) {
  const derBuffer = Buffer.isBuffer(derHex)
    ? derHex
    : Buffer.from(derHex.replace(/^0x/, ''), 'hex');

  if (derBuffer.length < 8) {
    throw new ValidationError('DER 签名数据过短（最小 8 字节）');
  }

  if (derBuffer[0] !== 0x30) {
    throw new ValidationError(
      `无效的 DER SEQUENCE 标记: 期望 0x30, 实际 0x${derBuffer[0].toString(16)}`
    );
  }

  let offset = 1;

  let seqLength;
  if (derBuffer[offset] & 0x80) {
    const numLenBytes = derBuffer[offset] & 0x7f;
    offset++;
    if (
      numLenBytes === 0 ||
      numLenBytes > 2 ||
      offset + numLenBytes > derBuffer.length
    ) {
      throw new ValidationError(
        `DER SEQUENCE 长度字段无效: numLenBytes=${numLenBytes}, offset=${offset}, buffer=${derBuffer.length}`
      );
    }
    seqLength = 0;
    for (let i = 0; i < numLenBytes; i++) {
      seqLength = (seqLength << 8) | derBuffer[offset + i];
    }
    offset += numLenBytes;
  } else {
    seqLength = derBuffer[offset];
    offset++;
  }

  if (offset + seqLength > derBuffer.length) {
    throw new ValidationError(
      `DER SEQUENCE 内容越界: offset=${offset}, seqLength=${seqLength}, bufferLen=${derBuffer.length}`
    );
  }

  const seqEnd = offset + seqLength;

  // r 值
  if (offset >= seqEnd)
    throw new ValidationError('DER 数据截断: 缺少 r INTEGER 标记');
  if (derBuffer[offset] !== 0x02)
    throw new ValidationError(
      `无效的 r INTEGER 标记: 期望 0x02, 实际 0x${derBuffer[offset].toString(16)}`
    );
  offset++;

  if (offset >= seqEnd)
    throw new ValidationError('DER 数据截断: 缺少 r 长度');
  const rLen = derBuffer[offset];
  offset++;

  if (rLen === 0 || offset + rLen > seqEnd)
    throw new ValidationError(
      `DER r 值越界或长度非法: offset=${offset}, rLen=${rLen}, seqEnd=${seqEnd}`
    );
  if (rLen > 33)
    throw new ValidationError(`DER r 值长度异常: rLen=${rLen}（最大允许 33）`);
  const r = derBuffer.subarray(offset, offset + rLen);
  offset += rLen;

  // s 值
  if (offset >= seqEnd)
    throw new ValidationError('DER 数据截断: 缺少 s INTEGER 标记');
  if (derBuffer[offset] !== 0x02)
    throw new ValidationError(
      `无效的 s INTEGER 标记: 期望 0x02, 实际 0x${derBuffer[offset].toString(16)}`
    );
  offset++;

  if (offset >= seqEnd)
    throw new ValidationError('DER 数据截断: 缺少 s 长度');
  const sLen = derBuffer[offset];
  offset++;

  if (sLen === 0 || offset + sLen > seqEnd)
    throw new ValidationError(
      `DER s 值越界或长度非法: offset=${offset}, sLen=${sLen}, seqEnd=${seqEnd}`
    );
  if (sLen > 33)
    throw new ValidationError(`DER s 值长度异常: sLen=${sLen}（最大允许 33）`);
  const s = derBuffer.subarray(offset, offset + sLen);
  offset += sLen;

  if (offset !== seqEnd)
    throw new ValidationError(
      `DER 数据包含多余的尾部字节: offset=${offset}, seqEnd=${seqEnd}`
    );

  const rHex = Buffer.from(r)
    .toString('hex')
    .replace(/^0+/, '')
    .padStart(64, '0');
  const sHex = Buffer.from(s)
    .toString('hex')
    .replace(/^0+/, '')
    .padStart(64, '0');

  return { r: '0x' + rHex, s: '0x' + sHex };
}

// ==================== KMS 签名器 ====================

class KMSSigner {
  constructor() {
    this.kmsType = null;
    this.address = null;
    this.chainId = null;
    this.kmsClient = null;
    this.kmsKeyId = null;
    this.wallet = null;
    this.provider = null;
  }

  async init(provider, chainId) {
    this.provider = provider;
    this.chainId = BigInt(chainId);

    if (process.env.AWS_KMS_KEY_ID && process.env.AWS_REGION) {
      this.kmsType = 'aws';
      await this._initAWS();
    } else if (
      process.env.AZURE_KEY_VAULT_NAME &&
      process.env.AZURE_KEY_NAME
    ) {
      this.kmsType = 'azure';
      await this._initAzure();
    } else if (process.env.GCP_KMS_KEY_PATH) {
      this.kmsType = 'gcp';
      await this._initGCP();
    } else if (
      process.env.VAULT_ADDR &&
      process.env.VAULT_TOKEN &&
      process.env.VAULT_KEY_PATH
    ) {
      this.kmsType = 'vault';
      await this._initVault();
    } else if (process.env.PRIVATE_KEY) {
      this.kmsType = 'local';
      this.wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
      this.address = this.wallet.address;
      secureLog.warn('[KMS] 使用本地私钥模式（仅限开发/测试环境）');
    } else {
      throw new Error(
        '未检测到任何密钥管理配置。请设置以下之一：\n' +
          '  AWS: AWS_KMS_KEY_ID + AWS_REGION\n' +
          '  Azure: AZURE_KEY_VAULT_NAME + AZURE_KEY_NAME\n' +
          '  GCP: GCP_KMS_KEY_PATH\n' +
          '  Vault: VAULT_ADDR + VAULT_TOKEN + VAULT_KEY_PATH\n' +
          '  Local: PRIVATE_KEY（仅开发）'
      );
    }

    secureLog.info(
      `[KMS] 签名器初始化完成: type=${this.kmsType}, address=${this.address}`
    );
    return this;
  }

  async _initAWS() {
    let KMS;
    try {
      ({ KMS } = require('@aws-sdk/client-kms'));
    } catch (e) {
      throw new Error(
        '未安装 @aws-sdk/client-kms。请运行: npm install @aws-sdk/client-kms'
      );
    }

    this.kmsClient = new KMS({
      region: process.env.AWS_REGION,
      ...(process.env.AWS_ACCESS_KEY_ID && {
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
          ...(process.env.AWS_SESSION_TOKEN && {
            sessionToken: process.env.AWS_SESSION_TOKEN,
          }),
        },
      }),
    });

    this.kmsKeyId = process.env.AWS_KMS_KEY_ID;

    const pubKeyResponse = await this.kmsClient.getPublicKey({
      KeyId: this.kmsKeyId,
    });

    const pubKeyDer = Buffer.from(pubKeyResponse.PublicKey);
    if (pubKeyDer.length < 26 + 64 + 1) {
      throw new Error('AWS KMS 公钥格式异常');
    }
    const rawPublicKey = '0x' + pubKeyDer.subarray(26, 26 + 65).toString('hex');
    this.address = ethers.computeAddress(rawPublicKey);
  }

  async _initAzure() {
    throw new Error('Azure Key Vault 签名尚未实现。请使用 AWS KMS 或本地模式。');
  }

  async _initGCP() {
    throw new Error('GCP KMS 签名尚未实现。请使用 AWS KMS 或本地模式。');
  }

  async _initVault() {
    const { VaultClient } = require('./utils/vaultClient');
    this.vaultClient = new VaultClient({
      addr: process.env.VAULT_ADDR,
      token: process.env.VAULT_TOKEN,
      keyPath: process.env.VAULT_KEY_PATH,
    });
    const pubKey = await this.vaultClient.getPublicKey();
    this.address = ethers.computeAddress(pubKey);
  }

  async sign(digest) {
    if (this.kmsType === 'local') {
      const sig = this.wallet.signingKey.sign(digest);
      return { r: sig.r, s: sig.s, v: BigInt(sig.v) };
    }
    if (this.kmsType === 'aws') return this._signWithAWSKMS(digest);
    if (this.kmsType === 'vault') return this._signWithVault(digest);
    throw new Error(`不支持的 KMS 类型: ${this.kmsType}`);
  }

  async _signWithAWSKMS(digest) {
    const digestBuffer = Buffer.from(digest.replace(/^0x/, ''), 'hex');
    const response = await this.kmsClient.sign({
      KeyId: this.kmsKeyId,
      Message: digestBuffer,
      MessageType: 'DIGEST',
      SigningAlgorithm: 'ECDSA_SHA_256',
    });

    const { r, s } = parseDerSignature(response.Signature);
    const baseV = this.chainId * 2n + 35n;
    for (let v = 0n; v <= 1n; v++) {
      try {
        const recovered = ethers.recoverAddress(digest, { r, s, v: baseV + v });
        if (recovered.toLowerCase() === this.address.toLowerCase()) {
          return { r, s, v: baseV + v };
        }
      } catch (e) {
        // continue
      }
    }
    throw new Error('无法恢复 recovery id (v) — 请检查 KMS 密钥配置');
  }

  async _signWithVault(digest) {
    const sigResult = await this.vaultClient.sign(digest);
    const { r, s } = parseDerSignature(sigResult.signature);
    const baseV = this.chainId * 2n + 35n;
    for (let v = 0n; v <= 1n; v++) {
      try {
        const recovered = ethers.recoverAddress(digest, { r, s, v: baseV + v });
        if (recovered.toLowerCase() === this.address.toLowerCase()) {
          return { r, s, v: baseV + v };
        }
      } catch (e) {
        // continue
      }
    }
    throw new Error('无法恢复 recovery id (v) — 请检查 Vault 密钥配置');
  }

  async signTransaction(tx) {
    if (this.kmsType === 'local') return this.wallet.signTransaction(tx);

    const populated = await ethers.populateTransaction(tx);
    const unsignedTxData = {
      to: populated.to,
      nonce: populated.nonce,
      gasLimit: populated.gasLimit,
      data: populated.data || '0x',
      value: populated.value || 0n,
      chainId: this.chainId,
      type: populated.type || 0,
    };

    if (
      populated.maxFeePerGas !== null &&
      populated.maxFeePerGas !== undefined
    ) {
      unsignedTxData.maxFeePerGas = populated.maxFeePerGas;
      unsignedTxData.maxPriorityFeePerGas = populated.maxPriorityFeePerGas;
      unsignedTxData.type = 2;
      if (populated.accessList) unsignedTxData.accessList = populated.accessList;
    } else {
      unsignedTxData.gasPrice = populated.gasPrice;
      unsignedTxData.type = 0;
    }

    const unsignedTx = ethers.Transaction.from(unsignedTxData);
    const unsignedSerialized = unsignedTx.unsignedSerialized;
    const digest = ethers.keccak256(unsignedSerialized);
    const { r, s, v } = await this.sign(digest);

    const signedTx = ethers.Transaction.from({
      ...unsignedTxData,
      signature: { r, s, v },
    });

    return signedTx.serialized;
  }
}

// ==================== 区块链初始化 ====================

// validateUrl, validateEthereumAddress imported from validators.js (breaks circular dep with scheduler.js)
const { validateUrl, validateEthereumAddress: _validateAddr } = require('./validators');

async function initBlockchain(healthCheckServerRef) {
  const rpcUrl = process.env.RPC_URL || process.env.ETHEREUM_RPC_URL;
  if (!rpcUrl) throw new Error('RPC_URL 环境变量未设置');

  validateUrl(rpcUrl);

  provider = new ethers.JsonRpcProvider(rpcUrl, { staticNetwork: true });
  const network = await provider.getNetwork();
  const chainId = Number(network.chainId);

  signer = new KMSSigner();
  await signer.init(provider, chainId);

  nonceManager = new NonceManager(provider, signer.address);
  await nonceManager.initialize();

  const contractAddress = process.env.RISK_REGISTRY_ADDRESS;
  if (!contractAddress)
    throw new Error('RISK_REGISTRY_ADDRESS 环境变量未设置');
  _validateAddr(contractAddress);

  contract = new ethers.Contract(contractAddress, RISK_REGISTRY_ABI, provider);

  const code = await provider.getCode(contractAddress);
  if (code === '0x')
    throw new Error(`合约未部署在地址 ${contractAddress}`);

  try {
    const owner = await contract.owner();
    if (owner.toLowerCase() !== signer.address.toLowerCase()) {
      secureLog.warn(
        `[Blockchain] 签名者 ${signer.address} 不是合约所有者 ${owner}`
      );
    }
  } catch (e) {
    // 合约可能没有 owner 函数
  }

  // [Cross-check fix] Verify ORACLE_ROLE in addition to owner check
  try {
    const ORACLE_ROLE = '0x68e79a7bf1e0bc45d0a330c573bc367f9cf464fd326078812f301165fbda4ef1';
    const hasRole = await contract.hasRole(ORACLE_ROLE, signer.address);
    if (!hasRole) {
      throw new Error(`签名者 ${signer.address} 没有 ORACLE_ROLE`);
    }
    secureLog.info(`[Blockchain] 签名者已确认拥有 ORACLE_ROLE`);
  } catch (e) {
    if (e.message && e.message.includes('没有 ORACLE_ROLE')) {
      throw e;
    }
    // 合约可能没有 hasRole 函数 — 记录但不阻断
    secureLog.warn('[Blockchain] 无法验证 ORACLE_ROLE（合约可能不支持 AccessControl）');
  }

  secureLog.info(
    `[Blockchain] 初始化完成: chainId=${chainId}, signer=${signer.address}`
  );

  if (healthCheckServerRef) {
    healthCheckServerRef.provider = provider;
  }
}

// ==================== Merkle Root 链上同步 ====================

async function syncMerkleRootToChain(merkleRoot, totalAddresses, auditLogger) {
  if (!contract || !signer || !provider)
    throw new Error('区块链组件未初始化');

  const currentRoot = await contract.getCurrentMerkleRoot();
  if (currentRoot.toLowerCase() === merkleRoot.toLowerCase()) {
    secureLog.info('[Sync] Merkle Root 未变化，跳过链上更新');
    return { txHash: null, skipped: true };
  }

  const currentVersion = await contract.getVersion();
  const nonce = await nonceManager.getNonce();

  const txData = await contract.updateMerkleRoot.populateTransaction(
    merkleRoot,
    totalAddresses,
    currentVersion + 1n
  );

  const unsignedTx = {
    ...txData,
    from: signer.address,
    nonce,
    gasLimit: 500000n,
    chainId: Number(signer.chainId),
  };

  try {
    const gasEstimate = await provider.estimateGas(unsignedTx);
    unsignedTx.gasLimit = (gasEstimate * 12n) / 10n;
  } catch (e) {
    secureLog.warn('[Sync] Gas 估算失败，使用默认值:', e.message);
  }

  const feeData = await provider.getFeeData();
  if (
    feeData.maxFeePerGas !== null &&
    feeData.maxFeePerGas !== undefined &&
    feeData.maxPriorityFeePerGas !== null &&
    feeData.maxPriorityFeePerGas !== undefined
  ) {
    unsignedTx.maxFeePerGas = feeData.maxFeePerGas;
    unsignedTx.maxPriorityFeePerGas = feeData.maxPriorityFeePerGas;
    unsignedTx.type = 2;
  } else if (feeData.gasPrice) {
    unsignedTx.gasPrice = feeData.gasPrice;
    unsignedTx.type = 0;
  }

  const signedTx = await signer.signTransaction(unsignedTx);
  const tx = await provider.broadcastTransaction(signedTx);

  secureLog.info(`[Sync] 交易已广播: ${tx.hash}, nonce=${nonce}`);

  // [Cross-check fix] Add 5-minute timeout to tx.wait to prevent indefinite hangs
  const receipt = await Promise.race([
    tx.wait(2),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Transaction confirmation timeout after 5 minutes')), 300000)
    ),
  ]);

  if (receipt === null || receipt.status !== 1) {
    await nonceManager.syncFromChain(); // Re-sync nonce from chain
    throw new Error(`交易回滚: ${tx.hash}`);
  }

  nonceManager.confirmNonce(nonce);

  const newVersion = Number(currentVersion) + 1;
  secureLog.info(
    `[Sync] Merkle Root 已更新: ${merkleRoot}, version=${newVersion}, tx=${tx.hash}`
  );

  if (auditLogger) {
    auditLogger.log('MERKLE_ROOT_UPDATED', {
      merkleRoot,
      totalAddresses,
      version: newVersion,
      txHash: tx.hash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed?.toString(),
    });
  }

  return { txHash: tx.hash, skipped: false, version: newVersion };
}

function getProvider() {
  return provider;
}

function getSigner() {
  return signer;
}

function getNonceManager() {
  return nonceManager;
}

module.exports = {
  RISK_REGISTRY_ABI,
  KMSSigner,
  parseDerSignature,
  initBlockchain,
  syncMerkleRootToChain,
  getProvider,
  getSigner,
  getNonceManager,
};
