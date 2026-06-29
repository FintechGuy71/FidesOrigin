# Forta 链上监控告警配置指南

**状态**: 待配置 ⚠️  
**目标**: 实时监控 FidesOrigin 合约异常行为，自动告警

---

## 概述

Forta 是一个去中心化实时监控网络，可以检测链上异常行为。我们为 FidesOrigin 配置以下监控：

1. **大额资金冻结** → 超过 $100K 的资金冻结立即告警
2. **策略频繁变更** → 同一 issuer 1 小时内多次变更策略 → 告警
3. **紧急模式触发** → ComplianceEngine 进入 emergencyMode → 立即告警
4. **制裁地址新增** → RiskRegistry 新增制裁地址 → 记录 + 告警
5. **合约升级** → TimelockController 安排升级操作 → 告警（48h 内提醒）

---

## 快速开始

### Step 1: 安装 Forta CLI

```bash
npm install -g @fortanetwork/forta-cli
```

### Step 2: 创建监控代理

```bash
mkdir -p forta-agents/fidesorigin-monitor
cd forta-agents/fidesorigin-monitor
npx forta-agent init
```

### Step 3: 编写监控逻辑

创建 `src/agent.ts`:

```typescript
import {
  Finding,
  FindingSeverity,
  FindingType,
  HandleTransaction,
  TransactionEvent,
} from "@fortanetwork/forta-agent";

// Sepolia 合约地址
const ADDRESSES = {
  ComplianceEngine: "0xd978f3246c56d7E3c3fF326e9fDe539f91F39ACa",
  RiskRegistry: "0xdA4D86D812b4AdF3e0023a6D4b1FF20139abD3b3",
  PolicyEngine: "0xF8f89120f5628aE3De747f55e7d00D79633002c4",
  TimelockController: "0x...",  // 需填入实际地址
};

// ABI 片段
const EVENTS = {
  FundsFrozen: "event FundsFrozen(address indexed account, uint256 amount)",
  EmergencyModeToggled: "event EmergencyModeToggled(bool isActive)",
  RiskProfileUpdated: "event RiskProfileUpdated(address indexed account, uint8 oldTier, uint8 newTier, bool isSanctioned)",
  IssuerPolicySet: "event IssuerPolicySet(address indexed issuer, (uint256,uint256,bool,bool,bool,bool,uint256) policy)",
  OperationScheduled: "event OperationScheduled(bytes32 indexed id, uint256 indexed operationType, address target, uint256 value, bytes data, uint256 timestamp)",
};

const BIG_TRANSFER_THRESHOLD = ethers.parseUnits("100000", 6); // 100K USDC

export const handleTransaction: HandleTransaction = async (
  txEvent: TransactionEvent
) => {
  const findings: Finding[] = [];

  // 1. 大额资金冻结告警
  const freezeEvents = txEvent.filterLog(
    EVENTS.FundsFrozen,
    ADDRESSES.ComplianceEngine
  );
  for (const event of freezeEvents) {
    const [account, amount] = event.args;
    if (amount >= BIG_TRANSFER_THRESHOLD) {
      findings.push(
        Finding.fromObject({
          name: "FidesOrigin 大额资金冻结",
          description: `账户 ${account} 被冻结 ${ethers.formatUnits(amount, 6)} USDC`,
          alertId: "FIDES-ORIGIN-BIG-FREEZE",
          severity: FindingSeverity.High,
          type: FindingType.Suspicious,
          metadata: {
            account,
            amount: amount.toString(),
            txHash: txEvent.hash,
          },
        })
      );
    }
  }

  // 2. 紧急模式触发告警
  const emergencyEvents = txEvent.filterLog(
    EVENTS.EmergencyModeToggled,
    ADDRESSES.ComplianceEngine
  );
  for (const event of emergencyEvents) {
    const [isActive] = event.args;
    findings.push(
      Finding.fromObject({
        name: isActive ? "FidesOrigin 紧急模式已激活" : "FidesOrigin 紧急模式已解除",
        description: `ComplianceEngine 紧急模式状态变更为: ${isActive}`,
        alertId: "FIDES-ORIGIN-EMERGENCY",
        severity: isActive ? FindingSeverity.Critical : FindingSeverity.Info,
        type: isActive ? FindingType.Exploit : FindingType.Info,
        metadata: {
          isActive,
          txHash: txEvent.hash,
        },
      })
    );
  }

  // 3. 制裁地址新增记录
  const sanctionEvents = txEvent.filterLog(
    EVENTS.RiskProfileUpdated,
    ADDRESSES.RiskRegistry
  );
  for (const event of sanctionEvents) {
    const [account, oldTier, newTier, isSanctioned] = event.args;
    if (isSanctioned) {
      findings.push(
        Finding.fromObject({
          name: "FidesOrigin 新增制裁地址",
          description: `地址 ${account} 被标记为制裁地址`,
          alertId: "FIDES-ORIGIN-SANCTION",
          severity: FindingSeverity.Medium,
          type: FindingType.Info,
          metadata: {
            account,
            oldTier,
            newTier,
            txHash: txEvent.hash,
          },
        })
      );
    }
  }

  // 4. 策略频繁变更告警
  const policyEvents = txEvent.filterLog(
    EVENTS.IssuerPolicySet,
    ADDRESSES.PolicyEngine
  );
  for (const event of policyEvents) {
    const [issuer] = event.args;
    findings.push(
      Finding.fromObject({
        name: "FidesOrigin 策略变更",
        description: `Issuer ${issuer} 更新了合规策略`,
        alertId: "FIDES-ORIGIN-POLICY-CHANGE",
        severity: FindingSeverity.Low,
        type: FindingType.Info,
        metadata: {
          issuer,
          txHash: txEvent.hash,
        },
      })
    );
  }

  // 5. 合约升级提醒（Timelock）
  const scheduleEvents = txEvent.filterLog(
    EVENTS.OperationScheduled,
    ADDRESSES.TimelockController
  );
  for (const event of scheduleEvents) {
    const [id, opType, target] = event.args;
    findings.push(
      Finding.fromObject({
        name: "FidesOrigin 合约升级已安排",
        description: `Timelock 安排了操作 ${id.slice(0, 10)}... 目标: ${target}`,
        alertId: "FIDES-ORIGIN-UPGRADE-SCHEDULED",
        severity: FindingSeverity.Medium,
        type: FindingType.Info,
        metadata: {
          operationId: id,
          target,
          txHash: txEvent.hash,
        },
      })
    );
  }

  return findings;
};
```

### Step 4: 配置 package.json

```json
{
  "name": "fidesorigin-forta-agent",
  "version": "0.0.1",
  "description": "FidesOrigin 链上监控告警代理",
  "chainIds": [11155111],
  "scripts": {
    "build": "tsc",
    "start": "npm run build && forta-agent run",
    "publish": "forta-agent publish"
  },
  "dependencies": {
    "@fortanetwork/forta-agent": "^0.1.48",
    "ethers": "^6.8.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0"
  }
}
```

### Step 5: 测试本地运行

```bash
npm install
npm run build
forta-agent run
```

### Step 6: 发布到 Forta 网络

```bash
forta-agent publish
```

---

## 告警分级

| 级别 | 场景 | 响应 |
|------|------|------|
| 🔴 **Critical** | 紧急模式激活 | 立即通知所有管理员 |
| 🟠 **High** | 大额资金冻结 (>100K) | Slack + Email 告警 |
| 🟡 **Medium** | 合约升级安排 / 新增制裁 | 每日摘要 + 即时通知 |
| 🔵 **Low** | 策略变更 | 每日摘要 |

---

## 集成通知渠道

### Discord Webhook

```typescript
// 在 agent.ts 中添加
async function sendDiscordAlert(finding: Finding) {
  const webhook = process.env.DISCORD_WEBHOOK_URL;
  await fetch(webhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      embeds: [{
        title: finding.name,
        description: finding.description,
        color: finding.severity === "critical" ? 0xff0000 : 0xffa500,
        fields: Object.entries(finding.metadata).map(([k, v]) => ({
          name: k,
          value: String(v),
          inline: true
        }))
      }]
    })
  });
}
```

### Slack Webhook

```typescript
async function sendSlackAlert(finding: Finding) {
  const webhook = process.env.SLACK_WEBHOOK_URL;
  await fetch(webhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: `*${finding.name}*\n${finding.description}\n${JSON.stringify(finding.metadata, null, 2)}`
    })
  });
}
```

---

## 成本

Forta 网络是免费的（观察者模式），发布代理需要质押少量 FORT token。

| 操作 | 成本 |
|------|------|
| 本地运行测试 | 免费 |
| 发布代理 | ~100 FORT（约 $20） |
| 运行监控 | 免费（激励由 Forta 网络支付） |

---

## 下一步

- [ ] 安装 Forta CLI
- [ ] 创建代理项目
- [ ] 填入 TimelockController 实际地址
- [ ] 本地测试运行
- [ ] 发布到 Forta 网络
- [ ] 配置 Discord/Slack Webhook

**文档**: https://docs.forta.network/
