/**
 * Virtual Table Helpers
 *
 * Shared schemas and imports for virtual table tools.
 */

/**
 * SQLite Virtual Table Tools
 *
 * Create and manage virtual tables for CSV, R-Tree, generation, etc.
 * 13 tools total.
 */

import { z } from "zod";

// Virtual table schemas
export const GenerateSeriesSchema = z.object({
  start: z.number().describe("Start value"),
  stop: z.number().describe("Stop value"),
  step: z.number().optional().default(1).describe("Step value"),
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
  ifExists: z.boolean().optional().default(true),
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
  limit: z
    .number()
    .optional()
    .default(100)
    .describe("Maximum number of tables/pages to return (default: 100)"),
  excludeSystemTables: z
    .boolean()
    .optional()
    .default(false)
    .describe(
      "Exclude SpatiaLite system tables and indexes from results (default: false)",
    ),
});

export const VacuumSchema = z.object({
  into: z.string().optional().describe("Optional file path to vacuum into"),
});

// New virtual table schemas
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
  delimiter: z.string().optional().default(",").describe("Column delimiter"),
  columns: z
    .array(z.string())
    .optional()
    .describe("Manual column names if no header"),
});

export const AnalyzeCsvSchemaSchema = z.object({
  filePath: z.string().describe("Path to the CSV file"),
  sampleRows: z.number().optional().default(100).describe("Rows to sample"),
  delimiter: z.string().optional().default(",").describe("Column delimiter"),
});

export const CreateRtreeTableSchema = z.object({
  tableName: z.string().describe("Name for the R-Tree table"),
  dimensions: z
    .number()
    .min(2)
    .max(5)
    .optional()
    .default(2)
    .describe("Number of dimensions (2-5)"),
  idColumn: z.string().optional().default("id").describe("ID column name"),
});

export const CreateSeriesTableSchema = z.object({
  tableName: z.string().describe("Name for the series table"),
  start: z.number().describe("Start value"),
  stop: z.number().describe("Stop value"),
  step: z.number().optional().default(1).describe("Step value"),
  columnName: z.string().optional().default("value").describe("Column name"),
});
