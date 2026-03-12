/**
 * Text Processing Tool Output Schemas (8 tools)
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
    rowCount: z.number(),
    matches: z.array(RowRecordSchema),
  })
  .extend(ErrorFieldsMixin.shape);

/**
 * sqlite_regex_replace output
 */
export const RegexReplaceOutputSchema = z
  .object({
    success: z.boolean(),
    rowsAffected: z.number(),
  })
  .extend(ErrorFieldsMixin.shape);

/**
 * Result item with similarity score for fuzzy search
 */
const FuzzyResultSchema = z
  .object({
    similarity_score: z.number().optional(),
  })
  .loose();

/**
 * sqlite_fuzzy_search output
 */
export const FuzzySearchOutputSchema = z
  .object({
    success: z.boolean(),
    rowCount: z.number(),
    results: z.array(FuzzyResultSchema),
  })
  .extend(ErrorFieldsMixin.shape);

/**
 * sqlite_soundex output
 */
export const SoundexOutputSchema = z
  .object({
    success: z.boolean(),
    rowCount: z.number(),
    results: z.array(RowRecordSchema),
  })
  .extend(ErrorFieldsMixin.shape);

/**
 * sqlite_levenshtein output
 */
export const LevenshteinOutputSchema = z
  .object({
    success: z.boolean(),
    distance: z.number(),
    string1: z.string(),
    string2: z.string(),
  })
  .extend(ErrorFieldsMixin.shape);

/**
 * sqlite_trigram_similarity output
 */
export const TrigramSimilarityOutputSchema = z
  .object({
    success: z.boolean(),
    similarity: z.number(),
    string1: z.string(),
    string2: z.string(),
  })
  .extend(ErrorFieldsMixin.shape);

/**
 * sqlite_text_normalize output
 */
export const TextNormalizeOutputSchema = z
  .object({
    success: z.boolean(),
    original: z.string(),
    normalized: z.string(),
    operations: z.array(z.string()).optional(),
  })
  .extend(ErrorFieldsMixin.shape);

/**
 * sqlite_text_split output
 * Returns per-row results with original value and split parts for traceability
 */
export const TextSplitOutputSchema = z
  .object({
    success: z.boolean(),
    rowCount: z.number(),
    rows: z.array(
      z.object({
        rowid: z.number(),
        original: z.string().nullable(),
        parts: z.array(z.string()),
      }),
    ),
  })
  .extend(ErrorFieldsMixin.shape);
