import { WhereConditionSchema } from "./where.js";
/**
 * Core Tool Output Schemas (9 tools)
 */

import { z } from "zod";
import { RowRecordSchema } from "./common.js";
import { ErrorFieldsMixin } from "./error-mixin.js";

const coerceNumber = (val: unknown): unknown => {
  if (typeof val === "string") {
    if (val.trim() === "") return undefined;
    const num = Number(val);
    return isNaN(num) ? val : num;
  }
  return val;
};

/**
 * sqlite_read_query output
 */
export const ReadQueryOutputSchema = z
  .object({
    success: z.boolean(),
    rowCount: z.number().optional(),
    rows: z.array(RowRecordSchema).optional(),
    nextCursor: z.string().optional(),
    executionTimeMs: z.number().optional(),
    streamed: z.boolean().optional(),
    chunksEmitted: z.number().optional(),
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
  isGenerated: z.boolean().optional(),
  generatedExpression: z.string().optional(),
  generatedType: z.enum(["VIRTUAL", "STORED"]).optional(),
});

/**
 * sqlite_describe_table output
 */
export const DescribeTableOutputSchema = z
  .object({
    success: z.boolean(),
    table: z.string().optional(),
    strict: z.boolean().optional(),
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
// Date Math Output
// =============================================================================

export const DateMathOutputSchema = z
  .object({
    success: z.boolean(),
    rows: z.array(z.record(z.string(), z.unknown())).optional(),
    count: z.number().optional(),
  })
  .extend(ErrorFieldsMixin.shape);

// =============================================================================
// Input Schemas
// =============================================================================

export const ReadQuerySchema = z.object({
  query: z.string().max(100000).default("").describe("SELECT query to execute"),
  sql: z.string().max(100000).optional().describe("Alias for query"),
  params: z
    .array(z.unknown())
    .optional()
    .describe("Query parameters for prepared statements"),
  cursor: z.string().optional().describe("Opaque cursor for pagination"),
  stream: z
    .boolean()
    .optional()
    .default(false)
    .describe(
      "Stream results row-by-row via MCP progress notifications instead of returning all rows in the response. " +
        "Requires a progressToken in the request _meta. Falls back to normal behavior if unavailable. " +
        "The final response contains rowCount and metadata but not the rows themselves.",
    ),
  chunkSize: z
    .number()
    .int()
    .positive()
    .optional()
    .describe(
      "When streaming, the number of rows to include in each progress notification chunk (default 10)",
    ),
});

export const WriteQuerySchema = z.object({
  query: z
    .string()
    .max(100000)
    .default("")
    .describe("INSERT/UPDATE/DELETE query to execute"),
  sql: z.string().max(100000).optional().describe("Alias for query"),
  params: z
    .array(z.unknown())
    .optional()
    .describe("Query parameters for prepared statements"),
  expectedVersion: z
    .number()
    .int()
    .positive()
    .optional()
    .describe(
      "If set and rowsAffected is 0, throws ConflictError instead of returning silently. Use with manual WHERE _version = ? guards.",
    ),
});

export const CreateTableSchema = z.object({
  table: z.string().default("").describe("Name of the table to create"),
  tableName: z.string().optional().describe("Alias for table"),
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
  foreignKeys: z
    .array(
      z.object({
        column: z.string().describe("Local column name"),
        targetTable: z.string().describe("Target table name"),
        targetColumn: z
          .string()
          .optional()
          .describe("Target column name (defaults to primary key)"),
        onDelete: z
          .enum(["NO ACTION", "RESTRICT", "SET NULL", "SET DEFAULT", "CASCADE"])
          .optional(),
        onUpdate: z
          .enum(["NO ACTION", "RESTRICT", "SET NULL", "SET DEFAULT", "CASCADE"])
          .optional(),
      }),
    )
    .optional()
    .describe("Foreign key constraints"),
  checkConstraints: z
    .array(z.string())
    .optional()
    .describe("CHECK constraints (e.g., 'price > 0')"),
  ifNotExists: z
    .boolean()
    .optional()
    .default(true)
    .describe("Add IF NOT EXISTS clause"),
  strict: z
    .boolean()
    .optional()
    .default(false)
    .describe(
      "Create a STRICT table (SQLite 3.37+). Enforces column type checking instead of dynamic typing.",
    ),
});

export const DescribeTableSchema = z.object({
  table: z.string().default("").describe("Name of the table to describe"),
  tableName: z.string().optional().describe("Alias for table"),
});

export const DropTableSchema = z.object({
  table: z.string().default("").describe("Name of the table to drop"),
  tableName: z.string().optional().describe("Alias for table"),
  ifExists: z
    .boolean()
    .optional()
    .default(true)
    .describe("Add IF EXISTS clause"),
});

export const CreateIndexSchema = z.object({
  indexName: z.string().default("").describe("Name of the index"),
  name: z.string().optional().describe("Alias for indexName"),
  table: z.string().default("").describe("Table to create index on"),
  tableName: z.string().optional().describe("Alias for table"),
  columns: z.array(z.string()).describe("Columns to index"),
  unique: z.boolean().optional().default(false).describe("Create unique index"),
  ifNotExists: z.boolean().optional().default(true),
});

export const GetIndexesSchema = z.object({
  table: z.string().optional().describe("Filter indexes by table name"),
  tableName: z.string().optional().describe("Alias for table"),
  excludeSystemIndexes: z
    .boolean()
    .optional()
    .default(true)
    .describe(
      "Exclude SpatiaLite system indexes (idx_spatial_ref_sys, idx_srid_geocols, etc.)",
    ),
});

export const DropIndexSchema = z.object({
  indexName: z.string().default("").describe("Name of the index to drop"),
  name: z.string().optional().describe("Alias for indexName"),
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
// List Triggers Schema
// =============================================================================

export const ListTriggersSchema = z.object({
  table: z
    .string()
    .optional()
    .describe("Filter triggers by associated table name"),
});

const TriggerEntrySchema = z.object({
  name: z.string(),
  table: z.string(),
  event: z.string().describe("INSERT, UPDATE, or DELETE"),
  timing: z.string().describe("BEFORE, AFTER, or INSTEAD OF"),
  sql: z.string(),
});

export const ListTriggersOutputSchema = z
  .object({
    success: z.boolean(),
    count: z.number().optional(),
    triggers: z.array(TriggerEntrySchema).optional(),
  })
  .extend(ErrorFieldsMixin.shape);

// =============================================================================
// List Constraints Schema
// =============================================================================

export const ListConstraintsSchema = z.object({
  table: z.string().describe("Table name to inspect constraints for"),
});

const ForeignKeyEntrySchema = z.object({
  id: z.number(),
  table: z.string(),
  from: z.string(),
  to: z.string(),
  onUpdate: z.string(),
  onDelete: z.string(),
});

const UniqueIndexEntrySchema = z.object({
  name: z.string(),
  columns: z.array(z.string()),
});

export const ListConstraintsOutputSchema = z
  .object({
    success: z.boolean(),
    table: z.string().optional(),
    primaryKey: z.array(z.string()).optional(),
    foreignKeys: z.array(ForeignKeyEntrySchema).optional(),
    uniqueIndexes: z.array(UniqueIndexEntrySchema).optional(),
    checkConstraints: z.array(z.string()).optional(),
  })
  .extend(ErrorFieldsMixin.shape);

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
export type ListTriggersInput = z.infer<typeof ListTriggersSchema>;
export type ListConstraintsInput = z.infer<typeof ListConstraintsSchema>;

export const UpsertSchema = z.object({
  table: z.string().default("").describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  data: z
    .record(z.string(), z.unknown())
    .describe("Column-value pairs to insert"),
  values: z
    .record(z.string(), z.unknown())
    .optional()
    .describe("Alias for data"),
  conflictColumns: z
    .union([z.array(z.string()), z.string()])
    .optional()
    .describe(
      "Columns that form the unique constraint (ON CONFLICT). If omitted, falls back to INSERT OR REPLACE.",
    ),
  conflictColumn: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .describe("Alias for conflictColumns"),
  updateColumns: z
    .array(z.string())
    .optional()
    .describe(
      "Columns to update on conflict (default: all except conflict columns). Only used if conflictColumns is provided.",
    ),
  returning: z
    .union([z.boolean(), z.array(z.string())])
    .optional()
    .describe("Columns to return, or true for all columns"),
  expectedVersion: z
    .number()
    .int()
    .positive()
    .optional()
    .describe(
      "Expected _version value for optimistic concurrency control. Requires conflictColumns and a versioned table.",
    ),
});

// =============================================================================
// BatchInsert Schema
// =============================================================================

export const BatchInsertSchema = z.object({
  table: z.string().default("").describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  rows: z
    .array(z.record(z.string(), z.unknown()))
    .min(1, "rows must not be empty. Provide at least one row to insert.")
    .describe("Array of row objects to insert"),
  returning: z
    .union([z.boolean(), z.array(z.string())])
    .optional()
    .describe("Columns to return, or true for all columns"),
});

// =============================================================================
// Count Schema
// =============================================================================

export const CountSchema = z.object({
  table: z.string().default("").describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  conditions: z
    .array(WhereConditionSchema)
    .optional()
    .describe("Optional WHERE conditions"),
  whereClause: z
    .string()
    .optional()
    .describe("Deprecated: Use conditions instead"),
  column: z
    .string()
    .optional()
    .describe("Column to count (default: * for all rows)"),
  columnName: z.string().optional().describe("Alias for column"),
  distinct: z
    .boolean()
    .optional()
    .describe("Count distinct values of the specified column"),
});

// =============================================================================
// Exists Schema
// =============================================================================

export const ExistsSchema = z.object({
  table: z.string().default("").describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  conditions: z
    .array(WhereConditionSchema)
    .optional()
    .describe("Optional WHERE conditions"),
  whereClause: z
    .string()
    .optional()
    .describe("Deprecated: Use conditions instead"),
});

// =============================================================================
// Truncate Schema
// =============================================================================

export const TruncateSchema = z.object({
  table: z.string().default("").describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  restartIdentity: z
    .boolean()
    .optional()
    .describe("Restart identity sequences (DELETE FROM sqlite_sequence)"),
});

// =============================================================================
// Date and Time Math Schemas
// =============================================================================

export const DateAddSchema = z.object({
  table: z.string().describe("Table name"),
  column: z.string().describe("Column containing date/time values"),
  amount: z.preprocess(
    coerceNumber,
    z.number().describe("Amount of time to add (use negative to subtract)"),
  ),
  unit: z
    .enum(["days", "months", "years", "hours", "minutes", "seconds"])
    .describe("Time unit"),
  conditions: z
    .array(WhereConditionSchema)
    .optional()
    .describe("Optional WHERE conditions"),
  whereClause: z
    .string()
    .optional()
    .describe("Deprecated: Use conditions instead"),
  limit: z
    .preprocess(coerceNumber, z.number().optional().default(50))
    .describe("Maximum number of rows to return (default: 50)"),
  selectColumns: z
    .array(z.string())
    .optional()
    .describe(
      "Specific columns to return (defaults to all columns). Useful to prevent large payloads on wide tables.",
    ),
});

export const DateDiffSchema = z.object({
  table: z.string().describe("Table name"),
  column1: z.string().describe("First date/time column"),
  column2: z.string().describe("Second date/time column (column1 - column2)"),
  unit: z
    .enum(["days", "hours", "minutes", "seconds"])
    .describe("Unit for the difference result"),
  conditions: z
    .array(WhereConditionSchema)
    .optional()
    .describe("Optional WHERE conditions"),
  whereClause: z
    .string()
    .optional()
    .describe("Deprecated: Use conditions instead"),
  limit: z
    .preprocess(coerceNumber, z.number().optional().default(50))
    .describe("Maximum number of rows to return (default: 50)"),
  selectColumns: z
    .array(z.string())
    .optional()
    .describe(
      "Specific columns to return (defaults to all columns). Useful to prevent large payloads on wide tables.",
    ),
});

// =============================================================================
// ALTER TABLE Schema
// =============================================================================

export const AlterTableSchema = z.object({
  table: z.string().describe("Table name to alter"),
  operation: z
    .enum(["add_column", "rename_column", "drop_column", "rename_table"])
    .describe("ALTER TABLE operation to perform"),
  column: z
    .string()
    .optional()
    .describe(
      "Column name (required for add_column, rename_column, drop_column)",
    ),
  newName: z
    .string()
    .optional()
    .describe(
      "New name for the column (rename_column) or table (rename_table)",
    ),
  type: z
    .string()
    .optional()
    .describe("Column type (required for add_column, e.g. 'TEXT', 'INTEGER')"),
  nullable: z
    .boolean()
    .optional()
    .default(true)
    .describe("Allow NULL values for the new column (add_column only)"),
  defaultValue: z
    .unknown()
    .optional()
    .describe(
      "Default value for the new column (add_column only). Required when nullable is false.",
    ),
});

export const AlterTableOutputSchema = z
  .object({
    success: z.boolean(),
    message: z.string().optional(),
    sql: z.string().optional(),
  })
  .extend(ErrorFieldsMixin.shape);

export type AlterTableInput = z.infer<typeof AlterTableSchema>;

// =============================================================================
// CREATE / DROP TRIGGER Schemas
// =============================================================================

export const CreateTriggerSchema = z.object({
  name: z.string().describe("Trigger name"),
  table: z.string().describe("Table the trigger is attached to"),
  timing: z
    .enum(["BEFORE", "AFTER", "INSTEAD OF"])
    .describe("When the trigger fires relative to the event"),
  event: z
    .enum(["INSERT", "UPDATE", "DELETE"])
    .describe("DML event that activates the trigger"),
  body: z
    .string()
    .describe(
      "SQL statements to execute (e.g. \"INSERT INTO log(msg) VALUES ('row changed')\")",
    ),
  columns: z
    .array(z.string())
    .optional()
    .describe(
      "Specific columns for UPDATE triggers (e.g. ['name', 'email'] → UPDATE OF name, email)",
    ),
  whenClause: z
    .string()
    .optional()
    .describe('Optional WHEN condition (e.g. "NEW.status != OLD.status")'),
  forEachRow: z
    .boolean()
    .optional()
    .default(true)
    .describe(
      "FOR EACH ROW (default: true). SQLite only supports row-level triggers.",
    ),
  ifNotExists: z
    .boolean()
    .optional()
    .default(true)
    .describe("Add IF NOT EXISTS clause"),
  temporary: z
    .boolean()
    .optional()
    .default(false)
    .describe("Create a temporary trigger (TEMP)"),
});

export const CreateTriggerOutputSchema = z
  .object({
    success: z.boolean(),
    message: z.string().optional(),
    sql: z.string().optional(),
  })
  .extend(ErrorFieldsMixin.shape);

export const DropTriggerSchema = z.object({
  name: z.string().describe("Trigger name to drop"),
  ifExists: z
    .boolean()
    .optional()
    .default(false)
    .describe("Add IF EXISTS clause"),
});

export const DropTriggerOutputSchema = z
  .object({
    success: z.boolean(),
    message: z.string().optional(),
  })
  .extend(ErrorFieldsMixin.shape);

export type CreateTriggerInput = z.infer<typeof CreateTriggerSchema>;
export type DropTriggerInput = z.infer<typeof DropTriggerSchema>;

// =============================================================================
// OCC / Versioning Schemas
// =============================================================================

export const EnableVersioningSchema = z.object({
  table: z.string().describe("Name of the table to enable versioning for"),
  tableName: z.string().optional().describe("Alias for table"),
});

export const EnableVersioningOutputSchema = z
  .object({
    success: z.boolean(),
    message: z.string().optional(),
    sql: z.string().optional(),
    alreadyEnabled: z.boolean().optional(),
  })
  .extend(ErrorFieldsMixin.shape);

export const DisableVersioningSchema = z.object({
  table: z.string().describe("Name of the table to disable versioning for"),
  tableName: z.string().optional().describe("Alias for table"),
  ifExists: z.boolean().optional().default(true),
});

export const DisableVersioningOutputSchema = z
  .object({
    success: z.boolean(),
    message: z.string().optional(),
    sql: z.string().optional(),
  })
  .extend(ErrorFieldsMixin.shape);

export const CheckVersionSchema = z.object({
  table: z.string().describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  rowId: z
    .union([z.number(), z.string()])
    .describe("Primary key or rowid value of the row"),
  idColumn: z
    .string()
    .optional()
    .describe("Name of the primary key column (default: 'rowid')"),
});

export const CheckVersionOutputSchema = z
  .object({
    success: z.boolean(),
    version: z.number().optional(),
    row: RowRecordSchema.optional(),
  })
  .extend(ErrorFieldsMixin.shape);

export const ConditionalUpdateSchema = z.object({
  table: z.string().describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  data: z
    .record(z.string(), z.unknown())
    .describe("Column-value pairs to update"),
  conditions: z
    .array(WhereConditionSchema)
    .describe("WHERE conditions to locate the row (e.g. id = 1)"),
  expectedVersion: z
    .number()
    .int()
    .positive()
    .describe("The _version value expected to be currently in the database"),
});

export const ConditionalUpdateOutputSchema = z
  .object({
    success: z.boolean(),
    rowsAffected: z.number().optional(),
    currentVersion: z.number().optional(),
    rows: z.array(RowRecordSchema).optional(),
  })
  .extend(ErrorFieldsMixin.shape);

export type EnableVersioningInput = z.infer<typeof EnableVersioningSchema>;
export type DisableVersioningInput = z.infer<typeof DisableVersioningSchema>;
export type CheckVersionInput = z.infer<typeof CheckVersionSchema>;
export type ConditionalUpdateInput = z.infer<typeof ConditionalUpdateSchema>;
