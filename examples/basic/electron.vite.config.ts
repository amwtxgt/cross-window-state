import { defineConfig } from "electron-vite";
import { resolve } from "node:path";

export default defineConfig({
  main: {
    build: {
      outDir: "out/main",
      lib: { entry: resolve("src/main/index.ts") },
    },
  },
  preload: {
    build: {
      outDir: "out/preload",
      lib: { entry: resolve("src/preload/index.ts") },
      // electron-vite externalizes `dependencies` — the library lives in
      // devDependencies on purpose so the preload bundle INLINES it
      // (sandboxed preloads cannot require bare node_modules specifiers).
    },
  },
  renderer: {
    root: resolve("src/renderer"),
    build: {
      outDir: "out/renderer",
      rollupOptions: { input: resolve("src/renderer/index.html") },
    },
  },
});
