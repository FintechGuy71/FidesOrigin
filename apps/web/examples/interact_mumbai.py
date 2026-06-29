#!/usr/bin/env python3
"""
FidesOrigin Mumbai 测试网智能合约交互示例 (Python web3.py)

使用方法:
    pip install web3 python-dotenv
    python examples/interact_mumbai.py

环境变量 (添加到 .env 文件):
    PRIVATE_KEY=your_private_key
    MUMBAI_RPC_URL=https://polygon-mumbai.g.alchemy.com/v2/YOUR_API_KEY
"""

import os
import json
from typing import Dict, Any, List
from dataclasses import dataclass
from decimal import Decimal

from web3 import Web3
from eth_account import Account
from dotenv import load_dotenv

# 加载环境变量
load_dotenv()


@dataclass
class ContractConfig:
    """合约配置"""
    address: str
    abi: List[Dict[str, Any]]


class FidesOriginMumbaiClient:
    """FidesOrigin Mumbai 测试网智能合约交互客户端"""
    
    # Mumbai 网络配置
    MUMBAI_CHAIN_ID = 80001
    MUMBAI_RPC_URL = os.getenv('MUMBAI_RPC_URL', 'https://rpc-mumbai.maticvigil.com')
    
    def __init__(self, private_key: str = None, rpc_url: str = None):
        """
        初始化客户端
        
        Args:
            private_key: 钱包私钥 (0x 开头)
            rpc_url: RPC 节点 URL
        """
        self.private_key = private_key or os.getenv('PRIVATE_KEY')
        if not self.private_key:
            raise ValueError("Private key is required. Set PRIVATE_KEY environment variable.")
        
        # 初始化 Web3
        self.rpc_url = rpc_url or self.MUMBAI_RPC_URL
        self.w3 = Web3(Web3.HTTPProvider(self.rpc_url))
        
        if not self.w3.is_connected():
            raise ConnectionError(f"Failed to connect to {self.rpc_url}")
        
        # 初始化账户
        self.account = Account.from_key(self.private_key)
        self.address = self.account.address
        
        print(f"✅ Connected to Mumbai Testnet")
        print(f"👤 Account: {self.address}")
        print(f"💰 Balance: {self.get_matic_balance():.6f} MATIC")
        
        # 加载合约
        self._load_contracts()
    
    def _load_contracts(self):
        """从部署文件加载合约"""
        try:
            deployment_path = os.path.join(
                os.path.dirname(__file__), '..', 'deployments', 'mumbai.json'
            )
            with open(deployment_path, 'r') as f:
                deployment = json.load(f)
            
            contracts = deployment.get('contracts', {})
            
            # 加载 FidesCompliance
            if 'FidesCompliance' in contracts:
                fc_info = contracts['FidesCompliance']
                self.fides_compliance = self.w3.eth.contract(
                    address=Web3.to_checksum_address(fc_info['address']),
                    abi=fc_info['abi']
                )
                print(f"📄 FidesCompliance: {fc_info['address']}")
            
            # 加载 TestUSD
            if 'TestUSD' in contracts:
                tusd_info = contracts['TestUSD']
                self.test_usd = self.w3.eth.contract(
                    address=Web3.to_checksum_address(tusd_info['address']),
                    abi=tusd_info['abi']
                )
                print(f"📄 TestUSD: {tusd_info['address']}")
                
        except FileNotFoundError:
            print("⚠️  Deployment file not found. Run deployment script first.")
            self.fides_compliance = None
            self.test_usd = None
    
    # ==================== MATIC 基础操作 ====================
    
    def get_matic_balance(self, address: str = None) -> float:
        """获取 MATIC 余额"""
        addr = address or self.address
        balance_wei = self.w3.eth.get_balance(Web3.to_checksum_address(addr))
        return self.w3.from_wei(balance_wei, 'ether')
    
    def send_matic(self, to: str, amount_matic: float) -> str:
        """发送 MATIC"""
        tx = {
            'to': Web3.to_checksum_address(to),
            'value': self.w3.to_wei(amount_matic, 'ether'),
            'gas': 21000,
            'maxFeePerGas': self.w3.to_wei('50', 'gwei'),
            'maxPriorityFeePerGas': self.w3.to_wei('2', 'gwei'),
            'nonce': self.w3.eth.get_transaction_count(self.address),
            'chainId': self.MUMBAI_CHAIN_ID,
        }
        
        signed_tx = self.w3.eth.account.sign_transaction(tx, self.private_key)
        tx_hash = self.w3.eth.send_raw_transaction(signed_tx.rawTransaction)
        
        print(f"📤 MATIC transfer sent: {tx_hash.hex()}")
        receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash)
        print(f"✅ Confirmed in block {receipt['blockNumber']}")
        
        return tx_hash.hex()
    
    # ==================== TestUSD 代币操作 ====================
    
    def get_tusd_balance(self, address: str = None) -> Decimal:
        """获取 TUSD 余额"""
        if not self.test_usd:
            raise RuntimeError("TestUSD contract not loaded")
        
        addr = address or self.address
        balance = self.test_usd.functions.balanceOf(
            Web3.to_checksum_address(addr)
        ).call()
        
        return Decimal(balance) / Decimal(10**18)
    
    def transfer_tusd(self, to: str, amount: float) -> str:
        """转账 TUSD"""
        if not self.test_usd:
            raise RuntimeError("TestUSD contract not loaded")
        
        amount_wei = int(amount * 10**18)
        
        tx = self.test_usd.functions.transfer(
            Web3.to_checksum_address(to),
            amount_wei
        ).build_transaction({
            'from': self.address,
            'nonce': self.w3.eth.get_transaction_count(self.address),
            'gas': 100000,
            'maxFeePerGas': self.w3.to_wei('50', 'gwei'),
            'maxPriorityFeePerGas': self.w3.to_wei('2', 'gwei'),
            'chainId': self.MUMBAI_CHAIN_ID,
        })
        
        signed_tx = self.w3.eth.account.sign_transaction(tx, self.private_key)
        tx_hash = self.w3.eth.send_raw_transaction(signed_tx.rawTransaction)
        
        print(f"📤 TUSD transfer sent: {tx_hash.hex()}")
        receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash)
        print(f"✅ Confirmed in block {receipt['blockNumber']}")
        
        return tx_hash.hex()
    
    def approve_tusd(self, spender: str, amount: float) -> str:
        """授权 TUSD 额度"""
        if not self.test_usd:
            raise RuntimeError("TestUSD contract not loaded")
        
        amount_wei = int(amount * 10**18)
        
        tx = self.test_usd.functions.approve(
            Web3.to_checksum_address(spender),
            amount_wei
        ).build_transaction({
            'from': self.address,
            'nonce': self.w3.eth.get_transaction_count(self.address),
            'gas': 100000,
            'maxFeePerGas': self.w3.to_wei('50', 'gwei'),
            'maxPriorityFeePerGas': self.w3.to_wei('2', 'gwei'),
            'chainId': self.MUMBAI_CHAIN_ID,
        })
        
        signed_tx = self.w3.eth.account.sign_transaction(tx, self.private_key)
        tx_hash = self.w3.eth.send_raw_transaction(signed_tx.rawTransaction)
        
        print(f"📤 TUSD approval sent: {tx_hash.hex()}")
        receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash)
        print(f"✅ Confirmed in block {receipt['blockNumber']}")
        
        return tx_hash.hex()
    
    def get_tusd_info(self) -> Dict[str, Any]:
        """获取 TUSD 合约信息"""
        if not self.test_usd:
            raise RuntimeError("TestUSD contract not loaded")
        
        info = self.test_usd.functions.getContractInfo().call()
        return {
            'name': info[0],
            'symbol': info[1],
            'decimals': info[2],
            'total_supply': Decimal(info[3]) / Decimal(10**18),
            'vip_count': info[4],
            'grey_count': info[5],
            'black_count': info[6],
            'paused': info[7],
        }
    
    def faucet(self) -> str:
        """从水龙头获取测试代币"""
        if not self.test_usd:
            raise RuntimeError("TestUSD contract not loaded")
        
        tx = self.test_usd.functions.faucet().build_transaction({
            'from': self.address,
            'nonce': self.w3.eth.get_transaction_count(self.address),
            'gas': 100000,
            'maxFeePerGas': self.w3.to_wei('50', 'gwei'),
            'maxPriorityFeePerGas': self.w3.to_wei('2', 'gwei'),
            'chainId': self.MUMBAI_CHAIN_ID,
        })
        
        signed_tx = self.w3.eth.account.sign_transaction(tx, self.private_key)
        tx_hash = self.w3.eth.send_raw_transaction(signed_tx.rawTransaction)
        
        print(f"📤 Faucet request sent: {tx_hash.hex()}")
        receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash)
        print(f"✅ Received 1000 TUSD (block {receipt['blockNumber']})")
        
        return tx_hash.hex()
    
    # ==================== FidesCompliance 合规操作 ====================
    
    def get_compliance_stats(self) -> Dict[str, Any]:
        """获取合规合约统计信息"""
        if not self.fides_compliance:
            raise RuntimeError("FidesCompliance contract not loaded")
        
        stats = self.fides_compliance.functions.getStats().call()
        return {
            'total_risk_profiles': stats[0],
            'total_rules': stats[1],
            'active_rules': stats[2],
            'total_audit_logs': stats[3],
            'daily_tx_count': stats[4],
            'daily_tx_volume': Decimal(stats[5]) / Decimal(10**18),
            'is_paused': stats[6],
            'strict_mode': stats[7],
            'audit_mode': stats[8],
        }
    
    def check_risk_profile(self, address: str) -> Dict[str, Any]:
        """查询地址风险画像"""
        if not self.fides_compliance:
            raise RuntimeError("FidesCompliance contract not loaded")
        
        profile = self.fides_compliance.functions.getRiskProfile(
            Web3.to_checksum_address(address)
        ).call()
        
        risk_levels = ['UNKNOWN', 'WHITELIST', 'LOW', 'MEDIUM', 'HIGH', 'BLACKLIST']
        
        return {
            'level': risk_levels[profile[0]] if profile[0] < len(risk_levels) else 'UNKNOWN',
            'score': profile[1],
            'tags': profile[2],
            'last_updated': profile[3],
            'updated_by': profile[4],
            'reason_hash': profile[5].hex(),
            'exists': profile[6],
        }
    
    def evaluate_transaction(self, from_addr: str, to_addr: str, amount: float) -> Dict[str, Any]:
        """评估交易合规性"""
        if not self.fides_compliance:
            raise RuntimeError("FidesCompliance contract not loaded")
        
        amount_wei = int(amount * 10**18)
        
        # 注意：这是一个 view 函数，不需要发送交易
        result = self.fides_compliance.functions.evaluateTransaction(
            Web3.to_checksum_address(from_addr),
            Web3.to_checksum_address(to_addr),
            amount_wei
        ).call()
        
        return {
            'compliant': result[0],
            'reason': result[1],
        }
    
    # ==================== 管理功能（需要特定角色） ====================
    
    def update_risk_profile(self, address: str, level: int, score: int, 
                           tags: List[str], reason_hash: str) -> str:
        """
        更新风险画像 (需要 OPERATOR_ROLE)
        
        Risk Levels:
            0: UNKNOWN
            1: WHITELIST
            2: LOW
            3: MEDIUM
            4: HIGH
            5: BLACKLIST
        """
        if not self.fides_compliance:
            raise RuntimeError("FidesCompliance contract not loaded")
        
        tx = self.fides_compliance.functions.updateRiskProfile(
            Web3.to_checksum_address(address),
            level,
            score,
            tags,
            bytes.fromhex(reason_hash.replace('0x', ''))
        ).build_transaction({
            'from': self.address,
            'nonce': self.w3.eth.get_transaction_count(self.address),
            'gas': 200000,
            'maxFeePerGas': self.w3.to_wei('50', 'gwei'),
            'maxPriorityFeePerGas': self.w3.to_wei('2', 'gwei'),
            'chainId': self.MUMBAI_CHAIN_ID,
        })
        
        signed_tx = self.w3.eth.account.sign_transaction(tx, self.private_key)
        tx_hash = self.w3.eth.send_raw_transaction(signed_tx.rawTransaction)
        
        print(f"📤 Risk profile update sent: {tx_hash.hex()}")
        receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash)
        print(f"✅ Confirmed in block {receipt['blockNumber']}")
        
        return tx_hash.hex()


def main():
    """示例用法"""
    print("=" * 70)
    print("🚀 FidesOrigin Mumbai Python SDK Demo")
    print("=" * 70)
    
    # 初始化客户端
    client = FidesOriginMumbaiClient()
    
    print("\n" + "-" * 70)
    print("💰 代币余额")
    print("-" * 70)
    print(f"MATIC Balance: {client.get_matic_balance():.6f} MATIC")
    
    if client.test_usd:
        print(f"TUSD Balance: {client.get_tusd_balance():.2f} TUSD")
        
        print("\n" + "-" * 70)
        print("📊 TUSD 合约信息")
        print("-" * 70)
        info = client.get_tusd_info()
        for key, value in info.items():
            print(f"  {key}: {value}")
    
    if client.fides_compliance:
        print("\n" + "-" * 70)
        print("📊 合规合约统计")
        print("-" * 70)
        stats = client.get_compliance_stats()
        for key, value in stats.items():
            print(f"  {key}: {value}")
        
        print("\n" + "-" * 70)
        print("🔍 风险画像查询")
        print("-" * 70)
        profile = client.check_risk_profile(client.address)
        for key, value in profile.items():
            print(f"  {key}: {value}")
    
    print("\n" + "=" * 70)
    print("✅ Demo Complete!")
    print("=" * 70)


if __name__ == '__main__':
    main()
