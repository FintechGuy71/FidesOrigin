#!/usr/bin/env python3
"""
Slither 门禁：解析 slither JSON 输出，对 High/Critical 卡 CI。

[2026-09-20 #6] 深度安全扫描落地为可重复关卡。基线（R3 后，112 合约 / 102 检测器）：
  Critical=0, High=0, Medium=46（多为 unused-return / incorrect-equality 误报类）。
本门禁只在出现 High/Critical 时失败，Medium 仅计数报告——避免把 slither 的
启发式 Medium（如 reentrancy-no-eth 不识别 nonReentrant 修饰符）当硬门禁。

用法：python scripts/slither_gate.py <slither.json> [--max-high 0] [--max-critical 0]
退出码：0=通过；1=超阈值；2=输入/解析错误。
"""
import json
import sys
from collections import Counter

SEVERITY_ORDER = ["Critical", "High", "Medium", "Low", "Informational", "Optimization"]


def main(argv):
    if len(argv) < 2:
        print("usage: slither_gate.py <slither.json> [--max-high N] [--max-critical N]")
        return 2
    path = argv[1]
    max_high = 0
    max_critical = 0
    i = 2
    while i < len(argv):
        if argv[i] == "--max-high":
            max_high = int(argv[i + 1]); i += 2
        elif argv[i] == "--max-critical":
            max_critical = int(argv[i + 1]); i += 2
        else:
            i += 1

    try:
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
    except (OSError, json.JSONDecodeError) as e:
        print("GATE ERROR: cannot read/parse %s: %s" % (path, e))
        return 2

    detectors = data.get("results", {}).get("detectors", [])
    counts = Counter(d.get("impact", "Unknown") for d in detectors)

    print("=== Slither 门禁结果 ===")
    for sev in SEVERITY_ORDER:
        if counts.get(sev):
            print("  %-14s %d" % (sev + ":", counts[sev]))
    print("  总检测项:", len(detectors))

    # 列出 High/Critical 明细（若有）
    criticals = [d for d in detectors if d.get("impact") in ("Critical", "High")]
    for d in criticals:
        print("  !! [%s] %s @ %s" % (
            d.get("impact"), d.get("check"),
            d.get("first_markdown_element", "").split("\n")[0][:80]))

    n_high = counts.get("High", 0)
    n_critical = counts.get("Critical", 0)
    if n_critical > max_critical or n_high > max_high:
        print("\nGATE FAIL: Critical=%d(max %d) High=%d(max %d)" % (
            n_critical, max_critical, n_high, max_high))
        return 1
    print("\nGATE PASS: Critical=%d High=%d 均在阈值内" % (n_critical, n_high))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
