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
  createTriggers: z
    .boolean()
    .optional()
    .default(true)
    .describe(
      "Create INSERT/UPDATE/DELETE triggers for auto-sync (only for external content tables)",
    ),
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

      // Use contentTable if specified, otherwise use sourceTable
      const effectiveContentTable = input.contentTable ?? input.sourceTable;
      sanitizeIdentifier(effectiveContentTable);
      options += `, content="${effectiveContentTable}"`;

      const sql = `CREATE VIRTUAL TABLE IF NOT EXISTS "${input.tableName}" USING fts5(${columnList}, ${options})`;

      await adapter.executeQuery(sql);

      // Create sync triggers for external content FTS tables
      let triggersCreated: string[] = [];
      if (input.createTriggers) {
        triggersCreated = await createSyncTriggers(
          adapter,
          input.tableName,
          effectiveContentTable,
          input.columns,
        );
      }

      // Populate the FTS index with existing data
      await adapter.executeQuery(
        `INSERT INTO "${input.tableName}"("${input.tableName}") VALUES('rebuild')`,
      );

      const message = triggersCreated.length
        ? `FTS5 table '${input.tableName}' created with ${triggersCreated.length} sync triggers`
        : `FTS5 table '${input.tableName}' created`;

      return {
        success: true,
        message,
        tableName: input.tableName,
        triggersCreated: triggersCreated.length ? triggersCreated : undefined,
      };
    },
  };
}

/**
 * Create INSERT/UPDATE/DELETE triggers to keep FTS5 index in sync with content table
 */
async function createSyncTriggers(
  adapter: SqliteAdapter,
  ftsTable: string,
  contentTable: string,
  columns: string[],
): Promise<string[]> {
  const triggersCreated: string[] = [];
  const colList = columns.map((c) => `"${c}"`).join(", ");
  const newColList = columns.map((c) => `NEW."${c}"`).join(", ");
  const oldColList = columns.map((c) => `OLD."${c}"`).join(", ");

  // INSERT trigger - add new row to FTS index
  const insertTriggerName = `${ftsTable}_ai`;
  const insertTrigger = `
    CREATE TRIGGER IF NOT EXISTS "${insertTriggerName}" AFTER INSERT ON "${contentTable}" BEGIN
      INSERT INTO "${ftsTable}"(rowid, ${colList}) VALUES (NEW.rowid, ${newColList});
    END;
  `;
  await adapter.executeQuery(insertTrigger);
  triggersCreated.push(insertTriggerName);

  // DELETE trigger - remove row from FTS index
  const deleteTriggerName = `${ftsTable}_ad`;
  const deleteTrigger = `
    CREATE TRIGGER IF NOT EXISTS "${deleteTriggerName}" AFTER DELETE ON "${contentTable}" BEGIN
      INSERT INTO "${ftsTable}"("${ftsTable}", rowid, ${colList}) VALUES('delete', OLD.rowid, ${oldColList});
    END;
  `;
  await adapter.executeQuery(deleteTrigger);
  triggersCreated.push(deleteTriggerName);

  // UPDATE trigger - delete old entry and insert new one
  const updateTriggerName = `${ftsTable}_au`;
  const updateTrigger = `
    CREATE TRIGGER IF NOT EXISTS "${updateTriggerName}" AFTER UPDATE ON "${contentTable}" BEGIN
      INSERT INTO "${ftsTable}"("${ftsTable}", rowid, ${colList}) VALUES('delete', OLD.rowid, ${oldColList});
      INSERT INTO "${ftsTable}"(rowid, ${colList}) VALUES (NEW.rowid, ${newColList});
    END;
  `;
  await adapter.executeQuery(updateTrigger);
  triggersCreated.push(updateTriggerName);

  return triggersCreated;
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

      let selectClause = "*";
      if (input.highlight) {
        selectClause = `*, highlight("${input.table}", 0, '<b>', '</b>') as snippet`;
      }

      // Handle wildcard/list-all query - skip MATCH and return all rows
      if (input.query === "*" || input.query.trim() === "") {
        const sql = `SELECT ${selectClause}, NULL as rank FROM "${input.table}" ORDER BY rowid LIMIT ${input.limit}`;
        const result = await adapter.executeReadQuery(sql);
        return {
          success: true,
          rowCount: result.rows?.length ?? 0,
          results: result.rows,
        };
      }

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
        tableName: input.table,
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
