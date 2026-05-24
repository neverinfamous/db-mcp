/**
 * Virtual Table Tool Output Schemas (9 tools)
 */

import { z } from "zod";

const coerceNumber = (val: unknown): unknown =>
  typeof val === "string"
    ? Number.isNaN(Number(val))
      ? undefined
      : Number(val)
    : val;
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
    count: z.number().optional(),
    views: z.array(ViewEntrySchema).optional(),
  })
  .extend(ErrorFieldsMixin.shape);

/**
 * sqlite_generate_series output
 */
export const GenerateSeriesOutputSchema = z
  .object({
    success: z.boolean(),
    count: z.number().optional(),
    values: z.array(z.number()).optional(),
  })
  .extend(ErrorFieldsMixin.shape);

/**
 * sqlite_list_virtual_tables output
 */
export const ListVirtualTablesOutputSchema = z
  .object({
    success: z.boolean(),
    count: z.number().optional(),
    virtualTables: z
      .array(
        z.object({
          name: z.string(),
          module: z.string(),
          sql: z.string(),
        }),
      )
      .optional(),
  })
  .extend(ErrorFieldsMixin.shape);

/**
 * sqlite_virtual_table_info output
 */
export const VirtualTableInfoOutputSchema = z
  .object({
    success: z.boolean(),
    name: z.string().optional(),
    module: z.string().optional(),
    moduleAvailable: z.boolean().optional(),
    columns: z
      .array(
        z.object({
          name: z.string(),
          type: z.string(),
        }),
      )
      .optional(),
    sql: z.string().optional(),
    note: z.string().optional(),
  })
  .extend(ErrorFieldsMixin.shape);

/**
 * sqlite_drop_virtual_table output
 */
export const DropVirtualTableOutputSchema = z
  .object({
    success: z.boolean(),
    message: z.string().optional(),
  })
  .extend(ErrorFieldsMixin.shape);

/**
 * sqlite_create_csv_table output
 */
export const CreateCsvTableOutputSchema = z
  .object({
    success: z.boolean(),
    message: z.string().optional(),
    sql: z.string().optional(),
    columns: z.array(z.string()).optional(),
  })
  .extend(ErrorFieldsMixin.shape);

/**
 * sqlite_analyze_csv_schema output
 */
export const AnalyzeCsvSchemaOutputSchema = z
  .object({
    success: z.boolean(),
    message: z.string().optional(),
    hasHeader: z.boolean().optional(),
    rowCount: z.number().optional(),
    columns: z
      .array(
        z.object({
          name: z.string(),
          inferredType: z.string(),
          nullCount: z.number(),
          sampleValues: z.array(z.string()),
        }),
      )
      .optional(),
    wasmLimitation: z.boolean().optional(),
  })
  .extend(ErrorFieldsMixin.shape);

/**
 * sqlite_create_rtree_table output
 */
export const CreateRtreeTableOutputSchema = z
  .object({
    success: z.boolean(),
    message: z.string().optional(),
    sql: z.string().optional(),
    columns: z.array(z.string()).optional(),
  })
  .extend(ErrorFieldsMixin.shape);

/**
 * sqlite_create_series_table output
 */
export const CreateSeriesTableOutputSchema = z
  .object({
    success: z.boolean(),
    message: z.string().optional(),
    rowCount: z.number().optional(),
  })
  .extend(ErrorFieldsMixin.shape);

// =============================================================================
// Input Schemas
// =============================================================================

export const GenerateSeriesSchema = z.object({
  start: z.preprocess(
    coerceNumber,
    z.number().optional().describe("Start value"),
  ),
  stop: z.preprocess(
    coerceNumber,
    z.number().optional().describe("Stop value"),
  ),
  step: z.preprocess(
    coerceNumber,
    z.number().optional().default(1).describe("Step value"),
  ),
});

export const CreateViewSchema = z.object({
  viewName: z.string().describe("Name of the view"),
  selectQuery: z.string().describe("SELECT query for view definition"),
  replace: z.boolean().optional().default(false),
});

export const ListViewsSchema = z.object({
  pattern: z
    .string()
    .optional()
    .describe("Optional LIKE pattern to filter views"),
  excludeSystemViews: z
    .boolean()
    .optional()
    .default(true)
    .describe(
      "Exclude SpatiaLite system views (default: true). Set to false to include all views.",
    ),
});

export const DropViewSchema = z.object({
  viewName: z.string().describe("Name of the view to drop"),
  ifExists: z.boolean().optional().default(false),
});

export const DbStatSchema = z.object({
  table: z.string().optional().describe("Optional table name to filter"),
  summarize: z
    .boolean()
    .optional()
    .default(false)
    .describe(
      "If true, return aggregated per-table stats instead of raw page-level data",
    ),
  limit: z.preprocess(
    coerceNumber,
    z
      .number()
      .optional()
      .default(100)
      .describe("Maximum number of tables/pages to return (default: 100)"),
  ),
  excludeSystemTables: z
    .boolean()
    .optional()
    .default(true)
    .describe(
      "Exclude SpatiaLite system tables and indexes from results (default: true). Set to false to include all tables.",
    ),
});

export const VacuumIntoSchema = z.object({
  into: z.string().optional().describe("Optional file path to vacuum into"),
});

export const ListVirtualTablesSchema = z.object({
  pattern: z.string().optional().describe("Optional LIKE pattern to filter"),
});

export const VirtualTableInfoSchema = z.object({
  tableName: z.string().describe("Name of the virtual table"),
});

export const DropVirtualTableSchema = z.object({
  tableName: z.string().describe("Name of the virtual table to drop"),
  ifExists: z.boolean().optional().default(true),
});

export const CreateCsvTableSchema = z.object({
  tableName: z.string().describe("Name for the virtual table"),
  filePath: z.string().describe("Path to the CSV file"),
  header: z.boolean().optional().default(true).describe("First row is header"),
  delimiter: z
    .string()
    .length(1, "Delimiter must be exactly one character")
    .regex(/^[\t\x20-\x7E]$/, "Delimiter must be a printable ASCII character or tab")
    .optional()
    .default(",")
    .describe("Column delimiter"),
  columns: z
    .array(z.string())
    .optional()
    .describe("Manual column names if no header"),
});

export const AnalyzeCsvSchemaSchema = z.object({
  filePath: z.string().describe("Path to the CSV file"),
  sampleRows: z.preprocess(
    coerceNumber,
    z.number().optional().default(100).describe("Rows to sample"),
  ),
  delimiter: z
    .string()
    .length(1, "Delimiter must be exactly one character")
    .regex(/^[\t\x20-\x7E]$/, "Delimiter must be a printable ASCII character or tab")
    .optional()
    .default(",")
    .describe("Column delimiter"),
});

export const CreateRtreeTableSchema = z.object({
  tableName: z.string().describe("Name for the R-Tree table"),
  dimensions: z.preprocess(
    coerceNumber,
    z.number().optional().default(2).describe("Number of dimensions (2-5)"),
  ),
  idColumn: z.string().optional().default("id").describe("ID column name"),
});

export const CreateSeriesTableSchema = z.object({
  tableName: z.string().describe("Name for the series table"),
  start: z.preprocess(
    coerceNumber,
    z.number().optional().describe("Start value"),
  ),
  stop: z.preprocess(
    coerceNumber,
    z.number().optional().describe("Stop value"),
  ),
  step: z.preprocess(
    coerceNumber,
    z.number().optional().default(1).describe("Step value"),
  ),
  columnName: z.string().optional().default("value").describe("Column name"),
});

// =============================================================================
// Types
// =============================================================================

export type GenerateSeriesInput = z.infer<typeof GenerateSeriesSchema>;
export type CreateViewInput = z.infer<typeof CreateViewSchema>;
export type ListViewsInput = z.infer<typeof ListViewsSchema>;
export type DropViewInput = z.infer<typeof DropViewSchema>;
export type DbStatInput = z.infer<typeof DbStatSchema>;
export type VacuumIntoInput = z.infer<typeof VacuumIntoSchema>;
export type ListVirtualTablesInput = z.infer<typeof ListVirtualTablesSchema>;
export type VirtualTableInfoInput = z.infer<typeof VirtualTableInfoSchema>;
export type DropVirtualTableInput = z.infer<typeof DropVirtualTableSchema>;
export type CreateCsvTableInput = z.infer<typeof CreateCsvTableSchema>;
export type AnalyzeCsvSchemaInput = z.infer<typeof AnalyzeCsvSchemaSchema>;
export type CreateRtreeTableInput = z.infer<typeof CreateRtreeTableSchema>;
export type CreateSeriesTableInput = z.infer<typeof CreateSeriesTableSchema>;

const DbstatObjectSchema = z.object({
  name: z.string(),
  pageCount: z.number(),
  totalPayload: z.number(),
  totalUnused: z.number(),
  totalCells: z.number(),
  maxPayload: z.number(),
});

export const DbstatOutputSchema = z
  .object({
    success: z.boolean(),
    // Summarized mode
    summarized: z.boolean().optional(),
    objectCount: z.number().optional(),
    objects: z.array(DbstatObjectSchema).optional(),
    // Raw mode
    rowCount: z.number().optional(),
    stats: z.array(z.record(z.string(), z.unknown())).optional(),
    // Fallback mode
    pageCount: z.number().optional(),
    tableCount: z.number().optional(),
    table: z.string().optional(),
    estimatedPages: z.number().optional(),
    totalDatabasePages: z.number().optional(),
    // Shared
    message: z.string().optional(),
    note: z.string().optional(),
  })
  .extend(ErrorFieldsMixin.shape);
