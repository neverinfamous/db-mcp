import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  coerceNumber,
  coerceEnumValues,
  validateTableExists,
  validateColumnInTable,
  validateOrderByColumns,
  resolveSelectColumns,
  sanitizePartitionBy,
  sanitizeOrderByExpr,
  validateDefaultValue,
} from "../../../../../src/adapters/sqlite-native/tools/window/helpers.js";
import { NativeSqliteAdapter } from "../../../../../src/adapters/sqlite-native/native-sqlite-adapter.js";
import { ResourceNotFoundError, ValidationError } from "../../../../../src/utils/errors/index.js";
import { DbMcpError } from "../../../../../src/utils/errors/base.js";

describe("Window Tools Helpers", () => {
  describe("coerceNumber", () => {
    it("should parse numeric strings to numbers", () => {
      expect(coerceNumber("123")).toBe(123);
      expect(coerceNumber("-12.5")).toBe(-12.5);
    });

    it("should return undefined for empty string", () => {
      expect(coerceNumber("")).toBeUndefined();
      expect(coerceNumber("   ")).toBeUndefined();
    });

    it("should return original string if not a valid number", () => {
      expect(coerceNumber("abc")).toBe("abc");
      expect(coerceNumber("123a")).toBe("123a");
    });

    it("should return original value if not a string", () => {
      expect(coerceNumber(123)).toBe(123);
      expect(coerceNumber(null)).toBeNull();
      expect(coerceNumber(undefined)).toBeUndefined();
    });
  });

  describe("coerceEnumValues", () => {
    it("should return value if in allowed list", () => {
      const coercer = coerceEnumValues(["a", "b"]);
      expect(coercer("a")).toBe("a");
      expect(coercer("b")).toBe("b");
    });

    it("should return undefined if not in allowed list", () => {
      const coercer = coerceEnumValues(["a", "b"]);
      expect(coercer("c")).toBeUndefined();
      expect(coercer("")).toBeUndefined();
      expect(coercer(null)).toBeUndefined();
      expect(coercer(123)).toBeUndefined();
    });
  });

  describe("sanitizePartitionBy", () => {
    it("should sanitize valid comma-separated identifiers", () => {
      expect(sanitizePartitionBy("col1, col2")).toBe('"col1", "col2"');
    });
  });

  describe("sanitizeOrderByExpr", () => {
    it("should sanitize and preserve ASC/DESC", () => {
      expect(sanitizeOrderByExpr("col1 ASC, col2 desc")).toBe('"col1" ASC, "col2" DESC');
      expect(sanitizeOrderByExpr("col1, col2")).toBe('"col1", "col2"');
    });
  });

  describe("validateDefaultValue", () => {
    it("should allow numeric literals", () => {
      expect(() => validateDefaultValue("123")).not.toThrow();
      expect(() => validateDefaultValue("-12.5")).not.toThrow();
    });

    it("should allow single-quoted strings", () => {
      expect(() => validateDefaultValue("'hello'")).not.toThrow();
    });

    it("should allow NULL", () => {
      expect(() => validateDefaultValue("NULL")).not.toThrow();
      expect(() => validateDefaultValue("null")).not.toThrow();
    });

    it("should reject invalid expressions", () => {
      expect(() => validateDefaultValue("FUNC()")).toThrow(DbMcpError);
      expect(() => validateDefaultValue("'nested''quotes'")).toThrow(DbMcpError);
      expect(() => validateDefaultValue("1 + 1")).toThrow(DbMcpError);
    });
  });

  describe("Database Required Helpers", () => {
    let adapter: NativeSqliteAdapter;

    beforeEach(async () => {
      adapter = new NativeSqliteAdapter();
      await adapter.connect({ type: "sqlite", connectionString: ":memory:" });
      await adapter.executeWriteQuery(
        "CREATE TABLE test_table (id INTEGER PRIMARY KEY, name TEXT, description TEXT, count INTEGER)"
      );
      
      // Create a wide table for select column limit tests
      const cols = Array.from({ length: 15 }).map((_, i) => `col${i} INTEGER`).join(", ");
      await adapter.executeWriteQuery(`CREATE TABLE wide_table (${cols})`);
    });

    afterEach(async () => {
      if (adapter.isConnected()) {
        await adapter.disconnect();
      }
    });

    describe("validateTableExists", () => {
      it("should pass for existing table", async () => {
        await expect(validateTableExists(adapter, "test_table")).resolves.not.toThrow();
      });

      it("should throw ResourceNotFoundError for non-existent table", async () => {
        await expect(validateTableExists(adapter, "missing_table")).rejects.toThrow(ResourceNotFoundError);
      });
    });

    describe("validateColumnInTable", () => {
      it("should pass for existing column", async () => {
        await expect(validateColumnInTable(adapter, "test_table", "name")).resolves.not.toThrow();
      });

      it("should throw ResourceNotFoundError for non-existent column", async () => {
        await expect(validateColumnInTable(adapter, "test_table", "missing_col")).rejects.toThrow(ResourceNotFoundError);
      });
    });

    describe("validateOrderByColumns", () => {
      it("should pass for valid columns and expressions", async () => {
        await expect(validateOrderByColumns(adapter, "test_table", "name ASC, count DESC")).resolves.not.toThrow();
      });

      it("should throw DbMcpError for invalid expression characters", async () => {
        await expect(validateOrderByColumns(adapter, "test_table", "COUNT(id)")).rejects.toThrow(DbMcpError);
      });

      it("should pass for dotted references", async () => {
        await expect(validateOrderByColumns(adapter, "test_table", "test_table.name")).resolves.not.toThrow();
      });
      
      it("should pass for quoted columns", async () => {
        await expect(validateOrderByColumns(adapter, "test_table", '"name" ASC')).resolves.not.toThrow();
      });

      it("should throw ResourceNotFoundError if column is not dotted and missing", async () => {
        await expect(validateOrderByColumns(adapter, "test_table", "missing_col")).rejects.toThrow(ResourceNotFoundError);
      });
    });

    describe("resolveSelectColumns", () => {
      it("should use provided selectColumns if available", async () => {
        const result = await resolveSelectColumns(adapter, "test_table", ["id", "name"]);
        expect(result.columnList).toBe('"id", "name"');
      });

      it("should omit long text columns by default", async () => {
        const result = await resolveSelectColumns(adapter, "test_table", undefined);
        expect(result.columnList).toBe('"id", "name", "count"');
        expect(result.hint).toContain("description");
      });

      it("should keep long text if it is the rank column", async () => {
        const result = await resolveSelectColumns(adapter, "test_table", undefined, "description");
        expect(result.columnList).toBe('*');
      });

      it("should throw ValidationError if too many columns remain", async () => {
        await expect(resolveSelectColumns(adapter, "wide_table", undefined)).rejects.toThrow(ValidationError);
      });
    });
  });
});
