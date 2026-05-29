import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    pool: "threads",
    maxWorkers: 2,
    fileParallelism: true,
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.{idea,git,cache,output,temp}/**",
      "**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build,eslint,prettier}.config.*",
      "**/tests/e2e/**",
    ],
    coverage: {
      provider: "v8",
      exclude: ["**/__tests__/**", "**/node_modules/**"],
      reporter: ["text", "json", "json-summary"],
    },
    benchmark: {
      include: ["tests/benchmarks/**/*.bench.ts"],
    },
  },
});
