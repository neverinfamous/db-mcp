import { describe, it, expect, vi } from "vitest";
import {
  validateTableExists,
  preprocessTableParams
} from "../../../../../src/adapters/sqlite/tools/core/convenience-schemas.js";
import type { SqliteAdapter } from "../../../../../src/adapters/sqlite/sqlite-adapter.js";

describe("convenience-schemas", () => {
  describe("validateTableExists", () => {
    it("should return null if the table exists", async () => {
      const mockAdapter = {
        executeReadQuery: vi.fn().mockResolvedValue({
          rows: [{ 1: 1 }]
        })
      } as unknown as SqliteAdapter;

      const result = await validateTableExists(mockAdapter, "existing_table");
      expect(result).toBeNull();
      expect(mockAdapter.executeReadQuery).toHaveBeenCalledWith(
        expect.stringContaining("pragma_table_list(?)"),
        ["existing_table"]
      );
    });

    it("should return an ErrorResponse if the table does not exist", async () => {
      const mockAdapter = {
        executeReadQuery: vi.fn().mockResolvedValue({
          rows: []
        })
      } as unknown as SqliteAdapter;

      const result = await validateTableExists(mockAdapter, "missing_table");
      expect(result).not.toBeNull();
      expect(result?.success).toBe(false);
      expect(result?.code).toBe("TABLE_NOT_FOUND");
    });
  });

  describe("preprocessTableParams", () => {
    it("should map tableName or name to table", () => {
      expect(preprocessTableParams({ table: "t1" })).toEqual({ table: "t1", tableName: "t1" });
      expect(preprocessTableParams({ name: "t2" })).toEqual({ name: "t2", table: "t2" });
      expect(preprocessTableParams({ table: "t3", name: "t2" })).toEqual({ table: "t3", tableName: "t3", name: "t2" });
    });
    
    it("should return input if not an object", () => {
      expect(preprocessTableParams(null)).toBeNull();
      expect(preprocessTableParams("string")).toBe("string");
    });
  });
});
