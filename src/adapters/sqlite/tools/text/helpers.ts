/**
 * Text Tool Helpers
 *
 * Shared schemas and validation functions for text tools.
 */

import { z } from "zod";


/**
 * Valid enum values for handler-side validation.
 * These are validated inside the handler's try/catch to produce structured
 * errors instead of raw MCP -32602 frames from Zod enum rejection.
 */
export const VALID_TEXT_CASE_MODES = ["upper", "lower"] as const;
export const VALID_NORMALIZE_MODES = ["nfc", "nfd", "nfkc", "nfkd", "strip_accents"] as const;
export const VALID_VALIDATE_PATTERNS = ["email", "phone", "url", "uuid", "ipv4", "custom"] as const;
export const VALID_PHONETIC_ALGORITHMS = ["soundex", "metaphone"] as const;

// Re-export validateColumnExists/validateColumnsExist from shared utility
export {
  validateColumnExists,
  validateColumnsExist,
} from "../column-validation.js";

/**
 * Coerce string-typed numbers to actual numbers.
 * Returns undefined for non-numeric strings so the schema default kicks in.
 */
const coerceNumber = (val: unknown): unknown =>
  typeof val === "string"
    ? isNaN(Number(val))
      ? undefined
      : Number(val)
    : val;

/**
 * Coerce empty strings to undefined so z.enum().optional().default() works.
 * Prevents raw MCP -32602 when explicit "" bypasses the default path.
 */
const coerceEnum = (val: unknown): unknown =>
  typeof val === "string" && val.trim() === "" ? undefined : val;

// Text tool schemas
export const RegexExtractSchema = z.object({
  table: z.string().describe("Table name"),
  column: z.string().describe("Column to extract from"),
  pattern: z.string().describe("Regular expression pattern"),
  groupIndex: z.preprocess(
    coerceNumber,
    z.number().optional().default(0).describe("Capture group index"),
  ),
  whereClause: z.string().optional(),
  limit: z.preprocess(coerceNumber, z.number().optional().default(100)),
});

export const RegexMatchSchema = z.object({
  table: z.string().describe("Table name"),
  column: z.string().describe("Column to match"),
  pattern: z.string().describe("Regular expression pattern"),
  whereClause: z.string().optional(),
  limit: z.preprocess(coerceNumber, z.number().optional().default(100)),
});

export const TextSplitSchema = z.object({
  table: z.string().describe("Table name"),
  column: z.string().describe("Column to split"),
  delimiter: z.string().describe("Delimiter string"),
  whereClause: z.string().optional(),
  limit: z.preprocess(coerceNumber, z.number().optional().default(100)),
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
  limit: z.preprocess(coerceNumber, z.number().optional().default(100)),
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
  mode: z.preprocess(coerceEnum, z.enum(["both", "left", "right"]).optional().default("both")),
  whereClause: z.string().optional(),
  limit: z.preprocess(coerceNumber, z.number().optional().default(100)),
});

export const TextCaseSchema = z.object({
  table: z.string().describe("Table name"),
  column: z.string().describe("Column to transform"),
  mode: z.string().describe("Case transformation: 'upper' or 'lower'"),
  whereClause: z.string().optional(),
  limit: z.preprocess(coerceNumber, z.number().optional().default(100)),
});

export const TextSubstringSchema = z.object({
  table: z.string().describe("Table name"),
  column: z.string().describe("Column to extract from"),
  start: z.preprocess(
    coerceNumber,
    z.number().optional().describe("Start position (1-indexed)"),
  ),
  length: z.preprocess(
    coerceNumber,
    z.number().optional().describe("Number of characters"),
  ),
  whereClause: z.string().optional(),
  limit: z.preprocess(coerceNumber, z.number().optional().default(100)),
});

// New text tool schemas
export const FuzzyMatchSchema = z.object({
  table: z.string().describe("Table name"),
  column: z.string().describe("Column to search"),
  search: z.string().describe("Search string"),
  maxDistance: z.preprocess(
    coerceNumber,
    z
      .number()
      .optional()
      .default(3)
      .describe("Maximum Levenshtein distance"),
  ),
  tokenize: z
    .boolean()
    .optional()
    .default(true)
    .describe(
      "Split column values into words and match against tokens (default: true). Set false to match entire column value.",
    ),
  limit: z.preprocess(coerceNumber, z.number().optional().default(10)),
});

export const PhoneticMatchSchema = z.object({
  table: z.string().describe("Table name"),
  column: z.string().describe("Column to search"),
  search: z.string().describe("Search string"),
  algorithm: z.preprocess(
    (val) => (typeof val === "string" && val.trim() === "" ? undefined : val),
    z.enum(["soundex", "metaphone"]).optional().default("soundex"),
  ),
  limit: z.preprocess(coerceNumber, z.number().optional().default(100)),
  includeRowData: z
    .boolean()
    .optional()
    .default(true)
    .describe("Include full row data in results (default: true)"),
});

export const TextNormalizeSchema = z.object({
  table: z.string().describe("Table name"),
  column: z.string().describe("Column to normalize"),
  mode: z.string().describe("Normalization mode: 'nfc', 'nfd', 'nfkc', 'nfkd', or 'strip_accents'"),
  whereClause: z.string().optional(),
  limit: z.preprocess(coerceNumber, z.number().optional().default(100)),
});

export const TextValidateSchema = z.object({
  table: z.string().describe("Table name"),
  column: z.string().describe("Column to validate"),
  pattern: z
    .string()
    .describe("Validation pattern: 'email', 'phone', 'url', 'uuid', 'ipv4', or 'custom'"),
  customPattern: z
    .string()
    .optional()
    .describe("Custom regex (required if pattern=custom)"),
  whereClause: z.string().optional(),
  limit: z.preprocess(coerceNumber, z.number().optional().default(100)),
  maxInvalid: z.preprocess(
    coerceNumber,
    z
      .number()
      .optional()
      .default(20)
      .describe(
        "Maximum number of invalid rows to return (default 20). Reduces payload size.",
      ),
  ),
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
  fuzzyThreshold: z.preprocess(
    coerceNumber,
    z
      .number()
      .optional()
      .default(0.6)
      .describe(
        "Fuzzy match similarity threshold (0-1). Lower values are more lenient: 0.3-0.4 for loose matching (e.g., 'laptob' matches 'laptop'), 0.6-0.8 for strict matching.",
      ),
  ),
  whereClause: z.string().optional(),
  limit: z.preprocess(coerceNumber, z.number().optional().default(100)),
});