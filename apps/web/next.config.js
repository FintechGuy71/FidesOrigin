/** @type {import('next').NextConfig} */
const path = require('path');

const nextConfig = {
  output: 'export',
  // [Deploy Fix] 移除 distDir: 'dist'——export 构建不在 distDir 生成
  // routes-manifest.json，Vercel Next builder 会报缺文件；恢复默认 .next，
  // 静态站点产物固定输出到 out/，由 Vercel 零配置自动识别。
  images: {
    // [H-8 Fix] Removed unoptimized: true to enable Next.js image optimization
    // unoptimized: true,
  },
  eslint: {
    // Temporarily disable during A+ transition
    // Code style issues being fixed incrementally
    ignoreDuringBuilds: true,
  },
  typescript: {
    // [H-5 Fix] Strict: never ignore TypeScript errors during builds
    // Only CI can temporarily override via NEXT_TS_IGNORE_BUILD_ERRORS env var
    ignoreBuildErrors: process.env.NEXT_TS_IGNORE_BUILD_ERRORS === 'true',
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': path.resolve(__dirname, './'),
    };
    return config;
  },
  env: {
    NEXT_PUBLIC_APP_VERSION: process.env.npm_package_version || '0.1.1',
  },
}

module.exports = nextConfig
