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
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "api",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command:
      "node dist/cli.js --transport http --port 3000 --sqlite ./database.db --tool-filter starter",
    url: "http://localhost:3000/health",
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
