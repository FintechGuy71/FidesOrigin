/** @type {import('next').NextConfig} */
const path = require('path');

const nextConfig = {
  output: 'export',
  // [Deploy Fix] 移除 distDir: 'dist'——export 构建不在 distDir 生成
  // routes-manifest.json，Vercel Next builder 会报缺文件；恢复默认 .next，
  // 静态站点产物固定输出到 out/，由 Vercel 零配置自动识别。
  images: {
    /* `output: 'export'` 下没有 Next 服务端，默认 loader 无法工作 ——
       任何被渲染的 <next/image> 都会让导出直接报错：
       "Image Optimization using the default loader is not compatible
        with 'output: export'"。
       此前这里是空对象 {}（注释声称"启用图片优化"），只是因为 next/image
       恰好不在渲染树上才没炸。显式声明 unoptimized 把这个约束固化下来。 */
    unoptimized: true,
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
