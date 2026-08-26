import vue from "@vitejs/plugin-vue";
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
      // Same as the basic example: the library stays in devDependencies so the
      // sandboxed preload bundle inlines it.
    },
  },
  renderer: {
    root: resolve("src/renderer"),
    plugins: [vue()],
    build: {
      outDir: "out/renderer",
      rollupOptions: { input: resolve("src/renderer/index.html") },
    },
  },
});
