import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // MCP SDK McpServer only supports one active transport at a time.
  // Parallel workers create competing SSE connections that steal each other's transport.
  workers: 1,
  reporter: "list",
  use: {
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "wasm",
      use: {
        ...devices["Desktop Chrome"],
        baseURL: "http://localhost:3000",
      },
      testIgnore: /native\./,
    },
    {
      name: "native",
      use: {
        ...devices["Desktop Chrome"],
        baseURL: "http://localhost:3001",
      },
      testIgnore: /wasm\./,
      dependencies: ["wasm"],
    },
  ],
  webServer: [
    {
      command:
        "node dist/cli.js --transport http --port 3000 --sqlite ./database.db --tool-filter +all",
      url: "http://localhost:3000/health",
      reuseExistingServer: !process.env.CI,
      timeout: 30000,
      stdout: "pipe",
      stderr: "pipe",
      env: { ...process.env, MCP_RATE_LIMIT_MAX: "1000" },
    },
    {
      command:
        "node dist/cli.js --transport http --port 3001 --sqlite-native ./database.db --tool-filter +all",
      url: "http://localhost:3001/health",
      reuseExistingServer: !process.env.CI,
      timeout: 30000,
      stdout: "pipe",
      stderr: "pipe",
      env: { ...process.env, MCP_RATE_LIMIT_MAX: "1000" },
    },
  ],
});
