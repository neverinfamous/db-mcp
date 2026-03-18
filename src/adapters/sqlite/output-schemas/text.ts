/**
 * Text Processing Tool Output Schemas (14 tools)
 */

import { z } from "zod";
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
          original: z.string(),
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
          original: z.string().nullable(),
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
