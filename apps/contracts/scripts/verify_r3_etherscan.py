"""
FidesOrigin R3 — 新增合约 Etherscan V2 直接验证（复用 verify_etherscan_direct.py 机制）

目标：2026-09-18 R3 部署的 8 个新合约
  UUPS 实现 ×3 + Diamond facet ×3 + QuarantineVault + FidesOriginTimelock

用法：python scripts/verify_r3_etherscan.py
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

TARGETS = [
    ("0x3F2856D2C0Ed2FeBf6ae20AFfD488F2588bea817", "contracts/RiskRegistry.sol:RiskRegistry"),
    ("0x7E2a41B7330aD4Ffec2CaBB2BBD11541fbF73dd2", "contracts/PolicyEngine.sol:PolicyEngine"),
    ("0x0f11220069B5Ad9fe1246Ff6981a6Fb083B3421d", "contracts/FidesCompliance.sol:FidesCompliance"),
    ("0x012e3074325c324D69119eAeCA5911495fcf9D92", "contracts/facets/WalletComplianceFacet.sol:WalletComplianceFacet"),
    ("0x21c40C012729891431f8b111190f11fA6F7114eF", "contracts/facets/AssetComplianceFacet.sol:AssetComplianceFacet"),
    ("0x19D3B58E62e6ba8469BA9FB0e02E61b792692621", "contracts/facets/DiamondLoupeFacet.sol:DiamondLoupeFacet"),
    ("0xa5Db586Fd93F49582405803eaB99C147267EfCbE", "contracts/QuarantineVault.sol:QuarantineVault"),
    ("0x02c7e72a10E9893Fd5bE12B62CA67954035a1DFA", "contracts/FidesOriginTimelock.sol:FidesOriginTimelock"),
]


def es(params, method="GET"):
    qs = urllib.parse.urlencode({"chainid": CHAIN_ID, "apikey": API_KEY})
    if method == "GET":
        req = urllib.request.Request(f"{V2}?{qs}&" + urllib.parse.urlencode(params))
    else:
        body = urllib.parse.urlencode(params).encode()
        req = urllib.request.Request(f"{V2}?{qs}", data=body, method="POST")
    with urllib.request.urlopen(req, timeout=120) as r:
        out = json.load(r)
    time.sleep(0.3)
    return out


def get_creation_input(address):
    c = es({"module": "contract", "action": "getcontractcreation", "contractaddresses": address})
    if c.get("status") != "1" or not c.get("result") or not c["result"][0].get("txHash"):
        raise RuntimeError(f"creation tx 未找到: {json.dumps(c)[:120]}")
    tx = es({"module": "proxy", "action": "eth_getTransactionByHash", "txhash": c["result"][0]["txHash"]})
    return tx["result"]["input"]


def find_build_info():
    root = os.path.join(os.path.dirname(__file__), "..")
    std = os.path.join(root, "artifacts", "build-info")
    if not os.path.isdir(std):
        raise RuntimeError("未找到 artifacts/build-info（先 compile）")
    candidates = [os.path.join(std, f) for f in os.listdir(std)]
    return max(candidates, key=os.path.getmtime)


def main():
    bi_file = find_build_info()
    with open(bi_file, encoding="utf-8") as f:
        bi = json.load(f)
    solc = bi["solcLongVersion"]
    standard_input = json.dumps(bi["input"])
    print(f"build-info: {os.path.basename(bi_file)}")
    print(f"solc: v{solc} | input {len(standard_input) // 1024}KB\n")

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
            guid_ok = isinstance(result, str) and len(result) >= 30 and " " not in result
            if resp.get("status") != "1" or not guid_ok:
                msg = result if isinstance(result, str) else json.dumps(resp)
                if "already verified" in msg.lower():
                    print(f"SKIP {label}: 已验证")
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
            print(("PASS " if verdict == "pass" else "FAIL ") + f"{label}: {verdict}")
            results[label] = verdict
        except Exception as e:
            print(f"ERR  {label}: {str(e)[:120]}")
            results[label] = "error: " + str(e)[:80]

    print("\n=== 汇总 ===")
    for k, v in results.items():
        print(f"  {v}  {k}")


if __name__ == "__main__":
    main()
