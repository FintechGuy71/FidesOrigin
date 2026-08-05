import { MempoolTx, DetectionResult } from './watcher';
import { ethers } from 'ethers';

// 已知风险地址/合约
const TORNADO_CASH_ADDRESSES = [
  '0x722122dF12D4e14e13Ac3b6895a86e84145b6967',
  '0xd90e2f925DA726b50C4Ed8D0Fb90Ad053324V31a',
].map(a => a.toLowerCase());

const KNOWN_LENDING_POOLS = [
  '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2', // Aave V3
  '0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9', // Aave V2
].map(a => a.toLowerCase());

const KNOWN_DEX_ROUTERS = [
  '0xE592427A0AEce92De3Edee1F18E0157C05861564', // Uniswap V3
  '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D', // Uniswap V2
].map(a => a.toLowerCase());

type RuleFn = (tx: MempoolTx) => boolean;

interface RuleDef {
  name: string;
  indicators: RuleFn[];
  riskScore: number;
  action: string;
}

export const RULES: RuleDef[] = [
  {
    name: 'flash_loan_attack',
    indicators: [
      (tx) => tx.value === BigInt(0) && tx.data.length > 500,
      (tx) => tx.data.toLowerCase().includes('flashloan') || tx.data.includes('0xab9c4b5d'),
      (tx) => KNOWN_LENDING_POOLS.some(p => tx.to?.toLowerCase() === p)
    ],
    riskScore: 95,
    action: 'BLOCK'
  },
  {
    name: 'tornado_cash_mixer',
    indicators: [
      (tx) => TORNADO_CASH_ADDRESSES.some(a => tx.to?.toLowerCase() === a),
      (tx) => tx.value > ethers.parseEther('1')
    ],
    riskScore: 100,
    action: 'BLOCK'
  },
  {
    name: 'suspicious_contract_creation',
    indicators: [
      (tx) => tx.to === null, // 合约创建
      (tx) => tx.data.length < 200, // 极小合约
    ],
    riskScore: 70,
    action: 'WARN'
  },
  {
    name: 'high_gas_price',
    indicators: [
      (tx) => tx.gasPrice > ethers.parseUnits('500', 'gwei')
    ],
    riskScore: 60,
    action: 'WARN'
  }
];

export class DetectionEngine {
  private txHistory: Map<string, { timestamps: number[]; volume: bigint }> = new Map();

  evaluate(tx: MempoolTx): DetectionResult {
    const matchedPatterns: string[] = [];
    let maxScore = 0;
    let maxConfidence = 0;

    for (const rule of RULES) {
      const matchCount = rule.indicators.filter(fn => {
        try { return fn(tx); } catch { return false; }
      }).length;

      if (matchCount === rule.indicators.length) {
        matchedPatterns.push(rule.name);
        maxScore = Math.max(maxScore, rule.riskScore);
        maxConfidence = 100;
      } else if (matchCount > 0) {
        // 部分匹配，降低置信度
        const partialConfidence = (matchCount / rule.indicators.length) * 50;
        if (partialConfidence > maxConfidence) {
          maxConfidence = partialConfidence;
        }
      }
    }

    // 行为分析: 快速资金转移
    const behaviorResult = this._checkBehavior(tx);
    if (behaviorResult.score > maxScore) {
      maxScore = behaviorResult.score;
      matchedPatterns.push(...behaviorResult.patterns);
    }

    return {
      matched: maxScore >= 50,
      confidence: maxConfidence,
      riskScore: maxScore,
      patterns: matchedPatterns,
      reason: matchedPatterns.length > 0 
        ? `Matched: ${matchedPatterns.join(', ')}` 
        : 'No patterns matched'
    };
  }

  private _checkBehavior(tx: MempoolTx): { score: number; patterns: string[] } {
    const from = tx.from.toLowerCase();
    const now = Date.now();
    
    if (!this.txHistory.has(from)) {
      this.txHistory.set(from, { timestamps: [], volume: BigInt(0) });
    }
    
    const history = this.txHistory.get(from)!;
    history.timestamps.push(now);
    history.volume += tx.value;
    
    // 清理1小时前的记录
    history.timestamps = history.timestamps.filter(t => now - t < 3600000);
    
    const patterns: string[] = [];
    let score = 0;
    
    // 每小时超过10笔交易
    if (history.timestamps.length > 10) {
      patterns.push('rapid_transactions');
      score = Math.max(score, 75);
    }
    
    // 每小时超过100ETH交易量
    if (history.volume > ethers.parseEther('100')) {
      patterns.push('high_volume');
      score = Math.max(score, 70);
    }
    
    return { score, patterns };
  }
}
