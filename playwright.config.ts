import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // MCP SDK McpServer only supports one active transport at a time.
  // Parallel workers create competing SSE connections that steal each other's transport.
  workers: 1,
  reporter: [["list"], ["json", { outputFile: ".playwright-results.json" }]],
  use: {
    trace: "on-first-retry",
    // 60s timeout — allows slow operations (vector stats, code mode ETL)
    // to complete without flaky timeouts from rate-limit backpressure
    actionTimeout: 0,
  },
  timeout: 60_000,
  projects: [
    {
      name: "wasm",
      use: {
        ...devices["Desktop Chrome"],
        baseURL: "http://localhost:3000",
      },
      testIgnore: [
        /native\./,
        /auth\./,
        /payloads-window\./,
        /payloads-fts\./,
        /payloads-transactions\./,
        /payloads-spatialite\./,
        /payloads-csv\./,
        /transactions-nested\./,
        /integration-workflows\./,
        /codemode-introspection\./,
      ],
    },
    {
      name: "native",
      use: {
        ...devices["Desktop Chrome"],
        baseURL: "http://localhost:3001",
      },
      testIgnore: [/wasm\./, /auth\./],
    },
  ],
  webServer: [
    {
      command:
        "node dist/cli.js --transport http --port 3000 --sqlite ./test-server/test.db --tool-filter +all --no-auth-enforcement --audit-log ./test-server/audit.db",
      url: "http://localhost:3000/health",
      reuseExistingServer: !process.env.CI,
      timeout: 30000,
      stdout: "pipe",
      stderr: "pipe",
      env: {
        ...process.env,
        DB_ENCRYPTION_KEY: "",
        MCP_RATE_LIMIT_MAX: "10000",
        MCP_CODEMODE_RATE_LIMIT: "10000",
        ALLOWED_IO_ROOTS: process.cwd(),
      },
    },
    {
      command:
        "node dist/cli.js --transport http --port 3001 --sqlite-native ./test-server/test.db --csv --spatialite --tool-filter +all --no-auth-enforcement --audit-log ./test-server/audit.db",
      url: "http://localhost:3001/health",
      reuseExistingServer: !process.env.CI,
      timeout: 30000,
      stdout: "pipe",
      stderr: "pipe",
      env: {
        ...process.env,
        DB_ENCRYPTION_KEY: "",
        MCP_RATE_LIMIT_MAX: "10000",
        MCP_CODEMODE_RATE_LIMIT: "10000",
        ALLOWED_IO_ROOTS: process.cwd(),
        SPATIALITE_PATH:
          "./extensions/mod_spatialite-5.1.0-win-amd64/mod_spatialite.dll",
        CSV_EXTENSION_PATH: "./extensions/xsv0.dll",
      },
    },
  ],
});
