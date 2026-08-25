import { defineConfig } from 'tsdown'

export default [
  // A) dual-format entries for host-agnostic surfaces
  defineConfig({
    entry: ['src/index.ts', 'src/main/index.ts', 'src/renderer/index.ts', 'src/vue/index.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    fixedExtension: true,
    clean: true,
    platform: 'neutral',
    outDir: 'dist',
  }),
  // B) preload must be a single .cjs file: sandboxed Electron preloads
  //    do not support ESM (verified 2026-08, Electron docs)
  defineConfig({
    entry: { 'preload/index': 'src/preload/index.ts' },
    format: ['cjs'],
    dts: true,
    fixedExtension: true,
    platform: 'node',
    outDir: 'dist',
    external: ['electron'],
  }),
]
