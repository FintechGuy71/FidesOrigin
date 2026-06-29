# Etherscan API Key 申请指南

## 申请链接
https://etherscan.io/apis

---

## 快速申请步骤（2分钟完成）

### 步骤1: 注册Etherscan账户
1. 访问 https://etherscan.io/register
2. 填写邮箱、用户名、密码
3. 验证邮箱

### 步骤2: 创建API Key
1. 登录后访问 https://etherscan.io/myapikey
2. 点击 "Create API Key"
3. 输入App名称（例如：FidesOrigin）
4. 复制生成的API Key

---

## 配置API Key

编辑 `.env` 文件，添加：

```bash
ETHERSCAN_API_KEY="你的api_key"
```

---

## API Key权限说明

免费版包含：
- ✅ 账户交易历史查询
- ✅ 合约ABI获取
- ✅ 合约源码验证
- ✅ 合约创建者信息
- ✅ 5 calls/second 频率限制
- ✅ 每日100,000次调用限额

---

## 测试API Key

```bash
node scripts/checkStatus.js
```

如果显示 `etherscan: ✅ 可用`，则配置成功。

---

## 与现有系统的集成

Etherscan适配器会自动：
1. 获取已知风险合约信息
2. 分析账户交易历史
3. 识别合约创建者
4. 标记高风险地址

---

## 备选数据源

如果暂时无法申请Etherscan API Key，系统已配置：
- ✅ OFAC SDN - 官方制裁名单
- ✅ 开源社区 - Tornado Cash等风险地址
- ✅ Chainalysis - 备用地址列表

总计已有 **19个风险地址** 可用。
