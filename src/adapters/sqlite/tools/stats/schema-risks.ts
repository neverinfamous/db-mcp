/**
 * SQLite Schema Risk Detection Tool
 *
 * Detects schema health risks — missing indexes on FK columns,
 * tables without primary keys, wide tables, and large unindexed tables.
 * Replaces the connection spike tool from postgres-mcp/mysql-mcp with
 * a more useful analysis for embedded databases.
 *
 * Tools:
 *   - sqlite_stats_detect_schema_risks: multi-factor schema health scoring
 */

import { z } from "zod";
import type { SqliteAdapter } from "../../sqlite-adapter.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../types/index.js";
import { readOnly } from "../../../../utils/annotations.js";
import { formatHandlerError } from "../../../../utils/errors/index.js";
import { StatsDetectSchemaRisksOutputSchema } from "../../schemas/stats.js";
import { toNum, riskFromScore } from "./anomaly-detection.js";
import type { RiskLevel } from "./anomaly-detection.js";
import { isSpatialiteSystemTable } from "../core/tables.js";

// =============================================================================
// Schema
// =============================================================================

const coerceNumber = (val: unknown): unknown =>
  typeof val === "string"
    ? isNaN(Number(val))
      ? undefined
      : Number(val)
    : val;

const DetectSchemaRisksSchema = z
  .object({
    limit: z.preprocess(
      coerceNumber,
      z
        .number()
        .optional()
        .default(50)
        .describe("Maximum tables to analyze (default: 50)"),
    ),
    excludeSystemTables: z
      .boolean()
      .optional()
      .describe("Exclude SpatiaLite system tables (default: true)"),
    includeZeroRisk: z
      .boolean()
      .optional()
      .default(false)
      .describe("Include tables with 0 risk score (default: false)"),
  })
  .default(() => ({ limit: 50, includeZeroRisk: false }));

// =============================================================================
// Tool Creator
// =============================================================================

export function createDetectSchemaRisksTool(
  adapter: SqliteAdapter,
): ToolDefinition {
  return {
    name: "sqlite_stats_detect_schema_risks",
    description:
      "Scores tables by schema health risk using multiple factors: " +
      "missing indexes on foreign key columns, tables without primary keys, " +
      "wide tables (>20 columns), and large unindexed tables. Returns " +
      "per-table risk scores (0-100) with actionable recommendations.",
    group: "stats",
    inputSchema: DetectSchemaRisksSchema,
    outputSchema: StatsDetectSchemaRisksOutputSchema,
    requiredScopes: ["read"],
    annotations: readOnly("Detect Schema Risks"),
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const input = DetectSchemaRisksSchema.parse(params);
        const limit = Math.max(1, Math.min(500, input.limit));
        const excludeSystem = input.excludeSystemTables !== false;

        // Get all user tables
        const tablesResult = await adapter.executeReadQuery(
          `SELECT name FROM sqlite_master
           WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
           ORDER BY name`,
        );

        interface TableRisk {
          name: string;
          rowCount: number;
          columnCount: number;
          indexCount: number;
          hasPrimaryKey: boolean;
          foreignKeyCount: number;
          unindexedForeignKeys: string[];
          riskScore: number;
          riskLevel: RiskLevel;
          factors: {
            missingFkIndexes: number;
            wideTable: number;
            noPrimaryKey: number;
            largeUnindexed: number;
          };
          recommendations: string[];
        }

        let tables: TableRisk[] = [];

        for (const row of tablesResult.rows ?? []) {
          const tableName = row["name"] as string;
          if (excludeSystem && isSpatialiteSystemTable(tableName)) continue;

          const qt = `"${tableName.replace(/"/g, '""')}"`;

          // Get column info
          let columns: Record<string, unknown>[] = [];
          try {
            const colsResult = await adapter.executeReadQuery(
              `PRAGMA table_info(${qt})`,
            );
            columns = colsResult.rows ?? [];
          } catch {
            continue; // Skip virtual tables where PRAGMA table_info fails
          }
          const columnCount = columns.length;

          // Check for primary key
          const hasPrimaryKey = columns.some(
            (c: Record<string, unknown>) => toNum(c["pk"]) > 0,
          );

          // Get row count
          let rowCount = 0;
          try {
            const cntResult = await adapter.executeReadQuery(
              `SELECT COUNT(*) as cnt FROM ${qt}`,
            );
            rowCount = toNum(cntResult.rows?.[0]?.["cnt"]);
          } catch {
            continue; // Skip virtual tables etc.
          }

          // Get indexes
          const indexResult = await adapter.executeReadQuery(
            `PRAGMA index_list(${qt})`,
          );
          const indexes = indexResult.rows ?? [];
          const indexCount = indexes.length;

          // Get indexed columns (flattened set)
          const indexedColumns = new Set<string>();
          for (const idx of indexes) {
            const idxName = idx["name"] as string;
            try {
              const idxInfo = await adapter.executeReadQuery(
                `PRAGMA index_info("${idxName.replace(/"/g, '""')}")`,
              );
              for (const idxCol of idxInfo.rows ?? []) {
                const colName = idxCol["name"];
                if (typeof colName === "string") {
                  indexedColumns.add(colName.toLowerCase());
                }
              }
            } catch {
              // Skip
            }
          }

          // Get foreign keys and check if their columns are indexed
          const fkResult = await adapter.executeReadQuery(
            `PRAGMA foreign_key_list(${qt})`,
          );
          const foreignKeys = fkResult.rows ?? [];
          const foreignKeyCount = foreignKeys.length;
          const unindexedForeignKeys: string[] = [];

          for (const fk of foreignKeys) {
            const fkCol = fk["from"];
            if (
              typeof fkCol === "string" &&
              !indexedColumns.has(fkCol.toLowerCase())
            ) {
              unindexedForeignKeys.push(fkCol);
            }
          }

          // Risk scoring
          // Factor 1: Missing indexes on FK columns (30%)
          let fkIndexScore = 0;
          if (unindexedForeignKeys.length >= 3) fkIndexScore = 100;
          else if (unindexedForeignKeys.length === 2) fkIndexScore = 70;
          else if (unindexedForeignKeys.length === 1) fkIndexScore = 40;

          // Factor 2: Wide table (20%)
          let wideScore = 0;
          if (columnCount >= 40) wideScore = 100;
          else if (columnCount >= 30) wideScore = 70;
          else if (columnCount >= 20) wideScore = 40;

          // Factor 3: No primary key (25%)
          let noPkScore = 0;
          if (!hasPrimaryKey) {
            noPkScore = rowCount >= 1000 ? 100 : rowCount >= 100 ? 70 : 40;
          }

          // Factor 4: Large unindexed table (25%)
          let largeUnindexedScore = 0;
          if (indexCount === 0 && rowCount >= 10000) largeUnindexedScore = 100;
          else if (indexCount === 0 && rowCount >= 1000)
            largeUnindexedScore = 60;
          else if (indexCount <= 1 && rowCount >= 50000)
            largeUnindexedScore = 50;

          const riskScore = Math.round(
            fkIndexScore * 0.3 +
              wideScore * 0.2 +
              noPkScore * 0.25 +
              largeUnindexedScore * 0.25,
          );

          const recommendations: string[] = [];
          if (unindexedForeignKeys.length > 0) {
            recommendations.push(
              `Create indexes on foreign key columns: ${unindexedForeignKeys.join(", ")}. Without indexes, JOINs on these columns cause full table scans.`,
            );
          }
          if (!hasPrimaryKey) {
            recommendations.push(
              "Table has no explicit PRIMARY KEY. Add one for efficient lookups and to avoid implicit rowid-based addressing.",
            );
          }
          if (columnCount >= 20) {
            recommendations.push(
              `Table has ${String(columnCount)} columns. Consider normalizing into related tables to reduce row width.`,
            );
          }
          if (indexCount === 0 && rowCount >= 1000) {
            recommendations.push(
              `Table has ${String(rowCount)} rows but no indexes. Add indexes on frequently queried columns.`,
            );
          }

          tables.push({
            name: tableName,
            rowCount,
            columnCount,
            indexCount,
            hasPrimaryKey,
            foreignKeyCount,
            unindexedForeignKeys,
            riskScore,
            riskLevel: riskFromScore(riskScore),
            factors: {
              missingFkIndexes: Math.round(fkIndexScore * 0.3),
              wideTable: Math.round(wideScore * 0.2),
              noPrimaryKey: Math.round(noPkScore * 0.25),
              largeUnindexed: Math.round(largeUnindexedScore * 0.25),
            },
            recommendations,
          });
        }

        // Sort by risk score descending, then limit
        if (!input.includeZeroRisk) {
          tables = tables.filter((t) => t.riskScore > 0);
        }
        
        tables.sort((a, b) => b.riskScore - a.riskScore);
        tables = tables.slice(0, limit);

        const highRiskCount = tables.filter((t) => t.riskScore >= 60).length;

        const summary =
          highRiskCount === 0
            ? `No high-risk schema issues detected across ${String(tables.length)} tables`
            : `${String(highRiskCount)} table(s) with schema health risks out of ${String(tables.length)} analyzed`;

        return {
          success: true,
          tables,
          highRiskCount,
          totalAnalyzed: tables.length,
          summary,
        };
      } catch (error) {
        return formatHandlerError(error);
      }
    },
  };
}
