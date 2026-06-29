import {
  Finding,
  FindingSeverity,
  FindingType,
  HandleTransaction,
  TransactionEvent,
} from '@fortanetwork/forta-agent';
// [High 修复] 正确导入 ethers 模块成员，避免 ReferenceError
import { Interface, parseUnits, formatUnits } from 'ethers';

// [P2 Fix] 移除了硬编码默认值，所有地址必须通过环境变量配置
// 如未配置，Agent 拒绝启动并给出明确错误提示
const COMPLIANCE_ENGINE = process.env.COMPLIANCE_ENGINE;
const COMPLIANT_STABLECOIN = process.env.COMPLIANT_STABLECOIN;
const RISK_REGISTRY = process.env.RISK_REGISTRY;

// 启动时校验必需环境变量
if (!COMPLIANCE_ENGINE) {
  throw new Error('[FORTA CONFIG] COMPLIANCE_ENGINE env var is required. Set it to the deployed ComplianceEngine contract address.');
}
if (!COMPLIANT_STABLECOIN) {
  throw new Error('[FORTA CONFIG] COMPLIANT_STABLECOIN env var is required. Set it to the deployed CompliantStableCoin contract address.');
}
if (!RISK_REGISTRY) {
  throw new Error('[FORTA CONFIG] RISK_REGISTRY env var is required. Set it to the deployed RiskRegistry contract address.');
}

// 事件 ABI 片段
const COMPLIANCE_CHECK_ABI = [
  'event ComplianceCheck(address indexed operator, address indexed from, address indexed to, uint256 amount, uint8 decision, string reason)',
  'event FundsHeld(bytes32 indexed holdId, address indexed owner, address asset, uint256 amount)',
  'event EmergencyModeActivated(address indexed triggeredBy)',
];

const iface = new Interface(COMPLIANCE_CHECK_ABI);

// [Low] 将精度提取为常量配置，避免硬编码散落
const TOKEN_DECIMALS = 6;

// 告警阈值（10万 fUSD）
const HIGH_VALUE_THRESHOLD = parseUnits('100000', TOKEN_DECIMALS);

// [Medium] 使用 Map 替代数组索引，增强类型安全
const DECISION_MAP = new Map<number, string>([
  [0, 'ALLOW'],
  [1, 'BLOCK'],
  [2, 'FLAG'],
  [3, 'HOLD'],
]);

/**
 * 安全获取决策标签
 */
function getDecisionLabel(decision: unknown): string {
  const code = Number(decision);
  return DECISION_MAP.get(code) || 'UNKNOWN';
}

/**
 * 安全格式化金额
 */
function safeFormatUnits(amount: unknown): string {
  try {
    const bigIntAmount = BigInt(amount || 0);
    return formatUnits(bigIntAmount, TOKEN_DECIMALS);
  } catch {
    return '0';
  }
}

const handleTransaction: HandleTransaction = async (
  txEvent: TransactionEvent
) => {
  const findings: Finding[] = [];

  // [Medium] 全局异常处理，防止单个解析错误导致 Agent 崩溃
  try {
    // ==================== 监控 ComplianceCheck 事件 ====================
    const complianceChecks = txEvent.filterLog(
      COMPLIANCE_CHECK_ABI[0],
      COMPLIANCE_ENGINE
    );

    for (const log of complianceChecks) {
      const { operator, from, to, amount, decision, reason } = log.args;

      const decisionCode = Number(decision);
      const decisionLabel = getDecisionLabel(decision);
      const amountBigInt = BigInt(amount || 0);
      const amountFormatted = safeFormatUnits(amount);

      // 🚨 BLOCK 决策 — 高风险
      if (decisionCode === 1) {
        findings.push(
          Finding.fromObject({
            name: 'FidesOrigin 交易被拦截',
            description: `地址 ${from} 向 ${to} 转账 ${amountFormatted} fUSD 被合规引擎拦截。原因: ${reason}`,
            alertId: 'FIDES-BLOCK-001',
            severity: FindingSeverity.High,
            type: FindingType.Suspicious,
            metadata: {
              operator: String(operator),
              from: String(from),
              to: String(to),
              amount: amountFormatted,
              reason: String(reason),
              txHash: txEvent.hash,
            },
          })
        );
      }

      // ⚠️ FLAG 决策 — 中风险
      if (decisionCode === 2) {
        findings.push(
          Finding.fromObject({
            name: 'FidesOrigin 交易被标记',
            description: `地址 ${from} 向 ${to} 转账 ${amountFormatted} fUSD 被标记需人工审核。原因: ${reason}`,
            alertId: 'FIDES-FLAG-001',
            severity: FindingSeverity.Medium,
            type: FindingType.Info,
            metadata: {
              operator: String(operator),
              from: String(from),
              to: String(to),
              amount: amountFormatted,
              reason: String(reason),
              txHash: txEvent.hash,
            },
          })
        );
      }

      // 💰 HOLD 决策 — 资金冻结
      if (decisionCode === 3) {
        findings.push(
          Finding.fromObject({
            name: 'FidesOrigin 资金被冻结',
            description: `地址 ${from} 的 ${amountFormatted} fUSD 被冻结。原因: ${reason}`,
            alertId: 'FIDES-HOLD-001',
            severity: FindingSeverity.High,
            type: FindingType.Suspicious,
            metadata: {
              operator: String(operator),
              from: String(from),
              to: String(to),
              amount: amountFormatted,
              reason: String(reason),
              txHash: txEvent.hash,
            },
          })
        );
      }

      // 🔥 大额交易监控（即使 ALLOW 也要记录）
      if (amountBigInt >= HIGH_VALUE_THRESHOLD) {
        findings.push(
          Finding.fromObject({
            name: 'FidesOrigin 大额转账',
            description: `检测到大额转账: ${amountFormatted} fUSD from ${from} to ${to}`,
            alertId: 'FIDES-HIGH-VALUE-001',
            severity: FindingSeverity.Medium,
            type: FindingType.Info,
            metadata: {
              from: String(from),
              to: String(to),
              amount: amountFormatted,
              decision: decisionLabel,
              txHash: txEvent.hash,
            },
          })
        );
      }
    }

    // ==================== 监控 FundsHeld 事件 ====================
    const fundsHeld = txEvent.filterLog(
      COMPLIANCE_CHECK_ABI[1],
      COMPLIANCE_ENGINE
    );
    for (const log of fundsHeld) {
      const { holdId, owner, asset, amount } = log.args;
      const heldAmountFormatted = safeFormatUnits(amount);
      findings.push(
        Finding.fromObject({
          name: 'FidesOrigin 新冻结记录',
          description: `新资金冻结: holdId=${holdId}, owner=${owner}, amount=${heldAmountFormatted} fUSD`,
          alertId: 'FIDES-HOLD-002',
          severity: FindingSeverity.Info,
          type: FindingType.Info,
          metadata: {
            holdId: String(holdId),
            owner: String(owner),
            asset: String(asset),
            amount: heldAmountFormatted,
          },
        })
      );
    }

    // ==================== 监控 EmergencyModeActivated ====================
    const emergencyEvents = txEvent.filterLog(
      COMPLIANCE_CHECK_ABI[2],
      COMPLIANCE_ENGINE
    );
    for (const log of emergencyEvents) {
      findings.push(
        Finding.fromObject({
          name: '🚨 FidesOrigin 紧急模式启动',
          description: `合规引擎进入紧急暂停模式，触发者: ${log.args.triggeredBy}`,
          alertId: 'FIDES-EMERGENCY-001',
          severity: FindingSeverity.Critical,
          type: FindingType.Exploit,
          metadata: {
            triggeredBy: String(log.args.triggeredBy),
          },
        })
      );
    }
  } catch (error) {
    // [Medium] 捕获解析异常，记录错误但不崩溃
    console.error('[FidesOrigin Agent] handleTransaction error:', error);
    findings.push(
      Finding.fromObject({
        name: 'FidesOrigin Agent 内部错误',
        description: `Agent 处理交易时发生异常: ${
          error instanceof Error ? error.message : String(error)
        }`,
        alertId: 'FIDES-AGENT-ERROR',
        severity: FindingSeverity.Low,
        type: FindingType.Info,
        metadata: {
          txHash: txEvent.hash,
          error: error instanceof Error ? error.message : String(error),
        },
      })
    );
  }

  return findings;
};

export default {
  handleTransaction,
};
