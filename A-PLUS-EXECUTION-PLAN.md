# FidesOrigin A+ 推进任务 — 主计划书

**启动时间**: 2026-08-03
**目标**: 全维度从A级提升至A+级
**执行方式**: 子代理自主执行，中断后自动重启
**检查点**: 每个Phase完成后更新此文件

---

## 当前基线（A级）

| 维度 | 当前 | 目标 | 差距 |
|------|------|------|------|
| 代码质量 | A | A+ | 测试391→保持，覆盖率>90%，添加形式验证 |
| 安全 | A- | A+ | meta标签→真正的HTTP安全头，引入自动安全扫描 |
| 设计 | A | A+ | 零可访问性警告，完美响应式，动画优化 |
| 性能 | B+ | A+ | Next.js构建零警告，Lighthouse 95+ |
| 可维护性 | A- | A+ | ESLint完美配置，零警告，版本号统一 |

---

## Phase 1: ESLint配置完美化 [检查点1]

**目标**: 升级到ESLint v9 flat config，消除所有警告

**动作清单**:
1. [ ] 备份现有 `.eslintrc.json`
2. [ ] 创建 `eslint.config.js` (flat config)
3. [ ] 配置规则：TypeScript, React, React Hooks, Next.js, Prettier
4. [ ] 运行 `eslint --fix` 自动修复
5. [ ] 手动修复剩余警告
6. [ ] 验证：零警告输出

**成功标准**: `npx eslint .` 输出为空或仅info

---

## Phase 2: Next.js构建零警告 [检查点2]

**目标**: 消除所有构建警告和错误

**已知问题**:
1. `fs`模块在浏览器环境（KmsSigner.ts）
2. `@typescript-eslint/naming-convention` 类型信息缺失
3. `headers not applied when exporting`
4. React 19 + Next.js 15.1.9 兼容性

**动作清单**:
1. [ ] 分析构建日志，列出所有警告
2. [ ] 修复KmsSigner.ts的fs导入（条件导入或polyfill）
3. [ ] 修复ESLint配置（Phase 1完成后应解决）
4. [ ] 评估headers配置：静态导出不支持，需决策
5. [ ] 修复React 19兼容性问题（降级或升级）
6. [ ] 运行 `next build`，验证零警告

**成功标准**: `next build` 输出无warning/error

---

## Phase 3: 安全头真正化 [检查点3]

**目标**: HTTP响应头发送安全头（非meta标签）

**方案对比**:
- 方案A: Cloudflare Pages (`_headers` 文件) — 支持自定义HTTP头
- 方案B: Vercel Edge Middleware — 需要Next.js原生模式
- 方案C: 保持现状+增强meta标签（不够A+）

**决策**: 评估后选择最优。Cloudflare Pages方案最干净。

**动作清单**:
1. [ ] 评估三种方案的迁移成本
2. [ ] 如选Cloudflare：创建`_headers`文件，配置所有安全头
3. [ ] 如选Vercel Middleware：创建middleware.ts配置安全头
4. [ ] 部署验证：curl -I 检查所有安全头存在
5. [ ] 安全扫描：securityheaders.com 评分A+

**成功标准**: securityheaders.com 评分 ≥ A

---

## Phase 4: 性能优化 [检查点4]

**目标**: Lighthouse 95+（全维度）

**动作清单**:
1. [ ] 运行Lighthouse基线测试（记录当前分数）
2. [ ] 图片优化：转换为WebP/AVIF，添加srcset
3. [ ] 字体优化：font-display: swap，预连接
4. [ ] JS代码分割：动态导入非关键组件
5. [ ] CSS关键路径内联
6. [ ] 添加Service Worker（可选缓存策略）
7. [ ] 重新测试Lighthouse，验证95+

**成功标准**: Lighthouse Performance ≥ 95, Accessibility ≥ 95, Best Practices ≥ 95, SEO ≥ 95

---

## Phase 5: 可访问性完美化 [检查点5]

**目标**: WCAG 2.1 AA级零警告

**动作清单**:
1. [ ] 使用axe-core或Pa11y扫描全站
2. [ ] 修复所有图片alt文本缺失
3. [ ] 修复颜色对比度（AA标准 4.5:1）
4. [ ] 修复键盘导航焦点顺序
5. [ ] 修复ARIA标签错误/缺失
6. [ ] 修复表单标签关联
7. [ ] 验证：零可访问性警告

**成功标准**: axe-core扫描零违规

---

## Phase 6: 代码质量最终提升 [检查点6]

**目标**: A+级代码质量

**动作清单**:
1. [ ] 运行测试套件，确认391 tests passing
2. [ ] 检查测试覆盖率报告（目标>90%）
3. [ ] 统一合约版本号（v2.0.0）
4. [ ] 清理console.log/warn/error（address-check.js, wallet-connect.js）
5. [ ] 运行Slither静态分析（合约安全）
6. [ ] 运行Mythril符号执行（合约安全）
7. [ ] 添加形式验证注释（可选高级）

**成功标准**: 零Slither HIGH/CRITICAL，覆盖率>90%

---

## Phase 7: Subgraph部署 [检查点7]

**目标**: 完整的链上数据索引

**动作清单**:
1. [ ] 填入Sepolia合约地址到subgraph.yaml
2. [ ] 运行 `graph codegen && graph build`
3. [ ] 部署到The Graph Studio
4. [ ] 验证索引同步正常
5. [ ] 添加前端查询示例

**成功标准**: Subgraph在线同步，API可查询

---

## Phase 8: 最终验证与报告 [检查点8]

**动作清单**:
1. [ ] 运行完整测试套件
2. [ ] 部署到生产环境
3. [ ] Post-Deploy Checklist（10项全通过）
4. [ ] Lighthouse全维度95+
5. [ ] securityheaders.com A+
6. [ ] 可访问性扫描零违规
7. [ ] 生成最终A+审计报告
8. [ ] 提交Git tag v2.7.0（A+版本）

**成功标准**: 全维度A+，生产环境验证通过

---

## 执行规则

1. **中断重启**: 任何Phase中断后，先读取此文件，从当前检查点继续
2. **Token不限制**: 每个Phase可执行多轮，不限制工具调用次数
3. **失败回退**: Phase内步骤失败时，记录原因，尝试替代方案
4. **交付标准**: 只有Phase全部完成才标记✅，部分完成标记⏳
5. **最终交付**: Phase 8完成后，向用户汇报完整A+审计报告

---

## 执行状态

| Phase | 状态 | 完成时间 | 备注 |
|-------|------|----------|------|
| Phase 1: ESLint | ✅ 已完成 | 2026-08-03 | v9 flat config, 零warning |
| Phase 2: Next.js构建 | ✅ 已完成 | 2026-08-03 | 零构建错误，移除无效headers配置 |
| Phase 3: 安全头 | ✅ 已完成 | 2026-08-03 | _headers + vercel.json 双平台配置 |
| Phase 4: 性能 | ⏳ 进行中 | - | Lighthouse基线测试 |
| Phase 5: 可访问性 | ⏳ 未开始 | - | - |
| Phase 6: 代码质量 | ⏳ 未开始 | - | - |
| Phase 7: Subgraph | ⏳ 未开始 | - | - |
| Phase 8: 最终验证 | ⏳ 未开始 | - | - |
