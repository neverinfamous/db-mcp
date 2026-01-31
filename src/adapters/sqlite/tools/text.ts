/**
 * SQLite Text Processing Tools
 *
 * String manipulation and pattern matching:
 * regex, split, concat, format, fuzzy match, phonetic, normalize, validate.
 * 13 tools total.
 */

import { z } from "zod";
import type { SqliteAdapter } from "../SqliteAdapter.js";
import type { ToolDefinition, RequestContext } from "../../../types/index.js";
import { readOnly, write } from "../../../utils/annotations.js";
import {
  validateWhereClause,
  sanitizeIdentifier,
} from "../../../utils/index.js";
import {
  RegexMatchOutputSchema,
  TextSplitOutputSchema,
  RegexReplaceOutputSchema,
} from "../output-schemas.js";

// Text tool schemas
const RegexExtractSchema = z.object({
  table: z.string().describe("Table name"),
  column: z.string().describe("Column to extract from"),
  pattern: z.string().describe("Regular expression pattern"),
  groupIndex: z.number().optional().default(0).describe("Capture group index"),
  whereClause: z.string().optional(),
  limit: z.number().optional().default(100),
});

const RegexMatchSchema = z.object({
  table: z.string().describe("Table name"),
  column: z.string().describe("Column to match"),
  pattern: z.string().describe("Regular expression pattern"),
  whereClause: z.string().optional(),
  limit: z.number().optional().default(100),
});

const TextSplitSchema = z.object({
  table: z.string().describe("Table name"),
  column: z.string().describe("Column to split"),
  delimiter: z.string().describe("Delimiter string"),
  whereClause: z.string().optional(),
  limit: z.number().optional().default(100),
});

const TextConcatSchema = z.object({
  table: z.string().describe("Table name"),
  columns: z.array(z.string()).describe("Columns to concatenate"),
  separator: z
    .string()
    .optional()
    .default("")
    .describe("Separator between values"),
  whereClause: z.string().optional(),
  limit: z.number().optional().default(100),
});

const TextReplaceSchema = z.object({
  table: z.string().describe("Table name"),
  column: z.string().describe("Column to update"),
  searchPattern: z.string().describe("Text to search for"),
  replaceWith: z.string().describe("Replacement text"),
  whereClause: z.string().describe("WHERE clause"),
});

const TextTrimSchema = z.object({
  table: z.string().describe("Table name"),
  column: z.string().describe("Column to trim"),
  mode: z.enum(["both", "left", "right"]).optional().default("both"),
  whereClause: z.string().optional(),
  limit: z.number().optional().default(100),
});

const TextCaseSchema = z.object({
  table: z.string().describe("Table name"),
  column: z.string().describe("Column to transform"),
  mode: z.enum(["upper", "lower"]).describe("Case transformation"),
  whereClause: z.string().optional(),
  limit: z.number().optional().default(100),
});

const TextSubstringSchema = z.object({
  table: z.string().describe("Table name"),
  column: z.string().describe("Column to extract from"),
  start: z.number().describe("Start position (1-indexed)"),
  length: z.number().optional().describe("Number of characters"),
  whereClause: z.string().optional(),
  limit: z.number().optional().default(100),
});

// New text tool schemas
const FuzzyMatchSchema = z.object({
  table: z.string().describe("Table name"),
  column: z.string().describe("Column to search"),
  search: z.string().describe("Search string"),
  maxDistance: z
    .number()
    .optional()
    .default(3)
    .describe("Maximum Levenshtein distance"),
  limit: z.number().optional().default(10),
});

const PhoneticMatchSchema = z.object({
  table: z.string().describe("Table name"),
  column: z.string().describe("Column to search"),
  search: z.string().describe("Search string"),
  algorithm: z.enum(["soundex", "metaphone"]).optional().default("soundex"),
  limit: z.number().optional().default(100),
});

const TextNormalizeSchema = z.object({
  table: z.string().describe("Table name"),
  column: z.string().describe("Column to normalize"),
  mode: z
    .enum(["nfc", "nfd", "nfkc", "nfkd", "strip_accents"])
    .describe("Normalization mode"),
  whereClause: z.string().optional(),
  limit: z.number().optional().default(100),
});

const TextValidateSchema = z.object({
  table: z.string().describe("Table name"),
  column: z.string().describe("Column to validate"),
  pattern: z
    .enum(["email", "phone", "url", "uuid", "ipv4", "custom"])
    .describe("Validation pattern"),
  customPattern: z
    .string()
    .optional()
    .describe("Custom regex (required if pattern=custom)"),
  whereClause: z.string().optional(),
  limit: z.number().optional().default(100),
});

const AdvancedSearchSchema = z.object({
  table: z.string().describe("Table name"),
  column: z.string().describe("Column to search"),
  searchTerm: z.string().describe("Search term"),
  techniques: z
    .array(z.enum(["exact", "fuzzy", "phonetic"]))
    .optional()
    .default(["exact", "fuzzy", "phonetic"])
    .describe("Search techniques to use"),
  fuzzyThreshold: z
    .number()
    .optional()
    .default(0.6)
    .describe("Fuzzy match threshold (0-1)"),
  whereClause: z.string().optional(),
  limit: z.number().optional().default(100),
});

/**
 * Get all text processing tools
 */
export function getTextTools(adapter: SqliteAdapter): ToolDefinition[] {
  return [
    createRegexExtractTool(adapter),
    createRegexMatchTool(adapter),
    createTextSplitTool(adapter),
    createTextConcatTool(adapter),
    createTextReplaceTool(adapter),
    createTextTrimTool(adapter),
    createTextCaseTool(adapter),
    createTextSubstringTool(adapter),
    createFuzzyMatchTool(adapter),
    createPhoneticMatchTool(adapter),
    createTextNormalizeTool(adapter),
    createTextValidateTool(adapter),
    createAdvancedSearchTool(adapter),
  ];
}

/**
 * Extract text using regex pattern
 * Note: SQLite doesn't have native regex, we do this in JS
 */
function createRegexExtractTool(adapter: SqliteAdapter): ToolDefinition {
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
      const input = RegexExtractSchema.parse(params);

      // Validate and quote identifiers
      const table = sanitizeIdentifier(input.table);
      const column = sanitizeIdentifier(input.column);

      let sql = `SELECT rowid, ${column} as value FROM ${table}`;
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
          const rawRowid = row["rowid"];
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
    },
  };
}

/**
 * Match rows using regex pattern
 */
function createRegexMatchTool(adapter: SqliteAdapter): ToolDefinition {
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
      const input = RegexMatchSchema.parse(params);

      // Validate and quote identifiers
      const table = sanitizeIdentifier(input.table);
      const column = sanitizeIdentifier(input.column);

      let sql = `SELECT rowid, ${column} as value FROM ${table}`;
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
          const rawRowid = row["rowid"];
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
    },
  };
}

/**
 * Split text into array
 */
function createTextSplitTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_text_split",
    description: "Split a text column by delimiter into array results.",
    group: "text",
    inputSchema: TextSplitSchema,
    outputSchema: TextSplitOutputSchema,
    requiredScopes: ["read"],
    annotations: readOnly("Text Split"),
    handler: async (params: unknown, _context: RequestContext) => {
      const input = TextSplitSchema.parse(params);

      // Validate and quote identifiers
      const table = sanitizeIdentifier(input.table);
      const column = sanitizeIdentifier(input.column);

      let sql = `SELECT rowid, ${column} as value FROM ${table}`;
      if (input.whereClause) {
        validateWhereClause(input.whereClause);
        sql += ` WHERE ${input.whereClause}`;
      }
      sql += ` LIMIT ${input.limit}`;

      const result = await adapter.executeReadQuery(sql);

      // Split in JavaScript
      const splits = (result.rows ?? []).map((row) => {
        const rawValue = row["value"];
        const valueStr =
          typeof rawValue === "string"
            ? rawValue
            : JSON.stringify(rawValue ?? "");
        return {
          rowid: row["rowid"],
          original: row["value"],
          parts: valueStr.split(input.delimiter),
        };
      });

      // Output schema expects parts and count for a single split result
      // But this tool returns per-row splits, so we need to align with actual usage
      // Return format matching the actual operation which is row-based splits
      const allParts = splits.flatMap((s) => s.parts);
      return {
        success: true,
        parts: allParts,
        count: allParts.length,
      };
    },
  };
}

/**
 * Concatenate columns
 */
function createTextConcatTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_text_concat",
    description: "Concatenate multiple columns with optional separator.",
    group: "text",
    inputSchema: TextConcatSchema,
    requiredScopes: ["read"],
    annotations: readOnly("Text Concat"),
    handler: async (params: unknown, _context: RequestContext) => {
      const input = TextConcatSchema.parse(params);

      // Validate and quote identifiers
      const table = sanitizeIdentifier(input.table);
      const quotedCols = input.columns.map((c) => sanitizeIdentifier(c));

      // Build concatenation expression
      const sep = input.separator.replace(/'/g, "''");
      const concatExpr = quotedCols
        .map((c) => `COALESCE(${c}, '')`)
        .join(`, '${sep}', `);

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
    },
  };
}

/**
 * Replace text in column
 */
function createTextReplaceTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_text_replace",
    description: "Replace text in a column using SQLite replace() function.",
    group: "text",
    inputSchema: TextReplaceSchema,
    outputSchema: RegexReplaceOutputSchema,
    requiredScopes: ["write"],
    annotations: write("Text Replace"),
    handler: async (params: unknown, _context: RequestContext) => {
      const input = TextReplaceSchema.parse(params);

      // Validate and quote identifiers
      const table = sanitizeIdentifier(input.table);
      const column = sanitizeIdentifier(input.column);

      const search = input.searchPattern.replace(/'/g, "''");
      const replace = input.replaceWith.replace(/'/g, "''");

      validateWhereClause(input.whereClause);
      const sql = `UPDATE ${table} SET ${column} = replace(${column}, '${search}', '${replace}') WHERE ${input.whereClause}`;

      const result = await adapter.executeWriteQuery(sql);

      return {
        success: true,
        rowsAffected: result.rowsAffected,
      };
    },
  };
}

/**
 * Trim whitespace
 */
function createTextTrimTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_text_trim",
    description: "Trim whitespace from text column values.",
    group: "text",
    inputSchema: TextTrimSchema,
    requiredScopes: ["read"],
    annotations: readOnly("Text Trim"),
    handler: async (params: unknown, _context: RequestContext) => {
      const input = TextTrimSchema.parse(params);

      // Validate and quote identifiers
      const table = sanitizeIdentifier(input.table);
      const column = sanitizeIdentifier(input.column);

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
    },
  };
}

/**
 * Change text case
 */
function createTextCaseTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_text_case",
    description: "Convert text to uppercase or lowercase.",
    group: "text",
    inputSchema: TextCaseSchema,
    requiredScopes: ["read"],
    annotations: readOnly("Text Case"),
    handler: async (params: unknown, _context: RequestContext) => {
      const input = TextCaseSchema.parse(params);

      // Validate and quote identifiers
      const table = sanitizeIdentifier(input.table);
      const column = sanitizeIdentifier(input.column);

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
    },
  };
}

/**
 * Extract substring
 */
function createTextSubstringTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_text_substring",
    description: "Extract a substring from text column using substr().",
    group: "text",
    inputSchema: TextSubstringSchema,
    requiredScopes: ["read"],
    annotations: readOnly("Text Substring"),
    handler: async (params: unknown, _context: RequestContext) => {
      const input = TextSubstringSchema.parse(params);

      // Validate and quote identifiers
      const table = sanitizeIdentifier(input.table);
      const column = sanitizeIdentifier(input.column);

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
    },
  };
}

// =============================================================================
// New Text Tools: Fuzzy, Phonetic, Normalize, Validate
// =============================================================================

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshtein(a: string, b: string): number {
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
function metaphone(word: string): string {
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
function stripAccents(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/**
 * Simple Soundex implementation for phonetic matching
 */
function soundex(word: string): string {
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
const VALIDATION_PATTERNS: Record<string, RegExp> = {
  email: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
  phone: /^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]{7,}$/,
  url: /^https?:\/\/[^\s/$.?#].[^\s]*$/i,
  uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  ipv4: /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/,
};

/**
 * Fuzzy match using Levenshtein distance
 */
function createFuzzyMatchTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_fuzzy_match",
    description:
      "Find fuzzy matches using Levenshtein distance. Returns values within max edit distance.",
    group: "text",
    inputSchema: FuzzyMatchSchema,
    outputSchema: z.object({
      success: z.boolean(),
      matchCount: z.number(),
      matches: z.array(
        z.object({
          value: z.string(),
          distance: z.number(),
          row: z.record(z.string(), z.unknown()),
        }),
      ),
    }),
    requiredScopes: ["read"],
    annotations: readOnly("Fuzzy Match"),
    handler: async (params: unknown, _context: RequestContext) => {
      const input = FuzzyMatchSchema.parse(params);

      // Validate and quote identifiers
      const table = sanitizeIdentifier(input.table);
      const column = sanitizeIdentifier(input.column);

      const sql = `SELECT * FROM ${table} WHERE ${column} IS NOT NULL LIMIT 1000`;
      const result = await adapter.executeReadQuery(sql);

      const matches: {
        value: string;
        distance: number;
        row: Record<string, unknown>;
      }[] = [];

      for (const row of result.rows ?? []) {
        const rawValue = row[input.column];
        const value =
          typeof rawValue === "string"
            ? rawValue
            : JSON.stringify(rawValue ?? "");
        const distance = levenshtein(input.search, value);
        if (distance <= input.maxDistance) {
          matches.push({ value, distance, row });
        }
      }

      // Sort by distance (ascending) and limit
      matches.sort((a, b) => a.distance - b.distance);
      const limited = matches.slice(0, input.limit);

      return {
        success: true,
        matchCount: limited.length,
        matches: limited,
      };
    },
  };
}

/**
 * Phonetic match using Soundex or Metaphone
 */
function createPhoneticMatchTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_phonetic_match",
    description:
      "Find phonetically similar values using Soundex (SQLite native) or Metaphone algorithm.",
    group: "text",
    inputSchema: PhoneticMatchSchema,
    outputSchema: z.object({
      success: z.boolean(),
      searchCode: z.string(),
      matchCount: z.number(),
      matches: z.array(
        z.object({
          value: z.string(),
          phoneticCode: z.string(),
          row: z.record(z.string(), z.unknown()),
        }),
      ),
    }),
    requiredScopes: ["read"],
    annotations: readOnly("Phonetic Match"),
    handler: async (params: unknown, _context: RequestContext) => {
      const input = PhoneticMatchSchema.parse(params);

      // Validate and quote identifiers
      const table = sanitizeIdentifier(input.table);
      const column = sanitizeIdentifier(input.column);

      const searchCode =
        input.algorithm === "metaphone" ? metaphone(input.search) : ""; // Soundex done in SQL

      let sql: string;
      if (input.algorithm === "soundex") {
        // Use SQLite's native soundex function
        sql = `SELECT *, soundex(${column}) as _phonetic FROM ${table} WHERE soundex(${column}) = soundex('${input.search.replace(/'/g, "''")}') LIMIT ${input.limit}`;
        const result = await adapter.executeReadQuery(sql);

        const matches = (result.rows ?? []).map((row) => {
          const rawValue = row[input.column];
          const rawPhonetic = row["_phonetic"];
          return {
            value:
              typeof rawValue === "string"
                ? rawValue
                : JSON.stringify(rawValue ?? ""),
            phoneticCode: typeof rawPhonetic === "string" ? rawPhonetic : "",
            row,
          };
        });

        return {
          success: true,
          searchCode: matches[0]?.phoneticCode ?? "",
          matchCount: matches.length,
          matches,
        };
      } else {
        // Metaphone in JS
        sql = `SELECT * FROM ${table} WHERE ${column} IS NOT NULL LIMIT 1000`;
        const result = await adapter.executeReadQuery(sql);

        const matches: {
          value: string;
          phoneticCode: string;
          row: Record<string, unknown>;
        }[] = [];

        for (const row of result.rows ?? []) {
          const rawValue = row[input.column];
          const value =
            typeof rawValue === "string"
              ? rawValue
              : JSON.stringify(rawValue ?? "");
          const code = metaphone(value);
          if (code === searchCode) {
            matches.push({ value, phoneticCode: code, row });
          }
        }

        return {
          success: true,
          searchCode,
          matchCount: matches.length,
          matches: matches.slice(0, input.limit),
        };
      }
    },
  };
}

/**
 * Normalize text (Unicode normalization or accent stripping)
 */
function createTextNormalizeTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_text_normalize",
    description:
      "Normalize text using Unicode normalization (NFC, NFD, NFKC, NFKD) or strip accents.",
    group: "text",
    inputSchema: TextNormalizeSchema,
    outputSchema: z.object({
      success: z.boolean(),
      rowCount: z.number(),
      rows: z.array(
        z.object({
          original: z.string(),
          normalized: z.string(),
        }),
      ),
    }),
    requiredScopes: ["read"],
    annotations: readOnly("Text Normalize"),
    handler: async (params: unknown, _context: RequestContext) => {
      const input = TextNormalizeSchema.parse(params);

      // Validate and quote identifiers
      const table = sanitizeIdentifier(input.table);
      const column = sanitizeIdentifier(input.column);

      let sql = `SELECT ${column} as original FROM ${table}`;
      if (input.whereClause) {
        validateWhereClause(input.whereClause);
        sql += ` WHERE ${input.whereClause}`;
      }
      sql += ` LIMIT ${input.limit}`;

      const result = await adapter.executeReadQuery(sql);

      const rows = (result.rows ?? []).map((row) => {
        const rawOriginal = row["original"];
        const original =
          typeof rawOriginal === "string"
            ? rawOriginal
            : JSON.stringify(rawOriginal ?? "");
        let normalized: string;

        if (input.mode === "strip_accents") {
          normalized = stripAccents(original);
        } else {
          normalized = original.normalize(
            input.mode.toUpperCase() as "NFC" | "NFD" | "NFKC" | "NFKD",
          );
        }

        return { original, normalized };
      });

      return {
        success: true,
        rowCount: rows.length,
        rows,
      };
    },
  };
}

/**
 * Validate text against common patterns
 */
function createTextValidateTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_text_validate",
    description:
      "Validate text values against patterns: email, phone, URL, UUID, IPv4, or custom regex.",
    group: "text",
    inputSchema: TextValidateSchema,
    outputSchema: z.object({
      success: z.boolean(),
      totalRows: z.number(),
      validCount: z.number(),
      invalidCount: z.number(),
      invalidRows: z.array(
        z.object({
          value: z.string(),
          rowid: z.number().optional(),
        }),
      ),
    }),
    requiredScopes: ["read"],
    annotations: readOnly("Text Validate"),
    handler: async (params: unknown, _context: RequestContext) => {
      const input = TextValidateSchema.parse(params);

      // Validate and quote identifiers
      const table = sanitizeIdentifier(input.table);
      const column = sanitizeIdentifier(input.column);

      // Get validation pattern
      let pattern: RegExp;
      if (input.pattern === "custom") {
        if (!input.customPattern) {
          throw new Error("customPattern is required when pattern='custom'");
        }
        pattern = new RegExp(input.customPattern);
      } else {
        const foundPattern = VALIDATION_PATTERNS[input.pattern];
        if (!foundPattern) {
          throw new Error(`Unknown pattern: ${input.pattern}`);
        }
        pattern = foundPattern;
      }

      let sql = `SELECT rowid, ${column} as value FROM ${table}`;
      if (input.whereClause) {
        validateWhereClause(input.whereClause);
        sql += ` WHERE ${input.whereClause}`;
      }
      sql += ` LIMIT ${input.limit}`;

      const result = await adapter.executeReadQuery(sql);

      const invalidRows: { value: string; rowid?: number }[] = [];
      let validCount = 0;

      for (const row of result.rows ?? []) {
        const rawValue = row["value"];
        const value =
          typeof rawValue === "string"
            ? rawValue
            : JSON.stringify(rawValue ?? "");
        if (pattern.test(value)) {
          validCount++;
        } else {
          const rowid = row["rowid"];
          if (typeof rowid === "number") {
            invalidRows.push({ value, rowid });
          } else {
            invalidRows.push({ value });
          }
        }
      }

      return {
        success: true,
        totalRows: result.rows?.length ?? 0,
        validCount,
        invalidCount: invalidRows.length,
        invalidRows,
      };
    },
  };
}

/**
 * Output schema for advanced search
 */
const AdvancedSearchOutputSchema = z.object({
  success: z.boolean(),
  searchTerm: z.string(),
  techniques: z.array(z.string()),
  matchCount: z.number(),
  matches: z.array(
    z.object({
      rowid: z.number(),
      text: z.string(),
      matchTypes: z.array(z.string()),
      bestScore: z.number(),
      bestType: z.string(),
    }),
  ),
});

/**
 * Advanced search combining multiple text processing techniques
 */
function createAdvancedSearchTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_advanced_search",
    description:
      "Advanced search combining exact, fuzzy (Levenshtein), and phonetic (Soundex) matching",
    group: "text",
    inputSchema: AdvancedSearchSchema,
    outputSchema: AdvancedSearchOutputSchema,
    requiredScopes: ["read"],
    annotations: readOnly("Advanced Search"),
    handler: async (params: unknown, _context: RequestContext) => {
      const input = AdvancedSearchSchema.parse(params);

      // Validate and quote identifiers
      const table = sanitizeIdentifier(input.table);
      const column = sanitizeIdentifier(input.column);

      // Fetch candidate rows
      let whereClause = "";
      if (input.whereClause) {
        validateWhereClause(input.whereClause);
        whereClause = ` AND ${input.whereClause}`;
      }
      const query = `SELECT rowid, ${column} AS value FROM ${table} WHERE ${column} IS NOT NULL${whereClause} LIMIT 1000`;
      const result = await adapter.executeQuery(query);

      if (!result.rows || result.rows.length === 0) {
        return {
          success: true,
          searchTerm: input.searchTerm,
          techniques: input.techniques,
          matchCount: 0,
          matches: [],
        };
      }

      const searchLower = input.searchTerm.toLowerCase();
      const searchSoundex = soundex(input.searchTerm);

      interface Match {
        rowid: number;
        text: string;
        matchTypes: string[];
        bestScore: number;
        bestType: string;
      }

      const allMatches: Match[] = [];

      for (const row of result.rows) {
        const rawValue: unknown = row["value"];
        const text =
          typeof rawValue === "string"
            ? rawValue
            : typeof rawValue === "number"
              ? String(rawValue)
              : "";
        const textLower = text.toLowerCase();
        const matches: { type: string; score: number }[] = [];

        // Exact match (case-insensitive substring)
        if (input.techniques.includes("exact")) {
          if (textLower.includes(searchLower)) {
            matches.push({ type: "exact", score: 1.0 });
          }
        }

        // Fuzzy match (Levenshtein ratio)
        if (input.techniques.includes("fuzzy")) {
          const distance = levenshtein(input.searchTerm, text);
          const maxLen = Math.max(input.searchTerm.length, text.length);
          const similarity = maxLen === 0 ? 1 : 1 - distance / maxLen;
          if (similarity >= input.fuzzyThreshold) {
            matches.push({ type: "fuzzy", score: similarity });
          }
        }

        // Phonetic match (Soundex)
        if (input.techniques.includes("phonetic")) {
          const words = text.split(/\s+/);
          for (const word of words) {
            if (soundex(word) === searchSoundex) {
              matches.push({ type: "phonetic", score: 0.8 });
              break;
            }
          }
        }

        if (matches.length > 0) {
          const best = matches.reduce((a, b) => (a.score > b.score ? a : b));
          // Safely coerce rowid to number, defaulting to 0 if undefined/null
          const rawRowid = row["rowid"];
          const rowid =
            typeof rawRowid === "number"
              ? rawRowid
              : typeof rawRowid === "string"
                ? parseInt(rawRowid, 10) || 0
                : 0;
          allMatches.push({
            rowid,
            text: text.length > 100 ? text.slice(0, 100) + "..." : text,
            matchTypes: matches.map((m) => m.type),
            bestScore: Math.round(best.score * 1000) / 1000,
            bestType: best.type,
          });
        }
      }

      // Sort by score and limit
      allMatches.sort((a, b) => b.bestScore - a.bestScore);
      const limited = allMatches.slice(0, input.limit);

      return {
        success: true,
        searchTerm: input.searchTerm,
        techniques: input.techniques,
        matchCount: limited.length,
        matches: limited,
      };
    },
  };
}
