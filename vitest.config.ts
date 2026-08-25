import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      include: ["src/**"],
      thresholds: {
        "src/core/**": { lines: 90, functions: 90 },
        "src/renderer/**": { lines: 90, functions: 90 },
      },
    },
    projects: [
      {
        test: {
          name: "unit",
          environment: "node",
          include: ["test/unit/**/*.test.ts", "test/*.test.ts"],
        },
      },
      {
        test: {
          name: "renderer",
          environment: "happy-dom",
          include: ["test/renderer/**/*.test.ts"],
        },
      },
    ],
  },
});
