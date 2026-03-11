/**
 * Text Tool Helpers
 *
 * Shared schemas and validation functions for text tools.
 */

import { z } from "zod";
import type { SqliteAdapter } from "../../sqlite-adapter.js";
import { ResourceNotFoundError } from "../../../../utils/errors.js";

// Text tool schemas
export const RegexExtractSchema = z.object({
  table: z.string().describe("Table name"),
  column: z.string().describe("Column to extract from"),
  pattern: z.string().describe("Regular expression pattern"),
  groupIndex: z.number().optional().default(0).describe("Capture group index"),
  whereClause: z.string().optional(),
  limit: z.number().optional().default(100),
});

export const RegexMatchSchema = z.object({
  table: z.string().describe("Table name"),
  column: z.string().describe("Column to match"),
  pattern: z.string().describe("Regular expression pattern"),
  whereClause: z.string().optional(),
  limit: z.number().optional().default(100),
});

export const TextSplitSchema = z.object({
  table: z.string().describe("Table name"),
  column: z.string().describe("Column to split"),
  delimiter: z.string().describe("Delimiter string"),
  whereClause: z.string().optional(),
  limit: z.number().optional().default(100),
});

export const TextConcatSchema = z.object({
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

export const TextReplaceSchema = z.object({
  table: z.string().describe("Table name"),
  column: z.string().describe("Column to update"),
  searchPattern: z.string().describe("Text to search for"),
  replaceWith: z.string().describe("Replacement text"),
  whereClause: z.string().describe("WHERE clause"),
});

export const TextTrimSchema = z.object({
  table: z.string().describe("Table name"),
  column: z.string().describe("Column to trim"),
  mode: z.enum(["both", "left", "right"]).optional().default("both"),
  whereClause: z.string().optional(),
  limit: z.number().optional().default(100),
});

export const TextCaseSchema = z.object({
  table: z.string().describe("Table name"),
  column: z.string().describe("Column to transform"),
  mode: z.enum(["upper", "lower"]).describe("Case transformation"),
  whereClause: z.string().optional(),
  limit: z.number().optional().default(100),
});

export const TextSubstringSchema = z.object({
  table: z.string().describe("Table name"),
  column: z.string().describe("Column to extract from"),
  start: z.number().describe("Start position (1-indexed)"),
  length: z.number().optional().describe("Number of characters"),
  whereClause: z.string().optional(),
  limit: z.number().optional().default(100),
});

// New text tool schemas
export const FuzzyMatchSchema = z.object({
  table: z.string().describe("Table name"),
  column: z.string().describe("Column to search"),
  search: z.string().describe("Search string"),
  maxDistance: z
    .number()
    .optional()
    .default(3)
    .describe("Maximum Levenshtein distance"),
  tokenize: z
    .boolean()
    .optional()
    .default(true)
    .describe(
      "Split column values into words and match against tokens (default: true). Set false to match entire column value.",
    ),
  limit: z.number().optional().default(10),
});

export const PhoneticMatchSchema = z.object({
  table: z.string().describe("Table name"),
  column: z.string().describe("Column to search"),
  search: z.string().describe("Search string"),
  algorithm: z.enum(["soundex", "metaphone"]).optional().default("soundex"),
  limit: z.number().optional().default(100),
  includeRowData: z
    .boolean()
    .optional()
    .default(true)
    .describe("Include full row data in results (default: true)"),
});

export const TextNormalizeSchema = z.object({
  table: z.string().describe("Table name"),
  column: z.string().describe("Column to normalize"),
  mode: z
    .enum(["nfc", "nfd", "nfkc", "nfkd", "strip_accents"])
    .describe("Normalization mode"),
  whereClause: z.string().optional(),
  limit: z.number().optional().default(100),
});

export const TextValidateSchema = z.object({
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

export const AdvancedSearchSchema = z.object({
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
    .describe(
      "Fuzzy match similarity threshold (0-1). Lower values are more lenient: 0.3-0.4 for loose matching (e.g., 'laptob' matches 'laptop'), 0.6-0.8 for strict matching.",
    ),
  whereClause: z.string().optional(),
  limit: z.number().optional().default(100),
});

/**
 * Validate that a column exists in a table.
 * Prevents silent success when SQLite treats quoted nonexistent identifiers as string literals.
 */
export async function validateColumnExists(
  adapter: SqliteAdapter,
  tableName: string,
  columnName: string,
): Promise<void> {
  // First check if the table exists
  const tableCheck = await adapter.executeReadQuery(
    `SELECT 1 FROM sqlite_master WHERE type IN ('table', 'view') AND name='${tableName.replace(/'/g, "''")}'`,
  );
  if (!tableCheck.rows || tableCheck.rows.length === 0) {
    throw new ResourceNotFoundError(
      `Table '${tableName}' does not exist`,
      "TABLE_NOT_FOUND",
      {
        suggestion:
          "Table not found. Run sqlite_list_tables to see available tables.",
        resourceType: "table",
        resourceName: tableName,
      },
    );
  }

  // Then check if the column exists
  const result = await adapter.executeReadQuery(
    `SELECT name FROM pragma_table_info('${tableName.replace(/'/g, "''")}') WHERE name = '${columnName.replace(/'/g, "''")}' LIMIT 1`,
  );
  if (!result.rows || result.rows.length === 0) {
    throw new ResourceNotFoundError(
      `Column '${columnName}' not found in table '${tableName}'`,
      "COLUMN_NOT_FOUND",
      {
        suggestion:
          "Column not found. Use sqlite_describe_table to see available columns.",
        resourceType: "column",
        resourceName: columnName,
      },
    );
  }
}

/**
 * Validate that multiple columns exist in a table.
 */
export async function validateColumnsExist(
  adapter: SqliteAdapter,
  tableName: string,
  columnNames: string[],
): Promise<void> {
  for (const col of columnNames) {
    await validateColumnExists(adapter, tableName, col);
  }
}