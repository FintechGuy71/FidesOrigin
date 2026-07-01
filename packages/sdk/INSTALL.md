# @fidesorigin/sdk 安装指南

此包发布在 **GitHub Packages** 私有 registry 上。

## 1. 获取 GitHub Personal Access Token

访问 [GitHub Settings → Developer settings → Personal access tokens](https://github.com/settings/tokens) 创建一个 token：

- **权限要求**：勾选 `read:packages`
- 如果还需要发布，额外勾选 `write:packages`

## 2. 在消费者项目中配置 `.npmrc`

在项目根目录创建或编辑 `.npmrc`：

```ini
@fidesorigin:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=ghp_xxxxxxxxxxxx
```

> ⚠️ **安全提示**：不要将 token 提交到 Git。建议使用环境变量：
> ```ini
> //npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
> ```
> 然后在 CI/CD 或本地设置 `GITHUB_TOKEN` 环境变量。

## 3. 安装 SDK

```bash
npm install @fidesorigin/sdk
# 或
pnpm add @fidesorigin/sdk
# 或
yarn add @fidesorigin/sdk
```

## 4. 使用示例

```typescript
import { FidesOriginClient } from '@fidesorigin/sdk';

const client = new FidesOriginClient({
  apiKey: 'your-api-key',
});

const result = await client.assessRisk({
  address: '0x...',
});
```

## 5. React Hook 用法

```tsx
import { useRiskAssessment } from '@fidesorigin/sdk/react';

function CompliancePanel({ address }: { address: string }) {
  const { data, loading, error } = useRiskAssessment(address);
  // ...
}
```
