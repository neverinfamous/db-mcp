/**
 * Core Tool Output Schemas (9 tools)
 */

import { z } from "zod";
import { RowRecordSchema } from "./common.js";
import { ErrorFieldsMixin } from "./error-mixin.js";

/**
 * sqlite_read_query output
 */
export const ReadQueryOutputSchema = z
  .object({
    success: z.boolean(),
    rowCount: z.number().optional(),
    rows: z.array(RowRecordSchema).optional(),
    executionTimeMs: z.number().optional(),
  })
  .extend(ErrorFieldsMixin.shape);

/**
 * sqlite_write_query output
 */
export const WriteQueryOutputSchema = z
  .object({
    success: z.boolean(),
    rowsAffected: z.number().optional(),
    rows: z.array(RowRecordSchema).optional(),
    executionTimeMs: z.number().optional(),
  })
  .extend(ErrorFieldsMixin.shape);

/**
 * sqlite_create_table output
 */
export const CreateTableOutputSchema = z
  .object({
    success: z.boolean(),
    message: z.string().optional(),
    sql: z.string().optional(),
  })
  .extend(ErrorFieldsMixin.shape);

/**
 * Table entry for list_tables
 */
const TableEntrySchema = z.object({
  name: z.string(),
  type: z.string(),
  rowCount: z.number().optional(),
  columnCount: z.number(),
});

/**
 * sqlite_list_tables output
 */
export const ListTablesOutputSchema = z
  .object({
    success: z.boolean(),
    count: z.number().optional(),
    tables: z.array(TableEntrySchema).optional(),
  })
  .extend(ErrorFieldsMixin.shape);

/**
 * Column info for describe_table
 */
const ColumnInfoSchema = z.object({
  name: z.string(),
  type: z.string(),
  nullable: z.boolean().optional(),
  primaryKey: z.boolean().optional(),
  defaultValue: z.unknown().optional(),
});

/**
 * sqlite_describe_table output
 */
export const DescribeTableOutputSchema = z
  .object({
    success: z.boolean(),
    table: z.string().optional(),
    rowCount: z.number().optional(),
    columns: z.array(ColumnInfoSchema).optional(),
  })
  .extend(ErrorFieldsMixin.shape);

/**
 * sqlite_drop_table output
 */
export const DropTableOutputSchema = z
  .object({
    success: z.boolean(),
    message: z.string().optional(),
  })
  .extend(ErrorFieldsMixin.shape);

/**
 * Index entry for get_indexes
 */
const IndexEntrySchema = z.object({
  name: z.string(),
  table: z.string(),
  unique: z.boolean(),
  sql: z.string(),
});

/**
 * sqlite_get_indexes output
 */
export const GetIndexesOutputSchema = z
  .object({
    success: z.boolean(),
    count: z.number().optional(),
    indexes: z.array(IndexEntrySchema).optional(),
  })
  .extend(ErrorFieldsMixin.shape);

/**
 * sqlite_create_index output
 */
export const CreateIndexOutputSchema = z
  .object({
    success: z.boolean(),
    message: z.string().optional(),
    sql: z.string().optional(),
  })
  .extend(ErrorFieldsMixin.shape);

/**
 * sqlite_drop_index output
 */
export const DropIndexOutputSchema = z
  .object({
    success: z.boolean(),
    message: z.string().optional(),
  })
  .extend(ErrorFieldsMixin.shape);

/**
 * sqlite_count output
 */
export const CountOutputSchema = z
  .object({
    success: z.boolean(),
    count: z.number().optional(),
  })
  .extend(ErrorFieldsMixin.shape);

/**
 * sqlite_exists output
 */
export const ExistsOutputSchema = z
  .object({
    success: z.boolean(),
    exists: z.boolean().optional(),
  })
  .extend(ErrorFieldsMixin.shape);


// =============================================================================
// Input Schemas
// =============================================================================

export const ReadQuerySchema = z.object({
  query: z.string().describe("SELECT query to execute"),
  params: z
    .array(z.unknown())
    .optional()
    .describe("Query parameters for prepared statements"),
});

export const WriteQuerySchema = z.object({
  query: z.string().describe("INSERT/UPDATE/DELETE query to execute"),
  params: z
    .array(z.unknown())
    .optional()
    .describe("Query parameters for prepared statements"),
});

export const CreateTableSchema = z.object({
  table: z.string().describe("Name of the table to create"),
  columns: z
    .array(
      z.object({
        name: z.string(),
        type: z.string(),
        nullable: z.boolean().optional().default(true),
        primaryKey: z.boolean().optional().default(false),
        unique: z.boolean().optional().default(false),
        defaultValue: z.unknown().optional(),
      }),
    )
    .describe("Column definitions"),
  ifNotExists: z
    .boolean()
    .optional()
    .default(true)
    .describe("Add IF NOT EXISTS clause"),
});

export const DescribeTableSchema = z.object({
  table: z.string().describe("Name of the table to describe"),
});

export const DropTableSchema = z.object({
  table: z.string().describe("Name of the table to drop"),
  ifExists: z
    .boolean()
    .optional()
    .default(true)
    .describe("Add IF EXISTS clause"),
});

export const CreateIndexSchema = z.object({
  indexName: z.string().describe("Name of the index"),
  table: z.string().describe("Table to create index on"),
  columns: z.array(z.string()).describe("Columns to index"),
  unique: z.boolean().optional().default(false).describe("Create unique index"),
  ifNotExists: z.boolean().optional().default(true),
});

export const GetIndexesSchema = z.object({
  table: z.string().optional().describe("Filter indexes by table name"),
  excludeSystemIndexes: z
    .boolean()
    .optional()
    .default(true)
    .describe(
      "Exclude SpatiaLite system indexes (idx_spatial_ref_sys, idx_srid_geocols, etc.)",
    ),
});

export const DropIndexSchema = z.object({
  indexName: z.string().describe("Name of the index to drop"),
  ifExists: z
    .boolean()
    .optional()
    .default(true)
    .describe("Add IF EXISTS clause"),
});

export const ListTablesSchema = z.object({
  excludeSystemTables: z
    .boolean()
    .optional()
    .default(true)
    .describe(
      "Exclude SpatiaLite system tables (geometry_columns, spatial_ref_sys, etc.)",
    ),
});


// =============================================================================
// Types
// =============================================================================

export type ReadQueryInput = z.infer<typeof ReadQuerySchema>;
export type WriteQueryInput = z.infer<typeof WriteQuerySchema>;
export type CreateTableInput = z.infer<typeof CreateTableSchema>;
export type DescribeTableInput = z.infer<typeof DescribeTableSchema>;
export type DropTableInput = z.infer<typeof DropTableSchema>;
export type CreateIndexInput = z.infer<typeof CreateIndexSchema>;
export type GetIndexesInput = z.infer<typeof GetIndexesSchema>;
export type DropIndexInput = z.infer<typeof DropIndexSchema>;
export type ListTablesInput = z.infer<typeof ListTablesSchema>;

export const UpsertSchema = z.object({
  table: z.string().describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  data: z.record(z.string(), z.unknown()).describe("Column-value pairs to insert"),
  values: z.record(z.string(), z.unknown()).optional().describe("Alias for data"),
  conflictColumns: z.union([z.array(z.string()), z.string()]).optional().describe("Columns that form the unique constraint (ON CONFLICT). If omitted, falls back to INSERT OR REPLACE."),
  conflictColumn: z.union([z.string(), z.array(z.string())]).optional().describe("Alias for conflictColumns"),
  updateColumns: z.array(z.string()).optional().describe("Columns to update on conflict (default: all except conflict columns). Only used if conflictColumns is provided."),
  returning: z.union([z.boolean(), z.array(z.string())]).optional().describe("Columns to return, or true for all columns"),
});

// =============================================================================
// BatchInsert Schema
// =============================================================================

export const BatchInsertSchema = z.object({
  table: z.string().describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  rows: z.array(z.record(z.string(), z.unknown())).describe("Array of row objects to insert"),
  returning: z.union([z.boolean(), z.array(z.string())]).optional().describe("Columns to return, or true for all columns"),
});

// =============================================================================
// Count Schema
// =============================================================================

export const CountSchema = z.object({
  table: z.string().describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  where: z.string().optional().describe("WHERE clause (supports ? placeholders)"),
  params: z.unknown().optional().describe("Parameters for WHERE clause placeholders"),
  condition: z.string().optional().describe("Alias for where"),
  filter: z.string().optional().describe("Alias for where"),
  whereClause: z.string().optional().describe("Alias for where"),
  column: z.string().optional().describe("Column to count (default: * for all rows)"),
  columnName: z.string().optional().describe("Alias for column"),
  distinct: z.boolean().optional().describe("Count distinct values of the specified column"),
});

// =============================================================================
// Exists Schema
// =============================================================================

export const ExistsSchema = z.object({
  table: z.string().describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  where: z.string().optional().describe("WHERE clause (supports ? placeholders)"),
  params: z.unknown().optional().describe("Parameters for WHERE clause placeholders"),
  condition: z.string().optional().describe("Alias for where"),
  filter: z.string().optional().describe("Alias for where"),
  whereClause: z.string().optional().describe("Alias for where"),
});

// =============================================================================
// Truncate Schema
// =============================================================================

export const TruncateSchema = z.object({
  table: z.string().describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  restartIdentity: z.boolean().optional().describe("Restart identity sequences (DELETE FROM sqlite_sequence)"),
});
