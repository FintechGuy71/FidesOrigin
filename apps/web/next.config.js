/** @type {import('next').NextConfig} */
const path = require('path');

const nextConfig = {
  output: 'export',
  distDir: 'dist',
  images: {
    unoptimized: true,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
  typescript: {
    ignoreBuildErrors: false,
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
