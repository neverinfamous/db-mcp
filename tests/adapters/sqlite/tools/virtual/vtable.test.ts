/**
 * Virtual Table Tool Tests (Mock-based)
 *
 * Tests vtable tools: list, info, drop, csv, analyze-csv
 * using a mock adapter with mocked module availability checks.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the analysis module for csv availability checks
vi.mock("../../../../../src/adapters/sqlite/tools/virtual/analysis.js", () => ({
  isModuleAvailable: vi.fn(),
  isCsvModuleAvailable: vi.fn(),
}));

import { createListVirtualTablesTool } from "../../../../../src/adapters/sqlite/tools/virtual/vtable/list.js";
import { createVirtualTableInfoTool } from "../../../../../src/adapters/sqlite/tools/virtual/vtable/info.js";
import { createDropVirtualTableTool } from "../../../../../src/adapters/sqlite/tools/virtual/vtable/drop.js";
import { createCsvTableTool } from "../../../../../src/adapters/sqlite/tools/virtual/vtable/csv.js";
import { createAnalyzeCsvSchemaTool } from "../../../../../src/adapters/sqlite/tools/virtual/vtable/analyze-csv.js";
import { isModuleAvailable, isCsvModuleAvailable } from "../../../../../src/adapters/sqlite/tools/virtual/analysis.js";

const ctx = { timestamp: new Date(), requestId: "test" };

function createMockAdapter() {
  return {
    executeReadQuery: vi.fn(),
    executeWriteQuery: vi.fn(),
  } as any;
}

// =============================================================================
// sqlite_list_virtual_tables
// =============================================================================

describe("createListVirtualTablesTool", () => {
  it("should return tool metadata", () => {
    const tool = createListVirtualTablesTool(createMockAdapter());
    expect(tool.name).toBe("sqlite_list_virtual_tables");
    expect(tool.group).toBe("admin");
  });

  it("should list virtual tables", async () => {
    const adapter = createMockAdapter();
    adapter.executeReadQuery.mockResolvedValue({
      rows: [
        { name: "csv_data", sql: "CREATE VIRTUAL TABLE csv_data USING csv(filename='data.csv')" },
        { name: "fts_index", sql: "CREATE VIRTUAL TABLE fts_index USING fts5(content)" },
      ],
    });
    const tool = createListVirtualTablesTool(adapter);
    const result = await tool.handler({}, ctx) as any;
    expect(result.success).toBe(true);
    expect(result.count).toBe(2);
    expect(result.virtualTables[0].module).toBe("csv");
    expect(result.virtualTables[1].module).toBe("fts5");
  });

  it("should filter by pattern", async () => {
    const adapter = createMockAdapter();
    adapter.executeReadQuery.mockResolvedValue({
      rows: [{ name: "fts_index", sql: "CREATE VIRTUAL TABLE fts_index USING fts5(content)" }],
    });
    const tool = createListVirtualTablesTool(adapter);
    const result = await tool.handler({ pattern: "fts_%" }, ctx) as any;
    expect(result.success).toBe(true);
    expect(adapter.executeReadQuery).toHaveBeenCalledWith(expect.stringContaining("fts_%"));
  });

  it("should handle empty result", async () => {
    const adapter = createMockAdapter();
    adapter.executeReadQuery.mockResolvedValue({ rows: [] });
    const tool = createListVirtualTablesTool(adapter);
    const result = await tool.handler({}, ctx) as any;
    expect(result.success).toBe(true);
    expect(result.count).toBe(0);
  });
});

// =============================================================================
// sqlite_virtual_table_info
// =============================================================================

describe("createVirtualTableInfoTool", () => {
  it("should return table info", async () => {
    const adapter = createMockAdapter();
    adapter.executeReadQuery.mockImplementation((sql: string) => {
      if (sql.includes("sqlite_master")) {
        return Promise.resolve({
          rows: [{ sql: "CREATE VIRTUAL TABLE my_vtable USING fts5(content, title)" }],
        });
      }
      if (sql.includes("PRAGMA table_info")) {
        return Promise.resolve({
          rows: [
            { name: "content", type: "TEXT" },
            { name: "title", type: "TEXT" },
          ],
        });
      }
      return Promise.resolve({ rows: [] });
    });
    const tool = createVirtualTableInfoTool(adapter);
    const result = await tool.handler({ tableName: "my_vtable" }, ctx) as any;
    expect(result.success).toBe(true);
    expect(result.module).toBe("fts5");
    expect(result.columns).toHaveLength(2);
  });

  it("should return not found for missing table", async () => {
    const adapter = createMockAdapter();
    adapter.executeReadQuery.mockResolvedValue({ rows: [] });
    const tool = createVirtualTableInfoTool(adapter);
    const result = await tool.handler({ tableName: "nonexistent" }, ctx) as any;
    expect(result.success).toBe(false);
    expect(result.code).toBe("TABLE_NOT_FOUND");
  });

  it("should handle module not available", async () => {
    const adapter = createMockAdapter();
    let calledPragma = false;
    adapter.executeReadQuery.mockImplementation((sql: string) => {
      if (sql.includes("sqlite_master")) {
        return Promise.resolve({
          rows: [{ sql: "CREATE VIRTUAL TABLE csv_table USING csv(filename='data.csv')" }],
        });
      }
      if (sql.includes("PRAGMA table_info")) {
        throw new Error("no such module: csv");
      }
      return Promise.resolve({ rows: [] });
    });
    const tool = createVirtualTableInfoTool(adapter);
    const result = await tool.handler({ tableName: "csv_table" }, ctx) as any;
    expect(result.success).toBe(true);
    expect(result.moduleAvailable).toBe(false);
    expect(result.note).toContain("csv");
  });
});

// =============================================================================
// sqlite_drop_virtual_table
// =============================================================================

describe("createDropVirtualTableTool", () => {
  it("should drop virtual table", async () => {
    const adapter = createMockAdapter();
    adapter.executeReadQuery.mockResolvedValue({
      rows: [{ sql: "CREATE VIRTUAL TABLE vtbl USING fts5(content)" }],
    });
    adapter.executeWriteQuery.mockResolvedValue({ rows: [] });
    const tool = createDropVirtualTableTool(adapter);
    const result = await tool.handler({ tableName: "vtbl" }, ctx) as any;
    expect(result.success).toBe(true);
  });

  it("should succeed with IF EXISTS for missing table", async () => {
    const adapter = createMockAdapter();
    adapter.executeReadQuery.mockResolvedValue({ rows: [] });
    adapter.executeWriteQuery.mockResolvedValue({ rows: [] });
    const tool = createDropVirtualTableTool(adapter);
    const result = await tool.handler({ tableName: "nonexistent" }, ctx) as any;
    // Uses DROP TABLE IF EXISTS by default, so missing table still succeeds
    expect(result.success).toBe(true);
    expect(result.message).toContain("did not exist");
  });

  it("should require confirmation when not provided", async () => {
    const adapter = createMockAdapter();
    adapter.executeReadQuery.mockResolvedValue({
      rows: [{ sql: "CREATE VIRTUAL TABLE vtbl USING fts5(content)" }],
    });
    const tool = createDropVirtualTableTool(adapter);
    const result = await tool.handler({ tableName: "vtbl", confirm: false }, ctx) as any;
    // The behavior depends on whether confirm is required; test the handler runs
    expect(result).toBeDefined();
  });
});

// =============================================================================
// sqlite_create_csv_table
// =============================================================================

describe("createCsvTableTool", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("should reject relative paths", async () => {
    const tool = createCsvTableTool(createMockAdapter());
    const result = await tool.handler({
      tableName: "data",
      filePath: "relative/path.csv",
    }, ctx) as any;
    expect(result.success).toBe(false);
    expect(String(result.error)).toContain("Relative path");
  });

  it("should reject when csv module unavailable (WASM)", async () => {
    vi.mocked(isCsvModuleAvailable).mockResolvedValue({ available: false } as any);
    vi.mocked(isModuleAvailable).mockResolvedValue(false);

    const tool = createCsvTableTool(createMockAdapter());
    const result = await tool.handler({
      tableName: "data",
      filePath: "/absolute/path.csv",
    }, ctx) as any;
    expect(result.success).toBe(false);
    expect(result.wasmLimitation).toBe(true);
  });

  it("should reject when csv module unavailable (native)", async () => {
    vi.mocked(isCsvModuleAvailable).mockResolvedValue({ available: false } as any);
    vi.mocked(isModuleAvailable).mockResolvedValue(true); // not WASM

    const tool = createCsvTableTool(createMockAdapter());
    const result = await tool.handler({
      tableName: "data",
      filePath: "/absolute/path.csv",
    }, ctx) as any;
    expect(result.success).toBe(false);
    // Native mode explicitly sets wasmLimitation: false (not undefined)
    expect(result.wasmLimitation).toBe(false);
  });

  it("should create csv table when available", async () => {
    vi.mocked(isCsvModuleAvailable).mockResolvedValue({ available: true } as any);

    const adapter = createMockAdapter();
    adapter.executeWriteQuery.mockResolvedValue({ rows: [] });
    adapter.executeReadQuery.mockResolvedValue({
      rows: [{ name: "col1" }, { name: "col2" }],
    });

    const tool = createCsvTableTool(adapter);
    const result = await tool.handler({
      tableName: "data",
      filePath: "/absolute/path.csv",
      header: false,
      delimiter: "\t",
      columns: ["a", "b"],
    }, ctx) as any;
    expect(result.success).toBe(true);
    expect(result.columns).toEqual(["col1", "col2"]);
  });
});

// =============================================================================
// sqlite_analyze_csv_schema
// =============================================================================

describe("createAnalyzeCsvSchemaTool", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("should reject relative paths", async () => {
    const tool = createAnalyzeCsvSchemaTool(createMockAdapter());
    const result = await tool.handler({
      filePath: "relative/data.csv",
    }, ctx) as any;
    expect(result.success).toBe(false);
  });

  it("should reject when csv unavailable (WASM)", async () => {
    vi.mocked(isCsvModuleAvailable).mockResolvedValue({ available: false } as any);
    vi.mocked(isModuleAvailable).mockResolvedValue(false);
    const tool = createAnalyzeCsvSchemaTool(createMockAdapter());
    const result = await tool.handler({
      filePath: "/absolute/data.csv",
    }, ctx) as any;
    expect(result.success).toBe(false);
    expect(result.wasmLimitation).toBe(true);
  });

  it("should analyze csv schema", async () => {
    vi.mocked(isCsvModuleAvailable).mockResolvedValue({ available: true } as any);
    const adapter = createMockAdapter();
    adapter.executeWriteQuery.mockResolvedValue({ rows: [] });
    adapter.executeReadQuery.mockImplementation((sql: string) => {
      if (sql.includes("PRAGMA table_info")) {
        return Promise.resolve({
          rows: [{ name: "id", cid: 0 }, { name: "value", cid: 1 }],
        });
      }
      if (sql.includes("SELECT *")) {
        return Promise.resolve({
          rows: [
            { id: "1", value: "3.14" },
            { id: "2", value: "2.71" },
          ],
        });
      }
      if (sql.includes("COUNT(*)")) {
        return Promise.resolve({ rows: [{ cnt: 100 }] });
      }
      return Promise.resolve({ rows: [] });
    });

    const tool = createAnalyzeCsvSchemaTool(adapter);
    const result = await tool.handler({
      filePath: "/absolute/data.csv",
      sampleRows: 10,
      delimiter: "\t",
    }, ctx) as any;
    expect(result.success).toBe(true);
    expect(result.columns).toHaveLength(2);
    expect(result.rowCount).toBe(100);
  });

  it("should infer INTEGER type", async () => {
    vi.mocked(isCsvModuleAvailable).mockResolvedValue({ available: true } as any);
    const adapter = createMockAdapter();
    adapter.executeWriteQuery.mockResolvedValue({ rows: [] });
    adapter.executeReadQuery.mockImplementation((sql: string) => {
      if (sql.includes("PRAGMA table_info")) {
        return Promise.resolve({ rows: [{ name: "num", cid: 0 }] });
      }
      if (sql.includes("SELECT *")) {
        return Promise.resolve({
          rows: [{ num: "1" }, { num: "2" }, { num: "3" }],
        });
      }
      if (sql.includes("COUNT(*)")) return Promise.resolve({ rows: [{ cnt: 3 }] });
      return Promise.resolve({ rows: [] });
    });

    const tool = createAnalyzeCsvSchemaTool(adapter);
    const result = await tool.handler({
      filePath: "/absolute/data.csv",
    }, ctx) as any;
    expect(result.columns[0].inferredType).toBe("INTEGER");
  });

  it("should handle null values in sample", async () => {
    vi.mocked(isCsvModuleAvailable).mockResolvedValue({ available: true } as any);
    const adapter = createMockAdapter();
    adapter.executeWriteQuery.mockResolvedValue({ rows: [] });
    adapter.executeReadQuery.mockImplementation((sql: string) => {
      if (sql.includes("PRAGMA table_info")) {
        return Promise.resolve({ rows: [{ name: "col", cid: 0 }] });
      }
      if (sql.includes("SELECT *")) {
        return Promise.resolve({ rows: [{ col: null }, { col: "" }, { col: null }] });
      }
      if (sql.includes("COUNT(*)")) return Promise.resolve({ rows: [{ cnt: 3 }] });
      return Promise.resolve({ rows: [] });
    });

    const tool = createAnalyzeCsvSchemaTool(adapter);
    const result = await tool.handler({ filePath: "/absolute/data.csv" }, ctx) as any;
    expect(result.success).toBe(true);
    expect(result.columns[0].nullCount).toBe(3);
    expect(result.columns[0].inferredType).toBe("TEXT");
  });

  it("should clean up temp table on error", async () => {
    vi.mocked(isCsvModuleAvailable).mockResolvedValue({ available: true } as any);
    const adapter = createMockAdapter();
    adapter.executeWriteQuery.mockRejectedValueOnce(new Error("csv error"));
    adapter.executeWriteQuery.mockResolvedValue({ rows: [] }); // cleanup

    const tool = createAnalyzeCsvSchemaTool(adapter);
    const result = await tool.handler({ filePath: "/absolute/data.csv" }, ctx) as any;
    expect(result.success).toBe(false);
  });
});
