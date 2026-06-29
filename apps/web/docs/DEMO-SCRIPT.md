# FidesOrigin 产品演示脚本

**版本**: v0.5.0  
**目标**: 1 分钟展示"链上执行级合规"核心价值  
**场景**: 投资人 Demo / 客户演示 / 社区 AMA

---

## 演示环境

| 组件 | 配置 |
|------|------|
| **网络** | Sepolia 测试网 |
| **合约** | CompliantStableCoin (fUSD) |
| **后台** | FidesOrigin Admin v0.4.0 |
| **数据** | The Graph Subgraph 实时索引 |

---

## 演示脚本（总时长：约 90 秒）

### 开场（10 秒）

> "现有 Web3 合规方案全是'监控+告警'——发现风险后发邮件通知运营人员，等他们看到的时候资金已经转移了。
> 
> FidesOrigin 不一样。我们在链上实时执行合规决策：交易中自动拦截、自动冻结、自动路由到合规流程。"

### 场景 1：制裁地址自动拦截（30 秒）

**操作步骤**:
1. 打开 Etherscan Sepolia → CompliantStableCoin (0x502...BF9A)
2. 点击 "Write Contract" → 连接 MetaMask（切换到 Sepolia）
3. 执行 `mint`：向地址 A 铸造 1000 fUSD
4. 打开 Admin 后台 → 客户管理
5. 将地址 B 标记为"制裁"（高风险 + SANCTIONED 标签）
6. 回到 Etherscan → 执行 `transfer`：从地址 A 向地址 B 转账 100 fUSD
7. **预期结果**：交易 revert，显示 `ComplianceCheckFailed`
8. 打开 Admin → 合规日志，看到拦截记录

**解说词**:
> "看，转账到制裁地址直接被链上拦截，0 人工延迟。不是告警——是根本不让交易发生。"

### 场景 2：超额转账自动 HOLD（30 秒）

**操作步骤**:
1. Admin → 限额配置
2. 设置日限额：500 fUSD/天
3. Etherscan → 从地址 A 向地址 C 转账 200 fUSD（正常通过）
4. 再次转账 200 fUSD（正常通过，累计 400）
5. 第三次转账 200 fUSD（**超过日限额 → HOLD**）
6. Admin → 合规日志，看到"HOLD"状态
7. Admin → 资金冻结 → 点击"释放资金"
8. 资金释放，地址 C 收到 200 fUSD

**解说词**:
> "超过日限额不会直接拦截——我们先 HOLD 资金，让运营人员审核后决定放行或退回。这才是真实业务需要的灵活性。"

### 场景 3：策略版本回滚（20 秒）

**操作步骤**:
1. Admin → 策略配置
2. 将日限额从 500 改为 100
3. 保存 → 版本号从 v1 变为 v2
4. 发现问题 → 点击"回滚到 v1"
5. 策略立即恢复到 500 fUSD
6. 展示版本历史时间线

**解说词**:
> "策略改了发现有问题？一键回滚到任意历史版本。监管审计时我们能证明'某月某日我们把限额从 A 改到 B'。"

### 结尾（10 秒）

**展示 Dashboard**:
- 打开 Admin Dashboard
- 展示 Subgraph 实时统计：总检查数、拦截数、制裁地址数
- 展示 The Graph 查询结果

**结语**:
> "这就是 FidesOrigin——不是监控合规，是执行合规。"

---

## 录屏检查清单

### 录制前准备
- [ ] MetaMask 已安装，切换到 Sepolia 网络
- [ ] Sepolia ETH 充足（至少 0.1 ETH）
- [ ] Admin 后台已打开（`fidesorigin-demo/admin/index.html` 本地打开）
- [ ] Etherscan Sepolia 合约页面已打开
- [ ] 屏幕录制软件就绪（推荐 OBS / Loom）

### 录制设置
- [ ] 分辨率：1920x1080 或更高
- [ ] 帧率：30fps
- [ ] 鼠标高亮：启用（便于 viewers 跟随）
- [ ] 麦克风：清晰，无背景噪音

### 后期剪辑建议
- [ ] 开头 3 秒：FidesOrigin Logo + 标语
- [ ] 每个场景间加 1 秒转场
- [ ] 关键操作（拦截/HOLD/回滚）加放大效果
- [ ] 结尾 5 秒：CTA（官网 + GitHub）
- [ ] 总时长控制在 2 分钟以内

---

## 备用方案（如果 Sepolia 网络拥堵）

### 本地 Hardhat 网络演示

```bash
# 启动本地网络
npx hardhat node

# 新终端部署合约
npx hardhat run scripts/deploy-full.js --network localhost

# 运行端到端演示脚本
npx hardhat run scripts/demo-e2e.js --network localhost
```

**缺点**：无法展示 Etherscan / The Graph 集成

---

## 常见问题（Q&A 准备）

| 问题 | 回答 |
|------|------|
| "Gas 成本会不会太高？" | Base/Arbitrum 上每次合规检查约 8K-15K gas，成本 <$0.01 |
| "会不会被绕过？" | 合规检查在合约层面强制执行，无法绕过 |
| "去中心化程度？" | 策略由发行方设定，执行由合约自动完成，无中心化控制 |
| "已有客户吗？" | 正在与 3 个稳定币/RWA 项目 POC（客户访谈阶段） |
| "怎么收费？" | SaaS 订阅（按交易量）+ 白标授权（按项目） |

---

## 素材链接

| 素材 | 链接 |
|------|------|
| Sepolia fUSD 合约 | https://sepolia.etherscan.io/address/0x5028Dc7DA99bf461ed60a226c7CEf0bf7f77BF9A |
| Admin 后台 | `fidesorigin-demo/admin/index.html`（本地打开） |
| The Graph Studio | https://thegraph.com/studio/subgraph/fidesorigin-sepolia |
| 白皮书 | `WHITEPAPER-v0.5.0.md` |

---

**录制完成后**: 上传到 YouTube / Loom，链接发给 contact@fidesorigin.com
