import {
  Finding,
  FindingSeverity,
  FindingType,
  HandleTransaction,
  TransactionEvent,
} from 'forta-agent';
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

// [Critical Fix] 使用合约实际定义的事件签名，替换之前错误的 ComplianceCheck 事件
// 合约中不存在的事件（已移除）：
//   - ComplianceCheck(address,address,address,uint256,uint8,string) ❌
//   - FundsHeld(bytes32,address,address,uint256) ❌
//   - EmergencyModeActivated(address) ❌
// 合约中实际定义的事件（已启用）：
//   - TransactionBlocked(address,address,uint256,address,string,uint256,uint256)
//   - TransactionQuarantined(address,address,uint256,address,bytes32,uint256,uint256)
//   - ComplianceCheckPerformed(address,uint256,bool,uint256,uint256,bytes32)
//   - ContractPaused(address,uint256)
//   - QuarantineReleased(bytes32,address,uint256)
const EVENT_ABIS = [
  'event TransactionBlocked(address indexed from, address indexed to, uint256 indexed amount, address token, string reason, uint256 timestamp, uint256 blockNumber)',
  'event TransactionQuarantined(address indexed from, address indexed to, uint256 indexed amount, address token, bytes32 quarantineId, uint256 timestamp, uint256 blockNumber)',
  'event ComplianceCheckPerformed(address indexed addr, uint256 indexed riskScore, bool indexed isCompliant, uint256 timestamp, uint256 blockNumber, bytes32 checkType)',
  'event ContractPaused(address indexed account, uint256 timestamp)',
  'event QuarantineReleased(bytes32 indexed quarantineId, address indexed operator, uint256 timestamp)',
];

const iface = new Interface(EVENT_ABIS);

const TOKEN_DECIMALS = 6;

/**
 * 安全格式化金额
 */
function safeFormatUnits(amount: unknown): string {
  try {
    const bigIntAmount = BigInt(String(amount || 0));
    return formatUnits(bigIntAmount, TOKEN_DECIMALS);
  } catch {
    return '0';
  }
}

/**
 * 安全格式化 bytes32 为可读字符串
 */
function bytes32ToString(bytes32: unknown): string {
  try {
    if (typeof bytes32 === 'string' && bytes32.length === 66) {
      return bytes32;
    }
    return String(bytes32);
  } catch {
    return String(bytes32);
  }
}

const handleTransaction: HandleTransaction = async (
  txEvent: TransactionEvent
) => {
  const findings: Finding[] = [];

  // [Medium] 全局异常处理，防止单个解析错误导致 Agent 崩溃
  try {
    // ==================== 监控 TransactionBlocked (交易被拦截) ====================
    const blockedTxs = txEvent.filterLog(EVENT_ABIS[0], COMPLIANCE_ENGINE);
    for (const log of blockedTxs) {
      const { from, to, amount, token, reason } = log.args;
      const amountFormatted = safeFormatUnits(amount);

      findings.push(
        Finding.fromObject({
          name: 'FidesOrigin 交易被拦截',
          description: `地址 ${from} 向 ${to} 转账 ${amountFormatted} fUSD 被合规引擎拦截。原因: ${reason}`,
          alertId: 'FIDES-BLOCK-001',
          severity: FindingSeverity.High,
          type: FindingType.Suspicious,
          metadata: {
            from: String(from),
            to: String(to),
            amount: amountFormatted,
            token: String(token),
            reason: String(reason),
            txHash: txEvent.hash,
          },
        })
      );
    }

    // ==================== 监控 TransactionQuarantined (交易被隔离) ====================
    const quarantinedTxs = txEvent.filterLog(EVENT_ABIS[1], COMPLIANCE_ENGINE);
    for (const log of quarantinedTxs) {
      const { from, to, amount, token, quarantineId } = log.args;
      const amountFormatted = safeFormatUnits(amount);

      findings.push(
        Finding.fromObject({
          name: 'FidesOrigin 资金被隔离',
          description: `地址 ${from} 向 ${to} 的 ${amountFormatted} fUSD 转账被隔离等待审核。quarantineId: ${quarantineId}`,
          alertId: 'FIDES-HOLD-001',
          severity: FindingSeverity.High,
          type: FindingType.Suspicious,
          metadata: {
            from: String(from),
            to: String(to),
            amount: amountFormatted,
            token: String(token),
            quarantineId: String(quarantineId),
            txHash: txEvent.hash,
          },
        })
      );
    }

    // ==================== 监控 ComplianceCheckPerformed (地址合规检查) ====================
    const complianceChecks = txEvent.filterLog(EVENT_ABIS[2], COMPLIANCE_ENGINE);
    for (const log of complianceChecks) {
      const { addr, riskScore, isCompliant, checkType } = log.args;
      const riskScoreNum = Number(riskScore);
      const checkTypeStr = bytes32ToString(checkType);

      // 地址不合规或高风险评分 → 对应旧的 FLAG 决策（需人工关注）
      if (!isCompliant || riskScoreNum >= 80) {
        findings.push(
          Finding.fromObject({
            name: 'FidesOrigin 高风险地址合规检查',
            description: `地址 ${addr} 合规检查不通过 (riskScore=${riskScoreNum}, isCompliant=${isCompliant}, checkType=${checkTypeStr})`,
            alertId: 'FIDES-FLAG-001',
            severity: riskScoreNum >= 95 ? FindingSeverity.High : FindingSeverity.Medium,
            type: FindingType.Info,
            metadata: {
              addr: String(addr),
              riskScore: String(riskScoreNum),
              isCompliant: String(isCompliant),
              checkType: checkTypeStr,
              txHash: txEvent.hash,
            },
          })
        );
      }
    }

    // ==================== 监控 ContractPaused (合约暂停 — 对应旧 EmergencyModeActivated) ====================
    const pausedEvents = txEvent.filterLog(EVENT_ABIS[3], COMPLIANCE_ENGINE);
    for (const log of pausedEvents) {
      const { account, timestamp } = log.args;
      findings.push(
        Finding.fromObject({
          name: '🚨 FidesOrigin 合约暂停',
          description: `合规引擎进入暂停模式，触发者: ${account}`,
          alertId: 'FIDES-EMERGENCY-001',
          severity: FindingSeverity.Critical,
          type: FindingType.Exploit,
          metadata: {
            triggeredBy: String(account),
            timestamp: String(timestamp),
            txHash: txEvent.hash,
          },
        })
      );
    }

    // ==================== 监控 QuarantineReleased (隔离被释放) ====================
    const releasedEvents = txEvent.filterLog(EVENT_ABIS[4], COMPLIANCE_ENGINE);
    for (const log of releasedEvents) {
      const { quarantineId, operator, timestamp } = log.args;
      findings.push(
        Finding.fromObject({
          name: 'FidesOrigin 隔离已释放',
          description: `隔离记录 ${quarantineId} 已被操作者 ${operator} 释放`,
          alertId: 'FIDES-HOLD-003',
          severity: FindingSeverity.Info,
          type: FindingType.Info,
          metadata: {
            quarantineId: String(quarantineId),
            operator: String(operator),
            timestamp: String(timestamp),
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
