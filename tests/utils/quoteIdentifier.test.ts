/**
 * Quote Identifier Security Tests
 *
 * Tests for quoteIdentifier, needsQuoting, sanitizeColumnRef,
 * sanitizeIdentifiers, createColumnList, and sanitizeIndexName.
 *
 * Priority 1 of db-mcp Test Coverage Improvement Plan
 */

import { describe, it, expect } from "vitest";
import {
  quoteIdentifier,
  needsQuoting,
  sanitizeColumnRef,
  sanitizeIdentifiers,
  createColumnList,
  sanitizeIndexName,
  InvalidIdentifierError,
} from "../../src/utils/index.js";

describe("Security: quoteIdentifier", () => {
  describe("valid identifiers", () => {
    it("should quote simple identifiers", () => {
      expect(quoteIdentifier("users")).toBe('"users"');
      expect(quoteIdentifier("my_table")).toBe('"my_table"');
    });

    it("should quote reserved keywords (valid when quoted)", () => {
      expect(quoteIdentifier("table")).toBe('"table"');
      expect(quoteIdentifier("select")).toBe('"select"');
      expect(quoteIdentifier("from")).toBe('"from"');
      expect(quoteIdentifier("where")).toBe('"where"');
    });

    it("should quote identifiers starting with underscore", () => {
      expect(quoteIdentifier("_internal")).toBe('"_internal"');
      expect(quoteIdentifier("_private_data")).toBe('"_private_data"');
    });

    it("should quote identifiers with numbers", () => {
      expect(quoteIdentifier("table1")).toBe('"table1"');
      expect(quoteIdentifier("data_2024")).toBe('"data_2024"');
    });
  });

  describe("invalid identifiers - error paths", () => {
    it("should throw for empty string", () => {
      expect(() => quoteIdentifier("")).toThrow(InvalidIdentifierError);
      expect(() => quoteIdentifier("")).toThrow(
        /Identifier must be a non-empty string/,
      );
    });

    it("should throw for null/undefined coerced to string", () => {
      // TypeScript would prevent this, but runtime safety matters
      expect(() => quoteIdentifier(null as unknown as string)).toThrow(
        InvalidIdentifierError,
      );
      expect(() => quoteIdentifier(undefined as unknown as string)).toThrow(
        InvalidIdentifierError,
      );
    });

    it("should throw for identifier exceeding max length (255)", () => {
      const longName = "a".repeat(256);
      expect(() => quoteIdentifier(longName)).toThrow(InvalidIdentifierError);
      expect(() => quoteIdentifier(longName)).toThrow(
        /exceeds maximum length of 255/,
      );
    });

    it("should allow identifier at exactly max length (255)", () => {
      const maxName = "a".repeat(255);
      expect(quoteIdentifier(maxName)).toBe(`"${maxName}"`);
    });

    it("should throw for identifiers with invalid characters", () => {
      expect(() => quoteIdentifier("user;name")).toThrow(
        InvalidIdentifierError,
      );
      expect(() => quoteIdentifier("table-name")).toThrow(
        InvalidIdentifierError,
      );
      expect(() => quoteIdentifier("col name")).toThrow(InvalidIdentifierError);
      expect(() => quoteIdentifier("user'data")).toThrow(
        InvalidIdentifierError,
      );
    });

    it("should throw for identifiers starting with a number", () => {
      expect(() => quoteIdentifier("1table")).toThrow(InvalidIdentifierError);
      expect(() => quoteIdentifier("123abc")).toThrow(InvalidIdentifierError);
    });

    it("should throw for SQL injection attempts", () => {
      expect(() => quoteIdentifier("users; DROP TABLE--")).toThrow(
        InvalidIdentifierError,
      );
      expect(() => quoteIdentifier("data' OR '1'='1")).toThrow(
        InvalidIdentifierError,
      );
    });
  });
});

describe("Security: needsQuoting", () => {
  describe("reserved keywords", () => {
    it("should return true for reserved keywords", () => {
      expect(needsQuoting("select")).toBe(true);
      expect(needsQuoting("from")).toBe(true);
      expect(needsQuoting("where")).toBe(true);
      expect(needsQuoting("table")).toBe(true);
      expect(needsQuoting("index")).toBe(true);
      expect(needsQuoting("order")).toBe(true);
    });

    it("should be case-insensitive for keywords", () => {
      expect(needsQuoting("SELECT")).toBe(true); // Also mixed case triggers
      expect(needsQuoting("Table")).toBe(true);
    });
  });

  describe("mixed case identifiers", () => {
    it("should return true for mixed case", () => {
      expect(needsQuoting("UserData")).toBe(true);
      expect(needsQuoting("myTable")).toBe(true);
      expect(needsQuoting("TableName")).toBe(true);
    });
  });

  describe("underscore prefix", () => {
    it("should return true for underscore-prefixed identifiers", () => {
      expect(needsQuoting("_internal")).toBe(true);
      expect(needsQuoting("_private")).toBe(true);
    });
  });

  describe("safe identifiers", () => {
    it("should return false for simple lowercase identifiers", () => {
      expect(needsQuoting("users")).toBe(false);
      expect(needsQuoting("data")).toBe(false);
      expect(needsQuoting("my_table")).toBe(false);
    });
  });
});

describe("Security: sanitizeColumnRef", () => {
  describe("without table qualifier", () => {
    it("should sanitize column name only", () => {
      expect(sanitizeColumnRef("id")).toBe('"id"');
      expect(sanitizeColumnRef("user_name")).toBe('"user_name"');
    });
  });

  describe("with table qualifier", () => {
    it("should sanitize both table and column", () => {
      expect(sanitizeColumnRef("id", "users")).toBe('"users"."id"');
      expect(sanitizeColumnRef("name", "orders")).toBe('"orders"."name"');
    });

    it("should handle reserved keywords in both parts", () => {
      expect(sanitizeColumnRef("select", "from")).toBe('"from"."select"');
    });
  });

  describe("invalid references", () => {
    it("should throw for invalid column names", () => {
      expect(() => sanitizeColumnRef("id;DROP")).toThrow(
        InvalidIdentifierError,
      );
    });

    it("should throw for invalid table names", () => {
      expect(() => sanitizeColumnRef("id", "users;--")).toThrow(
        InvalidIdentifierError,
      );
    });
  });
});

describe("Security: sanitizeIdentifiers", () => {
  it("should sanitize an array of identifiers", () => {
    const result = sanitizeIdentifiers(["id", "name", "email"]);
    expect(result).toEqual(['"id"', '"name"', '"email"']);
  });

  it("should handle empty array", () => {
    expect(sanitizeIdentifiers([])).toEqual([]);
  });

  it("should throw if any identifier is invalid", () => {
    expect(() => sanitizeIdentifiers(["id", "invalid;name", "email"])).toThrow(
      InvalidIdentifierError,
    );
  });

  it("should handle reserved keywords in array", () => {
    const result = sanitizeIdentifiers(["select", "from", "where"]);
    expect(result).toEqual(['"select"', '"from"', '"where"']);
  });
});

describe("Security: createColumnList", () => {
  it("should create comma-separated list", () => {
    const result = createColumnList(["id", "name", "email"]);
    expect(result).toBe('"id", "name", "email"');
  });

  it("should handle single column", () => {
    expect(createColumnList(["id"])).toBe('"id"');
  });

  it("should handle empty array", () => {
    expect(createColumnList([])).toBe("");
  });

  it("should throw if any column is invalid", () => {
    expect(() => createColumnList(["id", "bad;col"])).toThrow(
      InvalidIdentifierError,
    );
  });
});

describe("Security: sanitizeIndexName", () => {
  it("should sanitize valid index names", () => {
    expect(sanitizeIndexName("idx_users_email")).toBe('"idx_users_email"');
    expect(sanitizeIndexName("pk_orders")).toBe('"pk_orders"');
  });

  it("should throw for invalid index names", () => {
    expect(() => sanitizeIndexName("idx;DROP")).toThrow(InvalidIdentifierError);
    expect(() => sanitizeIndexName("")).toThrow(InvalidIdentifierError);
  });

  it("should handle reserved keywords as index names", () => {
    // When quoting, reserved keywords become valid
    expect(sanitizeIndexName("index")).toBe('"index"');
  });
});
