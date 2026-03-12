/**
 * Regex and Split Tools
 *
 * Pattern matching: regex-extract, regex-match, text-split.
 */

import type { SqliteAdapter } from "../../sqlite-adapter.js";
import type { ToolDefinition, RequestContext } from "../../../../types/index.js";
import { readOnly } from "../../../../utils/annotations.js";
import {
  validateWhereClause,
  sanitizeIdentifier,
} from "../../../../utils/index.js";
import { formatHandlerErrorResponse } from "../../../../utils/errors/index.js";
import {
  RegexMatchOutputSchema,
  TextSplitOutputSchema,
} from "../../output-schemas/index.js";
import {
  RegexExtractSchema,
  RegexMatchSchema,
  TextSplitSchema,
  validateColumnExists,
} from "./helpers.js";

/**
 * Extract text using regex pattern
 * Note: SQLite doesn't have native regex, we do this in JS
 */
export function createRegexExtractTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_regex_extract",
    description:
      "Extract text matching a regex pattern. Processed in JavaScript after fetching data.",
    group: "text",
    inputSchema: RegexExtractSchema,
    outputSchema: RegexMatchOutputSchema,
    requiredScopes: ["read"],
    annotations: readOnly("Regex Extract"),
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const input = RegexExtractSchema.parse(params);
        // Validate and quote identifiers, then verify column exists
        const table = sanitizeIdentifier(input.table);
        const column = sanitizeIdentifier(input.column);
        await validateColumnExists(adapter, input.table, input.column);

        let sql = `SELECT rowid as id, ${column} as value FROM ${table}`;
        if (input.whereClause) {
          validateWhereClause(input.whereClause);
          sql += ` WHERE ${input.whereClause}`;
        }
        sql += ` LIMIT ${input.limit}`;

        const result = await adapter.executeReadQuery(sql);

        // Apply regex in JavaScript
        const regex = new RegExp(input.pattern);
        const extracts = (result.rows ?? [])
          .map((row) => {
            const rawValue = row["value"];
            const value =
              typeof rawValue === "string"
                ? rawValue
                : JSON.stringify(rawValue ?? "");
            const match = regex.exec(value);
            // Safely coerce rowid to number, defaulting to row index or 0
            const rawRowid = row["id"];
            const rowid =
              typeof rawRowid === "number"
                ? rawRowid
                : typeof rawRowid === "string"
                  ? parseInt(rawRowid, 10) || 0
                  : 0;
            return {
              rowid,
              original: value,
              extracted: match ? (match[input.groupIndex] ?? match[0]) : null,
            };
          })
          .filter((r) => r.extracted !== null);

        return {
          success: true,
          rowCount: extracts.length,
          matches: extracts,
        };
      } catch (error) {
        return formatHandlerErrorResponse(error);
      }
    },
  };
}

/**
 * Match rows using regex pattern
 */
export function createRegexMatchTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_regex_match",
    description:
      "Find rows where column matches a regex pattern. Processed in JavaScript.",
    group: "text",
    inputSchema: RegexMatchSchema,
    outputSchema: RegexMatchOutputSchema,
    requiredScopes: ["read"],
    annotations: readOnly("Regex Match"),
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const input = RegexMatchSchema.parse(params);
        // Validate and quote identifiers, then verify column exists
        const table = sanitizeIdentifier(input.table);
        const column = sanitizeIdentifier(input.column);
        await validateColumnExists(adapter, input.table, input.column);

        let sql = `SELECT rowid as id, ${column} as value FROM ${table}`;
        if (input.whereClause) {
          validateWhereClause(input.whereClause);
          sql += ` WHERE ${input.whereClause}`;
        }
        sql += ` LIMIT ${input.limit}`;

        const result = await adapter.executeReadQuery(sql);

        // Apply regex in JavaScript
        const regex = new RegExp(input.pattern);
        const matches = (result.rows ?? [])
          .filter((row) => {
            const rawValue = row["value"];
            const value =
              typeof rawValue === "string"
                ? rawValue
                : JSON.stringify(rawValue ?? "");
            return regex.test(value);
          })
          .map((row) => {
            // Ensure rowid is a number for output schema compliance
            const rawRowid = row["id"];
            const rowid =
              typeof rawRowid === "number"
                ? rawRowid
                : typeof rawRowid === "string"
                  ? parseInt(rawRowid, 10) || 0
                  : 0;
            return { ...row, rowid };
          });

        return {
          success: true,
          rowCount: matches.length,
          matches,
        };
      } catch (error) {
        return formatHandlerErrorResponse(error);
      }
    },
  };
}

/**
 * Split text into array
 */
export function createTextSplitTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_text_split",
    description: "Split a text column by delimiter into array results.",
    group: "text",
    inputSchema: TextSplitSchema,
    outputSchema: TextSplitOutputSchema,
    requiredScopes: ["read"],
    annotations: readOnly("Text Split"),
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const input = TextSplitSchema.parse(params);
        // Validate and quote identifiers, then verify column exists
        const table = sanitizeIdentifier(input.table);
        const column = sanitizeIdentifier(input.column);
        await validateColumnExists(adapter, input.table, input.column);

        let sql = `SELECT rowid as id, ${column} as value FROM ${table}`;
        if (input.whereClause) {
          validateWhereClause(input.whereClause);
          sql += ` WHERE ${input.whereClause}`;
        }
        sql += ` LIMIT ${input.limit}`;

        const result = await adapter.executeReadQuery(sql);

        // Split in JavaScript - return per-row results for traceability
        const rows = (result.rows ?? []).map((row) => {
          const rawRowid = row["id"];
          const rowid =
            typeof rawRowid === "number"
              ? rawRowid
              : typeof rawRowid === "string"
                ? parseInt(rawRowid, 10) || 0
                : 0;
          const rawValue = row["value"];
          const original =
            typeof rawValue === "string"
              ? rawValue
              : rawValue === null || rawValue === undefined
                ? ""
                : JSON.stringify(rawValue);
          const parts = original.split(input.delimiter);
          return {
            rowid,
            original: rawValue === null ? null : original,
            parts,
          };
        });

        return {
          success: true,
          rowCount: rows.length,
          rows,
        };
      } catch (error) {
        return formatHandlerErrorResponse(error);
      }
    },
  };
}