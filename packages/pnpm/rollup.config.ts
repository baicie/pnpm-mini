// import { defineConfig } from 'rollup'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Plugin, RollupOptions } from 'rollup'
import { defineConfig } from 'rollup'
import nodeResolve from '@rollup/plugin-node-resolve'
import typescript from '@rollup/plugin-typescript'
import commonjs from '@rollup/plugin-commonjs'
import json from '@rollup/plugin-json'
import MagicString from 'magic-string'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

function createPnpm() {
  return defineConfig({
    treeshake: true,
    output: {
      dir: './dist',
      entryFileNames: '[name].js',
      chunkFileNames: 'chunks/dep-[hash].js',
      exports: 'named',
      format: 'esm',
      externalLiveBindings: false,
      freeze: false,
      sourcemap: true,
    },
    onwarn(warning, warn) {
      if (warning.message.includes('Circular dependency'))
        return
      warn(warning)
    },
    input: {
      index: path.resolve(__dirname, 'src/index.ts'),
      cli: path.resolve(__dirname, 'src/cli.ts'),
    },
    plugins: [
      nodeResolve({ preferBuiltins: true }),
      typescript({
        tsconfig: path.resolve(__dirname, 'tsconfig.json'),
        sourceMap: true,
        declaration: true,
        declarationDir: './dist',
        exclude: ['rollup.config.ts'],
      }),
      commonjs({
        extensions: ['.js'],
        ignore: ['bufferutil', 'utf-8-validate'],
      }),
      json(),
      cjsPatchPlugin(),
    ],
    external: ['esbuild'],
  })
}

function cjsPatchPlugin(): Plugin {
  const cjsPatch = `
import { fileURLToPath as __cjs_fileURLToPath } from 'node:url';
import { dirname as __cjs_dirname } from 'node:path';
import { createRequire as __cjs_createRequire } from 'node:module';

const __filename = __cjs_fileURLToPath(import.meta.url);
const __dirname = __cjs_dirname(__filename);
const require = __cjs_createRequire(import.meta.url);
const __require = require;
`.trimStart()

  return {
    name: 'cjs-chunk-patch',
    renderChunk(code, chunk) {
      if (!chunk.fileName.includes('chunks/dep-'))
        return

      const match = code.match(/^(?:import[\s\S]*?;\s*)+/)
      const index = match ? match.index! + match[0].length : 0
      const s = new MagicString(code)
      // inject after the last `import`
      s.appendRight(index, cjsPatch)

      return {
        code: s.toString(),
        map: s.generateMap({ hires: true }),
      }
    },
  }
}

// 打印rollup参数
export default (): RollupOptions[] => {
  return defineConfig([
    createPnpm(),
  ])
}
