# 视觉回归测试

## 运行

```bash
pnpm test:visual          # 或 npx playwright test
```

自动起静态服务（test/visual/static-server.mjs → out/），无需手动起 dev server。
先 `npm run build` 生成最新 out/。

## 基线更新（重要）

基线截图（`*-linux.png`）是 **Linux 渲染结果**，由 CI 生成/回提。
Windows/macOS 本地字体亚像素渲染不同，不要在本地 `--update-snapshots` 提交基线。

**有意的视觉变更后**（设计系统、组件、文案改动），必须在 Linux 环境重生成：

```bash
# CI 容器或 WSL 内
npx playwright test --update-snapshots
```

然后连快照目录一起提交。2% 像素阈值只拦真实回归，不拦亚像素差。

## 覆盖面

- `visual.spec.ts`：9 个桌面页面首屏 + 2 个移动端首屏 + 页脚法律行
- `mobile-audit.spec.ts`：28 个页面 375px 横向溢出检测（含元凶元素定位）
- `interaction.spec.ts`：交互路径

动效确定性：全程 `reducedMotion: 'reduce'`（全站动效遵循该媒体查询），
canvas 与实时筛查结果遮罩。
