import { defineConfig } from 'tsup';

/* [D2 Fix] 公共 npm 发布改用 tsup 打包。
   @fidesorigin/shared 原为 workspace 内部包（workspace:* 在公共 npm 无法解析），
   SDK 所需的少量类型与常量已 vendor 进 src/_shared.ts —— 源码零 shared 引用，
   发布产物完全自包含、零内部依赖（故无需 noExternal 内联 shared）。
   react/peer 依赖保持 external（由消费方提供）。 */
export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'react/index': 'src/react.ts',
  },
  format: ['cjs', 'esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  external: ['react', 'react-dom', 'ethers', 'isomorphic-ws'],
  outExtension({ format }) {
    return { js: format === 'esm' ? '.mjs' : '.js' };
  },
});
