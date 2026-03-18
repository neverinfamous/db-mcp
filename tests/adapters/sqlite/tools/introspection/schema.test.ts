/**
 * Introspection Tools Tests - Schema
 *
 * Tests for SQLite schema introspection tools:
 * dependency_graph, topological_sort, cascade_simulator,
 * schema_snapshot, constraint_analysis, migration_risks.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createTestAdapter,
  type TestAdapter,
} from "../../../../utils/test-adapter.js";

describe("Introspection Schema Tools", () => {
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
      // "root" = referenced by others but doesn't reference anything
      // departments is referenced by employees but has no outgoing FKs → root
      expect(result.stats.rootTables).toContain("departments");
      // "leaf" = references others but isn't referenced by anything
      // projects references employees but nothing references projects → leaf
      expect(result.stats.leafTables).toContain("projects");
      // They should be disjoint
      const intersection = result.stats.rootTables.filter((t: string) =>
        result.stats.leafTables.includes(t),
      );
      expect(intersection).toHaveLength(0);
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
      expect(result.affectedTables.some((t) => t.table === "employees")).toBe(
        true,
      );
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
      const result = (await tools.get("sqlite_constraint_analysis")?.({})) as {
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
    it("should assess DROP TABLE risks with FK dependents", async () => {
      const result = (await tools.get("sqlite_migration_risks")?.({
        statements: ["DROP TABLE departments"],
      })) as {
        success: boolean;
        risks: {
          riskLevel: string;
          category: string;
          description: string;
          mitigation?: string;
        }[];
        summary: {
          totalStatements: number;
          totalRisks: number;
          highestRisk: string;
        };
      };

      expect(result.success).toBe(true);
      expect(result.risks.length).toBeGreaterThan(0);
      expect(result.summary.highestRisk).toBe("critical");
      // Should mention dependent tables
      const dropRisk = result.risks.find((r) => r.category === "destructive");
      expect(dropRisk).toBeDefined();
      expect(dropRisk?.description).toContain("departments");
    });

    it("should assess ALTER TABLE DROP COLUMN risk", async () => {
      const result = (await tools.get("sqlite_migration_risks")?.({
        statements: ["ALTER TABLE employees DROP COLUMN name"],
      })) as {
        success: boolean;
        risks: { riskLevel: string; category: string }[];
      };

      expect(result.success).toBe(true);
      const alterRisk = result.risks.find(
        (r) => r.category === "alter_limitation",
      );
      expect(alterRisk).toBeDefined();
      expect(alterRisk?.riskLevel).toBe("high");
    });

    it("should assess ALTER TABLE RENAME COLUMN risk", async () => {
      const result = (await tools.get("sqlite_migration_risks")?.({
        statements: ["ALTER TABLE employees RENAME COLUMN name TO full_name"],
      })) as {
        success: boolean;
        risks: { riskLevel: string; category: string }[];
      };

      expect(result.success).toBe(true);
      const alterRisk = result.risks.find(
        (r) => r.category === "alter_limitation",
      );
      expect(alterRisk).toBeDefined();
      expect(alterRisk?.riskLevel).toBe("medium");
    });

    it("should assess ADD COLUMN NOT NULL without DEFAULT risk", async () => {
      const result = (await tools.get("sqlite_migration_risks")?.({
        statements: ["ALTER TABLE employees ADD COLUMN email TEXT NOT NULL"],
      })) as {
        success: boolean;
        risks: { riskLevel: string; category: string }[];
      };

      expect(result.success).toBe(true);
      const notNullRisk = result.risks.find(
        (r) => r.category === "alter_limitation" && r.riskLevel === "high",
      );
      expect(notNullRisk).toBeDefined();
    });

    it("should assess ADD COLUMN PRIMARY KEY as critical", async () => {
      const result = (await tools.get("sqlite_migration_risks")?.({
        statements: ["ALTER TABLE employees ADD COLUMN uuid TEXT PRIMARY KEY"],
      })) as {
        success: boolean;
        risks: { riskLevel: string; category: string }[];
        summary: { highestRisk: string };
      };

      expect(result.success).toBe(true);
      expect(result.summary.highestRisk).toBe("critical");
    });

    it("should assess ADD COLUMN UNIQUE risk", async () => {
      const result = (await tools.get("sqlite_migration_risks")?.({
        statements: ["ALTER TABLE employees ADD COLUMN badge TEXT UNIQUE"],
      })) as {
        success: boolean;
        risks: { riskLevel: string; category: string }[];
      };

      expect(result.success).toBe(true);
      const uniqueRisk = result.risks.find(
        (r) => r.riskLevel === "high" && r.category === "alter_limitation",
      );
      expect(uniqueRisk).toBeDefined();
    });

    it("should assess DROP INDEX risk", async () => {
      const result = (await tools.get("sqlite_migration_risks")?.({
        statements: ["DROP INDEX idx_something"],
      })) as {
        success: boolean;
        risks: { riskLevel: string; category: string }[];
      };

      expect(result.success).toBe(true);
      const indexRisk = result.risks.find(
        (r) => r.category === "index_removal",
      );
      expect(indexRisk).toBeDefined();
      expect(indexRisk?.riskLevel).toBe("medium");
    });

    it("should assess DELETE without WHERE as critical", async () => {
      const result = (await tools.get("sqlite_migration_risks")?.({
        statements: ["DELETE FROM employees"],
      })) as {
        success: boolean;
        risks: { riskLevel: string; category: string }[];
        summary: { highestRisk: string };
      };

      expect(result.success).toBe(true);
      expect(result.summary.highestRisk).toBe("critical");
      const deleteRisk = result.risks.find((r) => r.category === "destructive");
      expect(deleteRisk).toBeDefined();
    });

    it("should assess VACUUM risk", async () => {
      const result = (await tools.get("sqlite_migration_risks")?.({
        statements: ["VACUUM"],
      })) as {
        success: boolean;
        risks: { riskLevel: string; category: string }[];
      };

      expect(result.success).toBe(true);
      const vacuumRisk = result.risks.find((r) => r.category === "performance");
      expect(vacuumRisk).toBeDefined();
      expect(vacuumRisk?.riskLevel).toBe("medium");
    });

    it("should assess FTS5 virtual table creation", async () => {
      const result = (await tools.get("sqlite_migration_risks")?.({
        statements: [
          "CREATE VIRTUAL TABLE articles_fts USING fts5(title, body)",
        ],
      })) as {
        success: boolean;
        risks: { riskLevel: string; category: string }[];
      };

      expect(result.success).toBe(true);
      const ftsRisk = result.risks.find((r) => r.category === "fts5");
      expect(ftsRisk).toBeDefined();
      expect(ftsRisk?.riskLevel).toBe("low");
    });

    it("should assess transaction wrappers", async () => {
      const result = (await tools.get("sqlite_migration_risks")?.({
        statements: ["BEGIN", "COMMIT", "ROLLBACK"],
      })) as {
        success: boolean;
        risks: { riskLevel: string; category: string }[];
        summary: { totalStatements: number };
      };

      expect(result.success).toBe(true);
      expect(result.summary.totalStatements).toBe(3);
      const txnRisks = result.risks.filter((r) => r.category === "transaction");
      expect(txnRisks.length).toBe(3);
      expect(txnRisks.every((r) => r.riskLevel === "low")).toBe(true);
    });

    it("should assess DROP TABLE IF EXISTS for non-existent table", async () => {
      const result = (await tools.get("sqlite_migration_risks")?.({
        statements: ["DROP TABLE IF EXISTS nonexistent_xyz"],
      })) as {
        success: boolean;
        risks: { riskLevel: string; category: string }[];
      };

      expect(result.success).toBe(true);
      // Should still flag as high risk (destructive)
      const dropRisk = result.risks.find((r) => r.category === "destructive");
      expect(dropRisk).toBeDefined();
      expect(dropRisk?.riskLevel).toBe("high");
    });

    it("should handle creating a simple table with multiple statements", async () => {
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
      expect(result.risks.length).toBeGreaterThanOrEqual(1);
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
