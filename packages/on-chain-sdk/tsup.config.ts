import { defineConfig } from 'tsup';

/* [D3] on-chain-sdk 构建配置：与 fidesorigin-sdk 同口径（tsup，ethers external）。 */
export default defineConfig({
  entry: { index: 'src/index.ts' },
  format: ['cjs', 'esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  external: ['ethers'],
  outExtension({ format }) {
    return { js: format === 'esm' ? '.mjs' : '.js' };
  },
});
