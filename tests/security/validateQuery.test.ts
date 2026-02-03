/**
 * DatabaseAdapter.validateQuery Security Tests
 *
 * Tests for the protected validateQuery method which is critical
 * for SQL injection prevention.
 *
 * Priority 5 of db-mcp Test Coverage Improvement Plan
 */

import { describe, it, expect, beforeAll } from "vitest";
import { DatabaseAdapter } from "../../src/adapters/DatabaseAdapter.js";
import type {
  DatabaseConfig,
  QueryResult,
  HealthStatus,
  SchemaInfo,
  TableInfo,
  AdapterCapabilities,
  ToolDefinition,
  ResourceDefinition,
  PromptDefinition,
  ToolGroup,
} from "../../src/types/index.js";

/**
 * Testable concrete adapter that exposes the protected validateQuery method.
 * All abstract methods are stubbed since we're only testing validateQuery.
 */
class TestableAdapter extends DatabaseAdapter {
  readonly type = "sqlite" as const;
  readonly name = "TestAdapter";
  readonly version = "1.0.0";

  async connect(_config: DatabaseConfig): Promise<void> {
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  async getHealth(): Promise<HealthStatus> {
    return { connected: true };
  }

  async executeReadQuery(
    _sql: string,
    _params?: unknown[],
  ): Promise<QueryResult> {
    return { rows: [], columns: [] };
  }

  async executeWriteQuery(
    _sql: string,
    _params?: unknown[],
    _skipValidation?: boolean,
  ): Promise<QueryResult> {
    return { rows: [], rowsAffected: 0 };
  }

  async executeQuery(_sql: string, _params?: unknown[]): Promise<QueryResult> {
    return { rows: [], columns: [] };
  }

  async getSchema(): Promise<SchemaInfo> {
    return { tables: [], views: [], indexes: [] };
  }

  async listTables(): Promise<TableInfo[]> {
    return [];
  }

  async describeTable(_tableName: string): Promise<TableInfo> {
    return { name: "", type: "table", columns: [] };
  }

  async listSchemas(): Promise<string[]> {
    return [];
  }

  getCapabilities(): AdapterCapabilities {
    return {
      json: true,
      fullTextSearch: true,
      vector: false,
      geospatial: false,
      transactions: true,
      preparedStatements: true,
      connectionPooling: false,
    };
  }

  getSupportedToolGroups(): ToolGroup[] {
    return ["core"];
  }

  getToolDefinitions(): ToolDefinition[] {
    return [];
  }

  getResourceDefinitions(): ResourceDefinition[] {
    return [];
  }

  getPromptDefinitions(): PromptDefinition[] {
    return [];
  }

  // Stub required registration methods
  registerTool(): void {}
  registerResource(): void {}
  registerPrompt(): void {}

  /**
   * Expose protected method for testing
   */
  public testValidateQuery(sql: string, isReadOnly: boolean): void {
    this.validateQuery(sql, isReadOnly);
  }
}

describe("DatabaseAdapter.validateQuery Security", () => {
  let adapter: TestableAdapter;

  beforeAll(() => {
    adapter = new TestableAdapter();
  });

  describe("read-only mode restrictions", () => {
    it("should block INSERT statements in read-only mode", () => {
      expect(() =>
        adapter.testValidateQuery("INSERT INTO users VALUES (1)", true),
      ).toThrow(/Read-only mode/);
      expect(() =>
        adapter.testValidateQuery("INSERT INTO users VALUES (1)", true),
      ).toThrow(/INSERT/);
    });

    it("should block UPDATE statements in read-only mode", () => {
      expect(() =>
        adapter.testValidateQuery("UPDATE users SET name = 'x'", true),
      ).toThrow(/Read-only mode/);
    });

    it("should block DELETE statements in read-only mode", () => {
      expect(() =>
        adapter.testValidateQuery("DELETE FROM users", true),
      ).toThrow(/Read-only mode/);
    });

    it("should block DROP statements in read-only mode", () => {
      expect(() => adapter.testValidateQuery("DROP TABLE users", true)).toThrow(
        /Read-only mode/,
      );
    });

    it("should block CREATE statements in read-only mode", () => {
      expect(() =>
        adapter.testValidateQuery("CREATE TABLE test (id INT)", true),
      ).toThrow(/Read-only mode/);
    });

    it("should block ALTER statements in read-only mode", () => {
      expect(() =>
        adapter.testValidateQuery("ALTER TABLE users ADD COLUMN x INT", true),
      ).toThrow(/Read-only mode/);
    });

    it("should block TRUNCATE statements in read-only mode", () => {
      expect(() =>
        adapter.testValidateQuery("TRUNCATE TABLE users", true),
      ).toThrow(/Read-only mode/);
    });

    it("should allow SELECT in read-only mode", () => {
      expect(() =>
        adapter.testValidateQuery("SELECT * FROM users", true),
      ).not.toThrow();
    });

    it("should allow PRAGMA in read-only mode", () => {
      expect(() =>
        adapter.testValidateQuery("PRAGMA table_info(users)", true),
      ).not.toThrow();
    });
  });

  describe("dangerous pattern detection", () => {
    it("should block semicolon + DROP injection", () => {
      expect(() =>
        adapter.testValidateQuery(
          "SELECT * FROM users; DROP TABLE users",
          false,
        ),
      ).toThrow(/dangerous patterns/);
    });

    it("should block semicolon + DELETE injection", () => {
      expect(() =>
        adapter.testValidateQuery(
          "SELECT * FROM users; DELETE FROM users",
          false,
        ),
      ).toThrow(/dangerous patterns/);
    });

    it("should block semicolon + TRUNCATE injection", () => {
      expect(() =>
        adapter.testValidateQuery(
          "SELECT * FROM users; TRUNCATE TABLE users",
          false,
        ),
      ).toThrow(/dangerous patterns/);
    });

    it("should block SQL line comments (injection vector)", () => {
      expect(() =>
        adapter.testValidateQuery("SELECT * FROM users -- ignore rest", false),
      ).toThrow(/dangerous patterns/);
    });

    it("should block SQL block comments (injection vector)", () => {
      expect(() =>
        adapter.testValidateQuery("SELECT * FROM users /* comment */", false),
      ).toThrow(/dangerous patterns/);
    });

    it("should be case-insensitive for dangerous patterns", () => {
      expect(() =>
        adapter.testValidateQuery("SELECT 1; drop table users", false),
      ).toThrow(/dangerous patterns/);

      expect(() =>
        adapter.testValidateQuery("SELECT 1; DrOp TABLE users", false),
      ).toThrow(/dangerous patterns/);
    });
  });

  describe("safe queries", () => {
    it("should allow valid SELECT queries", () => {
      expect(() =>
        adapter.testValidateQuery(
          "SELECT id, name FROM users WHERE id = 1",
          true,
        ),
      ).not.toThrow();
    });

    it("should allow INSERT in non-read-only mode", () => {
      expect(() =>
        adapter.testValidateQuery(
          "INSERT INTO users (name) VALUES ('test')",
          false,
        ),
      ).not.toThrow();
    });

    it("should allow UPDATE in non-read-only mode", () => {
      expect(() =>
        adapter.testValidateQuery(
          "UPDATE users SET name = 'test' WHERE id = 1",
          false,
        ),
      ).not.toThrow();
    });

    it("should allow DELETE in non-read-only mode", () => {
      expect(() =>
        adapter.testValidateQuery("DELETE FROM users WHERE id = 1", false),
      ).not.toThrow();
    });

    it("should handle queries with whitespace", () => {
      expect(() =>
        adapter.testValidateQuery("  SELECT * FROM users  ", true),
      ).not.toThrow();
    });

    it("should handle queries with newlines", () => {
      expect(() =>
        adapter.testValidateQuery("SELECT *\nFROM users\nWHERE id = 1", true),
      ).not.toThrow();
    });
  });

  describe("edge cases", () => {
    it("should handle empty query", () => {
      // Empty query is allowed by validateQuery - validation happens elsewhere
      expect(() => adapter.testValidateQuery("", true)).not.toThrow();
    });

    it("should handle whitespace-only query", () => {
      expect(() => adapter.testValidateQuery("   ", true)).not.toThrow();
    });
  });
});
