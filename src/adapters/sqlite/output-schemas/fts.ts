/**
 * FTS5 Full-Text Search Tool Output Schemas (4 tools)
 */

import { z } from "zod";
import { ErrorFieldsMixin } from "./error-mixin.js";

/**
 * sqlite_fts_create output
 */
export const FtsCreateOutputSchema = z
  .object({
    success: z.boolean(),
    message: z.string().optional(),
    tableName: z.string().optional(),
    triggersCreated: z.array(z.string()).optional(),
  })
  .extend(ErrorFieldsMixin.shape);

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
export const FtsSearchOutputSchema = z
  .object({
    success: z.boolean(),
    rowCount: z.number().optional(),
    results: z.array(FtsResultSchema).optional(),
  })
  .extend(ErrorFieldsMixin.shape);

/**
 * sqlite_fts_rebuild output
 */
export const FtsRebuildOutputSchema = z
  .object({
    success: z.boolean(),
    message: z.string().optional(),
    tableName: z.string().optional(),
  })
  .extend(ErrorFieldsMixin.shape);
