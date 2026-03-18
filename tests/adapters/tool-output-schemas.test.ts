/**
 * Tool Output Schema Invariant Tests
 *
 * Structural invariant: EVERY tool must have an `outputSchema` defined,
 * the schema must be a valid Zod schema (has `.parse()`), and it must
 * NOT be defined inline (all schemas should be imported from the
 * centralized `output-schemas/` directory).
 *
 * Covers both WASM (SqliteAdapter) and Native (NativeSqliteAdapter) tool sets.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { NativeSqliteAdapter } from "../../src/adapters/sqlite-native/native-sqlite-adapter.js";
import { SqliteAdapter } from "../../src/adapters/sqlite/sqlite-adapter.js";
import type { ToolDefinition } from "../../src/types/index.js";

// Import ALL exported output schemas from the barrel to verify wiring
import * as OutputSchemas from "../../src/adapters/sqlite/output-schemas/index.js";

// =============================================================================
// Test Helpers
// =============================================================================

/**
 * Check if a value looks like a Zod schema (has a .parse method).
 */
function isZodSchema(value: unknown): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    "parse" in value &&
    typeof (value as { parse: unknown }).parse === "function"
  );
}

/**
 * Get all exported OutputSchema names from the barrel.
 * Filters to only names ending with "OutputSchema".
 */
function getExportedSchemaNames(): string[] {
  return Object.keys(OutputSchemas).filter((key) =>
    key.endsWith("OutputSchema"),
  );
}

/**
 * Collect all unique outputSchema references from tool definitions.
 * Returns a Set of the actual schema objects for identity comparison.
 */
function collectToolSchemaRefs(tools: ToolDefinition[]): Set<unknown> {
  const refs = new Set<unknown>();
  for (const tool of tools) {
    if (tool.outputSchema) {
      refs.add(tool.outputSchema);
    }
  }
  return refs;
}

// =============================================================================
// Native Adapter (better-sqlite3) — All 139+ tools
// =============================================================================

describe("Tool Output Schema Invariants (Native)", () => {
  let adapter: NativeSqliteAdapter;
  let tools: ToolDefinition[];

  beforeEach(async () => {
    adapter = new NativeSqliteAdapter();
    await adapter.connect({ type: "sqlite", filePath: ":memory:" });
    tools = adapter.getToolDefinitions();
  });

  afterEach(async () => {
    if (adapter.isConnected()) {
      await adapter.disconnect();
    }
  });

  // ==========================================================================
  // Core Invariants
  // ==========================================================================

  it("should have tool definitions", () => {
    expect(tools.length).toBeGreaterThan(100);
  });

  it("every tool must have outputSchema defined", () => {
    const violations: string[] = [];
    for (const tool of tools) {
      if (!tool.outputSchema) {
        violations.push(`${tool.name} (group: ${tool.group})`);
      }
    }
    expect(
      violations,
      `${violations.length} tool(s) missing outputSchema:\n  ${violations.join("\n  ")}`,
    ).toHaveLength(0);
  });

  it("every outputSchema must be a valid Zod schema", () => {
    const violations: string[] = [];
    for (const tool of tools) {
      if (tool.outputSchema && !isZodSchema(tool.outputSchema)) {
        violations.push(
          `${tool.name} (group: ${tool.group}) - outputSchema has no .parse() method`,
        );
      }
    }
    expect(
      violations,
      `${violations.length} tool(s) with invalid outputSchema:\n  ${violations.join("\n  ")}`,
    ).toHaveLength(0);
  });

  it("every outputSchema must accept {success: false, error: '...'}", () => {
    // Every schema should be tolerant of error responses
    const violations: string[] = [];
    for (const tool of tools) {
      if (tool.outputSchema && isZodSchema(tool.outputSchema)) {
        try {
          const schema = tool.outputSchema as {
            parse: (v: unknown) => unknown;
          };
          schema.parse({ success: false, error: "test error" });
        } catch {
          violations.push(`${tool.name} (group: ${tool.group})`);
        }
      }
    }
    expect(
      violations,
      `${violations.length} outputSchema(s) reject error responses:\n  ${violations.join("\n  ")}`,
    ).toHaveLength(0);
  });

  // ==========================================================================
  // Per-Group Checks
  // ==========================================================================

  describe("per-group outputSchema coverage", () => {
    const allGroups = [
      "core",
      "json",
      "text",
      "stats",
      "vector",
      "admin",
      "geo",
      "introspection",
      "migration",
    ];

    for (const group of allGroups) {
      it(`all ${group} tools should have outputSchema`, () => {
        const groupTools = tools.filter((t) => t.group === group);
        if (groupTools.length === 0) return;

        const missing: string[] = [];
        for (const tool of groupTools) {
          if (!tool.outputSchema) {
            missing.push(tool.name);
          }
        }
        expect(
          missing,
          `${group} tools missing outputSchema:\n  ${missing.join("\n  ")}`,
        ).toHaveLength(0);
      });
    }
  });

  // ==========================================================================
  // Schema Wiring Checks — schemas reference centralized schemas
  // ==========================================================================

  describe("schema wiring", () => {
    it("exported OutputSchema count should match or exceed unique tool schemas", () => {
      const exportedNames = getExportedSchemaNames();
      const toolSchemaRefs = collectToolSchemaRefs(tools);

      // Some schemas are shared across tools (e.g., FtsSearchOutputSchema for
      // both fts_search and fts_match_info, CreateTableOutputSchema for both
      // create_table and vector_create_table). And some schemas
      // (ErrorFieldsMixin, RowRecordSchema) are building blocks, not tool schemas.
      // So ≥ is the right comparison.
      expect(exportedNames.length).toBeGreaterThanOrEqual(
        toolSchemaRefs.size - 1,
      );
      // The -1 accounts for ExecuteCodeOutputSchema which is inline in codemode.ts
    });

    it("every tool outputSchema should reference a centralized schema (no inline z.object())", () => {
      // Build a set of all exported schema references from the barrel
      const exportedSchemaRefs = new Set<unknown>();
      for (const [key, value] of Object.entries(OutputSchemas)) {
        if (key.endsWith("OutputSchema")) {
          exportedSchemaRefs.add(value);
        }
      }

      const inlineViolations: string[] = [];
      for (const tool of tools) {
        if (tool.outputSchema && !exportedSchemaRefs.has(tool.outputSchema)) {
          inlineViolations.push(`${tool.name} (group: ${tool.group})`);
        }
      }

      // Known exception: ExecuteCodeOutputSchema is inline in codemode.ts
      // because it's the only codemode tool and has a unique structure.
      const knownInline = new Set(["sqlite_execute_code"]);
      const unexpectedInline = inlineViolations.filter(
        (v) => !knownInline.has(v.split(" ")[0]),
      );

      expect(
        unexpectedInline,
        `${unexpectedInline.length} tool(s) with inline outputSchema (not from output-schemas/):\n  ${unexpectedInline.join("\n  ")}\nKnown exceptions: ${[...knownInline].join(", ")}`,
      ).toHaveLength(0);
    });
  });

  // ==========================================================================
  // Specific Tool Schema Checks
  // ==========================================================================

  describe("specific tool schema references", () => {
    const toolSchemaMapping: [string, string][] = [
      // Core tools
      ["sqlite_read_query", "ReadQueryOutputSchema"],
      ["sqlite_write_query", "WriteQueryOutputSchema"],
      ["sqlite_create_table", "CreateTableOutputSchema"],
      ["sqlite_list_tables", "ListTablesOutputSchema"],
      ["sqlite_describe_table", "DescribeTableOutputSchema"],
      ["sqlite_drop_table", "DropTableOutputSchema"],
      ["sqlite_get_indexes", "GetIndexesOutputSchema"],
      ["sqlite_create_index", "CreateIndexOutputSchema"],
      ["sqlite_drop_index", "DropIndexOutputSchema"],

      // Stats tools
      ["sqlite_stats_basic", "StatsBasicOutputSchema"],
      ["sqlite_stats_count", "StatsCountOutputSchema"],
      ["sqlite_stats_group_by", "StatsGroupByOutputSchema"],
      ["sqlite_stats_histogram", "StatsHistogramOutputSchema"],
      ["sqlite_stats_percentile", "StatsPercentileOutputSchema"],
      ["sqlite_stats_correlation", "StatsCorrelationOutputSchema"],
      ["sqlite_stats_top_n", "StatsTopNOutputSchema"],
      ["sqlite_stats_distinct", "StatsDistinctOutputSchema"],
      ["sqlite_stats_summary", "StatsSummaryOutputSchema"],
      ["sqlite_stats_frequency", "StatsFrequencyOutputSchema"],
      ["sqlite_stats_outliers", "StatsOutliersOutputSchema"],
      ["sqlite_stats_regression", "StatsRegressionOutputSchema"],
      ["sqlite_stats_hypothesis", "StatsHypothesisOutputSchema"],

      // Window function tools
      ["sqlite_window_row_number", "WindowRowNumberOutputSchema"],
      ["sqlite_window_rank", "WindowRankOutputSchema"],
      ["sqlite_window_lag_lead", "WindowLagLeadOutputSchema"],
      ["sqlite_window_running_total", "WindowRunningTotalOutputSchema"],
      ["sqlite_window_moving_avg", "WindowMovingAvgOutputSchema"],
      ["sqlite_window_ntile", "WindowNtileOutputSchema"],

      // Transaction tools
      ["sqlite_transaction_begin", "TransactionBeginOutputSchema"],
      ["sqlite_transaction_commit", "TransactionCommitOutputSchema"],
      ["sqlite_transaction_rollback", "TransactionRollbackOutputSchema"],
      ["sqlite_transaction_savepoint", "TransactionSavepointOutputSchema"],
      ["sqlite_transaction_release", "TransactionReleaseOutputSchema"],
      ["sqlite_transaction_rollback_to", "TransactionRollbackToOutputSchema"],
      ["sqlite_transaction_execute", "TransactionExecuteOutputSchema"],

      // Vector tools
      ["sqlite_vector_search", "VectorSearchOutputSchema"],
      ["sqlite_vector_store", "VectorStoreOutputSchema"],
      ["sqlite_vector_batch_store", "VectorBatchStoreOutputSchema"],
      ["sqlite_vector_get", "VectorGetOutputSchema"],
      ["sqlite_vector_delete", "VectorDeleteOutputSchema"],
      ["sqlite_vector_count", "VectorCountOutputSchema"],
      ["sqlite_vector_stats", "VectorStatsOutputSchema"],
      ["sqlite_vector_dimensions", "VectorDimensionsOutputSchema"],
      ["sqlite_vector_normalize", "VectorNormalizeOutputSchema"],
      ["sqlite_vector_distance", "VectorDistanceOutputSchema"],
      ["sqlite_vector_create_table", "CreateTableOutputSchema"],

      // FTS tools
      ["sqlite_fts_create", "FtsCreateOutputSchema"],
      ["sqlite_fts_search", "FtsSearchOutputSchema"],
      ["sqlite_fts_rebuild", "FtsRebuildOutputSchema"],
      ["sqlite_fts_match_info", "FtsSearchOutputSchema"],

      // Admin tools
      ["sqlite_vacuum", "VacuumOutputSchema"],
      ["sqlite_backup", "BackupOutputSchema"],
      ["sqlite_restore", "RestoreOutputSchema"],
      ["sqlite_verify_backup", "VerifyBackupOutputSchema"],
      ["sqlite_analyze", "AnalyzeOutputSchema"],
      ["sqlite_optimize", "OptimizeOutputSchema"],
      ["sqlite_integrity_check", "IntegrityCheckOutputSchema"],
      ["sqlite_pragma_settings", "PragmaSettingsOutputSchema"],
      ["sqlite_pragma_compile_options", "PragmaCompileOptionsOutputSchema"],
      ["sqlite_pragma_database_list", "PragmaDatabaseListOutputSchema"],
      ["sqlite_pragma_optimize", "PragmaOptimizeOutputSchema"],
      ["sqlite_pragma_table_info", "PragmaTableInfoOutputSchema"],
      ["sqlite_index_stats", "IndexStatsOutputSchema"],
      ["sqlite_append_insight", "AppendInsightOutputSchema"],
      ["sqlite_dbstat", "DbstatOutputSchema"],

      // SpatiaLite tools
      ["sqlite_spatialite_load", "SpatialiteLoadOutputSchema"],
      ["sqlite_spatialite_create_table", "SpatialiteCreateTableOutputSchema"],
      ["sqlite_spatialite_query", "SpatialiteQueryOutputSchema"],
      ["sqlite_spatialite_index", "SpatialiteIndexOutputSchema"],
      ["sqlite_spatialite_analyze", "SpatialiteAnalyzeOutputSchema"],
      ["sqlite_spatialite_transform", "SpatialiteTransformOutputSchema"],
      ["sqlite_spatialite_import", "SpatialiteImportOutputSchema"],
    ];

    for (const [toolName, schemaName] of toolSchemaMapping) {
      it(`${toolName} should reference ${schemaName}`, () => {
        const tool = tools.find((t) => t.name === toolName);
        expect(tool, `tool '${toolName}' not found`).toBeDefined();

        const expectedSchema =
          OutputSchemas[schemaName as keyof typeof OutputSchemas];
        expect(
          expectedSchema,
          `schema '${schemaName}' not exported from output-schemas/`,
        ).toBeDefined();

        expect(
          tool?.outputSchema,
          `${toolName} outputSchema is undefined`,
        ).toBeDefined();
        expect(
          tool?.outputSchema === expectedSchema,
          `${toolName} outputSchema does not reference ${schemaName} from output-schemas/`,
        ).toBe(true);
      });
    }
  });

  // ==========================================================================
  // Orphan Detection — schemas exported but not used by any tool
  // ==========================================================================

  describe("orphan schema detection", () => {
    it("every exported OutputSchema should be referenced by at least one tool", () => {
      const toolSchemaRefs = collectToolSchemaRefs(tools);
      const exportedNames = getExportedSchemaNames();

      const orphans: string[] = [];
      for (const name of exportedNames) {
        const schema = OutputSchemas[name as keyof typeof OutputSchemas];
        if (!toolSchemaRefs.has(schema)) {
          orphans.push(name);
        }
      }

      expect(
        orphans,
        `${orphans.length} orphan schema(s) exported but not used by any tool:\n  ${orphans.join("\n  ")}`,
      ).toHaveLength(0);
    });
  });
});

// =============================================================================
// WASM Adapter (sql.js) — Subset of tools
// =============================================================================

describe("Tool Output Schema Invariants (WASM)", () => {
  let adapter: SqliteAdapter;
  let tools: ToolDefinition[];

  beforeEach(async () => {
    adapter = new SqliteAdapter();
    await adapter.connect({
      type: "sqlite",
      connectionString: ":memory:",
    });
    tools = adapter.getToolDefinitions();
  });

  afterEach(async () => {
    if (adapter.isConnected()) {
      await adapter.disconnect();
    }
  });

  it("should have tool definitions", () => {
    expect(tools.length).toBeGreaterThan(50);
  });

  it("every WASM tool must have outputSchema defined", () => {
    const violations: string[] = [];
    for (const tool of tools) {
      if (!tool.outputSchema) {
        violations.push(`${tool.name} (group: ${tool.group})`);
      }
    }
    expect(
      violations,
      `${violations.length} WASM tool(s) missing outputSchema:\n  ${violations.join("\n  ")}`,
    ).toHaveLength(0);
  });

  it("every WASM outputSchema must be a valid Zod schema", () => {
    const violations: string[] = [];
    for (const tool of tools) {
      if (tool.outputSchema && !isZodSchema(tool.outputSchema)) {
        violations.push(`${tool.name} (group: ${tool.group})`);
      }
    }
    expect(
      violations,
      `${violations.length} WASM tool(s) with invalid outputSchema:\n  ${violations.join("\n  ")}`,
    ).toHaveLength(0);
  });

  it("every WASM outputSchema must accept error responses", () => {
    const violations: string[] = [];
    for (const tool of tools) {
      if (tool.outputSchema && isZodSchema(tool.outputSchema)) {
        try {
          const schema = tool.outputSchema as {
            parse: (v: unknown) => unknown;
          };
          schema.parse({ success: false, error: "test error" });
        } catch {
          violations.push(`${tool.name} (group: ${tool.group})`);
        }
      }
    }
    expect(
      violations,
      `${violations.length} WASM outputSchema(s) reject error responses:\n  ${violations.join("\n  ")}`,
    ).toHaveLength(0);
  });
});
