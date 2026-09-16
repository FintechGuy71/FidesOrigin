import { MempoolTx, DetectionResult } from './watcher';
import { ethers } from 'ethers';

// 已知风险地址/合约
/* [AUDIT FIX 2026-09-17 R1-013] 第二个地址原含非法字符 'V'
   （...053324V31a），非十六进制 → 该混币池地址永远匹配不到，
   tornado_cash_mixer 规则对其失效。已更正为 ...053324c31a，
   并增加启动自检（非法地址直接抛错，避免静默失效）。 */
const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

function validatedAddresses(list: string[], label: string): string[] {
  for (const a of list) {
    if (!ADDRESS_RE.test(a)) {
      throw new Error(`[detector] ${label} 含非法地址: ${a}`);
    }
  }
  return list.map(a => a.toLowerCase());
}

const TORNADO_CASH_ADDRESSES = validatedAddresses([
  '0x722122dF12D4e14e13Ac3b6895a86e84145b6967',
  '0xd90e2f925DA726b50C4Ed8D0Fb90Ad053324c31a',
], 'TORNADO_CASH_ADDRESSES');

const KNOWN_LENDING_POOLS = validatedAddresses([
  '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2', // Aave V3
  '0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9', // Aave V2
], 'KNOWN_LENDING_POOLS');

const KNOWN_DEX_ROUTERS = validatedAddresses([
  '0xE592427A0AEce92De3Edee1F18E0157C05861564', // Uniswap V3
  '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D', // Uniswap V2
], 'KNOWN_DEX_ROUTERS');

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
  private txHistory: Map<string, { entries: { t: number; value: bigint }[] }> = new Map();

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
    const WINDOW_MS = 3600000; // 1 小时滑动窗口

    if (!this.txHistory.has(from)) {
      this.txHistory.set(from, { entries: [] });
    }

    const history = this.txHistory.get(from)!;
    history.entries.push({ t: now, value: tx.value });

    // [R1-014] 时间戳与金额同窗口过期；窗口内量额实时重算
    history.entries = history.entries.filter(e => now - e.t < WINDOW_MS);
    if (history.entries.length === 0) {
      this.txHistory.delete(from); // 防内存无界增长
    }
    const windowVolume = history.entries.reduce((sum, e) => sum + e.value, BigInt(0));

    const patterns: string[] = [];
    let score = 0;

    // 每小时超过10笔交易
    if (history.entries.length > 10) {
      patterns.push('rapid_transactions');
      score = Math.max(score, 75);
    }

    // 每小时（滑动窗口）超过100ETH交易量
    if (windowVolume > ethers.parseEther('100')) {
      patterns.push('high_volume');
      score = Math.max(score, 70);
    }

    return { score, patterns };
  }
}
