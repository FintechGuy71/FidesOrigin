#!/bin/bash
# 批量更新所有语言版本的 docs/api.html，添加 Subgraph 查询端点

SUBGRAPH_SECTION='
      <h2>Subgraph (GraphQL)</h2>
      <p>Query on-chain compliance data via The Graph subgraph.</p>
      <div class="docs-base-url">
        <code>https://api.studio.thegraph.com/query/1749664/fidesorigin-sepolia/v0.2.0</code>
      </div>
      <p><strong>Network:</strong> Sepolia Testnet | <strong>Version:</strong> v0.2.0</p>

      <h4>Example Query</h4>
      <div class="docs-code-block">
        <div class="docs-code-header">
          <span>GraphQL</span>
          <button class="docs-code-copy" aria-label="Copy code">Copy</button>
        </div>
        <pre><code>{
  riskProfiles(first: 5) {
    id
    riskScore
    tier
    isSanctioned
  }
  complianceChecks(first: 5) {
    id
    from
    to
    decision
    reason
  }
}</code></pre>
      </div>

      <h4>Available Entities</h4>
      <ul>
        <li><code>RiskProfile</code> — On-chain risk profiles</li>
        <li><code>RiskProfileUpdate</code> — Profile update history</li>
        <li><code>ComplianceCheck</code> — Compliance check results</li>
        <li><code>Policy</code> — Issuer policies</li>
        <li><code>PolicyEvaluation</code> — Policy evaluation records</li>
        <li><code>QuarantineRecord</code> — Quarantine vault records</li>
        <li><code>TokenTransfer</code> — Stablecoin transfer events</li>
      </ul>
'

# 文件列表
FILES=(
  "public/docs/api.html"
  "public/cn/docs/api.html"
  "public/tw/docs/api.html"
  "public/jp/docs/api.html"
)

for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    # 在 </main> 之前插入 Subgraph 部分
    # 先找到 </main> 的位置，然后在其前插入
    python3 << EOF
import re

with open('$file', 'r') as f:
    content = f.read()

# 在 </main> 之前插入
subgraph_section = '''$SUBGRAPH_SECTION'''

if 'Subgraph (GraphQL)' not in content:
    content = content.replace('    </main>', subgraph_section + '    </main>', 1)
    with open('$file', 'w') as f:
        f.write(content)
    print(f"Updated: $file")
else:
    print(f"Skipped (already has Subgraph): $file")
EOF
  else
    echo "Not found: $file"
  fi
done

echo "Done."
