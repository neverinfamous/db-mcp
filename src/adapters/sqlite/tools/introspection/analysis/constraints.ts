/**
 * Constraint Analysis Tool
 *
 * Analyze database schema for constraint health issues: missing primary keys,
 * nullable reference columns, unindexed foreign keys, and missing FK declarations.
 */

import type { SqliteAdapter } from "../../../sqlite-adapter.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../../types/index.js";
import { readOnly } from "../../../../../utils/annotations.js";
import { formatHandlerError } from "../../../../../utils/errors/index.js";
import { z } from "zod";
import { ErrorResponseFields } from "../../../../../utils/errors/error-response-fields.js";

// =============================================================================
// Schemas
// =============================================================================

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
}).extend(ErrorResponseFields.shape);

// =============================================================================
// Tool Creator
// =============================================================================

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
          // Skip tables that can't be introspected (e.g., FTS5 virtual tables in WASM)
          let columns: Record<string, unknown>[] = [];
          try {
            const colResult = await adapter.executeReadQuery(
              `PRAGMA table_info("${tableName}")`,
            );
            columns = colResult.rows ?? [];
          } catch {
            continue; // Skip this table entirely
          }

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
        return formatHandlerError(error);
      }
    },
  };
}
