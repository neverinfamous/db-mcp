/**
 * Transaction and Window Function Tool Output Schemas (Native only)
 */

import { z } from "zod";
import { ErrorFieldsMixin } from "./error-mixin.js";

// =============================================================================
// Transaction Tool Output Schemas (7 tools - Native only)
// =============================================================================

/**
 * sqlite_transaction_begin output
 */
export const TransactionBeginOutputSchema = z
  .object({
    success: z.boolean(),
    message: z.string().optional(),
    mode: z.string().optional(),
  })
  .extend(ErrorFieldsMixin.shape);

/**
 * sqlite_transaction_commit output
 */
export const TransactionCommitOutputSchema = z
  .object({
    success: z.boolean(),
    message: z.string().optional(),
  })
  .extend(ErrorFieldsMixin.shape);

/**
 * sqlite_transaction_rollback output
 */
export const TransactionRollbackOutputSchema = z
  .object({
    success: z.boolean(),
    message: z.string().optional(),
  })
  .extend(ErrorFieldsMixin.shape);

/**
 * sqlite_transaction_savepoint output
 */
export const TransactionSavepointOutputSchema = z
  .object({
    success: z.boolean(),
    message: z.string().optional(),
    name: z.string().optional(),
    savepoint: z.string().optional(),
  })
  .extend(ErrorFieldsMixin.shape);

/**
 * sqlite_transaction_release output
 */
export const TransactionReleaseOutputSchema = z
  .object({
    success: z.boolean(),
    message: z.string().optional(),
    name: z.string().optional(),
    savepoint: z.string().optional(),
  })
  .extend(ErrorFieldsMixin.shape);

/**
 * sqlite_transaction_rollback_to output
 */
export const TransactionRollbackToOutputSchema = z
  .object({
    success: z.boolean(),
    message: z.string().optional(),
    name: z.string().optional(),
    savepoint: z.string().optional(),
  })
  .extend(ErrorFieldsMixin.shape);

/**
 * sqlite_transaction_execute output
 */
export const TransactionExecuteOutputSchema = z
  .object({
    success: z.boolean(),
    message: z.string(),
    statementsExecuted: z.number(),
    results: z.array(z.unknown()).optional(),
  })
  .extend(ErrorFieldsMixin.shape);

// =============================================================================
// Window Function Tool Output Schemas (6 tools - Native only)
// =============================================================================

/**
 * Result item with row_number
 */
const RowNumberResultSchema = z
  .object({
    row_number: z.number(),
  })
  .loose();

/**
 * sqlite_window_row_number output
 */
export const WindowRowNumberOutputSchema = z
  .object({
    success: z.boolean(),
    rowCount: z.number(),
    rows: z.array(RowNumberResultSchema),
  })
  .extend(ErrorFieldsMixin.shape);

/**
 * Result item with rank values
 */
const RankResultSchema = z
  .object({
    rank: z.number().optional(),
    dense_rank: z.number().optional(),
    percent_rank: z.number().optional(),
  })
  .loose();

/**
 * sqlite_window_rank output
 */
export const WindowRankOutputSchema = z
  .object({
    success: z.boolean(),
    rowCount: z.number(),
    rows: z.array(RankResultSchema),
  })
  .extend(ErrorFieldsMixin.shape);

/**
 * Result item with lag/lead values
 */
const LagLeadResultSchema = z
  .object({
    lag_value: z.unknown().optional(),
    lead_value: z.unknown().optional(),
  })
  .loose();

/**
 * sqlite_window_lag_lead output
 */
export const WindowLagLeadOutputSchema = z
  .object({
    success: z.boolean(),
    rowCount: z.number(),
    rows: z.array(LagLeadResultSchema),
  })
  .extend(ErrorFieldsMixin.shape);

/**
 * Result item with running_total
 */
const RunningTotalResultSchema = z
  .object({
    running_total: z.number(),
  })
  .loose();

/**
 * sqlite_window_running_total output
 */
export const WindowRunningTotalOutputSchema = z
  .object({
    success: z.boolean(),
    rowCount: z.number(),
    rows: z.array(RunningTotalResultSchema),
  })
  .extend(ErrorFieldsMixin.shape);

/**
 * Result item with moving_avg
 */
const MovingAvgResultSchema = z
  .object({
    moving_avg: z.number(),
  })
  .loose();

/**
 * sqlite_window_moving_avg output
 */
export const WindowMovingAvgOutputSchema = z
  .object({
    success: z.boolean(),
    rowCount: z.number(),
    rows: z.array(MovingAvgResultSchema),
  })
  .extend(ErrorFieldsMixin.shape);

/**
 * Result item with ntile bucket
 */
const NtileResultSchema = z
  .object({
    ntile: z.number(),
  })
  .loose();

/**
 * sqlite_window_ntile output
 */
export const WindowNtileOutputSchema = z
  .object({
    success: z.boolean(),
    rowCount: z.number(),
    rows: z.array(NtileResultSchema),
  })
  .extend(ErrorFieldsMixin.shape);
