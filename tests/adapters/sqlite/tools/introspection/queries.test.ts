/**
 * Introspection Tools Tests - Queries & Profiling
 *
 * Tests for SQLite DB profiling and query analysis tools:
 * storage_analysis, index_audit, query_plan.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createTestAdapter,
  type TestAdapter,
} from "../../../../utils/test-adapter.js";

describe("Introspection Query Tools", () => {
  let adapter: TestAdapter;
  let tools: Map<string, (params: unknown) => Promise<unknown>>;

  beforeEach(async () => {
    adapter = createTestAdapter();
    await adapter.connect({
      type: "sqlite",
      connectionString: ":memory:",
    });

    tools = new Map();
    const toolDefs = adapter.getToolDefinitions();
    const context = { scopes: ["read", "write", "admin"] };

    for (const tool of toolDefs) {
      tools.set(tool.name, (params) => tool.handler(params, context as never));
    }

    // Enable foreign keys (required for PRAGMA foreign_key_list)
    await adapter.executeWriteQuery("PRAGMA foreign_keys = ON");

    // Set up schema with FK relationships for introspection
    await adapter.executeWriteQuery(
      "CREATE TABLE departments (id INTEGER PRIMARY KEY, name TEXT NOT NULL)",
    );
    await adapter.executeWriteQuery(
      `CREATE TABLE employees (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        dept_id INTEGER REFERENCES departments(id) ON DELETE CASCADE
      )`,
    );
    await adapter.executeWriteQuery(
      `CREATE TABLE projects (
        id INTEGER PRIMARY KEY,
        title TEXT NOT NULL,
        lead_id INTEGER REFERENCES employees(id) ON DELETE SET NULL
      )`,
    );
    await adapter.executeWriteQuery(
      "INSERT INTO departments (id, name) VALUES (1, 'Engineering'), (2, 'Marketing')",
    );
    await adapter.executeWriteQuery(
      "INSERT INTO employees (id, name, dept_id) VALUES (1, 'Alice', 1), (2, 'Bob', 2)",
    );
    await adapter.executeWriteQuery(
      "INSERT INTO projects (id, title, lead_id) VALUES (1, 'Alpha', 1)",
    );
  });

  afterEach(async () => {
    await adapter.disconnect();
  });

  // ===========================================================================
  // Storage Analysis
  // ===========================================================================

  describe("sqlite_storage_analysis", () => {
    it("should return database-level metrics", async () => {
      const result = (await tools.get("sqlite_storage_analysis")?.({})) as {
        success: boolean;
        database: {
          totalSizeBytes: number;
          pageSize: number;
          totalPages: number;
          freePages: number;
          fragmentationPct: number;
          journalMode: string;
          autoVacuum: string;
        };
        recommendations: { type: string; severity: string; message: string }[];
      };

      expect(result.success).toBe(true);
      expect(result.database).toBeDefined();
      expect(result.database.pageSize).toBeGreaterThan(0);
      expect(result.database.totalPages).toBeGreaterThan(0);
      expect(result.database.totalSizeBytes).toBe(
        result.database.pageSize * result.database.totalPages,
      );
      expect(result.database.journalMode).toBeDefined();
      expect(result.database.autoVacuum).toBeDefined();
    });

    it("should include per-table breakdown by default", async () => {
      const result = (await tools.get("sqlite_storage_analysis")?.({})) as {
        success: boolean;
        tables: {
          name: string;
          sizeBytes: number;
          rowCount: number;
          pctOfTotal: number;
        }[];
      };

      expect(result.success).toBe(true);
      expect(result.tables).toBeDefined();
      expect(result.tables.length).toBeGreaterThanOrEqual(3);
      // departments, employees, projects should all be present
      const names = result.tables.map((t) => t.name);
      expect(names).toContain("departments");
      expect(names).toContain("employees");
    });

    it("should omit tables when includeTableDetails is false", async () => {
      const result = (await tools.get("sqlite_storage_analysis")?.({
        includeTableDetails: false,
      })) as {
        success: boolean;
        tables?: unknown[];
      };

      expect(result.success).toBe(true);
      expect(result.tables).toBeUndefined();
    });

    it("should generate recommendations", async () => {
      const result = (await tools.get("sqlite_storage_analysis")?.({})) as {
        success: boolean;
        recommendations: { type: string; severity: string }[];
      };

      expect(result.success).toBe(true);
      expect(result.recommendations).toBeInstanceOf(Array);
    });
  });

  // ===========================================================================
  // Index Audit
  // ===========================================================================

  describe("sqlite_index_audit", () => {
    it("should detect missing FK indexes", async () => {
      const result = (await tools.get("sqlite_index_audit")?.({})) as {
        success: boolean;
        totalIndexes: number;
        findings: { type: string; table: string; column?: string; suggestion: string }[];
        summary: { redundant: number; missingFk: number; total: number };
      };

      expect(result.success).toBe(true);
      expect(result.findings).toBeInstanceOf(Array);
      // employees.dept_id and projects.lead_id have no indexes
      const missingFk = result.findings.filter(
        (f) => f.type === "missing_fk_index",
      );
      expect(missingFk.length).toBeGreaterThanOrEqual(1);
      expect(result.summary.missingFk).toBeGreaterThanOrEqual(1);
    });

    it("should detect redundant indexes", async () => {
      // Create a redundant pair: idx on (dept_id) is redundant when (dept_id, name) exists
      await adapter.executeWriteQuery(
        `CREATE INDEX idx_emp_dept ON employees(dept_id)`,
      );
      await adapter.executeWriteQuery(
        `CREATE INDEX idx_emp_dept_name ON employees(dept_id, name)`,
      );

      const result = (await tools.get("sqlite_index_audit")?.({})) as {
        success: boolean;
        findings: { type: string; index?: string; redundantOf?: string }[];
        summary: { redundant: number };
      };

      expect(result.success).toBe(true);
      const redundant = result.findings.filter(
        (f) => f.type === "redundant",
      );
      expect(redundant.length).toBeGreaterThanOrEqual(1);
      expect(redundant[0]?.index).toBe("idx_emp_dept");
      expect(redundant[0]?.redundantOf).toBe("idx_emp_dept_name");
    });

    it("should filter by table name", async () => {
      const result = (await tools.get("sqlite_index_audit")?.({
        table: "employees",
      })) as {
        success: boolean;
        findings: { table: string }[];
      };

      expect(result.success).toBe(true);
      for (const finding of result.findings) {
        expect(finding.table).toBe("employees");
      }
    });
  });

  // ===========================================================================
  // Query Plan
  // ===========================================================================

  describe("sqlite_query_plan", () => {
    it("should analyze a SELECT query", async () => {
      const result = (await tools.get("sqlite_query_plan")?.({
        sql: "SELECT * FROM employees WHERE dept_id = 1",
      })) as {
        success: boolean;
        sql: string;
        plan: { id: number; detail: string; scanType?: string }[];
        analysis: {
          fullScans: string[];
          indexScans: string[];
          estimatedEfficiency: string;
        };
      };

      expect(result.success).toBe(true);
      expect(result.sql).toContain("SELECT");
      expect(result.plan).toBeInstanceOf(Array);
      expect(result.plan.length).toBeGreaterThan(0);
      expect(result.analysis).toBeDefined();
      // No index on dept_id, so expect full scan
      expect(result.analysis.fullScans).toContain("employees");
    });

    it("should detect index usage", async () => {
      await adapter.executeWriteQuery(
        `CREATE INDEX idx_emp_dept ON employees(dept_id)`,
      );

      const result = (await tools.get("sqlite_query_plan")?.({
        sql: "SELECT * FROM employees WHERE dept_id = 1",
      })) as {
        success: boolean;
        analysis: { indexScans: string[]; fullScans: string[] };
      };

      expect(result.success).toBe(true);
      // With index, should no longer be a full scan
      expect(result.analysis.fullScans).not.toContain("employees");
    });

    it("should reject non-SELECT queries", async () => {
      const result = (await tools.get("sqlite_query_plan")?.({
        sql: "DELETE FROM employees WHERE id = 1",
      })) as {
        success: boolean;
        error?: string;
      };

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should generate suggestions for full scans", async () => {
      const result = (await tools.get("sqlite_query_plan")?.({
        sql: "SELECT * FROM employees WHERE name = 'Alice'",
      })) as {
        success: boolean;
        suggestions?: string[];
      };

      expect(result.success).toBe(true);
      expect(result.suggestions).toBeDefined();
      expect(result.suggestions?.length).toBeGreaterThan(0);
    });

    it("should handle CTE (WITH) queries", async () => {
      const result = (await tools.get("sqlite_query_plan")?.({
        sql: "WITH dept_counts AS (SELECT dept_id, COUNT(*) as cnt FROM employees GROUP BY dept_id) SELECT * FROM dept_counts",
      })) as {
        success: boolean;
        plan: { detail: string }[];
      };

      expect(result.success).toBe(true);
      expect(result.plan.length).toBeGreaterThan(0);
    });
  });
});
