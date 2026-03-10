/**
 * Introspection Diagnostics Tools
 *
 * Storage analysis, index auditing, and query plan analysis.
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

const StorageAnalysisSchema = z
  .object({
    includeTableDetails: z
      .boolean()
      .optional()
      .describe("Include per-table size breakdown (default: true)"),
    limit: z
      .number()
      .min(1)
      .max(500)
      .optional()
      .describe("Maximum number of tables to include (default: 50)"),
  })
  .default({});

const IndexAuditSchema = z
  .object({
    table: z
      .string()
      .optional()
      .describe("Optional table name to audit (default: all tables)"),
  })
  .default({});

const QueryPlanSchema = z.object({
  sql: z.string().describe("SQL query to analyze (SELECT only)"),
});

// =============================================================================
// Output Schemas
// =============================================================================

const StorageAnalysisOutputSchema = z.object({
  success: z.boolean(),
  database: z
    .object({
      totalSizeBytes: z.number(),
      pageSize: z.number(),
      totalPages: z.number(),
      freePages: z.number(),
      fragmentationPct: z.number(),
      journalMode: z.string(),
      autoVacuum: z.string(),
    })
    .optional(),
  tables: z
    .array(
      z.object({
        name: z.string(),
        sizeBytes: z.number(),
        pctOfTotal: z.number(),
        pageCount: z.number(),
        rowCount: z.number(),
        avgRowBytes: z.number(),
      }),
    )
    .optional(),
  recommendations: z
    .array(
      z.object({
        type: z.string(),
        severity: z.enum(["info", "warning", "error"]),
        message: z.string(),
      }),
    )
    .optional(),
  error: z.string().optional(),
});

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

const QueryPlanOutputSchema = z.object({
  success: z.boolean(),
  sql: z.string().optional(),
  plan: z
    .array(
      z.object({
        id: z.number(),
        parent: z.number(),
        detail: z.string(),
        scanType: z
          .enum([
            "full_scan",
            "index_scan",
            "covering_index",
            "search",
            "subquery",
            "compound",
            "other",
          ])
          .optional(),
        table: z.string().optional(),
      }),
    )
    .optional(),
  analysis: z
    .object({
      fullScans: z.array(z.string()),
      indexScans: z.array(z.string()),
      coveringIndexes: z.array(z.string()),
      estimatedEfficiency: z.enum(["good", "moderate", "poor"]),
    })
    .optional(),
  suggestions: z.array(z.string()).optional(),
  error: z.string().optional(),
});

// =============================================================================
// Helper: get pragma value as string
// =============================================================================

async function getPragmaValue(
  adapter: SqliteAdapter,
  pragma: string,
): Promise<string> {
  const result = await adapter.executeReadQuery(`PRAGMA ${pragma}`);
  const row = result.rows?.[0];
  if (!row) return "unknown";
  // PRAGMA results come back as { pragma_name: value } or { 0: value }
  const firstValue = Object.values(row)[0];
  if (typeof firstValue === "string") return firstValue;
  if (typeof firstValue === "number" || typeof firstValue === "boolean")
    return String(firstValue);
  return "unknown";
}

async function getPragmaNumber(
  adapter: SqliteAdapter,
  pragma: string,
): Promise<number> {
  const val = await getPragmaValue(adapter, pragma);
  const num = Number(val);
  return isNaN(num) ? 0 : num;
}

// =============================================================================
// Tool Creators
// =============================================================================

export function createStorageAnalysisTool(
  adapter: SqliteAdapter,
): ToolDefinition {
  return {
    name: "sqlite_storage_analysis",
    description:
      "Analyze database storage health: fragmentation, size breakdown per table, and optimization recommendations. Aggregates PRAGMA + dbstat data into an actionable report.",
    group: "introspection",
    inputSchema: StorageAnalysisSchema,
    outputSchema: StorageAnalysisOutputSchema,
    requiredScopes: ["read"],
    annotations: readOnly("Storage Analysis"),
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const input = StorageAnalysisSchema.parse(params);
        const includeDetails = input.includeTableDetails !== false;
        const limit = input.limit ?? 50;
        // Gather database-level metrics
        const pageSize = await getPragmaNumber(adapter, "page_size");
        const totalPages = await getPragmaNumber(adapter, "page_count");
        const freePages = await getPragmaNumber(adapter, "freelist_count");
        const journalMode = await getPragmaValue(adapter, "journal_mode");
        const autoVacuumRaw = await getPragmaNumber(adapter, "auto_vacuum");
        const autoVacuum =
          ["none", "full", "incremental"][autoVacuumRaw] ?? "unknown";

        const totalSizeBytes = totalPages * pageSize;
        const fragmentationPct =
          totalPages > 0
            ? Math.round((freePages / totalPages) * 10000) / 100
            : 0;

        // Per-table breakdown via dbstat (with fallback)
        interface TableEntry {
          name: string;
          sizeBytes: number;
          pctOfTotal: number;
          pageCount: number;
          rowCount: number;
          avgRowBytes: number;
        }

        const tables: TableEntry[] = [];
        if (includeDetails) {
          try {
            // Try dbstat for accurate per-table sizes
            const dbstatResult = await adapter.executeReadQuery(
              `SELECT name, SUM(pgsize) as size_bytes, COUNT(*) as page_count
               FROM dbstat
               WHERE name NOT LIKE 'sqlite_%'
               GROUP BY name
               ORDER BY size_bytes DESC
               LIMIT ${limit}`,
            );

            for (const row of dbstatResult.rows ?? []) {
              const tableName = row["name"] as string;
              const sizeBytes = Number(row["size_bytes"] ?? 0);
              const pageCount = Number(row["page_count"] ?? 0);

              // Get row count
              let rowCount = 0;
              try {
                const countResult = await adapter.executeReadQuery(
                  `SELECT COUNT(*) as cnt FROM "${tableName}"`,
                );
                rowCount = Number(countResult.rows?.[0]?.["cnt"] ?? 0);
              } catch {
                // May fail for views or virtual tables
              }

              tables.push({
                name: tableName,
                sizeBytes,
                pctOfTotal:
                  totalSizeBytes > 0
                    ? Math.round((sizeBytes / totalSizeBytes) * 10000) / 100
                    : 0,
                pageCount,
                rowCount,
                avgRowBytes:
                  rowCount > 0 ? Math.round(sizeBytes / rowCount) : 0,
              });
            }
          } catch {
            // dbstat not available — fallback to basic table list
            const tablesResult = await adapter.executeReadQuery(
              `SELECT name FROM sqlite_master
               WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
               ORDER BY name
               LIMIT ${limit}`,
            );

            for (const row of tablesResult.rows ?? []) {
              const tableName = row["name"] as string;
              let rowCount = 0;
              try {
                const countResult = await adapter.executeReadQuery(
                  `SELECT COUNT(*) as cnt FROM "${tableName}"`,
                );
                rowCount = Number(countResult.rows?.[0]?.["cnt"] ?? 0);
              } catch {
                // Skip
              }

              // Rough estimate: ~100 bytes per row average
              const estSizeBytes = rowCount * 100;
              tables.push({
                name: tableName,
                sizeBytes: estSizeBytes,
                pctOfTotal: 0, // Cannot calculate without dbstat
                pageCount: Math.max(1, Math.ceil(estSizeBytes / pageSize)),
                rowCount,
                avgRowBytes: rowCount > 0 ? 100 : 0,
              });
            }

            // Sort by estimated size descending
            tables.sort((a, b) => b.sizeBytes - a.sizeBytes);
          }
        }

        // Generate recommendations
        const recommendations: {
          type: string;
          severity: "info" | "warning" | "error";
          message: string;
        }[] = [];

        if (fragmentationPct > 25) {
          recommendations.push({
            type: "fragmentation",
            severity: "error",
            message: `High fragmentation: ${fragmentationPct}% free pages (${freePages} of ${totalPages}). Run VACUUM to reclaim space.`,
          });
        } else if (fragmentationPct > 10) {
          recommendations.push({
            type: "fragmentation",
            severity: "warning",
            message: `Moderate fragmentation: ${fragmentationPct}% free pages. Consider running VACUUM.`,
          });
        } else if (fragmentationPct > 0) {
          recommendations.push({
            type: "fragmentation",
            severity: "info",
            message: `Low fragmentation: ${fragmentationPct}% free pages.`,
          });
        }

        if (autoVacuum === "none" && freePages > 100) {
          recommendations.push({
            type: "auto_vacuum",
            severity: "warning",
            message: `auto_vacuum is disabled and ${freePages} free pages exist. Enable auto_vacuum or run periodic VACUUM.`,
          });
        }

        if (journalMode !== "wal") {
          recommendations.push({
            type: "journal_mode",
            severity: "info",
            message: `Journal mode is '${journalMode}'. WAL mode generally offers better concurrent read performance.`,
          });
        }

        return {
          success: true,
          database: {
            totalSizeBytes,
            pageSize,
            totalPages,
            freePages,
            fragmentationPct,
            journalMode,
            autoVacuum,
          },
          tables: includeDetails ? tables : undefined,
          recommendations,
        };
      } catch (error) {
        const structured = formatError(error);
        return { success: false, error: structured.error };
      }
    },
  };
}

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

export function createQueryPlanTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_query_plan",
    description:
      "Analyze a SQL query's execution plan. Returns structured EXPLAIN QUERY PLAN output with scan-type classification (full scan, index scan, covering index) and optimization suggestions.",
    group: "introspection",
    inputSchema: QueryPlanSchema,
    outputSchema: QueryPlanOutputSchema,
    requiredScopes: ["read"],
    annotations: readOnly("Query Plan"),
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const input = QueryPlanSchema.parse(params);
        const sql = (input.sql ?? "").trim();

        if (!sql) {
          return {
            success: false,
            error: "Parameter 'sql' is required and must be a non-empty string",
          };
        }

        // Only allow read-only queries
        const upper = sql.toUpperCase();
        if (!upper.startsWith("SELECT") && !upper.startsWith("WITH")) {
          return {
            success: false,
            error:
              "Only SELECT and WITH (CTE) queries can be analyzed. Received: " +
              upper.substring(0, 20),
          };
        }

        const result = await adapter.executeReadQuery(
          `EXPLAIN QUERY PLAN ${sql}`,
        );

        // Parse plan rows
        const plan: {
          id: number;
          parent: number;
          detail: string;
          scanType?:
            | "full_scan"
            | "index_scan"
            | "covering_index"
            | "search"
            | "subquery"
            | "compound"
            | "other";
          table?: string;
        }[] = [];

        const fullScans: string[] = [];
        const indexScans: string[] = [];
        const coveringIndexes: string[] = [];
        const suggestions: string[] = [];

        for (const row of result.rows ?? []) {
          const id = Number(row["id"] ?? row["selectid"] ?? 0);
          const parent = Number(row["parent"] ?? row["order"] ?? 0);
          const rawDetail = row["detail"] ?? "";
          const detail =
            typeof rawDetail === "string"
              ? rawDetail
              : typeof rawDetail === "number" || typeof rawDetail === "boolean"
                ? String(rawDetail)
                : "";

          // Classify scan type from detail string
          const detailUpper = detail.toUpperCase();
          let scanType:
            | "full_scan"
            | "index_scan"
            | "covering_index"
            | "search"
            | "subquery"
            | "compound"
            | "other" = "other";
          let table: string | undefined;

          if (detailUpper.includes("SCAN")) {
            // Extract table name: "SCAN table_name" or "SCAN TABLE table_name"
            const scanMatch = /SCAN\s+(?:TABLE\s+)?(\S+)/i.exec(detail);
            table = scanMatch?.[1];

            if (detailUpper.includes("COVERING INDEX")) {
              scanType = "covering_index";
              if (table) coveringIndexes.push(table);
            } else if (detailUpper.includes("USING INDEX")) {
              scanType = "index_scan";
              if (table) indexScans.push(table);
            } else {
              scanType = "full_scan";
              if (table) fullScans.push(table);
            }
          } else if (detailUpper.includes("SEARCH")) {
            scanType = "search";
            const searchMatch = /SEARCH\s+(?:TABLE\s+)?(\S+)/i.exec(detail);
            table = searchMatch?.[1];
            if (table) indexScans.push(table);
          } else if (
            detailUpper.includes("SUBQUERY") ||
            detailUpper.includes("CORRELATED")
          ) {
            scanType = "subquery";
          } else if (
            detailUpper.includes("COMPOUND") ||
            detailUpper.includes("UNION")
          ) {
            scanType = "compound";
          }

          plan.push({
            id,
            parent,
            detail,
            scanType,
            ...(table ? { table } : {}),
          });
        }

        // Deduplicate scan lists
        const uniqueFullScans = [...new Set(fullScans)];
        const uniqueIndexScans = [...new Set(indexScans)];
        const uniqueCovering = [...new Set(coveringIndexes)];

        // Generate suggestions
        for (const tableName of uniqueFullScans) {
          suggestions.push(
            `Table '${tableName}' requires a full table scan. Consider adding an index on the columns used in WHERE/JOIN clauses.`,
          );
        }

        if (plan.some((p) => p.scanType === "subquery")) {
          suggestions.push(
            "Query contains subqueries. Consider rewriting as JOINs for better performance.",
          );
        }

        // Determine efficiency
        let estimatedEfficiency: "good" | "moderate" | "poor" = "good";
        if (uniqueFullScans.length > 0) {
          estimatedEfficiency =
            uniqueFullScans.length > 1 ? "poor" : "moderate";
        }

        return {
          success: true,
          sql,
          plan,
          analysis: {
            fullScans: uniqueFullScans,
            indexScans: uniqueIndexScans,
            coveringIndexes: uniqueCovering,
            estimatedEfficiency,
          },
          suggestions: suggestions.length > 0 ? suggestions : undefined,
        };
      } catch (error) {
        const structured = formatError(error);
        return { success: false, error: structured.error };
      }
    },
  };
}
