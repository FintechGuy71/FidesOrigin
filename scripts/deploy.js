const hre = require("hardhat");

async function main() {
  console.log("🚀 开始部署 FidesOrigin MVP Demo...\n");

  // 获取部署账户
  const [deployer] = await hre.ethers.getSigners();
  console.log("👤 部署账户:", deployer.address);
  console.log("💰 账户余额:", (await hre.ethers.provider.getBalance(deployer.address)).toString(), "wei\n");

  // 部署 TestUSD 合约
  console.log("📄 正在部署 TestUSD 合约...");
  const TestUSD = await hre.ethers.getContractFactory("TestUSD");
  const testUSD = await TestUSD.deploy();
  await testUSD.waitForDeployment();

  const contractAddress = await testUSD.getAddress();
  console.log("✅ TestUSD 合约已部署到:", contractAddress);

  // 获取合约信息
  const info = await testUSD.getContractInfo();
  console.log("\n📊 合约信息:");
  console.log("  - 名称:", info[0]);
  console.log("  - 符号:", info[1]);
  console.log("  - 精度:", info[2]);
  console.log("  - 总供应量:", hre.ethers.formatUnits(info[3], 18), "TestUSD");
  console.log("  - 黑名单数量:", info[4].toString());
  console.log("  - 所有者:", info[5]);

  // 获取黑名单地址
  const blacklist = await testUSD.getBlacklist();
  console.log("\n🚫 预设黑名单地址:");
  blacklist.forEach((addr, index) => {
    console.log(`  ${index + 1}. ${addr}`);
  });

  // 测试转账功能
  console.log("\n🧪 开始功能测试...\n");

  // 创建测试账户
  const testAccount1 = hre.ethers.Wallet.createRandom().connect(hre.ethers.provider);
  console.log("📝 创建测试账户1:", testAccount1.address);

  // 给测试账户发送 ETH 用于 gas
  await deployer.sendTransaction({
    to: testAccount1.address,
    value: hre.ethers.parseEther("0.1")
  });

  // 向测试账户转账 TestUSD（白名单测试）
  console.log("\n✅ 测试1: 向白名单地址转账");
  const tx1 = await testUSD.transfer(testAccount1.address, hre.ethers.parseUnits("100", 18));
  await tx1.wait();
  const balance1 = await testUSD.balanceOf(testAccount1.address);
  console.log(`   转账成功! 接收方余额: ${hre.ethers.formatUnits(balance1, 18)} TestUSD`);

  // 尝试向黑名单地址转账
  console.log("\n❌ 测试2: 向黑名单地址转账");
  const blacklistAddr = blacklist[0];
  try {
    const tx2 = await testUSD.transfer(blacklistAddr, hre.ethers.parseUnits("100", 18));
    await tx2.wait();
    console.log("   错误: 转账应该被拦截!");
  } catch (error) {
    console.log("   转账被成功拦截!");
    console.log("   错误信息:", error.message.includes("AddressIsBlacklisted") ? "目标地址在黑名单中" : error.message);
  }

  console.log("\n🎉 部署和测试完成!");
  console.log("\n📌 重要地址:");
  console.log("  - 合约地址:", contractAddress);
  console.log("  - 部署者地址:", deployer.address);
  console.log("  - 测试账户1:", testAccount1.address);

  // 保存部署信息到文件
  const fs = require("fs");
  const deploymentInfo = {
    network: hre.network.name,
    contractAddress: contractAddress,
    deployer: deployer.address,
    blacklist: blacklist,
    timestamp: new Date().toISOString()
  };
  fs.writeFileSync("deployment.json", JSON.stringify(deploymentInfo, null, 2));
  console.log("\n💾 部署信息已保存到 deployment.json");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ 部署失败:", error);
    process.exit(1);
  });
