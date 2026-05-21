/**
 * SpatiaLite Tool Output Schemas (7 tools — Native only)
 */

import { z } from "zod";
import { RowRecordSchema } from "./common.js";
import { ErrorFieldsMixin } from "./error-mixin.js";

/**
 * sqlite_spatialite_load output
 */
export const SpatialiteLoadOutputSchema = z
  .object({
    success: z.boolean(),
    message: z.string().optional(),
    alreadyLoaded: z.boolean().optional(),
    extensionPath: z.string().optional(),
    searchedPaths: z.array(z.string()).optional(),
  })
  .extend(ErrorFieldsMixin.shape);

/**
 * sqlite_spatialite_create_table output
 */
export const SpatialiteCreateTableOutputSchema = z
  .object({
    success: z.boolean(),
    message: z.string().optional(),
    tableName: z.string().optional(),
    alreadyExists: z.boolean().optional(),
    geometryColumn: z.string().optional(),
    geometryType: z.string().optional(),
    srid: z.number().optional(),
  })
  .extend(ErrorFieldsMixin.shape);

/**
 * sqlite_spatialite_query output
 */
export const SpatialiteQueryOutputSchema = z
  .object({
    success: z.boolean(),
    rowCount: z.number().optional(),
    rows: z.array(RowRecordSchema).optional(),
  })
  .extend(ErrorFieldsMixin.shape);

/**
 * sqlite_spatialite_index output
 */
export const SpatialiteIndexOutputSchema = z
  .object({
    success: z.boolean(),
    message: z.string().optional(),
    action: z.string().optional(),
    alreadyExists: z.boolean().optional(),
    alreadyDropped: z.boolean().optional(),
    indexed: z.boolean().optional(),
    valid: z.boolean().nullable().optional(),
  })
  .extend(ErrorFieldsMixin.shape);

/**
 * sqlite_spatialite_analyze output
 */
export const SpatialiteAnalyzeOutputSchema = z
  .object({
    success: z.boolean(),
    analysisType: z.string().optional(),
    rowCount: z.number().optional(),
    results: z.array(RowRecordSchema).optional(),
  })
  .extend(ErrorFieldsMixin.shape);

/**
 * sqlite_spatialite_transform output
 */
export const SpatialiteTransformOutputSchema = z
  .object({
    success: z.boolean(),
    operation: z.string().optional(),
    result: z.string().optional(),
  })
  .extend(ErrorFieldsMixin.shape);

/**
 * sqlite_spatialite_import output
 */
export const SpatialiteImportOutputSchema = z
  .object({
    success: z.boolean(),
    message: z.string().optional(),
    rowsAffected: z.number().optional(),
  })
  .extend(ErrorFieldsMixin.shape);
