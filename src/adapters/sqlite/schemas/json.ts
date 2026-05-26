import { WhereConditionSchema } from "./where.js";
/**
 * JSON Helper, JSON Operation, and JSONB Tool Output Schemas
 */

import { z } from "zod";

const coerceNumber = (val: unknown): unknown => {
  if (typeof val === "number") return val;
  if (typeof val === "string" && val.trim() !== "" && !isNaN(Number(val)))
    return Number(val);
  return undefined;
};

import { RowRecordSchema } from "./common.js";
import { ErrorFieldsMixin } from "./error-mixin.js";

// =============================================================================
// JSON Helper Tool Output Schemas (6 tools)
// =============================================================================

/**
 * sqlite_json_insert output
 */
export const JsonInsertOutputSchema = z
  .object({
    success: z.boolean(),
    message: z.string().optional(),
    rowsAffected: z.number().optional(),
    warning: z.string().optional(),
    lastInsertRowid: z.number().optional(),
  })
  .extend(ErrorFieldsMixin.shape);

/**
 * sqlite_json_update output
 */
export const JsonUpdateOutputSchema = z
  .object({
    success: z.boolean(),
    message: z.string().optional(),
    rowsAffected: z.number().optional(),
    warning: z.string().optional(),
  })
  .extend(ErrorFieldsMixin.shape);

/**
 * sqlite_json_select output
 */
export const JsonSelectOutputSchema = z
  .object({
    success: z.boolean(),
    rowCount: z.number().optional(),
    rows: z.array(RowRecordSchema).optional(),
  })
  .extend(ErrorFieldsMixin.shape);

/**
 * sqlite_json_query output
 */
export const JsonQueryOutputSchema = z
  .object({
    success: z.boolean(),
    rowCount: z.number().optional(),
    rows: z.array(RowRecordSchema).optional(),
  })
  .extend(ErrorFieldsMixin.shape);

/**
 * sqlite_json_validate_path output
 */
export const JsonValidatePathOutputSchema = z
  .object({
    success: z.boolean(),
    valid: z.boolean().optional(),
    normalized: z.string().optional(),
    path: z.string().optional(),
    issues: z.array(z.string()).optional(),
  })
  .extend(ErrorFieldsMixin.shape);

/**
 * sqlite_json_merge output
 */
export const JsonMergeOutputSchema = z
  .object({
    success: z.boolean(),
    message: z.string().optional(),
    rowsAffected: z.number().optional(),
    warning: z.string().optional(),
  })
  .extend(ErrorFieldsMixin.shape);

/**
 * JSON property schema info
 */
const JsonPropertySchemaSchema = z.object({
  type: z.string(),
  nullable: z.boolean(),
  count: z.number(),
  itemType: z.string().optional(),
});

/**
 * sqlite_json_analyze_schema output
 */
export const AnalyzeJsonSchemaOutputSchema = z
  .object({
    success: z.boolean(),
    schema: z
      .object({
        type: z.string(),
        properties: z.record(z.string(), JsonPropertySchemaSchema),
        sampleSize: z.number(),
        nullCount: z.number(),
        errorCount: z.number(),
      })
      .optional(),
  })
  .extend(ErrorFieldsMixin.shape);

/**
 * sqlite_create_json_collection output
 */
export const CreateJsonCollectionOutputSchema = z
  .object({
    success: z.boolean(),
    message: z.string().optional(),
    sql: z.array(z.string()).optional(),
    indexCount: z.number().optional(),
  })
  .extend(ErrorFieldsMixin.shape);

// =============================================================================
// JSON Operation Tool Output Schemas (12 tools)
// =============================================================================

/**
 * sqlite_json_extract output
 */
export const JsonExtractOutputSchema = z
  .object({
    success: z.boolean(),
    rowCount: z.number().optional(),
    values: z.array(z.unknown()).optional(),
  })
  .extend(ErrorFieldsMixin.shape);

/**
 * sqlite_json_set output
 */
export const JsonSetOutputSchema = z
  .object({
    success: z.boolean(),
    rowsAffected: z.number().optional(),
    warning: z.string().optional(),
  })
  .extend(ErrorFieldsMixin.shape);

/**
 * sqlite_json_remove output
 */
export const JsonRemoveOutputSchema = z
  .object({
    success: z.boolean(),
    rowsAffected: z.number().optional(),
    warning: z.string().optional(),
  })
  .extend(ErrorFieldsMixin.shape);

/**
 * sqlite_json_type output
 */
export const JsonTypeOutputSchema = z
  .object({
    success: z.boolean(),
    rowCount: z.number().optional(),
    types: z.array(z.string().nullable()).optional(),
  })
  .extend(ErrorFieldsMixin.shape);

/**
 * sqlite_json_array_length output
 */
export const JsonArrayLengthOutputSchema = z
  .object({
    success: z.boolean(),
    rowCount: z.number().optional(),
    lengths: z.array(z.number().nullable()).optional(),
  })
  .extend(ErrorFieldsMixin.shape);

/**
 * sqlite_json_keys output
 */
export const JsonKeysOutputSchema = z
  .object({
    success: z.boolean(),
    rowCount: z.number().optional(),
    keys: z.array(z.union([z.string(), z.number()]).nullable()).optional(),
  })
  .extend(ErrorFieldsMixin.shape);

/**
 * sqlite_json_valid output
 */
export const JsonValidOutputSchema = z
  .object({
    success: z.boolean(),
    valid: z.boolean().optional(),
    message: z.string().optional(),
  })
  .extend(ErrorFieldsMixin.shape);

/**
 * sqlite_json_group_array output
 * Returns aggregated arrays - either a single array or grouped arrays with group keys
 */
export const JsonGroupArrayOutputSchema = z
  .object({
    success: z.boolean(),
    rowCount: z.number().optional(),
    rows: z.array(z.record(z.string(), z.unknown())).optional(),
  })
  .extend(ErrorFieldsMixin.shape);

/**
 * sqlite_json_group_object output
 * Returns aggregated objects - either single object or grouped objects with group keys
 */
export const JsonGroupObjectOutputSchema = z
  .object({
    success: z.boolean(),
    rowCount: z.number().optional(),
    rows: z.array(z.record(z.string(), z.unknown())).optional(),
    hint: z.string().optional(),
  })
  .extend(ErrorFieldsMixin.shape);

/**
 * sqlite_json_each output
 */
export const JsonEachOutputSchema = z
  .object({
    success: z.boolean(),
    rowCount: z.number().optional(),
    elements: z
      .array(
        z.object({
          row_id: z.number().optional(),
          key: z.union([z.string(), z.number()]),
          value: z.unknown(),
          type: z.string(),
        }),
      )
      .optional(),
  })
  .extend(ErrorFieldsMixin.shape);

/**
 * sqlite_json_pretty output
 */
export const JsonPrettyOutputSchema = z
  .object({
    success: z.boolean(),
    formatted: z.string().optional(),
  })
  .extend(ErrorFieldsMixin.shape);

// =============================================================================
// JSONB Tool Output Schemas (3 tools)
// =============================================================================

/**
 * sqlite_jsonb_convert output
 */
export const JsonbConvertOutputSchema = z
  .object({
    success: z.boolean(),
    message: z.string().optional(),
    rowsAffected: z.number().optional(),
    hint: z.string().optional(),
  })
  .extend(ErrorFieldsMixin.shape);

/**
 * sqlite_json_storage_info output
 */
export const JsonStorageInfoOutputSchema = z
  .object({
    success: z.boolean(),
    jsonbSupported: z.boolean().optional(),
    sampleSize: z.number().optional(),
    formats: z
      .object({
        text: z.number(),
        jsonb: z.number(),
        null: z.number(),
        unknown: z.number(),
      })
      .optional(),
    recommendation: z.string().optional(),
  })
  .extend(ErrorFieldsMixin.shape);

/**
 * sqlite_json_normalize_column output
 */
export const JsonNormalizeColumnOutputSchema = z
  .object({
    success: z.boolean(),
    message: z.string().optional(),
    normalized: z.number().optional(),
    unchanged: z.number().optional(),
    errors: z.number().optional(),
    total: z.number().optional(),
    outputFormat: z.string().optional(),
    firstErrorDetail: z.string().optional(),
  })
  .extend(ErrorFieldsMixin.shape);

// =============================================================================
// JSON Security Scan Output Schema (1 tool)
// =============================================================================

/**
 * sqlite_json_security_scan output
 *
 * Mirrors pg_jsonb_security_scan for cross-server parity.
 */
export const JsonSecurityScanOutputSchema = z
  .object({
    success: z.boolean(),
    scannedRows: z.number().optional().describe("Number of rows scanned"),
    issues: z
      .array(
        z.object({
          type: z
            .string()
            .describe(
              "Issue type: sensitive_key | sql_injection_pattern | xss_pattern | cmd_injection_pattern",
            ),
          key: z.string().optional().describe("Affected JSON key"),
          count: z.number().optional().describe("Occurrence count"),
        }),
      )
      .optional()
      .describe("Security issues found"),
    riskLevel: z
      .enum(["low", "medium", "high"])
      .optional()
      .describe("Overall risk level"),
  })
  .extend(ErrorFieldsMixin.shape);

// =============================================================================
// Input Schemas
// =============================================================================

export const JsonInsertSchema = z.object({
  table: z.string().describe("Table name"),
  column: z.string().describe("JSON column name"),
  data: z.unknown().describe("JSON data to insert as a new row"),
});

export const JsonUpdateSchema = z.object({
  table: z.string().describe("Table name"),
  column: z.string().describe("JSON column name"),
  path: z.string().describe("JSON path (e.g., $.key.subkey)"),
  value: z.unknown().describe("New value"),
  conditions: z.array(WhereConditionSchema).optional().describe("Optional WHERE conditions"),
  whereClause: z.string().optional().describe("Deprecated: Use conditions instead"),
});

export const JsonSelectSchema = z.object({
  table: z.string().describe("Table name"),
  column: z.string().describe("JSON column name"),
  paths: z.array(z.string()).optional().describe("JSON paths to extract"),
  conditions: z.array(WhereConditionSchema).optional().describe("Optional WHERE conditions"),
  whereClause: z.string().optional().describe("Deprecated: Use conditions instead"),
});

export const JsonQuerySchema = z.object({
  table: z.string().describe("Table name"),
  column: z.string().describe("JSON column name"),
  filterPaths: z
    .union([
      z.string().transform((val) => {
        try {
          return JSON.parse(val) as unknown;
        } catch {
          return val;
        }
      }),
      z.record(z.string(), z.unknown()),
    ])
    .optional()
    .describe("Path-value filters"),
  selectPaths: z.array(z.string()).optional().describe("Paths to select"),
  limit: z.preprocess(coerceNumber, z.number().max(10000).optional().default(100)),
});

export const JsonValidatePathSchema = z.object({
  path: z.string().describe("JSON path to validate"),
});

export const JsonMergeSchema = z.object({
  table: z.string().describe("Table name"),
  column: z.string().describe("JSON column name"),
  mergeData: z.unknown().describe("JSON object to merge"),
  conditions: z.array(WhereConditionSchema).optional().describe("Optional WHERE conditions"),
  whereClause: z.string().optional().describe("Deprecated: Use conditions instead"),
  deep: z.boolean().optional().default(false).describe("Deep merge"),
});

export const ValidateJsonSchema = z.object({
  json: z.string().describe("JSON string to validate"),
});

export const JsonExtractSchema = z.object({
  table: z.string().describe("Table name"),
  column: z.string().describe("JSON column name"),
  path: z.string().describe("JSON path to extract"),
  conditions: z.array(WhereConditionSchema).optional().describe("Optional WHERE conditions"),
  whereClause: z.string().optional().describe("Deprecated: Use conditions instead"),
});

export const JsonSetSchema = z.object({
  table: z.string().describe("Table name"),
  column: z.string().describe("JSON column name"),
  path: z.string().describe("JSON path"),
  value: z.unknown().describe("Value to set"),
  conditions: z.array(WhereConditionSchema).optional().describe("Optional WHERE conditions"),
  whereClause: z.string().optional().describe("Deprecated: Use conditions instead"),
});

export const JsonRemoveSchema = z.object({
  table: z.string().describe("Table name"),
  column: z.string().describe("JSON column name"),
  path: z.string().describe("JSON path to remove"),
  conditions: z.array(WhereConditionSchema).optional().describe("Optional WHERE conditions"),
  whereClause: z.string().optional().describe("Deprecated: Use conditions instead"),
});

export const AnalyzeJsonSchemaSchema = z.object({
  table: z.string().describe("Table name"),
  column: z.string().describe("JSON column to analyze"),
  sampleSize: z.preprocess(
    coerceNumber,
    z.number().max(10000).optional().default(100).describe("Number of rows to sample"),
  ),
});

export const CreateJsonCollectionSchema = z.object({
  tableName: z.string().describe("Collection table name"),
  idColumn: z.string().optional().default("id").describe("ID column name"),
  dataColumn: z
    .string()
    .optional()
    .default("data")
    .describe("JSON data column name"),
  timestamps: z
    .boolean()
    .optional()
    .default(true)
    .describe("Add created_at/updated_at columns"),
  indexes: z
    .array(
      z.object({
        path: z.string().describe("JSON path to index (e.g., $.name)"),
        name: z
          .string()
          .optional()
          .describe("Index name (auto-generated if omitted)"),
      }),
    )
    .optional()
    .describe("JSON path indexes to create"),
});

export const JsonSecurityScanSchema = z.object({
  table: z.string().describe("Table name"),
  column: z.string().describe("JSON column to scan for security issues"),
  sampleSize: z.preprocess(
    coerceNumber,
    z.number().max(10000).optional().default(100).describe("Number of rows to sample"),
  ),
  conditions: z.array(WhereConditionSchema).optional().describe("Optional WHERE conditions"),
  whereClause: z.string().optional().describe("Deprecated: Use conditions instead"),
});

// =============================================================================
// JSON Diff Schema
// =============================================================================

const JsonDiffEntrySchema = z.object({
  rowid: z.number().optional(),
  path1Value: z.unknown(),
  path2Value: z.unknown(),
  identical: z.boolean(),
});

export const JsonDiffSchema = z.object({
  table: z.string().describe("Table name"),
  column: z.string().describe("JSON column name"),
  path1: z.string().describe("First JSON path to compare (e.g., $.before)"),
  path2: z.string().describe("Second JSON path to compare (e.g., $.after)"),
  conditions: z.array(WhereConditionSchema).optional().describe("Optional WHERE conditions"),
  whereClause: z.string().optional().describe("Deprecated: Use conditions instead"),
  limit: z.preprocess(
    coerceNumber,
    z
      .number()
      .max(10000)
      .optional()
      .default(50)
      .describe("Maximum rows to compare (default: 50, max: 100)"),
  ),
});

export const JsonDiffOutputSchema = z
  .object({
    success: z.boolean(),
    rowCount: z.number().optional(),
    diffs: z.array(JsonDiffEntrySchema).optional(),
  })
  .extend(ErrorFieldsMixin.shape);

// =============================================================================
// Types
// =============================================================================

export type JsonInsertInput = z.infer<typeof JsonInsertSchema>;
export type JsonUpdateInput = z.infer<typeof JsonUpdateSchema>;
export type JsonSelectInput = z.infer<typeof JsonSelectSchema>;
export type JsonQueryInput = z.infer<typeof JsonQuerySchema>;
export type JsonValidatePathInput = z.infer<typeof JsonValidatePathSchema>;
export type JsonMergeInput = z.infer<typeof JsonMergeSchema>;
export type ValidateJsonInput = z.infer<typeof ValidateJsonSchema>;
export type JsonExtractInput = z.infer<typeof JsonExtractSchema>;
export type JsonSetInput = z.infer<typeof JsonSetSchema>;
export type JsonRemoveInput = z.infer<typeof JsonRemoveSchema>;
export type AnalyzeJsonSchemaInput = z.infer<typeof AnalyzeJsonSchemaSchema>;
export type CreateJsonCollectionInput = z.infer<
  typeof CreateJsonCollectionSchema
>;
export type JsonSecurityScanInput = z.infer<typeof JsonSecurityScanSchema>;
export type JsonDiffInput = z.infer<typeof JsonDiffSchema>;

// Additional schemas for JSON operations
export const JsonTypeSchema = z.object({
  table: z.string().describe("Table name"),
  column: z.string().describe("JSON column name"),
  path: z.string().optional().describe("JSON path (defaults to $)"),
  conditions: z.array(WhereConditionSchema).optional().describe("Optional WHERE conditions"),
  whereClause: z.string().optional().describe("Deprecated: Use conditions instead"),
});

export const JsonArrayLengthSchema = z.object({
  table: z.string().describe("Table name"),
  column: z.string().describe("JSON column name"),
  path: z.string().optional().describe("Path to array (defaults to $)"),
  conditions: z.array(WhereConditionSchema).optional().describe("Optional WHERE conditions"),
  whereClause: z.string().optional().describe("Deprecated: Use conditions instead"),
});

export const JsonArrayAppendSchema = z.object({
  table: z.string().describe("Table name"),
  column: z.string().describe("JSON column name"),
  path: z.string().describe("Path to array"),
  value: z.unknown().describe("Value to append"),
  conditions: z.array(WhereConditionSchema).optional().describe("Optional WHERE conditions"),
  whereClause: z.string().optional().describe("Deprecated: Use conditions instead"),
});

export const JsonKeysSchema = z.object({
  table: z.string().describe("Table name"),
  column: z.string().describe("JSON column name"),
  path: z.string().optional().describe("Path to object (defaults to $)"),
  conditions: z.array(WhereConditionSchema).optional().describe("Optional WHERE conditions"),
  whereClause: z.string().optional().describe("Deprecated: Use conditions instead"),
});

export const JsonEachSchema = z.object({
  table: z.string().describe("Table name"),
  column: z.string().describe("JSON column name"),
  path: z.string().optional().describe("Path to expand (defaults to $)"),
  conditions: z.array(WhereConditionSchema).optional().describe("Optional WHERE conditions"),
  whereClause: z.string().optional().describe("Deprecated: Use conditions instead"),
  limit: z.preprocess(coerceNumber, z.number().max(10000).optional().default(100)),
});

export const JsonGroupArraySchema = z.object({
  table: z.string().describe("Table name"),
  valueColumn: z
    .string()
    .describe(
      "Column to aggregate (or SQL expression if allowExpressions is true)",
    ),
  groupByColumn: z
    .string()
    .optional()
    .describe(
      "Column to group by. For JSON collection tables, use allowExpressions with json_extract(data, '$.field') instead.",
    ),
  conditions: z.array(WhereConditionSchema).optional().describe("Optional WHERE conditions"),
  whereClause: z.string().optional().describe("Deprecated: Use conditions instead"),
  allowExpressions: z
    .boolean()
    .optional()
    .describe(
      "Allow SQL expressions like json_extract() instead of plain column names",
    ),
});

export const JsonGroupObjectSchema = z.object({
  table: z.string().describe("Table name"),
  keyColumn: z
    .string()
    .optional()
    .describe(
      "Column for object keys (or SQL expression if allowExpressions is true). Defaults to rowid.",
    ),
  valueColumn: z
    .string()
    .optional()
    .describe(
      "Column for object values (or SQL expression if allowExpressions is true). For aggregates like COUNT(*), use aggregateFunction instead.",
    ),
  groupByColumn: z
    .string()
    .optional()
    .describe(
      "Column to group by. For JSON collection tables, use allowExpressions with json_extract(data, '$.field') instead.",
    ),
  conditions: z.array(WhereConditionSchema).optional().describe("Optional WHERE conditions"),
  whereClause: z.string().optional().describe("Deprecated: Use conditions instead"),
  allowExpressions: z
    .boolean()
    .optional()
    .describe(
      "Allow SQL expressions like json_extract() instead of plain column names. NOTE: Does NOT support aggregate functions - use aggregateFunction parameter instead.",
    ),
  aggregateFunction: z
    .string()
    .optional()
    .describe(
      "Aggregate function to use for values (e.g., 'COUNT(*)', 'SUM(amount)', 'AVG(price)'). When provided, builds object from pre-aggregated subquery results.",
    ),
});

export const JsonPrettySchema = z.object({
  json: z.string().describe("JSON string to pretty print"),
});

// Additional schemas defined in the transform section
export const JsonbConvertSchema = z.object({
  table: z.string().describe("Table name"),
  column: z.string().describe("JSON column to convert"),
  conditions: z.array(WhereConditionSchema).optional().describe("Optional WHERE conditions"),
  whereClause: z.string().optional().describe("Deprecated: Use conditions instead"),
});

// Schema for storage info tool
export const JsonStorageInfoSchema = z.object({
  table: z.string().describe("Table name"),
  column: z.string().describe("JSON column to analyze"),
  sampleSize: z.preprocess(
    coerceNumber,
    z.number().max(10000).optional().default(100).describe("Number of rows to sample"),
  ),
});

// Schema for normalize column tool
export const JsonNormalizeColumnSchema = z.object({
  table: z.string().describe("Table name"),
  column: z.string().describe("JSON column to normalize"),
  conditions: z.array(WhereConditionSchema).optional().describe("Optional WHERE conditions"),
  whereClause: z.string().optional().describe("Deprecated: Use conditions instead"),
  outputFormat: z
    .string()
    .optional()
    .default("preserve")
    .describe(
      "Output format: 'preserve' original format (default), 'text', or 'jsonb'",
    ),
});


