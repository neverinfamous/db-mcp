import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  createTestAdapter,
  type TestAdapter,
} from "../../../../../utils/test-adapter.js";

describe("Admin Tools - Dump", () => {
  let adapter: TestAdapter;
  let tools: Map<string, (params: unknown) => Promise<unknown>>;
  const testDbPath = path.resolve(process.cwd(), "tmp", "test_dump.db");
  const dumpTarget = path.resolve(process.cwd(), "tmp", "dump_out.sql");

  beforeEach(async () => {
    // Ensure tmp dir exists
    const tmpDir = path.dirname(testDbPath);
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }
    
    // Clean up old files
    [testDbPath, dumpTarget].forEach(f => {
      if (fs.existsSync(f)) fs.unlinkSync(f);
    });

    adapter = createTestAdapter();
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

    await adapter.executeWriteQuery("CREATE TABLE test_data (id INTEGER PRIMARY KEY, num INTEGER, flag BOOLEAN, str TEXT)");
    await adapter.executeWriteQuery("INSERT INTO test_data (num, flag, str) VALUES (42, true, 'hello ''world''')");
    await adapter.executeWriteQuery("INSERT INTO test_data (num, flag, str) VALUES (NULL, false, NULL)");
  });

  afterEach(async () => {
    await adapter.disconnect();
    // Clean up files
    [testDbPath, dumpTarget].forEach(f => {
      if (fs.existsSync(f)) fs.unlinkSync(f);
    });
  });

  describe("sqlite_dump", () => {
    it("should require outputPath", async () => {
      const res = await tools.get("sqlite_dump")?.({}) as { success: boolean };
      expect(res.success).toBe(false);
    });

    it("should reject path traversal in outputPath", async () => {
      const res = await tools.get("sqlite_dump")?.({
        outputPath: "../outside.sql"
      }) as { success: boolean, code: string };
      expect(res.success).toBe(false);
      expect(res.code).toBe("SECURITY_ERROR");
    });

    it("should reject in-memory databases", async () => {
      const memAdapter = createTestAdapter();
      await memAdapter.connect({ type: "sqlite", connectionString: ":memory:" });
      const memTools = new Map();
      memAdapter.getToolDefinitions().forEach(t => memTools.set(t.name, t));
      
      const res = await memTools.get("sqlite_dump")?.handler({ outputPath: "out.sql" }, { scopes: ["admin"] } as any) as { success: boolean, code: string };
      expect(res.success).toBe(false);
      expect(res.code).toBe("SECURITY_ERROR");
      
      await memAdapter.disconnect();
    });

    it("should dump schema and data successfully", async () => {
      const res = await tools.get("sqlite_dump")?.({
        outputPath: dumpTarget
      }) as { success: boolean, path: string };
      expect(res.success).toBe(true);
      expect(fs.existsSync(dumpTarget)).toBe(true);
      expect(res.path).toBe(dumpTarget);
      
      const dumpContent = fs.readFileSync(dumpTarget, "utf8");
      // Check for table creation
      expect(dumpContent).toContain("CREATE TABLE test_data");
      // Check for data insert with escaped string and boolean logic
      expect(dumpContent).toContain("hello ''world''");
      expect(dumpContent).toContain("42");
      expect(dumpContent).toContain("NULL");
      // Check transaction wrapper
      expect(dumpContent).toContain("BEGIN TRANSACTION;");
      expect(dumpContent).toContain("COMMIT;");
    });
  });
});
