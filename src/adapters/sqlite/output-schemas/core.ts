/**
 * Core Tool Output Schemas (9 tools)
 */

import { z } from "zod";
import { RowRecordSchema } from "./common.js";

/**
 * sqlite_read_query output
 */
export const ReadQueryOutputSchema = z.object({
  success: z.boolean(),
  rowCount: z.number(),
  rows: z.array(RowRecordSchema),
  executionTimeMs: z.number().optional(),
});

/**
 * sqlite_write_query output
 */
export const WriteQueryOutputSchema = z.object({
  success: z.boolean(),
  rowsAffected: z.number(),
  executionTimeMs: z.number().optional(),
});

/**
 * sqlite_create_table output
 */
export const CreateTableOutputSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
  sql: z.string().optional(),
  error: z.string().optional(),
  code: z.string().optional(),
  suggestion: z.string().optional(),
});

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
export const ListTablesOutputSchema = z.object({
  success: z.boolean(),
  count: z.number(),
  tables: z.array(TableEntrySchema),
});

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
export const DescribeTableOutputSchema = z.object({
  success: z.boolean(),
  table: z.string(),
  rowCount: z.number().optional(),
  columns: z.array(ColumnInfoSchema),
});

/**
 * sqlite_drop_table output
 */
export const DropTableOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

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
export const GetIndexesOutputSchema = z.object({
  success: z.boolean(),
  count: z.number(),
  indexes: z.array(IndexEntrySchema),
});

/**
 * sqlite_create_index output
 */
export const CreateIndexOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  sql: z.string(),
});

/**
 * sqlite_drop_index output
 */
export const DropIndexOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});
