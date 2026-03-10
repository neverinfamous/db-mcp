/**
 * Introspection Analysis Tools
 *
 * Schema snapshots, constraint analysis, and migration risk detection.
 * All tools are read-only — they only query PRAGMAs and sqlite_master.
 * 3 tools total.
 */

import type { SqliteAdapter } from "../../SqliteAdapter.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../types/index.js";
import { readOnly } from "../../../../utils/annotations.js";
import { formatError } from "../../../../utils/errors.js";
import { z } from "zod";

// =============================================================================
// Input Schemas
// =============================================================================

const SchemaSnapshotSchema = z
  .object({
    sections: z
      .array(z.enum(["tables", "views", "indexes", "triggers"]))
      .optional()
      .describe("Specific sections to include (default: all)"),
    compact: z
      .boolean()
      .optional()
      .describe(
        "Omit column details from tables section for reduced payload (default: false)",
      ),
  })
  .default({});

const ConstraintAnalysisSchema = z
  .object({
    table: z
      .string()
      .optional()
      .describe("Analyze constraints for a specific table only"),
    checks: z
      .array(
        z.enum([
          "missing_pk",
          "missing_not_null",
          "unindexed_fk",
          "missing_fk",
        ]),
      )
      .optional()
      .describe("Specific checks to run (default: all)"),
  })
  .default({});

const MigrationRisksSchema = z.object({
  statements: z
    .array(z.string())
    .describe("Array of DDL statements to analyze for risks"),
});

// =============================================================================
// Output Schemas
// =============================================================================

const SchemaSnapshotOutputSchema = z.object({
  success: z.boolean(),
  snapshot: z
    .object({
      tables: z
        .array(
          z.object({
            name: z.string(),
            columnCount: z.number(),
            rowCount: z.number().optional(),
            columns: z
              .array(
                z.object({
                  name: z.string(),
                  type: z.string(),
                  nullable: z.boolean(),
                  primaryKey: z.boolean(),
                  defaultValue: z.unknown().optional(),
                }),
              )
              .optional(),
          }),
        )
        .optional(),
      views: z
        .array(z.object({ name: z.string(), sql: z.string() }))
        .optional(),
      indexes: z
        .array(
          z.object({
            name: z.string(),
            table: z.string(),
            unique: z.boolean(),
            sql: z.string(),
          }),
        )
        .optional(),
      triggers: z
        .array(
          z.object({
            name: z.string(),
            table: z.string(),
            sql: z.string(),
          }),
        )
        .optional(),
    })
    .optional(),
  stats: z
    .object({
      tables: z.number(),
      views: z.number(),
      indexes: z.number(),
      triggers: z.number(),
    })
    .optional(),
  generatedAt: z.string().optional(),
  error: z.string().optional(),
});

const ConstraintAnalysisOutputSchema = z.object({
  success: z.boolean(),
  findings: z
    .array(
      z.object({
        type: z.string(),
        severity: z.enum(["info", "warning", "error"]),
        table: z.string(),
        description: z.string(),
        suggestion: z.string().optional(),
      }),
    )
    .optional(),
  summary: z
    .object({
      totalFindings: z.number(),
      byType: z.record(z.string(), z.number()),
      bySeverity: z.record(z.string(), z.number()),
    })
    .optional(),
  error: z.string().optional(),
});

const MigrationRisksOutputSchema = z.object({
  success: z.boolean(),
  risks: z
    .array(
      z.object({
        statement: z.string(),
        statementIndex: z.number(),
        riskLevel: z.enum(["low", "medium", "high", "critical"]),
        category: z.string(),
        description: z.string(),
        mitigation: z.string().optional(),
      }),
    )
    .optional(),
  summary: z
    .object({
      totalStatements: z.number(),
      totalRisks: z.number(),
      highestRisk: z.string(),
    })
    .optional(),
  error: z.string().optional(),
});

// =============================================================================
// Tool Creators
// =============================================================================

export function createSchemaSnapshotTool(
  adapter: SqliteAdapter,
): ToolDefinition {
  return {
    name: "sqlite_schema_snapshot",
    description:
      "Generate a comprehensive snapshot of the database schema — tables, views, indexes, and triggers — in a single call. Useful for understanding an unfamiliar database or diffing schema changes.",
    group: "introspection",
    inputSchema: SchemaSnapshotSchema,
    outputSchema: SchemaSnapshotOutputSchema,
    requiredScopes: ["read"],
    annotations: readOnly("Schema Snapshot"),
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const input = SchemaSnapshotSchema.parse(params);
        const sections = input.sections ?? [
          "tables",
          "views",
          "indexes",
          "triggers",
        ];
        const compact = input.compact ?? false;
        const snapshot: Record<string, unknown> = {};
        const stats = { tables: 0, views: 0, indexes: 0, triggers: 0 };

        if (sections.includes("tables")) {
          const tablesResult = await adapter.executeReadQuery(
            `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_mcp_%' ORDER BY name`,
          );
          const tables = [];
          for (const row of tablesResult.rows ?? []) {
            const tableName = row["name"] as string;
            const countResult = await adapter.executeReadQuery(
              `SELECT COUNT(*) as cnt FROM "${tableName}"`,
            );
            const rowCount =
              (countResult.rows?.[0]?.["cnt"] as number | undefined) ?? 0;

            const tableEntry: Record<string, unknown> = {
              name: tableName,
              rowCount,
            };

            if (!compact) {
              const colResult = await adapter.executeReadQuery(
                `PRAGMA table_info("${tableName}")`,
              );
              const columns = (colResult.rows ?? []).map((c) => ({
                name: c["name"] as string,
                type: (c["type"] as string) || "TEXT",
                nullable: (c["notnull"] as number) === 0,
                primaryKey: (c["pk"] as number) > 0,
                defaultValue: c["dflt_value"] ?? undefined,
              }));
              tableEntry["columnCount"] = columns.length;
              tableEntry["columns"] = columns;
            } else {
              const colResult = await adapter.executeReadQuery(
                `PRAGMA table_info("${tableName}")`,
              );
              tableEntry["columnCount"] = colResult.rows?.length ?? 0;
            }

            tables.push(tableEntry);
          }
          snapshot["tables"] = tables;
          stats.tables = tables.length;
        }

        if (sections.includes("views")) {
          const viewsResult = await adapter.executeReadQuery(
            `SELECT name, sql FROM sqlite_master WHERE type='view' ORDER BY name`,
          );
          const views = (viewsResult.rows ?? []).map((v) => ({
            name: v["name"] as string,
            sql: v["sql"] as string,
          }));
          snapshot["views"] = views;
          stats.views = views.length;
        }

        if (sections.includes("indexes")) {
          const indexResult = await adapter.executeReadQuery(
            `SELECT name, tbl_name, sql FROM sqlite_master WHERE type='index' AND sql IS NOT NULL ORDER BY tbl_name, name`,
          );
          const indexes = (indexResult.rows ?? []).map((idx) => ({
            name: idx["name"] as string,
            table: idx["tbl_name"] as string,
            unique: ((idx["sql"] as string) || "").includes("UNIQUE"),
            sql: idx["sql"] as string,
          }));
          snapshot["indexes"] = indexes;
          stats.indexes = indexes.length;
        }

        if (sections.includes("triggers")) {
          const trigResult = await adapter.executeReadQuery(
            `SELECT name, tbl_name, sql FROM sqlite_master WHERE type='trigger' ORDER BY tbl_name, name`,
          );
          const triggers = (trigResult.rows ?? []).map((t) => ({
            name: t["name"] as string,
            table: t["tbl_name"] as string,
            sql: t["sql"] as string,
          }));
          snapshot["triggers"] = triggers;
          stats.triggers = triggers.length;
        }

        return {
          success: true,
          snapshot,
          stats,
          generatedAt: new Date().toISOString(),
        };
      } catch (error) {
        const structured = formatError(error);
        return { success: false, error: structured.error };
      }
    },
  };
}

export function createConstraintAnalysisTool(
  adapter: SqliteAdapter,
): ToolDefinition {
  return {
    name: "sqlite_constraint_analysis",
    description:
      "Analyze database schema for constraint health issues: missing primary keys, columns that should be NOT NULL, foreign keys without indexes, and tables that could benefit from FK relationships.",
    group: "introspection",
    inputSchema: ConstraintAnalysisSchema,
    outputSchema: ConstraintAnalysisOutputSchema,
    requiredScopes: ["read"],
    annotations: readOnly("Constraint Analysis"),
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const input = ConstraintAnalysisSchema.parse(params);
        const checksToRun = input.checks ?? [
          "missing_pk",
          "missing_not_null",
          "unindexed_fk",
          "missing_fk",
        ];
        // Get tables to analyze
        let tableQuery = `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_mcp_%'`;
        const queryParams: unknown[] = [];
        if (input.table) {
          tableQuery += ` AND name = ?`;
          queryParams.push(input.table);
        }
        tableQuery += ` ORDER BY name`;

        const tablesResult = await adapter.executeReadQuery(
          tableQuery,
          queryParams,
        );
        const tables = (tablesResult.rows ?? []).map(
          (r) => r["name"] as string,
        );

        if (input.table && tables.length === 0) {
          return {
            success: false,
            error: `Table '${input.table}' does not exist`,
          };
        }

        interface Finding {
          type: string;
          severity: "info" | "warning" | "error";
          table: string;
          description: string;
          suggestion?: string;
        }

        const findings: Finding[] = [];

        for (const tableName of tables) {
          const colResult = await adapter.executeReadQuery(
            `PRAGMA table_info("${tableName}")`,
          );
          const columns = colResult.rows ?? [];

          // Check: Missing primary key
          if (checksToRun.includes("missing_pk")) {
            const hasPk = columns.some((c) => (c["pk"] as number) > 0);
            if (!hasPk) {
              findings.push({
                type: "missing_pk",
                severity: "warning",
                table: tableName,
                description: `Table '${tableName}' has no primary key defined`,
                suggestion:
                  "Consider adding a PRIMARY KEY column for data integrity and performance",
              });
            }
          }

          // Check: Missing NOT NULL on non-PK columns
          if (checksToRun.includes("missing_not_null")) {
            for (const col of columns) {
              const isPk = (col["pk"] as number) > 0;
              const isNullable = (col["notnull"] as number) === 0;
              const colName = col["name"] as string;

              // Flag nullable columns that end with _id (likely references)
              if (
                !isPk &&
                isNullable &&
                colName.toLowerCase().endsWith("_id")
              ) {
                findings.push({
                  type: "missing_not_null",
                  severity: "info",
                  table: tableName,
                  description: `Column '${colName}' in '${tableName}' is nullable but appears to be a reference (ends with _id)`,
                  suggestion: `Consider adding NOT NULL if this column should always have a value`,
                });
              }
            }
          }

          // Check: Unindexed foreign keys
          if (checksToRun.includes("unindexed_fk")) {
            const fkResult = await adapter.executeReadQuery(
              `PRAGMA foreign_key_list("${tableName}")`,
            );
            const fks = fkResult.rows ?? [];

            if (fks.length > 0) {
              // Get indexes for this table
              const indexResult = await adapter.executeReadQuery(
                `PRAGMA index_list("${tableName}")`,
              );
              const indexedColumns = new Set<string>();

              for (const idx of indexResult.rows ?? []) {
                const idxName = idx["name"] as string;
                const idxInfoResult = await adapter.executeReadQuery(
                  `PRAGMA index_info("${idxName}")`,
                );
                for (const idxCol of idxInfoResult.rows ?? []) {
                  indexedColumns.add(idxCol["name"] as string);
                }
              }

              for (const fk of fks) {
                const fromCol = fk["from"] as string;
                if (!indexedColumns.has(fromCol)) {
                  findings.push({
                    type: "unindexed_fk",
                    severity: "warning",
                    table: tableName,
                    description: `Foreign key column '${fromCol}' in '${tableName}' → '${String(fk["table"])}' is not indexed`,
                    suggestion: `CREATE INDEX idx_${tableName}_${fromCol} ON "${tableName}"("${fromCol}")`,
                  });
                }
              }
            }
          }

          // Check: Missing FK (columns named _id without FK declaration)
          if (checksToRun.includes("missing_fk")) {
            const fkResult = await adapter.executeReadQuery(
              `PRAGMA foreign_key_list("${tableName}")`,
            );
            const fkColumns = new Set(
              (fkResult.rows ?? []).map((fk) => fk["from"] as string),
            );

            for (const col of columns) {
              const colName = col["name"] as string;
              if (
                colName.toLowerCase().endsWith("_id") &&
                !fkColumns.has(colName) &&
                (col["pk"] as number) === 0
              ) {
                // Try to infer the referenced table name
                const inferredTable = colName
                  .replace(/_id$/i, "")
                  .replace(/_/g, "_");
                findings.push({
                  type: "missing_fk",
                  severity: "info",
                  table: tableName,
                  description: `Column '${colName}' in '${tableName}' appears to be a reference but has no FOREIGN KEY constraint`,
                  suggestion: `Consider adding: REFERENCES "${inferredTable}"(id) if applicable`,
                });
              }
            }
          }
        }

        // Summary
        const byType: Record<string, number> = {};
        const bySeverity: Record<string, number> = {};
        for (const f of findings) {
          byType[f.type] = (byType[f.type] ?? 0) + 1;
          bySeverity[f.severity] = (bySeverity[f.severity] ?? 0) + 1;
        }

        return {
          success: true,
          findings,
          summary: {
            totalFindings: findings.length,
            byType,
            bySeverity,
          },
        };
      } catch (error) {
        const structured = formatError(error);
        return { success: false, error: structured.error };
      }
    },
  };
}

export function createMigrationRisksTool(
  adapter: SqliteAdapter,
): ToolDefinition {
  return {
    name: "sqlite_migration_risks",
    description:
      "Analyze DDL statements for SQLite-specific migration risks. Detects ALTER TABLE limitations, large table operations, column type changes, destructive operations, and FTS5 rebuild requirements.",
    group: "introspection",
    inputSchema: MigrationRisksSchema,
    outputSchema: MigrationRisksOutputSchema,
    requiredScopes: ["read"],
    annotations: readOnly("Migration Risks"),
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const input = MigrationRisksSchema.parse(params);
        interface Risk {
          statement: string;
          statementIndex: number;
          riskLevel: "low" | "medium" | "high" | "critical";
          category: string;
          description: string;
          mitigation?: string | undefined;
        }

        const risks: Risk[] = [];
        const riskOrder = { low: 0, medium: 1, high: 2, critical: 3 };
        let highestRisk: "low" | "medium" | "high" | "critical" = "low";

        // Get existing table info for context
        const tablesResult = await adapter.executeReadQuery(
          `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`,
        );
        const existingTables = new Set(
          (tablesResult.rows ?? []).map((r) => r["name"] as string),
        );

        for (let i = 0; i < input.statements.length; i++) {
          const rawStmt = input.statements[i];
          if (!rawStmt) continue;
          const stmt = rawStmt.trim();
          const upper = stmt.toUpperCase();

          const addRisk = (
            riskLevel: Risk["riskLevel"],
            category: string,
            description: string,
            mitigation?: string,
          ): void => {
            risks.push({
              statement:
                stmt.substring(0, 100) + (stmt.length > 100 ? "..." : ""),
              statementIndex: i,
              riskLevel,
              category,
              description,
              mitigation,
            });
            if (riskOrder[riskLevel] > riskOrder[highestRisk]) {
              highestRisk = riskLevel;
            }
          };

          // ALTER TABLE limitations
          if (upper.startsWith("ALTER TABLE")) {
            if (upper.includes("DROP COLUMN")) {
              addRisk(
                "high",
                "alter_limitation",
                "ALTER TABLE DROP COLUMN requires SQLite 3.35.0+. Older versions will fail.",
                "Verify SQLite version >= 3.35.0, or use the copy-table strategy.",
              );
            }
            if (upper.includes("RENAME COLUMN")) {
              addRisk(
                "medium",
                "alter_limitation",
                "ALTER TABLE RENAME COLUMN requires SQLite 3.25.0+. Older versions will fail.",
                "Verify SQLite version >= 3.25.0.",
              );
            }
            if (upper.includes("ADD COLUMN") && upper.includes("NOT NULL")) {
              if (!upper.includes("DEFAULT")) {
                addRisk(
                  "high",
                  "alter_limitation",
                  "Adding a NOT NULL column without DEFAULT will fail if the table has existing rows.",
                  "Add a DEFAULT value or make the column nullable.",
                );
              }
            }
            if (upper.includes("ADD COLUMN") && upper.includes("PRIMARY KEY")) {
              addRisk(
                "critical",
                "alter_limitation",
                "SQLite does not support adding a PRIMARY KEY column via ALTER TABLE.",
                "Use the copy-table strategy: create new table, copy data, drop old, rename.",
              );
            }
            if (upper.includes("ADD COLUMN") && upper.includes("UNIQUE")) {
              addRisk(
                "high",
                "alter_limitation",
                "Adding a UNIQUE column that may conflict with existing data will fail.",
                "Verify no duplicate values exist, or add the column as nullable first.",
              );
            }
          }

          // DROP TABLE risks
          if (upper.startsWith("DROP TABLE")) {
            const dropTableRegex =
              /DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:"([^"]+)"|(\w+))/i;
            const tableMatch = dropTableRegex.exec(stmt);
            const tableName = tableMatch?.[1] ?? tableMatch?.[2];
            if (tableName && existingTables.has(tableName)) {
              addRisk(
                "critical",
                "destructive",
                `DROP TABLE will permanently delete '${tableName}' and all its data.`,
                "Back up data first with sqlite_backup or export the table.",
              );
            } else {
              addRisk(
                "high",
                "destructive",
                "DROP TABLE will permanently delete the table and all its data.",
                "Back up data first.",
              );
            }
          }

          // DELETE without WHERE
          if (upper.startsWith("DELETE") && !upper.includes("WHERE")) {
            addRisk(
              "critical",
              "destructive",
              "DELETE without WHERE clause will remove all rows from the table.",
              "Add a WHERE clause to target specific rows.",
            );
          }

          // VACUUM considerations
          if (upper.startsWith("VACUUM")) {
            addRisk(
              "medium",
              "performance",
              "VACUUM requires double the database size in free disk space and locks the database exclusively.",
              "Schedule during low-traffic periods. Ensure sufficient disk space.",
            );
          }

          // CREATE TABLE with FTS5
          if (
            upper.includes("CREATE VIRTUAL TABLE") &&
            upper.includes("FTS5")
          ) {
            addRisk(
              "low",
              "fts5",
              "FTS5 virtual tables require rebuild after bulk data changes for accurate search results.",
              "After populating data, run: INSERT INTO table(table) VALUES('rebuild')",
            );
          }

          // Transaction-wrapped DDL
          if (
            upper.startsWith("BEGIN") ||
            upper === "COMMIT" ||
            upper === "ROLLBACK"
          ) {
            addRisk(
              "low",
              "transaction",
              "DDL in SQLite is automatically transactional. Explicit transactions are supported but not required for single statements.",
            );
          }
        }

        return {
          success: true,
          risks,
          summary: {
            totalStatements: input.statements.length,
            totalRisks: risks.length,
            highestRisk,
          },
        };
      } catch (error) {
        const structured = formatError(error);
        return { success: false, error: structured.error };
      }
    },
  };
}
