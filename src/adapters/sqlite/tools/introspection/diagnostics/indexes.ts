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
import { formatHandlerError } from "../../../../../utils/errors/index.js";
import {
  IndexAuditOutputSchema,
  IndexAuditSchema,
} from "../../../schemas/introspection.js";
import { isSpatialiteSystemTable } from "../../core/tables.js";

// =============================================================================
// Schemas
// =============================================================================

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

        const excludeSystem = input.excludeSystemTables !== false;
        // Get all user-created indexes
        let indexQuery = `SELECT name, tbl_name, sql FROM sqlite_master
                          WHERE type = 'index' AND sql IS NOT NULL`;
        if (input.table) {
          const escaped = input.table.replace(/'/g, "''");
          indexQuery += ` AND tbl_name = '${escaped}'`;

          // Verify table exists before proceeding
          const tableCheck = await adapter.executeReadQuery(
            `SELECT name FROM sqlite_master WHERE type IN ('table', 'view') AND name = '${escaped}'`,
          );
          if ((tableCheck.rows?.length ?? 0) === 0) {
            return {
              success: false,
              error: `Table '${input.table}' does not exist`,
              code: "TABLE_NOT_FOUND",
              category: "resource",
              suggestion:
                "Table not found. Run sqlite_list_tables to see available tables.",
              recoverable: false,
            };
          }
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
          | "unindexed_large_table"
          | "missing_composite_index";
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
          if (excludeSystem && isSpatialiteSystemTable(tableName)) continue;
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
          if (excludeSystem && isSpatialiteSystemTable(tableName)) continue;
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

        // Check 4: Index Recommendations based on queries (Composite/Partial)
        if (input.recommendComposite && input.queriesToAnalyze && input.queriesToAnalyze.length > 0) {
          for (const query of input.queriesToAnalyze) {
            try {
              // Don't run EXPLAIN QUERY PLAN on DML/DDL that might mutate if an agent accidentally sent one.
              // Safe query check:
              if (/^\s*SELECT/i.test(query)) {
                const planResult = await adapter.executeReadQuery(`EXPLAIN QUERY PLAN ${query}`);
                const planRows = planResult.rows ?? [];
                
                // Simple heuristic: look for "SCAN TABLE" or "SEARCH TABLE" without a covering index.
                for (const row of planRows) {
                  const detailVal = row["detail"];
                  const detail = typeof detailVal === "string" ? detailVal : "";
                  if (detail.startsWith("SCAN TABLE") || detail.startsWith("SCAN ")) {
                    const match = /SCAN (?:TABLE )?([\w_]+)/i.exec(detail);
                    const tableName = match ? match[1] : "unknown";
                    if (tableName && tableName !== "unknown") {
                      findings.push({
                        type: "missing_composite_index",
                        severity: "warning",
                        table: tableName,
                        suggestion: `Query resulted in SCAN TABLE "${tableName}". Consider analyzing WHERE/JOIN clauses to add a composite index.`,
                      });
                    }
                  }
                }
              }
            } catch {
              // Ignore EXPLAIN failures (e.g., syntax errors in user queries)
            }
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

        // Apply severity filter if specified
        const severityOrder = { info: 0, warning: 1, error: 2 };
        const minSev = input.minSeverity;
        const filteredFindings = minSev
          ? findings.filter(
              (f) => severityOrder[f.severity] >= severityOrder[minSev],
            )
          : findings;

        return {
          success: true,
          totalIndexes: indexes.length,
          findings: filteredFindings,
          summary: {
            redundant: redundantCount,
            missingFk: missingFkCount,
            unindexedLarge: unindexedCount,
            total: findings.length,
          },
        };
      } catch (error: unknown) {
        return formatHandlerError(error);
      }
    },
  };
}
