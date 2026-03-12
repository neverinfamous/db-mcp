/**
 * Virtual Table Tool Output Schemas (4 tools)
 */

import { z } from "zod";
import { RowRecordSchema } from "./common.js";
import { ErrorFieldsMixin } from "./error-mixin.js";

/**
 * View entry for list_views
 */
const ViewEntrySchema = z.object({
  name: z.string(),
  sql: z.string().nullable(),
});

/**
 * sqlite_list_views output
 */
export const ListViewsOutputSchema = z
  .object({
    success: z.boolean(),
    count: z.number(),
    views: z.array(ViewEntrySchema),
  })
  .extend(ErrorFieldsMixin.shape);

/**
 * sqlite_generate_series output
 */
export const GenerateSeriesOutputSchema = z
  .object({
    success: z.boolean(),
    count: z.number(),
    values: z.array(z.number()),
  })
  .extend(ErrorFieldsMixin.shape);

/**
 * sqlite_generate_dates output
 */
export const GenerateDatesOutputSchema = z
  .object({
    success: z.boolean(),
    count: z.number(),
    dates: z.array(z.string()),
  })
  .extend(ErrorFieldsMixin.shape);

/**
 * sqlite_cte_recursive output
 */
export const CteRecursiveOutputSchema = z
  .object({
    success: z.boolean(),
    rowCount: z.number(),
    rows: z.array(RowRecordSchema),
  })
  .extend(ErrorFieldsMixin.shape);

/**
 * sqlite_pivot_table output
 */
export const PivotTableOutputSchema = z
  .object({
    success: z.boolean(),
    rowCount: z.number(),
    columns: z.array(z.string()),
    rows: z.array(RowRecordSchema),
  })
  .extend(ErrorFieldsMixin.shape);
