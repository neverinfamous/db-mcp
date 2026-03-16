/**
 * Virtual Table Tool Output Schemas (2 tools)
 */

import { z } from "zod";
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
