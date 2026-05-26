import { WhereConditionSchema } from "./where.js";
/**
 * Text Processing Tool Output Schemas (14 tools)
 */

import { z } from "zod";

const coerceNumber = (val: unknown): unknown => {
  if (typeof val === "string") {
    const parsed = Number(val);
    return isNaN(parsed) ? val : parsed;
  }
  return val;
};
import { RowRecordSchema } from "./common.js";
import { ErrorFieldsMixin } from "./error-mixin.js";

/**
 * sqlite_regex_match output
 */
export const RegexMatchOutputSchema = z
  .object({
    success: z.boolean(),
    rowCount: z.number().optional(),
    matches: z.array(RowRecordSchema).optional(),
  })
  .extend(ErrorFieldsMixin.shape);

/**
 * sqlite_regex_replace output
 */
export const RegexReplaceOutputSchema = z
  .object({
    success: z.boolean(),
    rowsAffected: z.number().optional(),
  })
  .extend(ErrorFieldsMixin.shape);

/**
 * Fuzzy match result item
 */
const FuzzyMatchResultSchema = z.object({
  value: z.string(),
  matchedToken: z.string().optional(),
  tokenDistance: z.number().optional(),
  distance: z.number(),
});

/**
 * sqlite_fuzzy_match output
 */
export const FuzzySearchOutputSchema = z
  .object({
    success: z.boolean(),
    matchCount: z.number().optional(),
    tokenized: z.boolean().optional(),
    matches: z.array(FuzzyMatchResultSchema).optional(),
  })
  .extend(ErrorFieldsMixin.shape);

/**
 * Phonetic match result item
 */
const PhoneticMatchResultSchema = z.object({
  value: z.string(),
  phoneticCode: z.string(),
  row: z.record(z.string(), z.unknown()).optional(),
});

/**
 * sqlite_phonetic_match output
 */
export const SoundexOutputSchema = z
  .object({
    success: z.boolean(),
    searchCode: z.string().optional(),
    matchCount: z.number().optional(),
    matches: z.array(PhoneticMatchResultSchema).optional(),
  })
  .extend(ErrorFieldsMixin.shape);

/**
 * sqlite_text_normalize output
 */
export const TextNormalizeOutputSchema = z
  .object({
    success: z.boolean(),
    rowCount: z.number().optional(),
    rows: z
      .array(
        z.object({
          rowid: z.number(),
          normalized: z.string(),
        }),
      )
      .optional(),
  })
  .extend(ErrorFieldsMixin.shape);

/**
 * sqlite_text_split output
 * Returns per-row results with original value and split parts for traceability
 */
export const TextSplitOutputSchema = z
  .object({
    success: z.boolean(),
    rowCount: z.number().optional(),
    rows: z
      .array(
        z.object({
          rowid: z.number(),
          parts: z.array(z.string()),
        }),
      )
      .optional(),
  })
  .extend(ErrorFieldsMixin.shape);

/**
 * sqlite_text_validate output
 */
export const TextValidateOutputSchema = z
  .object({
    success: z.boolean(),
    totalRows: z.number().optional(),
    validCount: z.number().optional(),
    invalidCount: z.number().optional(),
    invalidRows: z
      .array(
        z.object({
          value: z.string().nullable(),
          rowid: z.number().optional(),
        }),
      )
      .optional(),
    truncated: z.boolean().optional(),
  })
  .extend(ErrorFieldsMixin.shape);

/**
 * sqlite_text_concat output
 */
export const TextConcatOutputSchema = z
  .object({
    success: z.boolean(),
    rowCount: z.number().optional(),
    values: z.array(z.unknown()).optional(),
  })
  .extend(ErrorFieldsMixin.shape);

/**
 * sqlite_text_trim output
 */
export const TextTrimOutputSchema = z
  .object({
    success: z.boolean(),
    rowCount: z.number().optional(),
    results: z.array(RowRecordSchema).optional(),
  })
  .extend(ErrorFieldsMixin.shape);

/**
 * sqlite_text_case output
 */
export const TextCaseOutputSchema = z
  .object({
    success: z.boolean(),
    rowCount: z.number().optional(),
    results: z.array(RowRecordSchema).optional(),
  })
  .extend(ErrorFieldsMixin.shape);

/**
 * sqlite_text_substring output
 */
export const TextSubstringOutputSchema = z
  .object({
    success: z.boolean(),
    rowCount: z.number().optional(),
    results: z.array(RowRecordSchema).optional(),
  })
  .extend(ErrorFieldsMixin.shape);

/**
 * sqlite_advanced_search output
 */
export const AdvancedSearchOutputSchema = z
  .object({
    success: z.boolean(),
    searchTerm: z.string().optional(),
    techniques: z.array(z.string()).optional(),
    matchCount: z.number().optional(),
    matches: z
      .array(
        z.object({
          rowid: z.number(),
          text: z.string(),
          matchTypes: z.array(z.string()),
          bestScore: z.number(),
          bestType: z.string(),
        }),
      )
      .optional(),
  })
  .extend(ErrorFieldsMixin.shape);

const SentimentResultItemSchema = z.object({
  rowid: z.number().optional(),
  sentiment: z.string(),
  score: z.number(),
  confidence: z.string(),
  positiveCount: z.number(),
  negativeCount: z.number(),
  matchedPositive: z.array(z.string()).optional(),
  matchedNegative: z.array(z.string()).optional(),
});

export const TextSentimentOutputSchema = z
  .object({
    success: z.boolean(),

    sentiment: z.string().optional(),
    score: z.number().optional(),
    confidence: z.string().optional(),
    positiveCount: z.number().optional(),
    negativeCount: z.number().optional(),
    matchedPositive: z.array(z.string()).optional(),
    matchedNegative: z.array(z.string()).optional(),

    rowCount: z.number().optional(),
    results: z.array(SentimentResultItemSchema).optional(),
  })
  .extend(ErrorFieldsMixin.shape);

// =============================================================================
// Input Schemas
// =============================================================================

export const RegexExtractSchema = z.object({
  table: z.string().describe("Table name"),
  column: z.string().describe("Column to extract from"),
  pattern: z.string().max(200).describe("Regular expression pattern"),
  groupIndex: z.preprocess(
    coerceNumber,
    z.number().optional().default(0).describe("Capture group index"),
  ),
  conditions: z.array(WhereConditionSchema).optional().describe("Optional WHERE conditions"),
  whereClause: z.string().optional().describe("Deprecated: Use conditions instead"),
  limit: z.preprocess(coerceNumber, z.number().max(1000).optional().default(100)),
});

export const RegexMatchSchema = z.object({
  table: z.string().describe("Table name"),
  column: z.string().describe("Column to match"),
  pattern: z.string().max(200).describe("Regular expression pattern"),
  conditions: z.array(WhereConditionSchema).optional().describe("Optional WHERE conditions"),
  whereClause: z.string().optional().describe("Deprecated: Use conditions instead"),
  limit: z.preprocess(coerceNumber, z.number().max(1000).optional().default(100)),
});

export const TextSplitSchema = z.object({
  table: z.string().describe("Table name"),
  column: z.string().describe("Column to split"),
  delimiter: z.string().describe("Delimiter string"),
  conditions: z.array(WhereConditionSchema).optional().describe("Optional WHERE conditions"),
  whereClause: z.string().optional().describe("Deprecated: Use conditions instead"),
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
  conditions: z.array(WhereConditionSchema).optional().describe("Optional WHERE conditions"),
  whereClause: z.string().optional().describe("Deprecated: Use conditions instead"),
  limit: z.preprocess(coerceNumber, z.number().optional().default(100)),
});

export const TextReplaceSchema = z.object({
  table: z.string().describe("Table name"),
  column: z.string().describe("Column to update"),
  searchPattern: z.string().describe("Text to search for"),
  replaceWith: z.string().describe("Replacement text"),
  conditions: z.array(WhereConditionSchema).optional().describe("Optional WHERE conditions"),
  whereClause: z.string().optional().describe("Deprecated: Use conditions instead"),
});

export const TextTrimSchema = z.object({
  table: z.string().describe("Table name"),
  column: z.string().describe("Column to trim"),
  mode: z
    .string()
    .optional()
    .default("both")
    .describe("Trim mode: 'both', 'left', or 'right'"),
  conditions: z.array(WhereConditionSchema).optional().describe("Optional WHERE conditions"),
  whereClause: z.string().optional().describe("Deprecated: Use conditions instead"),
  limit: z.preprocess(coerceNumber, z.number().optional().default(100)),
});

export const TextCaseSchema = z.object({
  table: z.string().describe("Table name"),
  column: z.string().describe("Column to transform"),
  mode: z.string().describe("Case transformation: 'upper' or 'lower'"),
  conditions: z.array(WhereConditionSchema).optional().describe("Optional WHERE conditions"),
  whereClause: z.string().optional().describe("Deprecated: Use conditions instead"),
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
  conditions: z.array(WhereConditionSchema).optional().describe("Optional WHERE conditions"),
  whereClause: z.string().optional().describe("Deprecated: Use conditions instead"),
  limit: z.preprocess(coerceNumber, z.number().optional().default(100)),
});

export const FuzzyMatchSchema = z.object({
  table: z.string().describe("Table name"),
  column: z.string().describe("Column to search"),
  search: z.string().describe("Search string"),
  maxDistance: z.preprocess(
    coerceNumber,
    z.number().optional().default(3).describe("Maximum Levenshtein distance"),
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
  algorithm: z
    .string()
    .optional()
    .default("soundex")
    .describe("Phonetic algorithm: 'soundex' or 'metaphone'"),
  limit: z.preprocess(coerceNumber, z.number().optional().default(100)),
  includeRowData: z
    .boolean()
    .optional()
    .default(false)
    .describe("Include full row data in results (default: false)"),
});

export const TextNormalizeSchema = z.object({
  table: z.string().describe("Table name"),
  column: z.string().describe("Column to normalize"),
  mode: z
    .string()
    .describe(
      "Normalization mode: 'nfc', 'nfd', 'nfkc', 'nfkd', or 'strip_accents'",
    ),
  conditions: z.array(WhereConditionSchema).optional().describe("Optional WHERE conditions"),
  whereClause: z.string().optional().describe("Deprecated: Use conditions instead"),
  limit: z.preprocess(coerceNumber, z.number().optional().default(100)),
});

export const TextValidateSchema = z.object({
  table: z.string().describe("Table name"),
  column: z.string().describe("Column to validate"),
  pattern: z
    .string()
    .describe(
      "Validation pattern: 'email', 'phone', 'url', 'uuid', 'ipv4', or 'custom'",
    ),
  customPattern: z
    .string()
    .max(200)
    .optional()
    .describe("Custom regex (required if pattern=custom)"),
  conditions: z.array(WhereConditionSchema).optional().describe("Optional WHERE conditions"),
  whereClause: z.string().optional().describe("Deprecated: Use conditions instead"),
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
    .array(z.string())
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
  conditions: z.array(WhereConditionSchema).optional().describe("Optional WHERE conditions"),
  whereClause: z.string().optional().describe("Deprecated: Use conditions instead"),
  limit: z.preprocess(coerceNumber, z.number().optional().default(100)),
});

export const TextSentimentSchema = z.object({
  table: z.string().optional().describe("Table name"),
  column: z.string().optional().describe("Column to analyze"),
  text: z.string().optional().describe("Text to analyze"),
  returnWords: z
    .boolean()
    .optional()
    .default(false)
    .describe("Return matched positive/negative words"),
  conditions: z.array(WhereConditionSchema).optional().describe("Optional WHERE conditions"),
  whereClause: z.string().optional().describe("Deprecated: Use conditions instead"),
  limit: z.preprocess(coerceNumber, z.number().optional().default(100)),
});

export const FtsHeadlineSchema = z.object({
  table: z.string().describe("FTS5 table name"),
  query: z.string().describe("Full-text search query"),
  column: z
    .string()
    .optional()
    .describe("Specific FTS column to highlight (default: column 0)"),
  startSel: z
    .string()
    .optional()
    .default("<b>")
    .describe("Start highlight marker"),
  stopSel: z
    .string()
    .optional()
    .default("</b>")
    .describe("Stop highlight marker"),
  snippetWords: z.preprocess(
    coerceNumber,
    z
      .number()
      .optional()
      .default(10)
      .describe("Number of context words around match for snippet()"),
  ),
  limit: z.preprocess(coerceNumber, z.number().optional().default(100)),
});

// =============================================================================
// Types
// =============================================================================

export type RegexExtractInput = z.infer<typeof RegexExtractSchema>;
export type RegexMatchInput = z.infer<typeof RegexMatchSchema>;
export type TextSplitInput = z.infer<typeof TextSplitSchema>;
export type TextConcatInput = z.infer<typeof TextConcatSchema>;
export type TextReplaceInput = z.infer<typeof TextReplaceSchema>;
export type TextTrimInput = z.infer<typeof TextTrimSchema>;
export type TextCaseInput = z.infer<typeof TextCaseSchema>;
export type TextSubstringInput = z.infer<typeof TextSubstringSchema>;
export type FuzzyMatchInput = z.infer<typeof FuzzyMatchSchema>;
export type PhoneticMatchInput = z.infer<typeof PhoneticMatchSchema>;
export type TextNormalizeInput = z.infer<typeof TextNormalizeSchema>;
export type TextValidateInput = z.infer<typeof TextValidateSchema>;
export type AdvancedSearchInput = z.infer<typeof AdvancedSearchSchema>;
export type TextSentimentInput = z.infer<typeof TextSentimentSchema>;
export type FtsHeadlineInput = z.infer<typeof FtsHeadlineSchema>;

