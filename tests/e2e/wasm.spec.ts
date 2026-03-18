/**
 * E2E Tests: WASM Adapter Graceful Degradation
 *
 * Verifies that native-only features return structured errors
 * instead of crashing when running under the WASM (sql.js) adapter.
 * Skipped by the native project via testIgnore in playwright.config.ts.
 */

import { test, expect } from "@playwright/test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

test.describe.configure({ mode: "serial" });

test.describe("WASM Adapter Graceful Degradation", () => {
  async function createClient(baseURL: string) {
    const transport = new SSEClientTransport(new URL(`${baseURL}/sse`));
    const client = new Client(
      { name: "playwright-wasm-test", version: "1.0.0" },
      { capabilities: {} },
    );
    await client.connect(transport);
    return client;
  }

  test("should reject sqlite_transaction_begin in WASM mode", async ({}, testInfo) => {
    const baseURL = testInfo.project.use.baseURL as string;
    const client = await createClient(baseURL);
    try {
      const response = await client.callTool({
        name: "sqlite_transaction_begin",
        arguments: {},
      });

      // WASM adapter returns isError: true for native-only transaction tools
      expect(response.isError).toBe(true);
    } finally {
      await client.close();
    }
  });

  test("should return wasmLimitation for sqlite_backup", async ({}, testInfo) => {
    const baseURL = testInfo.project.use.baseURL as string;
    const client = await createClient(baseURL);
    try {
      const response = await client.callTool({
        name: "sqlite_backup",
        arguments: { targetPath: "/tmp/test-backup.db" },
      });

      expect(response.isError).toBeUndefined();
      expect(Array.isArray(response.content)).toBe(true);
      const parsed = JSON.parse((response.content[0] as { text: string }).text);
      expect(parsed.success).toBe(false);
      expect(parsed.wasmLimitation).toBe(true);
    } finally {
      await client.close();
    }
  });

  test("should return wasmLimitation for sqlite_restore", async ({}, testInfo) => {
    const baseURL = testInfo.project.use.baseURL as string;
    const client = await createClient(baseURL);
    try {
      const response = await client.callTool({
        name: "sqlite_restore",
        arguments: { sourcePath: "/tmp/nonexistent.db" },
      });

      expect(response.isError).toBeUndefined();
      expect(Array.isArray(response.content)).toBe(true);
      const parsed = JSON.parse((response.content[0] as { text: string }).text);
      expect(parsed.success).toBe(false);
      expect(parsed.wasmLimitation).toBe(true);
    } finally {
      await client.close();
    }
  });

  test("should return wasmLimitation for sqlite_verify_backup", async ({}, testInfo) => {
    const baseURL = testInfo.project.use.baseURL as string;
    const client = await createClient(baseURL);
    try {
      const response = await client.callTool({
        name: "sqlite_verify_backup",
        arguments: { backupPath: "/tmp/nonexistent.db" },
      });

      expect(response.isError).toBeUndefined();
      expect(Array.isArray(response.content)).toBe(true);
      const parsed = JSON.parse((response.content[0] as { text: string }).text);
      expect(parsed.success).toBe(false);
      expect(parsed.wasmLimitation).toBe(true);
    } finally {
      await client.close();
    }
  });
});
