import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createTestAdapter,
  type TestAdapter,
} from "../../../../utils/test-adapter.js";
import path from "node:path";
import fs from "node:fs";

describe("Admin Tools - WAL Management", () => {
  let adapter: TestAdapter;
  let tools: Map<string, (params: unknown) => Promise<unknown>>;
  const testDbPath = path.resolve(process.cwd(), "tmp", "test_wal.db");

  beforeEach(async () => {
    // Ensure tmp dir exists
    const tmpDir = path.dirname(testDbPath);
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }
    
    // Clean up old files
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);

    adapter = createTestAdapter();
    // Connect to a file DB because WAL requires a file
    await adapter.connect({
      type: "sqlite",
      connectionString: testDbPath,
    });

    tools = new Map();
    const toolDefs = adapter.getToolDefinitions();
    const context = { scopes: ["read", "write", "admin"] };

    for (const tool of toolDefs) {
      tools.set(tool.name, (params) => tool.handler(params, context as never));
    }
  });

  afterEach(async () => {
    await adapter.disconnect();
    // Clean up files
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
  });

  describe("sqlite_wal", () => {
    it("should get status", async () => {
      const res = await tools.get("sqlite_wal")?.({
        action: "status"
      }) as { success: boolean, journalMode: string };
      expect(res.success).toBe(true);
      expect(res.journalMode).toBeDefined();
    });

    it("should enable WAL mode", async () => {
      // First ensure it's not WAL
      await adapter.rawQuery("PRAGMA journal_mode=DELETE");
      
      const res = await tools.get("sqlite_wal")?.({
        action: "enable"
      }) as { success: boolean, journalMode: string, previousMode: string };
      expect(res.success).toBe(true);
      expect(res.journalMode.toLowerCase()).toBe("wal");
      expect(res.previousMode.toLowerCase()).toBe("delete");
    });

    it("should handle enabling when already enabled", async () => {
      await adapter.rawQuery("PRAGMA journal_mode=WAL");
      
      const res = await tools.get("sqlite_wal")?.({
        action: "enable"
      }) as { success: boolean, journalMode: string, previousMode: string, message: string };
      expect(res.success).toBe(true);
      expect(res.journalMode.toLowerCase()).toBe("wal");
      expect(res.message).toContain("already enabled");
    });

    it("should disable WAL mode", async () => {
      await adapter.rawQuery("PRAGMA journal_mode=WAL");
      
      const res = await tools.get("sqlite_wal")?.({
        action: "disable"
      }) as { success: boolean, journalMode: string, previousMode: string };
      expect(res.success).toBe(true);
      expect(res.journalMode.toLowerCase()).toBe("delete");
      expect(res.previousMode.toLowerCase()).toBe("wal");
    });

    it("should handle disabling when already disabled", async () => {
      await adapter.rawQuery("PRAGMA journal_mode=DELETE");
      
      const res = await tools.get("sqlite_wal")?.({
        action: "disable"
      }) as { success: boolean, journalMode: string, message: string };
      expect(res.success).toBe(true);
      expect(res.journalMode.toLowerCase()).toBe("delete");
      expect(res.message).toContain("Already using default");
    });

    it("should checkpoint successfully in WAL mode", async () => {
      await adapter.rawQuery("PRAGMA journal_mode=WAL");
      
      // Do some writes to put stuff in WAL
      await adapter.executeWriteQuery("CREATE TABLE wal_test (id INTEGER)");
      await adapter.executeWriteQuery("INSERT INTO wal_test VALUES (1), (2), (3)");

      const res = await tools.get("sqlite_wal")?.({
        action: "checkpoint",
        checkpointMode: "PASSIVE"
      }) as { success: boolean, walPages: number, checkpointedPages: number };
      expect(res.success).toBe(true);
      expect(res.checkpointedPages).toBeGreaterThanOrEqual(0); // Might be 0 if auto-checkpoint happened
    });

    it("should error when checkpointing in non-WAL mode", async () => {
      await adapter.rawQuery("PRAGMA journal_mode=DELETE");

      const res = await tools.get("sqlite_wal")?.({
        action: "checkpoint",
        checkpointMode: "PASSIVE"
      }) as { success: boolean, error: string, code: string };
      expect(res.success).toBe(false);
      expect(res.code).toBe("VALIDATION_ERROR");
      expect(res.error).toContain("is not in WAL mode");
    });
  });
});
