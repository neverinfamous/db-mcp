/**
 * SQLite Full-Text Search (FTS5) Tools
 *
 * Create and query FTS5 virtual tables for full-text search.
 * 4 tools total.
 */

import { z } from "zod";
import type { SqliteAdapter } from "../SqliteAdapter.js";
import type { ToolDefinition, RequestContext } from "../../../types/index.js";
import { readOnly, idempotent, admin } from "../../../utils/annotations.js";
import { sanitizeIdentifier } from "../../../utils/index.js";
import {
  FtsCreateOutputSchema,
  FtsSearchOutputSchema,
  FtsRebuildOutputSchema,
} from "../output-schemas.js";

// FTS schemas
const FtsCreateSchema = z.object({
  tableName: z.string().describe("Name of the FTS table to create"),
  sourceTable: z.string().describe("Source table to index"),
  columns: z.array(z.string()).describe("Columns to include in the index"),
  contentTable: z
    .string()
    .optional()
    .describe("Content table for external content FTS"),
  tokenizer: z
    .enum(["unicode61", "ascii", "porter"])
    .optional()
    .default("unicode61"),
});

const FtsSearchSchema = z.object({
  table: z.string().describe("FTS table name"),
  query: z.string().describe("Full-text search query"),
  columns: z
    .array(z.string())
    .optional()
    .describe("Specific columns to search"),
  limit: z.number().optional().default(100),
  highlight: z
    .boolean()
    .optional()
    .default(false)
    .describe("Include highlighted snippets"),
});

const FtsRebuildSchema = z.object({
  table: z.string().describe("FTS table name to rebuild"),
});

const FtsMatchInfoSchema = z.object({
  table: z.string().describe("FTS table name"),
  query: z.string().describe("Full-text search query"),
  format: z.enum(["bm25", "rank"]).optional().default("bm25"),
});

/**
 * Get all FTS tools
 */
export function getFtsTools(adapter: SqliteAdapter): ToolDefinition[] {
  return [
    createFtsCreateTool(adapter),
    createFtsSearchTool(adapter),
    createFtsRebuildTool(adapter),
    createFtsMatchInfoTool(adapter),
  ];
}

/**
 * Create an FTS5 table
 */
function createFtsCreateTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_fts_create",
    description: "Create an FTS5 full-text search virtual table.",
    group: "text",
    inputSchema: FtsCreateSchema,
    outputSchema: FtsCreateOutputSchema,
    requiredScopes: ["write"],
    annotations: idempotent("FTS Create"),
    handler: async (params: unknown, _context: RequestContext) => {
      const input = FtsCreateSchema.parse(params);

      // Validate identifiers (FTS5 uses raw column names, not quoted)
      sanitizeIdentifier(input.tableName);
      sanitizeIdentifier(input.sourceTable);
      for (const col of input.columns) {
        sanitizeIdentifier(col);
      }

      const columnList = input.columns.join(", ");
      let options = `tokenize="${input.tokenizer}"`;

      if (input.contentTable) {
        sanitizeIdentifier(input.contentTable);
        options += `, content="${input.contentTable}"`;
      }

      const sql = `CREATE VIRTUAL TABLE IF NOT EXISTS "${input.tableName}" USING fts5(${columnList}, ${options})`;

      await adapter.executeQuery(sql);

      return {
        success: true,
        message: `FTS5 table '${input.tableName}' created`,
        sql,
      };
    },
  };
}

/**
 * Search FTS table
 */
function createFtsSearchTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_fts_search",
    description: "Search an FTS5 table using full-text query syntax.",
    group: "text",
    inputSchema: FtsSearchSchema,
    outputSchema: FtsSearchOutputSchema,
    requiredScopes: ["read"],
    annotations: readOnly("FTS Search"),
    handler: async (params: unknown, _context: RequestContext) => {
      const input = FtsSearchSchema.parse(params);

      // Validate FTS table name
      sanitizeIdentifier(input.table);

      // Build query - use single quotes for FTS5 MATCH strings (not double quotes which are identifiers)
      const queryEscaped = input.query.replace(/'/g, "''");
      let matchExpr = `"${input.table}" MATCH '${queryEscaped}'`;

      // If specific columns, use column filters
      if (input.columns && input.columns.length > 0) {
        for (const col of input.columns) {
          sanitizeIdentifier(col);
        }
        const colFilter = input.columns
          .map((c) => `${c}:${queryEscaped}`)
          .join(" OR ");
        matchExpr = `"${input.table}" MATCH '${colFilter}'`;
      }

      let selectClause = "*";
      if (input.highlight) {
        selectClause = `*, highlight("${input.table}", 0, '<b>', '</b>') as snippet`;
      }

      const sql = `SELECT ${selectClause}, rank FROM "${input.table}" WHERE ${matchExpr} ORDER BY rank LIMIT ${input.limit}`;

      const result = await adapter.executeReadQuery(sql);

      return {
        success: true,
        rowCount: result.rows?.length ?? 0,
        results: result.rows,
      };
    },
  };
}

/**
 * Rebuild FTS index
 */
function createFtsRebuildTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_fts_rebuild",
    description: "Rebuild an FTS5 index to optimize search performance.",
    group: "text",
    inputSchema: FtsRebuildSchema,
    outputSchema: FtsRebuildOutputSchema,
    requiredScopes: ["admin"],
    annotations: admin("FTS Rebuild"),
    handler: async (params: unknown, _context: RequestContext) => {
      const input = FtsRebuildSchema.parse(params);

      // Validate FTS table name
      sanitizeIdentifier(input.table);

      // Rebuild = drop shadow tables and recreate
      const sql = `INSERT INTO "${input.table}"("${input.table}") VALUES('rebuild')`;

      await adapter.executeQuery(sql);

      return {
        success: true,
        message: `FTS5 index '${input.table}' rebuilt`,
      };
    },
  };
}

/**
 * Get FTS match info/ranking
 */
function createFtsMatchInfoTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_fts_match_info",
    description: "Get FTS5 match ranking information using bm25.",
    group: "text",
    inputSchema: FtsMatchInfoSchema,
    outputSchema: FtsSearchOutputSchema,
    requiredScopes: ["read"],
    annotations: readOnly("FTS Match Info"),
    handler: async (params: unknown, _context: RequestContext) => {
      const input = FtsMatchInfoSchema.parse(params);

      // Validate FTS table name
      sanitizeIdentifier(input.table);

      // Use single quotes for FTS5 MATCH strings
      const queryEscaped = input.query.replace(/'/g, "''");

      let rankExpr: string;
      if (input.format === "bm25") {
        rankExpr = `bm25("${input.table}")`;
      } else {
        rankExpr = "rank";
      }

      const sql = `SELECT *, ${rankExpr} as score FROM "${input.table}" WHERE "${input.table}" MATCH '${queryEscaped}' ORDER BY score`;

      const result = await adapter.executeReadQuery(sql);

      return {
        success: true,
        rowCount: result.rows?.length ?? 0,
        results: result.rows,
      };
    },
  };
}
