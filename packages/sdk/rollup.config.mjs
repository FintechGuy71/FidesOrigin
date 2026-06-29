import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import dts from 'rollup-plugin-dts';
import terser from '@rollup/plugin-terser';
import { readFileSync } from 'fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

const banner = `/*!
 * ${pkg.name} v${pkg.version}
 * ${pkg.homepage}
 * 
 * Copyright (c) ${new Date().getFullYear()} FidesOrigin
 * Licensed under the ${pkg.license} License
 */`;

export default [
  // ESM build
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/esm/index.js',
      format: 'esm',
      banner,
      sourcemap: true
    },
    plugins: [
      resolve({ browser: false, preferBuiltins: true }),
      commonjs(),
      typescript({
        tsconfig: './tsconfig.json',
        outDir: 'dist/esm',
        declaration: false
      })
    ],
    external: ['isomorphic-ws', 'react']
  },
  
  // CommonJS build
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/cjs/index.js',
      format: 'cjs',
      banner,
      sourcemap: true,
      exports: 'named'
    },
    plugins: [
      resolve({ browser: false, preferBuiltins: true }),
      commonjs(),
      typescript({
        tsconfig: './tsconfig.json',
        outDir: 'dist/cjs',
        declaration: false
      })
    ],
    external: ['isomorphic-ws', 'react']
  },
  
  // UMD build for browsers
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/umd/fidesorigin.js',
      format: 'umd',
      name: 'FidesOrigin',
      banner,
      sourcemap: true,
      exports: 'named',
      globals: {
        'isomorphic-ws': 'WebSocket',
        'react': 'React'
      }
    },
    plugins: [
      resolve({ browser: true, preferBuiltins: false }),
      commonjs(),
      typescript({
        tsconfig: './tsconfig.json',
        outDir: 'dist/umd',
        declaration: false
      })
    ],
    external: ['react']
  },
  
  // UMD minified build
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/umd/fidesorigin.min.js',
      format: 'umd',
      name: 'FidesOrigin',
      banner,
      sourcemap: true,
      exports: 'named',
      globals: {
        'isomorphic-ws': 'WebSocket',
        'react': 'React'
      }
    },
    plugins: [
      resolve({ browser: true, preferBuiltins: false }),
      commonjs(),
      typescript({
        tsconfig: './tsconfig.json',
        outDir: 'dist/umd',
        declaration: false
      }),
      terser({
        format: {
          comments: /^!/
        }
      })
    ],
    external: ['react']
  },
  
  // Type declarations
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/types/index.d.ts',
      format: 'esm'
    },
    plugins: [
      dts()
    ],
    external: ['isomorphic-ws', 'react']
  }
];
