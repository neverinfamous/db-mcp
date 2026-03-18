/**
 * Query Plan Tool
 *
 * Analyze a SQL query's execution plan with scan-type classification
 * and optimization suggestions.
 */

import type { SqliteAdapter } from "../../../sqlite-adapter.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../../types/index.js";
import { readOnly } from "../../../../../utils/annotations.js";
import { formatHandlerError } from "../../../../../utils/errors/index.js";
import { z } from "zod";
import { QueryPlanOutputSchema } from "../../../output-schemas/index.js";

// Synthetic EXPLAIN table names that are not real tables
const SYNTHETIC_TABLES = new Set([
  "CONSTANT",
  "SUBQUERY",
  "LIST",
  "MATERIALIZED",
]);

// =============================================================================
// Input Schema
// =============================================================================

const QueryPlanSchema = z.object({
  sql: z.string().describe("SQL query to analyze (SELECT only)"),
});

// =============================================================================
// Tool Creator
// =============================================================================

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
            code: "VALIDATION_ERROR",
            category: "validation",
            recoverable: false,
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
              if (table && !SYNTHETIC_TABLES.has(table.toUpperCase()))
                coveringIndexes.push(table);
            } else if (detailUpper.includes("USING INDEX")) {
              scanType = "index_scan";
              if (table && !SYNTHETIC_TABLES.has(table.toUpperCase()))
                indexScans.push(table);
            } else {
              scanType = "full_scan";
              if (table && !SYNTHETIC_TABLES.has(table.toUpperCase()))
                fullScans.push(table);
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
          suggestions:
            suggestions.length > 0 ? [...new Set(suggestions)] : undefined,
        };
      } catch (error) {
        return formatHandlerError(error);
      }
    },
  };
}
