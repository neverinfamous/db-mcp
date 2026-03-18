/**
 * Storage Analysis Tool
 *
 * Analyze database storage health: fragmentation, size breakdown per table,
 * and optimization recommendations.
 */

import type { SqliteAdapter } from "../../../sqlite-adapter.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../../types/index.js";
import { readOnly } from "../../../../../utils/annotations.js";
import { formatHandlerError } from "../../../../../utils/errors/index.js";
import { z } from "zod";
import { StorageAnalysisOutputSchema } from "../../../output-schemas/index.js";
import { isSpatialiteSystemTable } from "../../core/tables.js";

// =============================================================================
// Schemas
// =============================================================================

const StorageAnalysisSchema = z
  .object({
    includeTableDetails: z
      .boolean()
      .optional()
      .describe("Include per-table size breakdown (default: true)"),
    excludeSystemTables: z
      .boolean()
      .optional()
      .describe(
        "Exclude SpatiaLite system tables from per-table breakdown (default: true)",
      ),
    limit: z
      .number()
      .min(1)
      .max(500)
      .optional()
      .describe("Maximum number of tables to include (default: 50)"),
  })
  .default({});

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
// Tool Creator
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
        const excludeSystem = input.excludeSystemTables !== false;
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

        let tables: TableEntry[] = [];
        if (includeDetails) {
          try {
            // Try dbstat for accurate per-table sizes
            // Note: limit is applied after system table filtering to avoid
            // returning fewer rows than requested when system tables are excluded
            const dbstatResult = await adapter.executeReadQuery(
              `SELECT name, SUM(pgsize) as size_bytes, COUNT(*) as page_count
               FROM dbstat
               WHERE name NOT LIKE 'sqlite_%'
               GROUP BY name
               ORDER BY size_bytes DESC`,
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

            // Filter SpatiaLite system tables, then apply limit
            if (excludeSystem) {
              tables = tables.filter(
                (t) => !isSpatialiteSystemTable(t.name),
              );
            }
            tables = tables.slice(0, limit);
          } catch {
            // dbstat not available — fallback to basic table list
            const tablesResult = await adapter.executeReadQuery(
              `SELECT name FROM sqlite_master
               WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
               ORDER BY name`,
            );

            for (const row of tablesResult.rows ?? []) {
              const tableName = row["name"] as string;
              if (excludeSystem && isSpatialiteSystemTable(tableName)) continue;
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

            // Sort by estimated size descending, then apply limit
            tables.sort((a, b) => b.sizeBytes - a.sizeBytes);
            tables = tables.slice(0, limit);
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
        return formatHandlerError(error);
      }
    },
  };
}
