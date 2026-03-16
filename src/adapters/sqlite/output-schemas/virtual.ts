/**
 * Virtual Table Tool Output Schemas (9 tools)
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

/**
 * sqlite_list_virtual_tables output
 */
export const ListVirtualTablesOutputSchema = z
  .object({
    success: z.boolean(),
    count: z.number(),
    virtualTables: z.array(
      z.object({
        name: z.string(),
        module: z.string(),
        sql: z.string(),
      }),
    ),
  })
  .extend(ErrorFieldsMixin.shape);

/**
 * sqlite_virtual_table_info output
 */
export const VirtualTableInfoOutputSchema = z
  .object({
    success: z.boolean(),
    name: z.string(),
    module: z.string(),
    moduleAvailable: z.boolean().optional(),
    columns: z
      .array(
        z.object({
          name: z.string(),
          type: z.string(),
        }),
      )
      .optional(),
    sql: z.string(),
    note: z.string().optional(),
  })
  .extend(ErrorFieldsMixin.shape);

/**
 * sqlite_drop_virtual_table output
 */
export const DropVirtualTableOutputSchema = z
  .object({
    success: z.boolean(),
    message: z.string(),
  })
  .extend(ErrorFieldsMixin.shape);

/**
 * sqlite_create_csv_table output
 */
export const CreateCsvTableOutputSchema = z
  .object({
    success: z.boolean(),
    message: z.string(),
    sql: z.string(),
    columns: z.array(z.string()),
  })
  .extend(ErrorFieldsMixin.shape);

/**
 * sqlite_analyze_csv_schema output
 */
export const AnalyzeCsvSchemaOutputSchema = z
  .object({
    success: z.boolean(),
    message: z.string().optional(),
    hasHeader: z.boolean(),
    rowCount: z.number(),
    columns: z.array(
      z.object({
        name: z.string(),
        inferredType: z.string(),
        nullCount: z.number(),
        sampleValues: z.array(z.string()),
      }),
    ),
    wasmLimitation: z.boolean().optional(),
  })
  .extend(ErrorFieldsMixin.shape);

/**
 * sqlite_create_rtree_table output
 */
export const CreateRtreeTableOutputSchema = z
  .object({
    success: z.boolean(),
    message: z.string(),
    sql: z.string(),
    columns: z.array(z.string()),
  })
  .extend(ErrorFieldsMixin.shape);

/**
 * sqlite_create_series_table output
 */
export const CreateSeriesTableOutputSchema = z
  .object({
    success: z.boolean(),
    message: z.string(),
    rowCount: z.number(),
  })
  .extend(ErrorFieldsMixin.shape);
