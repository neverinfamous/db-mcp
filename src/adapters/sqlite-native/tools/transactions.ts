/**
 * Transaction Tools for Native SQLite Adapter
 *
 * Provides transaction control tools for complex multi-statement operations.
 */

import { z } from "zod";
import type { ToolDefinition, RequestContext } from "../../../types/index.js";
import type { NativeSqliteAdapter } from "../native-sqlite-adapter.js";
import {
  formatHandlerError,
  ValidationError,
} from "../../../utils/errors/index.js";
import { readOnly, write } from "../../../utils/annotations.js";
import {
  TransactionBeginOutputSchema,
  TransactionCommitOutputSchema,
  TransactionRollbackOutputSchema,
  TransactionSavepointOutputSchema,
  TransactionReleaseOutputSchema,
  TransactionRollbackToOutputSchema,
  TransactionExecuteOutputSchema,
  TransactionStatusOutputSchema,
} from "../../sqlite/schemas/index.js";

// Schemas
const BeginTransactionSchema = z.object({
  mode: z
    .enum(["deferred", "immediate", "exclusive"])
    .optional()
    .default("deferred")
    .describe(
      "Transaction mode: deferred waits for first write, immediate acquires lock immediately, exclusive blocks all access",
    ),
});

const SavepointSchema = z.object({
  name: z.string().describe("Savepoint name"),
});

const ExecuteInTransactionSchema = z.object({
  statements: z
    .array(z.string())
    .describe("Array of SQL statements to execute in order"),
  rollbackOnError: z
    .boolean()
    .optional()
    .default(true)
    .describe("If true, rollback all changes when any statement fails"),
});

/**
 * Get all transaction tools
 */
export function getTransactionTools(
  adapter: NativeSqliteAdapter,
): ToolDefinition[] {
  return [
    createBeginTransactionTool(adapter),
    createTransactionStatusTool(adapter),
    createCommitTransactionTool(adapter),
    createRollbackTransactionTool(adapter),
    createSavepointTool(adapter),
    createReleaseSavepointTool(adapter),
    createRollbackToSavepointTool(adapter),
    createExecuteInTransactionTool(adapter),
  ];
}

/**
 * Begin transaction
 */
function createBeginTransactionTool(
  adapter: NativeSqliteAdapter,
): ToolDefinition {
  return {
    name: "sqlite_transaction_begin",
    description:
      "Begin a new transaction. Use immediate or exclusive mode for write-heavy operations.",
    group: "transactions",
    inputSchema: BeginTransactionSchema,
    outputSchema: TransactionBeginOutputSchema,
    annotations: write("Begin Transaction"),
    requiredScopes: ["write"],
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const input = BeginTransactionSchema.parse(params);

        const mode = input.mode.toUpperCase();
        await adapter.executeWriteQuery(`BEGIN ${mode} TRANSACTION`);

        return {
          success: true,
          message: `Transaction started (${input.mode} mode)`,
          mode: input.mode,
        };
      } catch (error: unknown) {
        return formatHandlerError(error);
      }
    },
  };
}

/**
 * Transaction status — read-only check
 */
function createTransactionStatusTool(
  adapter: NativeSqliteAdapter,
): ToolDefinition {
  return {
    name: "sqlite_transaction_status",
    description:
      "Check whether a transaction is currently active. " +
      "Returns status and a boolean flag. Read-only — does not alter transaction state.",
    group: "transactions",
    inputSchema: z.object({}).strict(),
    outputSchema: TransactionStatusOutputSchema,
    annotations: readOnly("Transaction Status"),
    requiredScopes: ["read"],
    handler: (_params: unknown, _context: RequestContext) => {
      try {
        const db = adapter.getDatabase();
        const active = db.inTransaction;

        return Promise.resolve({
          success: true,
          status: active ? "active" : "none",
          active,
          message: active
            ? "A transaction is currently active."
            : "No transaction is active.",
        });
      } catch (error: unknown) {
        return Promise.resolve(formatHandlerError(error));
      }
    },
  };
}

/**
 * Commit transaction
 */
function createCommitTransactionTool(
  adapter: NativeSqliteAdapter,
): ToolDefinition {
  return {
    name: "sqlite_transaction_commit",
    description:
      "Commit the current transaction, making all changes permanent.",
    group: "transactions",
    inputSchema: z.object({}).strict(),
    outputSchema: TransactionCommitOutputSchema,
    annotations: write("Commit Transaction"),
    requiredScopes: ["write"],
    handler: (_params: unknown, _context: RequestContext) => {
      try {
        adapter.commitTransaction();

        return Promise.resolve({
          success: true,
          message: "Transaction committed",
        });
      } catch (error: unknown) {
        return Promise.resolve(formatHandlerError(error));
      }
    },
  };
}

/**
 * Rollback transaction
 */
function createRollbackTransactionTool(
  adapter: NativeSqliteAdapter,
): ToolDefinition {
  return {
    name: "sqlite_transaction_rollback",
    description: "Rollback the current transaction, discarding all changes.",
    group: "transactions",
    outputSchema: TransactionRollbackOutputSchema,
    inputSchema: z.object({}).strict(),
    annotations: write("Rollback Transaction"),
    requiredScopes: ["write"],
    handler: (_params: unknown, _context: RequestContext) => {
      try {
        adapter.rollbackTransaction();

        return Promise.resolve({
          success: true,
          message: "Transaction rolled back",
        });
      } catch (error: unknown) {
        return Promise.resolve(formatHandlerError(error));
      }
    },
  };
}

/**
 * Create savepoint
 */
function createSavepointTool(adapter: NativeSqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_transaction_savepoint",
    description:
      "Create a savepoint within the current transaction for partial rollback.",
    group: "transactions",
    outputSchema: TransactionSavepointOutputSchema,
    inputSchema: SavepointSchema,
    annotations: write("Create Savepoint"),
    requiredScopes: ["write"],
    handler: (params: unknown, _context: RequestContext) => {
      try {
        const input = SavepointSchema.parse(params);
        //       const queryParams: unknown[] = [];

        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.name)) {
          return Promise.resolve(
            formatHandlerError(
              new ValidationError(
                `Invalid savepoint name '${input.name}': must start with a letter or underscore and contain only alphanumeric characters`,
              ),
            ),
          );
        }

        adapter.savepoint(input.name);

        return Promise.resolve({
          success: true,
          message: `Savepoint '${input.name}' created`,
          savepoint: input.name,
        });
      } catch (error: unknown) {
        return Promise.resolve(formatHandlerError(error));
      }
    },
  };
}

/**
 * Release savepoint
 */
function createReleaseSavepointTool(
  adapter: NativeSqliteAdapter,
): ToolDefinition {
  return {
    name: "sqlite_transaction_release",
    description:
      "Release a savepoint, keeping the changes made since it was created.",
    group: "transactions",
    inputSchema: SavepointSchema,
    outputSchema: TransactionReleaseOutputSchema,
    annotations: write("Release Savepoint"),
    requiredScopes: ["write"],
    handler: (params: unknown, _context: RequestContext) => {
      try {
        const input = SavepointSchema.parse(params);
        //       const queryParams: unknown[] = [];

        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.name)) {
          return Promise.resolve(
            formatHandlerError(
              new ValidationError(
                `Invalid savepoint name '${input.name}': must start with a letter or underscore and contain only alphanumeric characters`,
              ),
            ),
          );
        }

        adapter.releaseSavepoint(input.name);

        return Promise.resolve({
          success: true,
          message: `Savepoint '${input.name}' released`,
          savepoint: input.name,
        });
      } catch (error: unknown) {
        return Promise.resolve(formatHandlerError(error));
      }
    },
  };
}

/**
 * Rollback to savepoint
 */
function createRollbackToSavepointTool(
  adapter: NativeSqliteAdapter,
): ToolDefinition {
  return {
    name: "sqlite_transaction_rollback_to",
    description:
      "Rollback to a savepoint, discarding changes made after it was created.",
    group: "transactions",
    inputSchema: SavepointSchema,
    outputSchema: TransactionRollbackToOutputSchema,
    annotations: write("Rollback to Savepoint"),
    requiredScopes: ["write"],
    handler: (params: unknown, _context: RequestContext) => {
      try {
        const input = SavepointSchema.parse(params);
        //       const queryParams: unknown[] = [];

        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.name)) {
          return Promise.resolve(
            formatHandlerError(
              new ValidationError(
                `Invalid savepoint name '${input.name}': must start with a letter or underscore and contain only alphanumeric characters`,
              ),
            ),
          );
        }

        adapter.rollbackToSavepoint(input.name);

        return Promise.resolve({
          success: true,
          message: `Rolled back to savepoint '${input.name}'`,
          savepoint: input.name,
        });
      } catch (error: unknown) {
        return Promise.resolve(formatHandlerError(error));
      }
    },
  };
}

/**
 * Execute multiple statements in a transaction
 */
function createExecuteInTransactionTool(
  adapter: NativeSqliteAdapter,
): ToolDefinition {
  return {
    name: "sqlite_transaction_execute",
    description:
      "Execute multiple SQL statements in a single transaction. Automatically commits on success or rolls back on error.",
    group: "transactions",
    outputSchema: TransactionExecuteOutputSchema,
    inputSchema: ExecuteInTransactionSchema,
    annotations: write("Execute in Transaction"),
    requiredScopes: ["write"],
    handler: async (params: unknown, _context: RequestContext) => {
      const queryParams: unknown[] = [];
      let input;
      try {
        input = ExecuteInTransactionSchema.parse(params);
        if (input.statements.length === 0) {
          throw new ValidationError("Must provide at least one SQL statement");
        }
      } catch (error: unknown) {
        const errObj = formatHandlerError(error);
        return {
          ...errObj,
          message: errObj.error || "Transaction execution failed",
          statementsExecuted: 0,
          results: [],
        };
      }

      const results: {
        statement: string;
        rowsAffected?: number;
        rowCount?: number;
        rows?: Record<string, unknown>[];
        error?: string;
      }[] = [];
      let success = true;

      let transactionStarted = false;
      const db = adapter.getDatabase();
      const originallyInTransaction = db.inTransaction;

      try {
        if (!originallyInTransaction) {
          adapter.beginTransaction();
          transactionStarted = true;
        }

        for (const statement of input.statements) {
          try {
            // Detect SELECT statements to return row data
            const isSelect = statement
              .trim()
              .toUpperCase()
              .startsWith("SELECT");

            if (isSelect) {
              const result = await adapter.executeReadQuery(
                statement,
                queryParams,
              );
              const rowCount = result.rows?.length ?? 0;
              const statementResult: {
                statement: string;
                rowCount: number;
                rows?: Record<string, unknown>[];
                error?: string;
              } = {
                statement:
                  statement.substring(0, 100) +
                  (statement.length > 100 ? "..." : ""),
                rowCount,
              };
              if (result.rows) {
                if (result.rows.length > 50) {
                  statementResult.rows = result.rows.slice(0, 50);
                  statementResult.error =
                    "Result truncated to 50 rows. Use sqlite_read_query with LIMIT for larger datasets.";
                } else {
                  statementResult.rows = result.rows;
                }
              }
              results.push(statementResult);
            } else {
              const result = await adapter.executeWriteQuery(
                statement,
                queryParams,
              );
              results.push({
                statement:
                  statement.substring(0, 100) +
                  (statement.length > 100 ? "..." : ""),
                rowsAffected: result.rowsAffected ?? 0,
              });
            }
          } catch (error: unknown) {
            const message =
              error instanceof Error ? error.message : String(error);
            results.push({
              statement:
                statement.substring(0, 100) +
                (statement.length > 100 ? "..." : ""),
              error: message,
            });

            if (input.rollbackOnError) {
              throw error;
            }
            success = false;
          }
        }

        if (transactionStarted) {
          adapter.commitTransaction();
        }

        return {
          success,
          error: success ? undefined : "Transaction completed with errors",
          message: success
            ? "Transaction completed successfully"
            : "Transaction completed with errors",
          statementsExecuted: input.statements.length,
          results,
        };
      } catch (error: unknown) {
        let rollbackFailure: string | undefined;
        if (transactionStarted) {
          try {
            adapter.rollbackTransaction();
          } catch (rbError) {
            rollbackFailure =
              rbError instanceof Error ? rbError.message : String(rbError);
          }
        } else if (originallyInTransaction && input.rollbackOnError) {
          try {
            adapter.rollbackTransaction();
          } catch (rbError) {
            rollbackFailure =
              rbError instanceof Error ? rbError.message : String(rbError);
          }
        }
        const message = error instanceof Error ? error.message : String(error);
        const formatted = formatHandlerError(error);
        let rollbackMessage = `Transaction rolled back: ${message}`;
        if (rollbackFailure) {
          rollbackMessage += ` (rollback error: ${rollbackFailure})`;
        } else if (!transactionStarted && !originallyInTransaction) {
          rollbackMessage = `Transaction failed to start: ${message}`;
        }

        return {
          ...formatted,
          error: formatted.error ?? rollbackMessage,
          message: rollbackMessage,
          statementsExecuted: results.length,
          results,
        };
      }
    },
  };
}
