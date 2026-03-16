/**
 * JSON Helper, JSON Operation, and JSONB Tool Output Schemas
 */

import { z } from "zod";
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
 * sqlite_json_tree output
 */
export const JsonTreeOutputSchema = z
  .object({
    success: z.boolean(),
    rowCount: z.number(),
    nodes: z.array(
      z.object({
        key: z.union([z.string(), z.number()]).nullable(),
        value: z.unknown(),
        type: z.string(),
        path: z.string(),
      }),
    ),
  })
  .extend(ErrorFieldsMixin.shape);

/**
 * sqlite_json_patch output
 */
export const JsonPatchOutputSchema = z
  .object({
    success: z.boolean(),
    rowsAffected: z.number().optional(),
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
