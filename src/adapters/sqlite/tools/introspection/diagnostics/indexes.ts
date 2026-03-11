/**
 * Index Audit Tool
 *
 * Audit index effectiveness: find redundant indexes, missing foreign key
 * indexes, and large tables without secondary indexes.
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

const IndexAuditSchema = z
  .object({
    table: z
      .string()
      .optional()
      .describe("Optional table name to audit (default: all tables)"),
  })
  .default({});

const IndexAuditOutputSchema = z.object({
  success: z.boolean(),
  totalIndexes: z.number().optional(),
  findings: z
    .array(
      z.object({
        type: z.enum([
          "redundant",
          "missing_fk_index",
          "unindexed_large_table",
        ]),
        severity: z.enum(["info", "warning", "error"]),
        table: z.string(),
        index: z.string().optional(),
        redundantOf: z.string().optional(),
        column: z.string().optional(),
        suggestion: z.string(),
      }),
    )
    .optional(),
  summary: z
    .object({
      redundant: z.number(),
      missingFk: z.number(),
      unindexedLarge: z.number(),
      total: z.number(),
    })
    .optional(),
  error: z.string().optional(),
});

// =============================================================================
// Tool Creator
// =============================================================================

export function createIndexAuditTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_index_audit",
    description:
      "Audit index effectiveness: find redundant indexes (prefix duplicates), missing foreign key indexes, and large tables without secondary indexes. Returns actionable suggestions.",
    group: "introspection",
    inputSchema: IndexAuditSchema,
    outputSchema: IndexAuditOutputSchema,
    requiredScopes: ["read"],
    annotations: readOnly("Index Audit"),
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const input = IndexAuditSchema.parse(params);
        // Get all user-created indexes
        let indexQuery = `SELECT name, tbl_name, sql FROM sqlite_master
                          WHERE type = 'index' AND sql IS NOT NULL`;
        if (input.table) {
          const escaped = input.table.replace(/'/g, "''");
          indexQuery += ` AND tbl_name = '${escaped}'`;
        }

        const indexResult = await adapter.executeReadQuery(indexQuery);

        // Build index info with column lists
        interface IndexEntry {
          name: string;
          table: string;
          columns: string[];
          unique: boolean;
        }

        const indexes: IndexEntry[] = [];
        for (const row of indexResult.rows ?? []) {
          const indexName = row["name"] as string;
          const tableName = row["tbl_name"] as string;
          const sqlDef = (row["sql"] as string) ?? "";

          // Get columns via PRAGMA index_info
          const colResult = await adapter.executeReadQuery(
            `PRAGMA index_info("${indexName}")`,
          );
          const columns = (colResult.rows ?? []).map(
            (c) => c["name"] as string,
          );

          indexes.push({
            name: indexName,
            table: tableName,
            columns,
            unique: sqlDef.toUpperCase().includes("UNIQUE"),
          });
        }

        type FindingType =
          | "redundant"
          | "missing_fk_index"
          | "unindexed_large_table";
        const findings: {
          type: FindingType;
          severity: "info" | "warning" | "error";
          table: string;
          index?: string;
          redundantOf?: string;
          column?: string;
          suggestion: string;
        }[] = [];

        // Check 1: Redundant indexes (prefix duplicates)
        // An index on (A) is redundant if an index on (A, B) exists on the same table
        const byTable = new Map<string, IndexEntry[]>();
        for (const idx of indexes) {
          const existing = byTable.get(idx.table) ?? [];
          existing.push(idx);
          byTable.set(idx.table, existing);
        }

        for (const [, tableIndexes] of byTable) {
          for (let i = 0; i < tableIndexes.length; i++) {
            const shorter = tableIndexes[i];
            if (!shorter) continue;
            for (let j = 0; j < tableIndexes.length; j++) {
              if (i === j) continue;
              const longer = tableIndexes[j];
              if (!longer) continue;

              // Check if shorter is a prefix of longer
              if (
                shorter.columns.length < longer.columns.length &&
                shorter.columns.every((col, k) => col === longer.columns[k])
              ) {
                findings.push({
                  type: "redundant",
                  severity: "warning",
                  table: shorter.table,
                  index: shorter.name,
                  redundantOf: longer.name,
                  suggestion: `DROP INDEX "${shorter.name}" — columns (${shorter.columns.join(", ")}) are a prefix of "${longer.name}" (${longer.columns.join(", ")})`,
                });
              }
            }
          }
        }

        // Check 2: Missing FK indexes
        let tableFilter = `SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`;
        if (input.table) {
          const escaped = input.table.replace(/'/g, "''");
          tableFilter += ` AND name = '${escaped}'`;
        }
        const tableList = await adapter.executeReadQuery(tableFilter);

        for (const row of tableList.rows ?? []) {
          const tableName = row["name"] as string;
          const fkResult = await adapter.executeReadQuery(
            `PRAGMA foreign_key_list("${tableName}")`,
          );

          for (const fk of fkResult.rows ?? []) {
            const fromCol = fk["from"] as string;

            // Check if any index on this table starts with this FK column
            const tableIdxs = byTable.get(tableName) ?? [];
            const hasIndex = tableIdxs.some(
              (idx) => idx.columns[0] === fromCol,
            );

            if (!hasIndex) {
              findings.push({
                type: "missing_fk_index",
                severity: "warning",
                table: tableName,
                column: fromCol,
                suggestion: `CREATE INDEX "idx_${tableName}_${fromCol}" ON "${tableName}"("${fromCol}")`,
              });
            }
          }
        }

        // Check 3: Large tables without secondary indexes
        for (const row of tableList.rows ?? []) {
          const tableName = row["name"] as string;
          const tableIdxs = byTable.get(tableName) ?? [];

          // Skip if already has user indexes
          if (tableIdxs.length > 0) continue;

          // Check row count
          try {
            const countResult = await adapter.executeReadQuery(
              `SELECT COUNT(*) as cnt FROM "${tableName}"`,
            );
            const rowCount = Number(countResult.rows?.[0]?.["cnt"] ?? 0);

            if (rowCount >= 1000) {
              findings.push({
                type: "unindexed_large_table",
                severity: "info",
                table: tableName,
                suggestion: `Table "${tableName}" has ${rowCount} rows but no secondary indexes. Consider adding indexes on frequently queried columns.`,
              });
            }
          } catch {
            // Skip virtual tables or other errors
          }
        }

        const redundantCount = findings.filter(
          (f) => f.type === "redundant",
        ).length;
        const missingFkCount = findings.filter(
          (f) => f.type === "missing_fk_index",
        ).length;
        const unindexedCount = findings.filter(
          (f) => f.type === "unindexed_large_table",
        ).length;

        return {
          success: true,
          totalIndexes: indexes.length,
          findings,
          summary: {
            redundant: redundantCount,
            missingFk: missingFkCount,
            unindexedLarge: unindexedCount,
            total: findings.length,
          },
        };
      } catch (error) {
        const structured = formatError(error);
        return { success: false, error: structured.error };
      }
    },
  };
}
