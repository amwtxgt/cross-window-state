import { defineConfig } from '@playwright/test'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  testDir: fileURLToPath(new URL('.', import.meta.url)),
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  projects: [
    { name: 'electron', testMatch: /electron\.spec\.ts/ },
    { name: 'web', testMatch: /web\.spec\.ts/ },
  ],
  webServer: {
    command:
      'pnpm --filter cross-window-state-example-basic build:web && pnpm --filter cross-window-state-example-basic preview --port 4891 --strictPort',
    url: 'http://localhost:4891',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  use: { trace: 'off' },
})
