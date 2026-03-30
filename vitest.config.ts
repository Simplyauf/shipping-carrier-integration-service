import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: false,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.ts"],
      exclude: ["src/index.ts"],
      thresholds: {
        lines: 75,
        functions: 75,
        branches: 65,
      },
    },
    // Run tests sequentially to avoid nock interceptor race conditions
    pool: "forks",
    poolOptions: { forks: { singleFork: true } },
  },
});
