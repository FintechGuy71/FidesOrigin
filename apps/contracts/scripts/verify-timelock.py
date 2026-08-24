# 复用 verify_etherscan_direct.py 的机制验证 Timelock（覆盖 TARGETS）
import importlib.util
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("ve", os.path.join(HERE, "verify_etherscan_direct.py"))
ve = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ve)

ve.TARGETS = [
    ("0x04B2Fc88b57AE8d8E6cE26d93294E3511cFbb247", "contracts/FidesOriginTimelock.sol:FidesOriginTimelock"),
]
ve.main()
