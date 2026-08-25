import { defineConfig } from 'vite'
import { resolve } from 'node:path'

// Pure-browser build of the same renderer logic (web mode: localStorage +
// BroadcastChannel, no Electron). Used by the web e2e suite via preview.
export default defineConfig({
  root: resolve('web'),
  build: { outDir: resolve('dist-web') },
})
