import { defineConfig } from "tsdown";

export default [
  // A) dual-format entries. Node platform so `node:*` builtins in the main
  //    entry resolve; renderer/vue/index don't import them anyway.
  defineConfig({
    entry: ["src/index.ts", "src/main/index.ts", "src/renderer/index.ts", "src/vue/index.ts"],
    format: ["esm", "cjs"],
    dts: { tsconfig: "./tsconfig.build.json" },
    fixedExtension: true,
    clean: true,
    platform: "node",
    outDir: "dist",
  }),
  // B) preload must be a single .cjs file: sandboxed Electron preloads
  //    do not support ESM (verified 2026-08, Electron docs)
  defineConfig({
    entry: { "preload/index": "src/preload/index.ts" },
    format: ["cjs"],
    dts: { tsconfig: "./tsconfig.build.json" },
    fixedExtension: true,
    platform: "node",
    outDir: "dist",
    external: ["electron"],
  }),
];
