#!/bin/bash
# Vercel install script - handles pnpm onlyBuiltDependencies

# Create pnpm-workspace.yaml with onlyBuiltDependencies
cat > pnpm-workspace.yaml << 'EOF'
packages:
  - "apps/*"
  - "packages/*"

onlyBuiltDependencies:
  - sharp
  - "@napi-rs/canvas"
  - secp256k1
  - keccak
  - bcrypt
  - esbuild
  - protobufjs
  - msw

overrides:
  "@chainlink/contracts": "1.3.0"

settings:
  fetchTimeout: 600000
  networkConcurrency: 3
EOF

# Run pnpm install
pnpm install --no-frozen-lockfile
