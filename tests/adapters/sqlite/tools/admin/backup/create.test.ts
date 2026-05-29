import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  createTestAdapter,
  type TestAdapter,
} from "../../../../../utils/test-adapter.js";

describe("Admin Tools - Backup Create & Vacuum Into", () => {
  let adapter: TestAdapter;
  let tools: Map<string, (params: unknown) => Promise<unknown>>;
  const testDbPath = path.resolve(process.cwd(), "tmp", "test_backup.db");
  const backupTarget = path.resolve(process.cwd(), "tmp", "backup_out.db");
  const vacuumTarget = path.resolve(process.cwd(), "tmp", "vacuum_out.db");

  beforeEach(async () => {
    // Ensure tmp dir exists
    const tmpDir = path.dirname(testDbPath);
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }

    // Clean up old files
    [testDbPath, backupTarget, vacuumTarget].forEach((f) => {
      if (fs.existsSync(f)) fs.unlinkSync(f);
    });

    adapter = createTestAdapter();
    // Connect to a file DB so validateSameDirPath passes
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

    await adapter.executeWriteQuery(
      "CREATE TABLE test_data (id INTEGER PRIMARY KEY, val TEXT)",
    );
    await adapter.executeWriteQuery(
      "INSERT INTO test_data (val) VALUES ('hello')",
    );
  });

  afterEach(async () => {
    await adapter.disconnect();
    // Clean up files
    [testDbPath, backupTarget, vacuumTarget].forEach((f) => {
      if (fs.existsSync(f)) fs.unlinkSync(f);
    });
  });

  describe("sqlite_backup", () => {
    it("should require targetPath", async () => {
      const res = (await tools.get("sqlite_backup")?.({})) as {
        success: boolean;
      };
      expect(res.success).toBe(false);
    });

    it("should reject path traversal in targetPath", async () => {
      const res = (await tools.get("sqlite_backup")?.({
        targetPath: "../outside.db",
      })) as { success: boolean; code: string; error: string };
      expect(res.success).toBe(false);
      expect(res.code).toBe("SECURITY_ERROR");
    });

    it("should reject null bytes in path", async () => {
      const res = (await tools.get("sqlite_backup")?.({
        targetPath: "test\x00.db",
      })) as { success: boolean; code: string };
      expect(res.success).toBe(false);
      expect(res.code).toBe("SECURITY_ERROR");
    });

    it("should create a backup successfully", async () => {
      const res = (await tools.get("sqlite_backup")?.({
        targetPath: backupTarget,
      })) as { success: boolean; path: string };
      expect(res.success).toBe(true);
      expect(fs.existsSync(backupTarget)).toBe(true);
      expect(res.path).toBe(backupTarget);
    });

    it("should reject in-memory databases", async () => {
      const memAdapter = createTestAdapter();
      await memAdapter.connect({
        type: "sqlite",
        connectionString: ":memory:",
      });
      const memTools = new Map();
      memAdapter.getToolDefinitions().forEach((t) => memTools.set(t.name, t));

      const res = (await memTools
        .get("sqlite_backup")
        ?.handler({ targetPath: "out.db" }, { scopes: ["admin"] } as any)) as {
        success: boolean;
        code: string;
        error: string;
      };
      expect(res.success).toBe(false);
      expect(res.code).toBe("SECURITY_ERROR");
      expect(res.error).toContain("not permitted for :memory:");

      await memAdapter.disconnect();
    });
  });

  describe("sqlite_vacuum_into", () => {
    it("should require outputPath", async () => {
      const res = (await tools.get("sqlite_vacuum_into")?.({})) as {
        success: boolean;
      };
      expect(res.success).toBe(false);
    });

    it("should reject path traversal", async () => {
      const res = (await tools.get("sqlite_vacuum_into")?.({
        outputPath: "../outside.db",
      })) as { success: boolean; code: string };
      expect(res.success).toBe(false);
      expect(res.code).toBe("SECURITY_ERROR");
    });

    it("should vacuum into a new file", async () => {
      const res = (await tools.get("sqlite_vacuum_into")?.({
        outputPath: vacuumTarget,
      })) as { success: boolean; sizeBytes?: number };
      expect(res.success).toBe(true);
      expect(fs.existsSync(vacuumTarget)).toBe(true);
      expect(res.sizeBytes).toBeGreaterThan(0);
    });
  });
});
