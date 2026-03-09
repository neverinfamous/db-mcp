/**
 * Text Processing Tool Output Schemas (8 tools)
 */

import { z } from "zod";
import { RowRecordSchema } from "./common.js";

/**
 * sqlite_regex_match output
 */
export const RegexMatchOutputSchema = z.object({
  success: z.boolean(),
  rowCount: z.number(),
  matches: z.array(RowRecordSchema),
});

/**
 * sqlite_regex_replace output
 */
export const RegexReplaceOutputSchema = z.object({
  success: z.boolean(),
  rowsAffected: z.number(),
});

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
export const FuzzySearchOutputSchema = z.object({
  success: z.boolean(),
  rowCount: z.number(),
  results: z.array(FuzzyResultSchema),
});

/**
 * sqlite_soundex output
 */
export const SoundexOutputSchema = z.object({
  success: z.boolean(),
  rowCount: z.number(),
  results: z.array(RowRecordSchema),
});

/**
 * sqlite_levenshtein output
 */
export const LevenshteinOutputSchema = z.object({
  success: z.boolean(),
  distance: z.number(),
  string1: z.string(),
  string2: z.string(),
});

/**
 * sqlite_trigram_similarity output
 */
export const TrigramSimilarityOutputSchema = z.object({
  success: z.boolean(),
  similarity: z.number(),
  string1: z.string(),
  string2: z.string(),
});

/**
 * sqlite_text_normalize output
 */
export const TextNormalizeOutputSchema = z.object({
  success: z.boolean(),
  original: z.string(),
  normalized: z.string(),
  operations: z.array(z.string()).optional(),
});

/**
 * sqlite_text_split output
 * Returns per-row results with original value and split parts for traceability
 */
export const TextSplitOutputSchema = z.object({
  success: z.boolean(),
  rowCount: z.number(),
  rows: z.array(
    z.object({
      rowid: z.number(),
      original: z.string().nullable(),
      parts: z.array(z.string()),
    }),
  ),
});
