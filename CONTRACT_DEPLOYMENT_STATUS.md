# FidesOrigin 合约部署状态报告

**检查时间**: 2026-06-22 23:50 GMT+8
**网络**: Sepolia Testnet (Chain ID: 11155111)
**部署者**: `0x5F6Ae278e7a62E64F9F467a91B693f372b84a374`

> [Fix #46] **安全修复更新 (2026-07-01)**: 已完成 72 项安全审计修复。
> 关键变更：升级脚本添加了网络限制 (BYPASS_TIMELOCK 仅在 hardhat 网络)、
> Hardhat 配置添加了 KMS 迁移 TODO、CI/CD 添加了最小权限。

---

## 部署记录汇总

### 1. 完整部署 (v1.0 - 2026-05-09)

| 合约 | 地址 | 状态 | 备注 |
|------|------|------|------|
| **RiskRegistry** | `0xdA4D86D812b4AdF3e0023a6D4b1FF20139abD3b3` | ✅ 已部署 |  via publicnode.com |
| **PolicyEngine** | `0xF8f89120f5628aE3De747f55e7d00D79633002c4` | ✅ 已部署 |  via publicnode.com |
| **ComplianceEngine** | `0xd978f3246c56d7E3c3fF326e9fDe539f91F39ACa` | ✅ 已部署 |  via publicnode.com |
| **CompliantStableCoin** | `0x5028Dc7DA99bf461ed60a226c7CEf0bf7f77BF9A` | ✅ 已部署 |  via continuation script |
| **CompliantSmartWallet** | `0xC0F142DcC67a186C16e8c244b041A1c938891F0D` | ✅ 已部署 |  via continuation script |
| **QuarantineVault** | `0x787CC3b07D59830DFBF0c7D93430E241c8aEf762` | ✅ 已部署 |  with auto-quarantine |
| **CompliantSmartWalletV2** | `0xbC3E072F83118D9d68DFD8D78e0ed1E7d72BB6b1` | ✅ 已部署 |  v2 with quarantine |
| **FidesCompliance (Proxy)** | `0xaEB8ffDC51C62c37b456593F4C5E68D291Ce552b` | ✅ 已部署 |  UUPS upgradeable |
| **FidesCompliance (Impl)** | `0x74c63D64a548262B0E1508Ac397C7Afc45e4d7cC` | ✅ 已部署 |  implementation |
| **CompliantSmartWalletV3** | `0xbe33EBA3e0d6Dc324aBF1DE1aD0E1e65DcA526AB` | ✅ 已部署 |  v1.1 split |

**Subgraph 部署**:
- Studio URL: https://thegraph.com/studio/subgraph/fidesorigin-sepolia
- Query URL: https://api.studio.thegraph.com/query/1749664/fidesorigin-sepolia/v0.0.3
- IPFS Hash: QmQ2kGmioagSptrCLVDN1bYmyieVjNdTjeLBbk5o4wbQdo

---

### 2. 部分部署 (v0.2.1 - 2026-06-15)

| 合约 | 地址 | 状态 | 备注 |
|------|------|------|------|
| **RiskRegistry (Proxy)** | `0x7a41abE5B170085fDe9d4e0a3BaD47A70bAC52bc` | ✅ 已部署 | UUPS Proxy |
| **RiskRegistry (Impl)** | `0x73F97E9e33b9eb952B8Ec7e0722523bAef555A59` | ✅ 已部署 | |
| **PolicyEngine (Proxy)** | `0x87089F67A61F9643796AE154663A6a9F21196b38` | ✅ 已部署 | UUPS Proxy |
| **PolicyEngine (Impl)** | `0xFD89795Bb954C175267e7d78d9492Ce22200dBA7` | ✅ 已部署 | |
| **ComplianceEngine (Proxy)** | `0x50aAaf70b50fB26e588e0d296A4c042943FfB0AC` | ✅ 已部署 | UUPS Proxy |
| **ComplianceEngine (Impl)** | `0x84838e8c9721e7f9475Bb379c6aF4b11240e9807` | ✅ 已部署 | |
| **QuarantineVault** | `0x497176b21CC2EDd90a8725a3023742358311a382` | ✅ 已部署 | Direct Deploy |
| **FidesCompliance** | - | ⏳ PENDING | 余额不足 |
| **CompliantStableCoin** | - | ⏳ PENDING | 余额不足 |

**部署时余额**: 0.004 ETH (不足以完成全部部署)

---

### 3. 独立部署记录

| 合约 | 地址 | 部署时间 | 备注 |
|------|------|----------|------|
| **TestUSD** | `0xeF90F9FdB868EDA98b337CbF54111b8539533ED2` | 2026-06-14 | v0.3.0 Phase 3 |
| **TestUSD** | `0x9c9f4d5775BAf5DB2f4E8f8cD1C5ca695D5c7BDb` | 2026-05-14 | 早期版本 |
| **QuarantineVault** | `0xF5593e26b2560b9fc71de729EA2D86F979dfd76b` | 2026-05-14 | 早期版本 |

---

### 4. v1.1 升级部署 (2026-06-13)

| 合约 | 地址 | 备注 |
|------|------|------|
| **FidesCompliance (Proxy)** | `0xaEB8ffDC51C62c37b456593F4C5E68D291Ce552b` | UUPS upgradeable |
| **FidesCompliance (Impl)** | `0x74c63D64a548262B0E1508Ac397C7Afc45e4d7cC` | v1.1 implementation |
| **CompliantSmartWalletV3** | `0xbe33EBA3e0d6Dc324aBF1DE1aD0E1e65DcA526AB` | v1.1 split |

---

## 合约验证状态

⚠️ **注意**: 由于网络限制，无法直接通过 Etherscan API 验证合约是否已验证。建议通过以下方式确认：

1. **Sepolia Etherscan 手动检查**:
   - https://sepolia.etherscan.io/address/0xdA4D86D812b4AdF3e0023a6D4b1FF20139abD3b3 (RiskRegistry)
   - https://sepolia.etherscan.io/address/0x787CC3b07D59830DFBF0c7D93430E241c8aEf762 (QuarantineVault)

2. **Hardhat 验证命令**:
   ```bash
   cd apps/contracts
   npx hardhat verify --network sepolia 0xdA4D86D812b4AdF3e0023a6D4b1FF20139abD3b3
   ```

---

## 当前合约文件 (本地)

| 合约文件 | 大小 | 最后修改 |
|----------|------|----------|
| ComplianceEngine.sol | 32KB | 2026-06-22 |
| FidesCompliance.sol | 18KB | 2026-06-22 |
| PolicyEngine.sol | 28KB | 2026-06-22 |
| QuarantineVault.sol | 18KB | 2026-06-22 |
| RiskRegistry.sol | 29KB | 2026-06-22 |
| RiskOracle.sol | 30KB | 2026-06-21 |
| TestUSD.sol | 13KB | 2026-06-21 |
| MerkleRiskRegistry.sol | 10KB | 2026-06-21 |
| FidesOriginTimelock.sol | 4KB | 2026-06-21 |

---

## 建议

1. **合约验证**: 建议对所有部署的合约进行 Etherscan 验证，便于调试和审计
2. **余额监控**: v0.2.1 部署因余额不足中断，建议保持测试网钱包有足够 ETH
3. **版本管理**: 当前有多个版本的合约地址，建议统一使用最新版本 (v1.1)
4. **文档更新**: 建议将最新合约地址同步到项目文档和官网

---

**总结**: FidesOrigin 核心合约已在 Sepolia 测试网完成部署，包含完整的合规协议栈（RiskRegistry, PolicyEngine, ComplianceEngine, QuarantineVault, FidesCompliance 等）。Subgraph 也已部署并同步。部分 v0.2.1 部署因余额不足未完成，但不影响已部署的 v1.0 和 v1.1 版本合约的正常使用。
