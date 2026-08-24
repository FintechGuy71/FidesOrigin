"""
FidesOrigin v3.1.0 — Etherscan V2 直接验证（Python 版，走系统代理）

原理：
  1. build-info 的 input 即标准 JSON 输入（与链上编译设置逐位一致）
  2. 构造参数从链上合约创建交易提取（initcode 之后的字节）
  3. 提交 solidity-standard-json-input 验证，轮询结果

用法：
  python scripts/verify_etherscan_direct.py   （ETHERSCAN_API_KEY 环境变量或下方默认值）
"""

import json
import os
import sys
import time
import urllib.parse
import urllib.request

API_KEY = os.environ.get("ETHERSCAN_API_KEY", "ABQJNS57VYBYH7K3MSCQB4TWKVSB54QPXC")
V2 = "https://api.etherscan.io/v2/api"
CHAIN_ID = "11155111"
ROOT = os.path.join(os.path.dirname(__file__), "..")

TARGETS = [
    ("0xD104b05442F5032f6BCF7a4F90dfff58D9a4FBf3", "contracts/FidesCompliance.sol:FidesCompliance"),
    ("0x2426e26f6182052eD4a6B0b0ac176Dc42B2C5F08", "contracts/RiskRegistry.sol:RiskRegistry"),
    ("0x0A0db0D56A345710591174726270CAe544D9b0e2", "contracts/PolicyEngine.sol:PolicyEngine"),
    ("0xdF36A8b16F064308eeDE21A740FAc4e87b724F0E", "contracts/DiamondComplianceEngine.sol:DiamondComplianceEngine"),
    ("0x496A674FACE2722b7dD62b25d58F73BF7D141a99", "contracts/facets/DiamondCutFacet.sol:DiamondCutFacet"),
    ("0x3d9C891145226Bc49D43a82Ec3cc95Ff526EBeE3", "contracts/facets/DiamondLoupeFacet.sol:DiamondLoupeFacet"),
    ("0x96cA1BD56bC5390Bac134Da165318f0C3e3FC20B", "contracts/facets/ComplianceCoreFacet.sol:ComplianceCoreFacet"),
    ("0xD80Ccee6167818E307bbAF436060003EeB6e415d", "contracts/facets/AssetComplianceFacet.sol:AssetComplianceFacet"),
    ("0x3C99EF323832FB723A6eff4A43B03A03b8CC3917", "contracts/facets/WalletComplianceFacet.sol:WalletComplianceFacet"),
    ("0xdB06c51C26bc3e8fdF541EcC31b3669F4E5cD7A7", "contracts/facets/AdminFacet.sol:AdminFacet"),
    ("0x6803E163259B07F58111f56423aB0732858196Be", "contracts/QuarantineVault.sol:QuarantineVault"),
    ("0x31A034efbe22eDc1a78ceb37F52BA869D869c33B", "contracts/MerkleRiskRegistry.sol:MerkleRiskRegistry"),
    ("0x34c76eE51f3A063365279f510dA9503dF809D374", "contracts/TestUSD.sol:TestUSD"),
    ("0x2245A8FCf6aca017327eA8950Ba510e9596595E9", "contracts/examples/CompliantStableCoin.sol:CompliantStableCoin"),
]


def es(params, method="GET"):
    # V2 API：chainid 与 apikey 必须在 URL 查询串（POST 的验证接口亦然）
    qs = urllib.parse.urlencode({"chainid": CHAIN_ID, "apikey": API_KEY})
    if method == "GET":
        req = urllib.request.Request(f"{V2}?{qs}&" + urllib.parse.urlencode(params))
    else:
        body = urllib.parse.urlencode(params).encode()
        req = urllib.request.Request(f"{V2}?{qs}", data=body, method="POST")
    with urllib.request.urlopen(req, timeout=120) as r:
        out = json.load(r)
    time.sleep(0.3)  # 免费档 5 req/s
    return out


def get_creation_input(address):
    c = es({"module": "contract", "action": "getcontractcreation", "contractaddresses": address})
    if c.get("status") != "1" or not c.get("result") or not c["result"][0].get("txHash"):
        raise RuntimeError(f"creation tx 未找到: {json.dumps(c)[:120]}")
    tx = es({"module": "proxy", "action": "eth_getTransactionByHash", "txhash": c["result"][0]["txHash"]})
    return tx["result"]["input"]


def find_build_info():
    """自动发现 build-info：标准 artifacts 目录（CI）或本地时间戳目录"""
    root = os.path.join(os.path.dirname(__file__), "..")
    candidates = []
    std = os.path.join(root, "artifacts", "build-info")
    if os.path.isdir(std):
        candidates += [os.path.join(std, f) for f in os.listdir(std)]
    # 本地沙箱用时间戳目录（artifacts-v*/）
    for d in sorted(os.listdir(root)):
        if d.startswith("artifacts-v"):
            p = os.path.join(root, d, "build-info")
            if os.path.isdir(p):
                candidates += [os.path.join(p, f) for f in os.listdir(p)]
    if not candidates:
        raise RuntimeError("未找到 build-info（先 npx hardhat compile）")
    return max(candidates, key=os.path.getmtime)


def main():
    bi_file = find_build_info()
    with open(bi_file, encoding="utf-8") as f:
        bi = json.load(f)
    solc = bi["solcLongVersion"]
    standard_input = json.dumps(bi["input"])
    print(f"build-info: {os.path.basename(bi_file)}")
    print(f"solc: v{solc} | 源文件: {len(bi['input']['sources'])} | input {len(standard_input) // 1024}KB\n")

    results = {}
    for address, contract_name in TARGETS:
        label = f"{contract_name.split(':')[1]} ({address[:10]}...)"
        try:
            src_path, contract = contract_name.split(":")
            artifact = bi["output"]["contracts"].get(src_path, {}).get(contract)
            if not artifact:
                raise RuntimeError("build-info 无此合约")
            creation_code = artifact["evm"]["bytecode"]["object"]

            tx_input = get_creation_input(address)
            if not tx_input.lower().startswith("0x" + creation_code.lower()):
                raise RuntimeError("链上创建码与 build-info 不一致")
            ctor_args = tx_input[2 + len(creation_code):]

            resp = es({
                "module": "contract", "action": "verifysourcecode",
                "codeFormat": "solidity-standard-json-input",
                "contractaddress": address, "contractname": contract_name,
                "compilerversion": "v" + solc, "optimizationUsed": "1", "runs": "1",
                "constructorArguements": ctor_args, "sourceCode": standard_input,
            }, method="POST")
            result = resp.get("result")
            # V2 成功返回 50 位 base32 风格 GUID（非 0x 前缀）
            guid_ok = isinstance(result, str) and len(result) >= 30 and " " not in result
            if resp.get("status") != "1" or not guid_ok:
                msg = result if isinstance(result, str) else json.dumps(resp)
                if "already verified" in msg.lower():
                    print(f"⏭️  {label}: 已验证")
                    results[label] = "already"
                    continue
                raise RuntimeError("提交失败: " + msg[:150])
            guid = result

            verdict = "timeout"
            for _ in range(12):
                time.sleep(10)
                st = es({"module": "contract", "action": "checkverifystatus", "guid": guid})
                r = st.get("result", "") if isinstance(st.get("result"), str) else ""
                if "pass" in r.lower():
                    verdict = "pass"; break
                if "fail" in r.lower():
                    verdict = "fail: " + r[:120]; break
            print(("✅ " if verdict == "pass" else "❌ ") + f"{label}: {verdict}")
            results[label] = verdict
        except Exception as e:
            print(f"❌ {label}: {str(e)[:120]}")
            results[label] = "error: " + str(e)[:80]

    ok = sum(1 for v in results.values() if v in ("pass", "already"))
    print(f"\n═══ 验证完成: {ok}/{len(results)} 通过 ═══")
    out = os.path.join(ROOT, "deployments", "etherscan-verify-v3.1.0.json")
    with open(out, "w", encoding="utf-8") as f:
        json.dump({"timestamp": time.strftime("%Y-%m-%dT%H:%M:%S"), "results": results}, f, ensure_ascii=False, indent=2)
    print("结果已存:", out)


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main()
