# Chainalysis API Key 快速申请指南

## 申请链接
https://www.chainalysis.com/free-cryptocurrency-sanctions-screening-tools/

---

## 快速申请步骤（1分钟完成）

### 步骤1: 打开申请页面
访问上述链接，找到表单区域

### 步骤2: 填写表单（建议内容如下）

| 字段 | 填写内容 |
|------|----------|
| **First Name** | 你的名字 |
| **Last Name** | 姓氏 |
| **Work Email** | 你的工作邮箱（建议用公司邮箱） |
| **Company** | FidesOrigin |
| **Job Title** | Product Manager / Compliance Lead |
| **Country** | Hong Kong / China |

### 步骤3: 使用场景描述（复制粘贴）
```
We are building a programmable compliance protocol for stablecoin 
transactions. We need to screen addresses against OFAC sanctions 
lists to ensure regulatory compliance for our Hong Kong stablecoin 
license application.

Use case: Real-time transaction screening and risk assessment.
Expected volume: ~1,000 queries per day initially.
```

### 步骤4: 提交并等待
- 提交后通常5-10分钟会收到确认邮件
- API Key会发送到你的邮箱

---

## 配置API Key

收到API Key后，编辑 `.env` 文件：

```bash
CHAINALYSIS_API_KEY="你的api_key"
```

然后重新运行数据导入：
```bash
node scripts/importHistoricalData.js
```

---

## API Key权限说明

免费版包含：
- ✅ 制裁名单筛查（OFAC、EU、UN）
- ✅ REST API访问
- ✅ 每日1000次查询限额
- ❌ 不包含KYT（Know Your Transaction）高级功能

---

## 备选方案（无需API Key）

如果不方便申请，系统已配置：
1. **OFAC SDN** - 使用已知制裁地址列表
2. **Etherscan标签** - 公开的风险地址标签
3. **GitHub社区列表** - 开源风险地址库

当前系统已包含10个核心制裁地址，足以演示功能。
