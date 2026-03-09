/**
 * Introspection Tools Tests
 *
 * Tests for SQLite introspection tools:
 * dependency_graph, topological_sort, cascade_simulator,
 * schema_snapshot, constraint_analysis, migration_risks.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createTestAdapter,
  type TestAdapter,
} from "../../../utils/test-adapter.js";

describe("Introspection Tools", () => {
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
  // Dependency Graph
  // ===========================================================================

  describe("sqlite_dependency_graph", () => {
    it("should build a FK dependency graph", async () => {
      const result = (await tools.get("sqlite_dependency_graph")?.({})) as {
        success: boolean;
        nodes: { table: string }[];
        edges: { from: string; to: string }[];
        stats: {
          totalTables: number;
          totalRelationships: number;
          rootTables: string[];
          leafTables: string[];
        };
      };

      expect(result.success).toBe(true);
      expect(result.nodes.length).toBeGreaterThanOrEqual(3);
      expect(result.edges.length).toBe(2);
      expect(result.stats.totalTables).toBeGreaterThanOrEqual(3);
      expect(result.stats.totalRelationships).toBe(2);
    });

    it("should identify root and leaf tables", async () => {
      const result = (await tools.get("sqlite_dependency_graph")?.({})) as {
        success: boolean;
        stats: { rootTables: string[]; leafTables: string[] };
      };

      expect(result.success).toBe(true);
      // "root" = no incoming FK references (nothing points TO it)
      // projects has no incoming references, so it's a root
      expect(result.stats.rootTables).toContain("projects");
      // departments HAS incoming FKs from employees, so it's NOT a root
      expect(result.stats.leafTables).toContain("departments");
    });
  });

  // ===========================================================================
  // Topological Sort
  // ===========================================================================

  describe("sqlite_topological_sort", () => {
    it("should return safe creation order", async () => {
      const result = (await tools.get("sqlite_topological_sort")?.({})) as {
        success: boolean;
        order: { table: string; level: number; dependencies: string[] }[];
        hasCycles: boolean;
        direction: string;
      };

      expect(result.success).toBe(true);
      expect(result.hasCycles).toBe(false);
      expect(result.order).toBeInstanceOf(Array);
      expect(result.order.length).toBeGreaterThanOrEqual(3);
      expect(result.direction).toBe("create");

      // departments must appear before employees (FK dependency)
      const tableNames = result.order.map((o) => o.table);
      const deptIdx = tableNames.indexOf("departments");
      const empIdx = tableNames.indexOf("employees");
      expect(deptIdx).toBeLessThan(empIdx);
    });

    it("should support reverse order for drops", async () => {
      const result = (await tools.get("sqlite_topological_sort")?.({
        direction: "drop",
      })) as {
        success: boolean;
        order: { table: string }[];
        direction: string;
      };

      expect(result.success).toBe(true);
      expect(result.direction).toBe("drop");

      // In reverse, employees should come before departments
      const tableNames = result.order.map((o) => o.table);
      const deptIdx = tableNames.indexOf("departments");
      const empIdx = tableNames.indexOf("employees");
      expect(empIdx).toBeLessThan(deptIdx);
    });
  });

  // ===========================================================================
  // Cascade Simulator
  // ===========================================================================

  describe("sqlite_cascade_simulator", () => {
    it("should simulate cascading deletes", async () => {
      const result = (await tools.get("sqlite_cascade_simulator")?.({
        table: "departments",
      })) as {
        success: boolean;
        sourceTable: string;
        affectedTables: { table: string; action: string; depth: number }[];
        severity: string;
      };

      expect(result.success).toBe(true);
      expect(result.sourceTable).toBe("departments");
      // employees CASCADE → should appear
      expect(
        result.affectedTables.some((t) => t.table === "employees"),
      ).toBe(true);
    });

    it("should return empty affected list for leaf tables", async () => {
      const result = (await tools.get("sqlite_cascade_simulator")?.({
        table: "projects",
      })) as {
        success: boolean;
        affectedTables: { table: string }[];
      };

      expect(result.success).toBe(true);
      // projects is a leaf — no tables reference it via FK
      expect(result.affectedTables.length).toBe(0);
    });

    it("should handle nonexistent table gracefully", async () => {
      const result = (await tools.get("sqlite_cascade_simulator")?.({
        table: "nonexistent_table_xyz",
      })) as {
        success: boolean;
        error?: string;
      };

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  // ===========================================================================
  // Schema Snapshot
  // ===========================================================================

  describe("sqlite_schema_snapshot", () => {
    it("should capture full schema snapshot", async () => {
      const result = (await tools.get("sqlite_schema_snapshot")?.({})) as {
        success: boolean;
        snapshot: {
          tables: { name: string; columnCount: number }[];
        };
        stats: {
          tables: number;
          views: number;
          indexes: number;
          triggers: number;
        };
        generatedAt: string;
      };

      expect(result.success).toBe(true);
      expect(result.snapshot).toBeDefined();
      expect(result.snapshot.tables.length).toBeGreaterThanOrEqual(3);
      expect(result.stats).toBeDefined();
      expect(result.stats.tables).toBeGreaterThanOrEqual(3);
      expect(result.generatedAt).toBeDefined();
    });

    it("should filter sections", async () => {
      const result = (await tools.get("sqlite_schema_snapshot")?.({
        sections: ["tables"],
      })) as {
        success: boolean;
        snapshot: {
          tables: unknown[];
          views?: unknown[];
          indexes?: unknown[];
          triggers?: unknown[];
        };
      };

      expect(result.success).toBe(true);
      expect(result.snapshot).toBeDefined();
      expect(result.snapshot.tables).toBeDefined();
    });

    it("should support compact mode", async () => {
      const full = (await tools.get("sqlite_schema_snapshot")?.({})) as {
        snapshot: {
          tables: { columns?: unknown[] }[];
        };
      };
      const compact = (await tools.get("sqlite_schema_snapshot")?.({
        compact: true,
      })) as {
        snapshot: {
          tables: { columns?: unknown[] }[];
        };
      };

      // Full includes column details, compact omits them
      const fullFirstTable = full.snapshot.tables[0];
      const compactFirstTable = compact.snapshot.tables[0];
      expect(fullFirstTable?.columns).toBeDefined();
      expect(compactFirstTable?.columns).toBeUndefined();
    });
  });

  // ===========================================================================
  // Constraint Analysis
  // ===========================================================================

  describe("sqlite_constraint_analysis", () => {
    it("should analyze all constraints", async () => {
      const result = (await tools.get("sqlite_constraint_analysis")?.(
        {},
      )) as {
        success: boolean;
        findings: { type: string; severity: string; table: string }[];
        summary: {
          totalFindings: number;
          byType: Record<string, number>;
          bySeverity: Record<string, number>;
        };
      };

      expect(result.success).toBe(true);
      expect(result.findings).toBeInstanceOf(Array);
      expect(result.summary).toBeDefined();
      expect(result.summary.totalFindings).toBeGreaterThanOrEqual(0);
    });

    it("should analyze specific table", async () => {
      const result = (await tools.get("sqlite_constraint_analysis")?.({
        table: "employees",
      })) as {
        success: boolean;
        findings: { type: string; table: string }[];
      };

      expect(result.success).toBe(true);
      // All findings should relate to the specified table
      for (const finding of result.findings) {
        expect(finding.table).toBe("employees");
      }
    });

    it("should filter by check type", async () => {
      const result = (await tools.get("sqlite_constraint_analysis")?.({
        checks: ["unindexed_fk"],
      })) as {
        success: boolean;
        findings: { type: string }[];
      };

      expect(result.success).toBe(true);
      // All findings should be of the specified type
      for (const finding of result.findings) {
        expect(finding.type).toBe("unindexed_fk");
      }
    });
  });

  // ===========================================================================
  // Migration Risks
  // ===========================================================================

  describe("sqlite_migration_risks", () => {
    it("should assess DROP TABLE risks", async () => {
      const result = (await tools.get("sqlite_migration_risks")?.({
        statements: ["DROP TABLE departments"],
      })) as {
        success: boolean;
        risks: { riskLevel: string; category: string }[];
        summary: {
          totalStatements: number;
          totalRisks: number;
          highestRisk: string;
        };
      };

      expect(result.success).toBe(true);
      expect(result.risks.length).toBeGreaterThan(0);
      expect(result.summary.totalRisks).toBeGreaterThan(0);
    });

    it("should assess ALTER TABLE risk", async () => {
      const result = (await tools.get("sqlite_migration_risks")?.({
        statements: ["ALTER TABLE employees ADD COLUMN email TEXT"],
      })) as {
        success: boolean;
        risks: { riskLevel: string }[];
      };

      expect(result.success).toBe(true);
    });

    it("should assess CREATE TABLE as low risk", async () => {
      const result = (await tools.get("sqlite_migration_risks")?.({
        statements: ["CREATE TABLE new_table (id INTEGER PRIMARY KEY)"],
      })) as {
        success: boolean;
        risks: { riskLevel: string }[];
        summary: { highestRisk: string };
      };

      expect(result.success).toBe(true);
      expect(result.summary.highestRisk).toBe("low");
    });

    it("should handle multiple statements", async () => {
      const result = (await tools.get("sqlite_migration_risks")?.({
        statements: [
          "CREATE TABLE logs (id INTEGER PRIMARY KEY, msg TEXT)",
          "DROP TABLE departments",
          "ALTER TABLE employees ADD COLUMN email TEXT",
        ],
      })) as {
        success: boolean;
        risks: { statementIndex: number }[];
        summary: { totalStatements: number };
      };

      expect(result.success).toBe(true);
      expect(result.summary.totalStatements).toBe(3);
      // CREATE TABLE is safe and may not generate a risk entry
      expect(result.risks.length).toBeGreaterThanOrEqual(1);
    });
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

  // ===========================================================================
  // Error Handling
  // ===========================================================================

  describe("error handling", () => {
    it("should return structured error for nonexistent cascade table", async () => {
      const result = (await tools.get("sqlite_cascade_simulator")?.({
        table: "nonexistent_table_xyz",
      })) as {
        success: boolean;
        error?: string;
      };

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});
