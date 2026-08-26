import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";
import { resolve } from "node:path";

// Pure-browser build of the same Vue renderer (web mode: localStorage +
// BroadcastChannel, no Electron). Open two tabs to watch state sync.
export default defineConfig({
  root: resolve("web"),
  plugins: [vue()],
  build: { outDir: resolve("dist-web") },
});
