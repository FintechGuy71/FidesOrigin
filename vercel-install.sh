#!/bin/bash
set -euo pipefail

# 保留仓库唯一的 pnpm-workspace.yaml，禁止部署时覆盖构建审批配置。
pnpm install --frozen-lockfile --config.block-exotic-subdeps=false
