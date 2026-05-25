import { validateColumnExists, isNumericType } from "./helpers.js";
/**
 * SQLite Anomaly Detection Tools
 *
 * Lightweight anomaly detectors adapted for SQLite's embedded architecture.
 * Uses PRAGMA, dbstat, and statistical analysis to provide risk scores
 * and actionable recommendations.
 *
 * Tools:
 *   - sqlite_stats_detect_anomalies: z-score data distribution anomaly detection
 *   - sqlite_stats_detect_bloat: multi-factor fragmentation/bloat risk scoring
 *
 * Shared helpers (exported for schema-risks.ts):
 *   - toNum, riskFromScore, RiskLevel
 */

import type { SqliteAdapter } from "../../sqlite-adapter.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../types/index.js";
import { readOnly } from "../../../../utils/annotations.js";
import {
  formatHandlerError,
  ResourceNotFoundError,
} from "../../../../utils/errors/index.js";
import {
  StatsDetectAnomaliesOutputSchema,
  StatsDetectBloatOutputSchema,
  DetectAnomaliesSchema,
  DetectBloatSchema,
} from "../../schemas/stats.js";
import type { WhereCondition } from "../../schemas/where.js";
import { isSpatialiteSystemTable } from "../core/tables.js";
import { buildWhereClause } from "../../../../utils/where-clause.js";

// =============================================================================
// Shared Helpers (exported for schema-risks.ts)
// =============================================================================

export type RiskLevel = "low" | "moderate" | "high" | "critical";

export const toNum = (val: unknown): number =>
  val === null || val === undefined ? 0 : Number(val);

export function riskFromScore(score: number): RiskLevel {
  if (score >= 80) return "critical";
  if (score >= 60) return "high";
  if (score >= 40) return "moderate";
  return "low";
}

// =============================================================================
// Input Schema Helpers
// =============================================================================

// =============================================================================
// Helper: get PRAGMA value
// =============================================================================

async function getPragmaNumber(
  adapter: SqliteAdapter,
  pragma: string,
): Promise<number> {
  const result = await adapter.executeReadQuery(`PRAGMA ${pragma}`);
  const row = result.rows?.[0];
  if (!row) return 0;
  const firstValue = Object.values(row)[0];
  const num = Number(firstValue);
  return isNaN(num) ? 0 : num;
}

async function getPragmaValue(
  adapter: SqliteAdapter,
  pragma: string,
): Promise<string> {
  const result = await adapter.executeReadQuery(`PRAGMA ${pragma}`);
  const row = result.rows?.[0];
  if (!row) return "unknown";
  const firstValue = Object.values(row)[0];
  if (typeof firstValue === "string") return firstValue;
  if (typeof firstValue === "number" || typeof firstValue === "boolean")
    return String(firstValue);
  return "unknown";
}

// =============================================================================
// 1. sqlite_stats_detect_anomalies
// =============================================================================

export function createDetectAnomaliesTool(
  adapter: SqliteAdapter,
): ToolDefinition {
  return {
    name: "sqlite_stats_detect_anomalies",
    description:
      "Detects data distribution anomalies in numeric columns using z-score " +
      "analysis. Flags rows where values deviate beyond a configurable threshold " +
      "from the column mean. Returns per-column anomaly counts, top deviations, " +
      "and an overall risk level.",
    group: "stats",
    inputSchema: DetectAnomaliesSchema,
    outputSchema: StatsDetectAnomaliesOutputSchema,
    requiredScopes: ["read"],
    annotations: readOnly("Detect Data Anomalies"),
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const input = DetectAnomaliesSchema.parse(params);
      
        const threshold = Math.max(0.5, Math.min(100, input.threshold));
        const limit = Math.max(1, Math.min(500, input.limit));

        // Validate table exists
        const tableCheck = await adapter.executeReadQuery(
          `SELECT 1 FROM sqlite_master WHERE type IN ('table', 'view') AND name='${input.table.replace(/'/g, "''")}'`,
        );
        if (!tableCheck.rows || tableCheck.rows.length === 0) {
          throw new ResourceNotFoundError(
            `Table '${input.table}' does not exist`,
            "TABLE_NOT_FOUND",
            {
              suggestion: "Run sqlite_list_tables to see available tables.",
              resourceType: "table",
              resourceName: input.table,
            },
          );
        }

        // Determine columns to analyze
        const tableInfo = await adapter.describeTable(input.table);
        let columnsToAnalyze: string[];
        if (input.column) {
          await validateColumnExists(adapter, input.table, input.column);
          columnsToAnalyze = [input.column];
        } else if (input.columns && input.columns.length > 0) {
          for (const col of input.columns) {
            await validateColumnExists(adapter, input.table, col);
          }
          columnsToAnalyze = input.columns;
        } else {
          columnsToAnalyze = (tableInfo.columns ?? [])
            .filter((c) => isNumericType((c.type ?? "").toLowerCase()))
            .map((c) => c.name);
        }

        if (columnsToAnalyze.length === 0) {
          return {
            success: true,
            anomalies: [],
            riskLevel: "low" as const,
            totalColumnsAnalyzed: 0,
            totalAnomalies: 0,
            summary: "No numeric columns found to analyze.",
          };
        }

        return await analyzeColumns(
          adapter,
          input.table,
          columnsToAnalyze,
          threshold,
          limit,
          input.conditions,
        );
      } catch (error: unknown) {
        return formatHandlerError(error);
      }
    },
  };
}

/** Core anomaly analysis loop — extracted for readability */
async function analyzeColumns(
  adapter: SqliteAdapter,
  table: string,
  columns: string[],
  threshold: number,
  limit: number,
  conditions?: WhereCondition[],
): Promise<Record<string, unknown>> {
  interface ColumnAnomaly {
    column: string;
    mean: number;
    stddev: number;
    anomalyCount: number;
    totalRows: number;
    topDeviations: { rowid: number; value: number; zScore: number }[];
  }

  const anomalies: ColumnAnomaly[] = [];
  let totalAnomalies = 0;
  let maxAnomalyPct = 0;
  const qt = `"${table.replace(/"/g, '""')}"`;

  let extraWhere = "";
  let whereParams: unknown[] = [];
  if (conditions) {
    const { sql, params } = buildWhereClause(conditions);
    if (sql !== "") {
      extraWhere = ` AND ${sql}`;
      whereParams = params;
    }
  }

  for (const col of columns) {
    const qc = `"${col.replace(/"/g, '""')}"`;
    const whereBase = `${qc} IS NOT NULL AND typeof(${qc}) IN ('integer', 'real')`;

    // Compute mean
    const statsResult = await adapter.executeReadQuery(
      `SELECT COUNT(${qc}) as cnt, AVG(CAST(${qc} AS REAL)) as mean_val FROM ${qt} WHERE ${whereBase}${extraWhere}`,
      whereParams
    );
    const count = toNum(statsResult.rows?.[0]?.["cnt"]);
    const mean = toNum(statsResult.rows?.[0]?.["mean_val"]);
    if (count < 2) continue;

    // Compute stddev (SQLite has no built-in STDDEV)
    const varResult = await adapter.executeReadQuery(
      `SELECT AVG((CAST(${qc} AS REAL) - ${String(mean)}) * (CAST(${qc} AS REAL) - ${String(mean)})) as variance FROM ${qt} WHERE ${whereBase}${extraWhere}`,
      whereParams
    );
    const stddev = Math.sqrt(toNum(varResult.rows?.[0]?.["variance"]));
    if (stddev === 0) continue;

    const lo = mean - threshold * stddev;
    const hi = mean + threshold * stddev;
    const boundFilter = `(CAST(${qc} AS REAL) < ${String(lo)} OR CAST(${qc} AS REAL) > ${String(hi)})`;

    // Count anomalies
    const cntResult = await adapter.executeReadQuery(
      `SELECT COUNT(*) as ac FROM ${qt} WHERE ${whereBase} AND ${boundFilter}${extraWhere}`,
      whereParams
    );
    const anomalyCount = toNum(cntResult.rows?.[0]?.["ac"]);
    if (anomalyCount === 0) continue;

    // Top deviations
    const deviations = await adapter.executeReadQuery(
      `SELECT rowid, ${qc} as value, ABS((CAST(${qc} AS REAL) - ${String(mean)}) / ${String(stddev)}) as z_score FROM ${qt} WHERE ${whereBase} AND ${boundFilter}${extraWhere} ORDER BY z_score DESC LIMIT ${String(limit)}`,
      whereParams
    );

    totalAnomalies += anomalyCount;
    const pct = (anomalyCount / count) * 100;
    if (pct > maxAnomalyPct) maxAnomalyPct = pct;

    anomalies.push({
      column: col,
      mean: Math.round(mean * 10000) / 10000,
      stddev: Math.round(stddev * 10000) / 10000,
      anomalyCount,
      totalRows: count,
      topDeviations: (deviations.rows ?? []).map(
        (r: Record<string, unknown>) => ({
          rowid: toNum(r["rowid"]),
          value: toNum(r["value"]),
          zScore: Math.round(toNum(r["z_score"]) * 100) / 100,
        }),
      ),
    });
  }

  // Risk scoring
  let riskScore = 0;
  if (maxAnomalyPct >= 20) riskScore += 50;
  else if (maxAnomalyPct >= 10) riskScore += 30;
  else if (maxAnomalyPct >= 5) riskScore += 15;
  if (totalAnomalies >= 100) riskScore += 40;
  else if (totalAnomalies >= 50) riskScore += 25;
  else if (totalAnomalies >= 10) riskScore += 10;

  const riskLevel = riskFromScore(riskScore);
  const summary =
    totalAnomalies === 0
      ? `No data anomalies detected across ${String(columns.length)} column(s) (threshold: ${String(threshold)}σ)`
      : `${String(totalAnomalies)} anomalies across ${String(anomalies.length)} of ${String(columns.length)} column(s) (threshold: ${String(threshold)}σ, max rate: ${String(Math.round(maxAnomalyPct * 10) / 10)}%)`;

  return {
    success: true,
    anomalies,
    riskLevel,
    totalColumnsAnalyzed: columns.length,
    totalAnomalies,
    summary,
  };
}

// =============================================================================
// 2. sqlite_stats_detect_bloat
// =============================================================================

export function createDetectBloatTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_stats_detect_bloat",
    description:
      "Scores database and tables by fragmentation/bloat risk using " +
      "multiple factors: free page ratio, per-table size, auto_vacuum status, " +
      "and journal mode. Returns per-table risk scores (0-100), database-level " +
      "metrics, and actionable recommendations.",
    group: "stats",
    inputSchema: DetectBloatSchema,
    outputSchema: StatsDetectBloatOutputSchema,
    requiredScopes: ["read"],
    annotations: readOnly("Detect Bloat Risk"),
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const input = DetectBloatSchema.parse(params);
//       const queryParams: unknown[] = [];
        const limit = Math.max(1, Math.min(500, input.limit));
        const excludeSystem = input.excludeSystemTables !== false;

        // Database-level metrics
        const pageSize = await getPragmaNumber(adapter, "page_size");
        const totalPages = await getPragmaNumber(adapter, "page_count");
        const freePages = await getPragmaNumber(adapter, "freelist_count");
        const journalMode = await getPragmaValue(adapter, "journal_mode");
        const avRaw = await getPragmaNumber(adapter, "auto_vacuum");
        const autoVacuum =
          (["none", "full", "incremental"] as const)[avRaw] ?? "none";

        const totalSizeBytes = totalPages * pageSize;
        const dbFragPct =
          totalPages > 0
            ? Math.round((freePages / totalPages) * 10000) / 100
            : 0;

        let tables = await gatherTableBloat(
          adapter,
          pageSize,
          totalSizeBytes,
          dbFragPct,
          autoVacuum,
          journalMode,
          excludeSystem,
        );

        if (!input.includeZeroRisk) {
          tables = tables.filter((t) => t.riskScore >= 10);
        }

        tables.sort((a, b) => b.riskScore - a.riskScore);
        tables = tables.slice(0, limit);

        const highRiskCount = tables.filter((t) => t.riskScore >= 60).length;
        const summary =
          highRiskCount === 0
            ? `No high-risk bloat detected across ${String(tables.length)} tables (db fragmentation: ${String(dbFragPct)}%)`
            : `${String(highRiskCount)} table(s) at elevated bloat risk out of ${String(tables.length)} analyzed (db fragmentation: ${String(dbFragPct)}%)`;

        return {
          success: true,
          database: {
            totalSizeBytes,
            pageSize,
            totalPages,
            freePages,
            fragmentationPct: dbFragPct,
            journalMode,
            autoVacuum,
          },
          tables,
          highRiskCount,
          totalAnalyzed: tables.length,
          summary,
        };
      } catch (error: unknown) {
        return formatHandlerError(error);
      }
    },
  };
}

interface TableBloatEntry {
  name: string;
  sizeBytes: number;
  pageCount: number;
  rowCount: number;
  pctOfTotal: number;
  riskScore: number;
  riskLevel: RiskLevel;
  factors: {
    fragmentation: number;
    tableSizeImpact: number;
    autoVacuumStatus: number;
    journalMode: number;
  };
  recommendations: string[];
}

async function gatherTableBloat(
  adapter: SqliteAdapter,
  pageSize: number,
  totalSizeBytes: number,
  dbFragPct: number,
  autoVacuum: string,
  journalMode: string,
  excludeSystem: boolean,
): Promise<TableBloatEntry[]> {
  const tables: TableBloatEntry[] = [];

  try {
    const dbstatResult = await adapter.executeReadQuery(
      `SELECT name, SUM(pgsize) as size_bytes, COUNT(*) as page_count
       FROM dbstat WHERE name NOT LIKE 'sqlite_%'
       GROUP BY name ORDER BY size_bytes DESC`,
    );

    for (const row of dbstatResult.rows ?? []) {
      const name = row["name"] as string;
      if (excludeSystem && isSpatialiteSystemTable(name)) continue;
      const sizeBytes = toNum(row["size_bytes"]);
      const pc = toNum(row["page_count"]);
      const rc = await safeRowCount(adapter, name);
      tables.push(
        scoreBloat(
          name,
          sizeBytes,
          pc,
          rc,
          totalSizeBytes,
          dbFragPct,
          autoVacuum,
          journalMode,
        ),
      );
    }
  } catch {
    // Fallback when dbstat is unavailable
    const result = await adapter.executeReadQuery(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name`,
    );
    for (const row of result.rows ?? []) {
      const name = row["name"] as string;
      if (excludeSystem && isSpatialiteSystemTable(name)) continue;
      const rc = await safeRowCount(adapter, name);
      const est = rc * 100;
      tables.push(
        scoreBloat(
          name,
          est,
          Math.max(1, Math.ceil(est / pageSize)),
          rc,
          totalSizeBytes,
          dbFragPct,
          autoVacuum,
          journalMode,
        ),
      );
    }
  }

  return tables;
}

async function safeRowCount(
  adapter: SqliteAdapter,
  table: string,
): Promise<number> {
  try {
    const r = await adapter.executeReadQuery(
      `SELECT COUNT(*) as cnt FROM "${table.replace(/"/g, '""')}"`,
    );
    return toNum(r.rows?.[0]?.["cnt"]);
  } catch {
    return 0;
  }
}

function scoreBloat(
  name: string,
  sizeBytes: number,
  pageCount: number,
  rowCount: number,
  totalSizeBytes: number,
  dbFragPct: number,
  autoVacuum: string,
  journalMode: string,
): TableBloatEntry {
  const pctOfTotal =
    totalSizeBytes > 0
      ? Math.round((sizeBytes / totalSizeBytes) * 10000) / 100
      : 0;
  const sizeMB = sizeBytes / (1024 * 1024);

  // Factor 1: Fragmentation (40%)
  let fragScore = 0;
  if (dbFragPct >= 30) fragScore = 100;
  else if (dbFragPct >= 20) fragScore = 80;
  else if (dbFragPct >= 10) fragScore = 50;
  else if (dbFragPct >= 5) fragScore = 25;

  // Factor 2: Table size (25%)
  let sizeScore = 0;
  if (sizeMB >= 1000) sizeScore = 100;
  else if (sizeMB >= 100) sizeScore = 70;
  else if (sizeMB >= 10) sizeScore = 40;

  // Factor 3: Auto-vacuum (20%)
  let avScore = 0;
  if (autoVacuum === "none" && dbFragPct > 5) avScore = 90;
  else if (autoVacuum === "none") avScore = 30;

  // Factor 4: Journal mode (15%)
  let jmScore = 0;
  if (journalMode !== "wal" && sizeMB >= 10) jmScore = 50;

  const riskScore = Math.round(
    fragScore * 0.4 + sizeScore * 0.25 + avScore * 0.2 + jmScore * 0.15,
  );

  const recommendations: string[] = [];
  if (dbFragPct >= 10)
    recommendations.push(
      `Database has ${String(dbFragPct)}% fragmentation. Run VACUUM to reclaim space.`,
    );
  if (autoVacuum === "none" && dbFragPct > 5)
    recommendations.push(
      "auto_vacuum is disabled. Enable with PRAGMA auto_vacuum = INCREMENTAL or run periodic VACUUM.",
    );
  if (journalMode !== "wal" && sizeMB >= 10)
    recommendations.push(
      "Consider switching to WAL mode (PRAGMA journal_mode = WAL) for better concurrent performance.",
    );

  return {
    name,
    sizeBytes,
    pageCount,
    rowCount,
    pctOfTotal,
    riskScore,
    riskLevel: riskFromScore(riskScore),
    factors: {
      fragmentation: Math.round(fragScore * 0.4),
      tableSizeImpact: Math.round(sizeScore * 0.25),
      autoVacuumStatus: Math.round(avScore * 0.2),
      journalMode: Math.round(jmScore * 0.15),
    },
    recommendations,
  };
}
