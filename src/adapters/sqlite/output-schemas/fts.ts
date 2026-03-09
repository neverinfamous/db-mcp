/**
 * FTS5 Full-Text Search Tool Output Schemas (4 tools)
 */

import { z } from "zod";

/**
 * sqlite_fts_create output
 */
export const FtsCreateOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  tableName: z.string(),
  triggersCreated: z.array(z.string()).optional(),
});

/**
 * Result item with rank/bm25 for FTS search
 */
const FtsResultSchema = z
  .object({
    rank: z.number().nullable().optional(),
    bm25: z.number().nullable().optional(),
  })
  .loose();

/**
 * sqlite_fts_search output
 */
export const FtsSearchOutputSchema = z.object({
  success: z.boolean(),
  rowCount: z.number(),
  results: z.array(FtsResultSchema),
});

/**
 * sqlite_fts_rebuild output
 */
export const FtsRebuildOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  tableName: z.string(),
});

/**
 * sqlite_fts_optimize output
 */
export const FtsOptimizeOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  tableName: z.string(),
});
