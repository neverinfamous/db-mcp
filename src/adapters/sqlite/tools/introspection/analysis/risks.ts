/**
 * Migration Risks Tool
 *
 * Analyze DDL statements for SQLite-specific migration risks.
 */

import type { SqliteAdapter } from "../../../sqlite-adapter.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../../types/index.js";
import { readOnly } from "../../../../../utils/annotations.js";
import { formatError } from "../../../../../utils/errors/index.js";
import { z } from "zod";

// =============================================================================
// Schemas
// =============================================================================

const MigrationRisksSchema = z.object({
  statements: z
    .array(z.string())
    .describe("Array of DDL statements to analyze for risks"),
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
// Tool Creator
// =============================================================================

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

          // DROP INDEX risks
          if (upper.startsWith("DROP INDEX")) {
            addRisk(
              "medium",
              "index_removal",
              "Dropping an index may degrade query performance for queries that relied on it.",
              "Verify no critical queries depend on this index before dropping. Use sqlite_query_plan to check.",
            );
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
