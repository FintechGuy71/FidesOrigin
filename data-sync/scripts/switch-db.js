#!/usr/bin/env node
/**
 * [INFO-3 FIX] Prisma datasource provider 切换脚本
 *
 * 背景：Prisma 要求 schema 中的 provider 为字面量（不能读环境变量），
 * 原实现硬编码 sqlite 而注释声称"生产使用 PostgreSQL"，切换无文档无工具。
 *
 * 用法：
 *   node scripts/switch-db.js sqlite     # 开发（默认）
 *   node scripts/switch-db.js postgres   # 生产
 *
 * 切换后自动运行 `prisma generate`（如可用）。迁移执行由部署流程负责：
 *   npx prisma migrate deploy
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ALLOWED = new Set(['sqlite', 'postgres']);
const target = process.argv[2];

if (!target || !ALLOWED.has(target)) {
  console.error('Usage: node scripts/switch-db.js <sqlite|postgres>');
  process.exit(1);
}

const schemaPath = path.join(__dirname, '..', 'prisma', 'schema.prisma');
let schema = fs.readFileSync(schemaPath, 'utf8');

const updated = schema.replace(
  /provider\s*=\s*"(sqlite|postgres)"(\s*\/\/[^\n]*)?/,
  (match, current, comment) => `provider = "${target}"${comment || ''}`
);

if (updated === schema) {
  console.error('ERROR: provider declaration not found in schema.prisma');
  process.exit(1);
}

fs.writeFileSync(schemaPath, updated);
console.log(`✅ datasource provider: ${target}`);

if (target === 'postgres') {
  console.log('   Remember: DATABASE_URL must point to the PostgreSQL instance,');
  console.log('   and run `npx prisma migrate deploy` before starting the service.');
}

// Best-effort client regeneration
try {
  execSync('npx prisma generate', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });
} catch {
  console.warn('⚠️ prisma generate skipped (npx prisma not available)');
}
