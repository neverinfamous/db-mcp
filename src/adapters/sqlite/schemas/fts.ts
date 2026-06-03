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
    nextCursor: z.string().optional(),
    facets: z.record(z.string(), z.number()).optional(),
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

/**
 * sqlite_fts_headline output
 */
export const FtsHeadlineOutputSchema = z
  .object({
    success: z.boolean(),
    rowCount: z.number().optional(),
    results: z
      .array(
        z
          .object({
            headline: z.string().optional(),
            snippet: z.string().optional(),
            rank: z.number().nullable().optional(),
          })
          .loose(),
      )
      .optional(),
  })
  .extend(ErrorFieldsMixin.shape);

// =============================================================================
// Input Schemas
// =============================================================================

const coerceEnumValues =
  (allowed: readonly string[]) =>
  (val: unknown): unknown =>
    typeof val === "string" && allowed.includes(val) ? val : undefined;

export const FtsCreateSchema = z.object({
  tableName: z.string().optional().describe("Name of the FTS table to create"),
  ftsTable: z
    .string()
    .optional()
    .describe("Name of the FTS table to create (alias)"),
  sourceTable: z.string().describe("Source table to index"),
  columns: z.array(z.string()).describe("Columns to include in the index"),
  contentTable: z
    .string()
    .optional()
    .describe("Content table for external content FTS"),
  tokenizer: z.preprocess(
    coerceEnumValues(["unicode61", "ascii", "porter"]),
    z.enum(["unicode61", "ascii", "porter"]).optional().default("unicode61"),
  ),
  createTriggers: z
    .boolean()
    .optional()
    .default(true)
    .describe("Create triggers"),
});
export type FtsCreateInput = z.infer<typeof FtsCreateSchema>;

export const FtsSearchSchema = z.object({
  table: z.string().describe("FTS table name"),
  query: z.string().describe("Full-text search query"),
  columns: z
    .array(z.string())
    .optional()
    .describe("Specific columns to search"),
  limit: z.preprocess((val) => {
    if (typeof val === "string") {
      const parsed = Number(val);
      return isNaN(parsed) ? val : parsed;
    }
    return val;
  }, z.number().optional().default(100)),
  highlight: z
    .boolean()
    .optional()
    .default(false)
    .describe("Include highlighted snippets"),
  includeRowData: z
    .boolean()
    .optional()
    .default(true)
    .describe("Include full row data in results"),
  cursor: z.string().optional().describe("Opaque cursor for pagination"),
  includeFacets: z
    .boolean()
    .optional()
    .default(false)
    .describe(
      "Return match counts per column (distribution by matched column)",
    ),
});
export type FtsSearchInput = z.infer<typeof FtsSearchSchema>;

export const FtsRebuildSchema = z.object({
  table: z.string().describe("FTS table name to rebuild"),
});
export type FtsRebuildInput = z.infer<typeof FtsRebuildSchema>;

export const FtsMatchInfoSchema = z.object({
  table: z.string().describe("FTS table name"),
  query: z.string().describe("Full-text search query"),
  format: z.preprocess(
    coerceEnumValues(["bm25", "rank"]),
    z.enum(["bm25", "rank"]).optional().default("bm25"),
  ),
  includeRowData: z
    .boolean()
    .optional()
    .default(true)
    .describe("Include full row data in results"),
});
export type FtsMatchInfoInput = z.infer<typeof FtsMatchInfoSchema>;
