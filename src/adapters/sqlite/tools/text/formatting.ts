/**
 * Text Formatting Tools
 *
 * String manipulation: concat, replace, trim, case, substring.
 */

import type { SqliteAdapter } from "../../sqlite-adapter.js";
import type { ToolDefinition, RequestContext } from "../../../../types/index.js";
import { readOnly, write } from "../../../../utils/annotations.js";
import {
  validateWhereClause,
  sanitizeIdentifier,
} from "../../../../utils/index.js";
import { formatHandlerError, ValidationError } from "../../../../utils/errors/index.js";
import {
  RegexReplaceOutputSchema,
  TextConcatOutputSchema,
  TextTrimOutputSchema,
  TextCaseOutputSchema,
  TextSubstringOutputSchema,
} from "../../output-schemas/index.js";
import {
  TextConcatSchema,
  TextReplaceSchema,
  TextTrimSchema,
  TextCaseSchema,
  TextSubstringSchema,
  VALID_TEXT_CASE_MODES,
  VALID_TRIM_MODES,
  validateColumnExists,
  validateColumnsExist,
} from "./helpers.js";

export function createTextConcatTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_text_concat",
    description: "Concatenate multiple columns with optional separator.",
    group: "text",
    inputSchema: TextConcatSchema,
    outputSchema: TextConcatOutputSchema,
    requiredScopes: ["read"],
    annotations: readOnly("Text Concat"),
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const input = TextConcatSchema.parse(params);
        // Validate and quote identifiers, then verify columns exist
        const table = sanitizeIdentifier(input.table);
        const quotedCols = input.columns.map((c) => sanitizeIdentifier(c));
        await validateColumnsExist(adapter, input.table, input.columns);

        // Build concatenation expression using || operator
        const sep = input.separator.replace(/'/g, "''");
        // Build: COALESCE(col1, '') || 'sep' || COALESCE(col2, '') || ...
        const concatExpr = quotedCols
          .map((c) => `COALESCE(${c}, '')`)
          .join(` || '${sep}' || `);

        let sql = `SELECT ${concatExpr} as concatenated FROM ${table}`;
        if (input.whereClause) {
          validateWhereClause(input.whereClause);
          sql += ` WHERE ${input.whereClause}`;
        }
        sql += ` LIMIT ${input.limit}`;

        const result = await adapter.executeReadQuery(sql);

        return {
          success: true,
          rowCount: result.rows?.length ?? 0,
          values: result.rows?.map((r) => r["concatenated"]),
        };
      } catch (error) {
        return formatHandlerError(error);
      }
    },
  };
}

/**
 * Replace text in column
 */
export function createTextReplaceTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_text_replace",
    description: "Replace text in a column using SQLite replace() function.",
    group: "text",
    inputSchema: TextReplaceSchema,
    outputSchema: RegexReplaceOutputSchema,
    requiredScopes: ["write"],
    annotations: write("Text Replace"),
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const input = TextReplaceSchema.parse(params);
        // Validate and quote identifiers, then verify column exists
        const table = sanitizeIdentifier(input.table);
        const column = sanitizeIdentifier(input.column);
        await validateColumnExists(adapter, input.table, input.column);

        const search = input.searchPattern.replace(/'/g, "''");
        const replace = input.replaceWith.replace(/'/g, "''");

        validateWhereClause(input.whereClause);
        const sql = `UPDATE ${table} SET ${column} = replace(${column}, '${search}', '${replace}') WHERE ${input.whereClause}`;

        const result = await adapter.executeWriteQuery(sql);

        return {
          success: true,
          rowsAffected: result.rowsAffected,
        };
      } catch (error) {
        return formatHandlerError(error);
      }
    },
  };
}

/**
 * Trim whitespace
 */
export function createTextTrimTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_text_trim",
    description: "Trim whitespace from text column values.",
    group: "text",
    inputSchema: TextTrimSchema,
    outputSchema: TextTrimOutputSchema,
    requiredScopes: ["read"],
    annotations: readOnly("Text Trim"),
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const input = TextTrimSchema.parse(params);

        // Handler-side enum validation (schema uses z.string() to prevent raw MCP -32602)
        if (input.mode && !VALID_TRIM_MODES.includes(input.mode as typeof VALID_TRIM_MODES[number])) {
          throw new ValidationError(
            `Invalid mode '${input.mode}'. Must be one of: ${VALID_TRIM_MODES.join(", ")}`,
          );
        }

        // Validate and quote identifiers, then verify column exists
        const table = sanitizeIdentifier(input.table);
        const column = sanitizeIdentifier(input.column);
        await validateColumnExists(adapter, input.table, input.column);

        let trimFunc: string;
        switch (input.mode) {
          case "left":
            trimFunc = "ltrim";
            break;
          case "right":
            trimFunc = "rtrim";
            break;
          default:
            trimFunc = "trim";
        }

        let sql = `SELECT rowid, ${column} as original, ${trimFunc}(${column}) as trimmed FROM ${table}`;
        if (input.whereClause) {
          validateWhereClause(input.whereClause);
          sql += ` WHERE ${input.whereClause}`;
        }
        sql += ` LIMIT ${input.limit}`;

        const result = await adapter.executeReadQuery(sql);

        return {
          success: true,
          rowCount: result.rows?.length ?? 0,
          results: result.rows,
        };
      } catch (error) {
        return formatHandlerError(error);
      }
    },
  };
}

/**
 * Change text case
 */
export function createTextCaseTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_text_case",
    description: "Convert text to uppercase or lowercase.",
    group: "text",
    inputSchema: TextCaseSchema,
    outputSchema: TextCaseOutputSchema,
    requiredScopes: ["read"],
    annotations: readOnly("Text Case"),
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const input = TextCaseSchema.parse(params);

        // Handler-side enum validation (schema uses z.string() to prevent raw MCP -32602)
        if (!input.mode || !VALID_TEXT_CASE_MODES.includes(input.mode as typeof VALID_TEXT_CASE_MODES[number])) {
          throw new ValidationError(
            `Invalid mode '${input.mode ?? ""}'. Must be one of: ${VALID_TEXT_CASE_MODES.join(", ")}`,
          );
        }

        // Validate and quote identifiers, then verify column exists
        const table = sanitizeIdentifier(input.table);
        const column = sanitizeIdentifier(input.column);
        await validateColumnExists(adapter, input.table, input.column);

        const caseFunc = input.mode === "upper" ? "upper" : "lower";

        let sql = `SELECT rowid, ${column} as original, ${caseFunc}(${column}) as transformed FROM ${table}`;
        if (input.whereClause) {
          validateWhereClause(input.whereClause);
          sql += ` WHERE ${input.whereClause}`;
        }
        sql += ` LIMIT ${input.limit}`;

        const result = await adapter.executeReadQuery(sql);

        return {
          success: true,
          rowCount: result.rows?.length ?? 0,
          results: result.rows,
        };
      } catch (error) {
        return formatHandlerError(error);
      }
    },
  };
}

/**
 * Extract substring
 */
export function createTextSubstringTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_text_substring",
    description: "Extract a substring from text column using substr().",
    group: "text",
    inputSchema: TextSubstringSchema,
    outputSchema: TextSubstringOutputSchema,
    requiredScopes: ["read"],
    annotations: readOnly("Text Substring"),
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const input = TextSubstringSchema.parse(params);

        // Handler-side validation: start is required (schema uses .optional() to prevent raw MCP errors)
        if (input.start === undefined || input.start === null) {
          throw new ValidationError("'start' parameter is required (1-indexed position)");
        }

        // Validate and quote identifiers, then verify column exists
        const table = sanitizeIdentifier(input.table);
        const column = sanitizeIdentifier(input.column);
        await validateColumnExists(adapter, input.table, input.column);

        const substrExpr =
          input.length !== undefined
            ? `substr(${column}, ${input.start}, ${input.length})`
            : `substr(${column}, ${input.start})`;

        let sql = `SELECT rowid, ${column} as original, ${substrExpr} as substring FROM ${table}`;
        if (input.whereClause) {
          validateWhereClause(input.whereClause);
          sql += ` WHERE ${input.whereClause}`;
        }
        sql += ` LIMIT ${input.limit}`;

        const result = await adapter.executeReadQuery(sql);

        return {
          success: true,
          rowCount: result.rows?.length ?? 0,
          results: result.rows,
        };
      } catch (error) {
        return formatHandlerError(error);
      }
    },
  };
}

// =============================================================================
// New Text Tools: Fuzzy, Phonetic, Normalize, Validate
// =============================================================================

/**
 * Calculate Levenshtein distance between two strings
 */
export function levenshtein(a: string, b: string): number {
  const aLower = a.toLowerCase();
  const bLower = b.toLowerCase();

  // Handle edge cases
  if (aLower === bLower) return 0;
  if (aLower.length === 0) return bLower.length;
  if (bLower.length === 0) return aLower.length;

  // Create matrix with proper initialization
  const rows = bLower.length + 1;
  const cols = aLower.length + 1;
  const matrix: number[][] = [];

  for (let i = 0; i < rows; i++) {
    matrix.push(new Array<number>(cols).fill(0));
  }

  // Initialize first column and row
  for (let i = 0; i < rows; i++) {
    const row = matrix[i];
    if (row) row[0] = i;
  }
  for (let j = 0; j < cols; j++) {
    const firstRow = matrix[0];
    if (firstRow) firstRow[j] = j;
  }

  // Fill in the rest of the matrix
  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const currentRow = matrix[i];
      const prevRow = matrix[i - 1];
      if (!currentRow || !prevRow) continue;

      const cost = bLower[i - 1] === aLower[j - 1] ? 0 : 1;
      const del = (prevRow[j] ?? 0) + 1;
      const ins = (currentRow[j - 1] ?? 0) + 1;
      const sub = (prevRow[j - 1] ?? 0) + cost;
      currentRow[j] = Math.min(del, ins, sub);
    }
  }

  const lastRow = matrix[bLower.length];
  return lastRow?.[aLower.length] ?? 0;
}

/**
 * Simple Metaphone implementation
 */
export function metaphone(word: string): string {
  const vowels = "AEIOU";
  let result = "";
  const w = word.toUpperCase().replace(/[^A-Z]/g, "");

  for (let i = 0; i < w.length && result.length < 4; i++) {
    const c = w.charAt(i);
    const prev = i > 0 ? w.charAt(i - 1) : "";
    const next = i < w.length - 1 ? w.charAt(i + 1) : "";

    // Skip duplicate adjacent letters
    if (c === prev && c !== "C") continue;

    // Skip vowels except at start
    if (vowels.includes(c) && i > 0) continue;

    // Consonant rules (simplified)
    if (c === "B" && i === w.length - 1 && prev === "M") continue;
    if (c === "C") {
      if (next === "H") {
        result += "X";
        i++;
      } else if ("IEY".includes(next)) result += "S";
      else result += "K";
    } else if (c === "D") {
      const afterNext = w.charAt(i + 2);
      if (next === "G" && "IEY".includes(afterNext)) {
        result += "J";
        i++;
      } else result += "T";
    } else if (c === "G") {
      if (next === "H") continue;
      if ("IEY".includes(next)) result += "J";
      else result += "K";
    } else if (c === "K" && prev === "C") continue;
    else if (c === "P" && next === "H") {
      result += "F";
      i++;
    } else if (c === "Q") result += "K";
    else if (c === "S" && next === "H") {
      result += "X";
      i++;
    } else if (c === "T" && next === "H") {
      result += "0";
      i++;
    } else if (c === "W" && vowels.includes(next)) result += "W";
    else if (c === "X") result += "KS";
    else if (c === "Z") result += "S";
    else if (!"HW".includes(c)) result += c;
  }

  return result;
}

/**
 * Strip accents from text
 */
export function stripAccents(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/**
 * Simple Soundex implementation for phonetic matching
 */
export function soundex(word: string): string {
  if (!word) return "0000";
  const upper = word.toUpperCase().replace(/[^A-Z]/g, "");
  if (!upper) return "0000";

  const first = upper[0] ?? "0";
  const mapping: Record<string, string> = {
    B: "1",
    F: "1",
    P: "1",
    V: "1",
    C: "2",
    G: "2",
    J: "2",
    K: "2",
    Q: "2",
    S: "2",
    X: "2",
    Z: "2",
    D: "3",
    T: "3",
    L: "4",
    M: "5",
    N: "5",
    R: "6",
  };

  let result = first;
  for (let i = 1; i < upper.length && result.length < 4; i++) {
    const char = upper[i];
    if (char && mapping[char]) {
      const code = mapping[char];
      if (code && !result.endsWith(code)) {
        result += code;
      }
    }
  }
  return (result + "000").slice(0, 4);
}

/**
 * Validation patterns
 */
export const VALIDATION_PATTERNS: Record<string, RegExp> = {
  email: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
  phone: /^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]{7,}$/,
  url: /^https?:\/\/[^\s/$.?#].[^\s]*$/i,
  uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  ipv4: /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/,
};

/**
 * Fuzzy match using Levenshtein distance
 */