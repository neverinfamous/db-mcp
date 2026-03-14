/**
 * Transaction Tools for Native SQLite Adapter
 *
 * Provides transaction control tools for complex multi-statement operations.
 */

import { z } from "zod";
import type { ToolDefinition, RequestContext } from "../../../types/index.js";
import type { NativeSqliteAdapter } from "../native-sqlite-adapter.js";
import { formatHandlerError } from "../../../utils/errors/index.js";

// Schemas
const BeginTransactionSchema = z.object({
  mode: z
    .enum(["deferred", "immediate", "exclusive"])
    .optional()
    .default("deferred")
    .describe(
      "Transaction mode: deferred waits for first write, immediate acquires lock immediately, exclusive blocks all access",
    ),
}).strict();

const SavepointSchema = z.object({
  name: z
    .string()
    .regex(
      /^[a-zA-Z_][a-zA-Z0-9_]*$/,
      "Savepoint name must start with a letter/underscore and contain only alphanumeric chars",
    )
    .describe("Savepoint name"),
}).strict();

const ExecuteInTransactionSchema = z.object({
  statements: z
    .array(z.string())
    .describe("Array of SQL statements to execute in order"),
  rollbackOnError: z
    .boolean()
    .optional()
    .default(true)
    .describe("If true, rollback all changes when any statement fails"),
}).strict();

/**
 * Get all transaction tools
 */
export function getTransactionTools(
  adapter: NativeSqliteAdapter,
): ToolDefinition[] {
  return [
    createBeginTransactionTool(adapter),
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
    group: "admin",
    inputSchema: BeginTransactionSchema,
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
      } catch (error) {
        return formatHandlerError(error);
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
    group: "admin",
    inputSchema: z.object({}).strict(),
    requiredScopes: ["write"],
    handler: (_params: unknown, _context: RequestContext) => {
      try {
        adapter.commitTransaction();

        return Promise.resolve({
          success: true,
          message: "Transaction committed",
        });
      } catch (error) {
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
    group: "admin",
    inputSchema: z.object({}).strict(),
    requiredScopes: ["write"],
    handler: (_params: unknown, _context: RequestContext) => {
      try {
        adapter.rollbackTransaction();

        return Promise.resolve({
          success: true,
          message: "Transaction rolled back",
        });
      } catch (error) {
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
    group: "admin",
    inputSchema: SavepointSchema,
    requiredScopes: ["write"],
    handler: (params: unknown, _context: RequestContext) => {
      try {
        const input = SavepointSchema.parse(params);

        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.name)) {
          return Promise.resolve({
            success: false,
            error: "Invalid savepoint name",
          });
        }

        adapter.savepoint(input.name);

        return Promise.resolve({
          success: true,
          message: `Savepoint '${input.name}' created`,
          savepoint: input.name,
        });
      } catch (error) {
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
    group: "admin",
    inputSchema: SavepointSchema,
    requiredScopes: ["write"],
    handler: (params: unknown, _context: RequestContext) => {
      try {
        const input = SavepointSchema.parse(params);

        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.name)) {
          return Promise.resolve({
            success: false,
            error: "Invalid savepoint name",
          });
        }

        adapter.releaseSavepoint(input.name);

        return Promise.resolve({
          success: true,
          message: `Savepoint '${input.name}' released`,
          savepoint: input.name,
        });
      } catch (error) {
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
    group: "admin",
    inputSchema: SavepointSchema,
    requiredScopes: ["write"],
    handler: (params: unknown, _context: RequestContext) => {
      try {
        const input = SavepointSchema.parse(params);

        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.name)) {
          return Promise.resolve({
            success: false,
            error: "Invalid savepoint name",
          });
        }

        adapter.rollbackToSavepoint(input.name);

        return Promise.resolve({
          success: true,
          message: `Rolled back to savepoint '${input.name}'`,
          savepoint: input.name,
        });
      } catch (error) {
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
    group: "admin",
    inputSchema: ExecuteInTransactionSchema,
    requiredScopes: ["write"],
    handler: async (params: unknown, _context: RequestContext) => {
      let input;
      try {
        input = ExecuteInTransactionSchema.parse(params);
      } catch (error) {
        return {
          success: false,
          message: error instanceof Error ? error.message : String(error),
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

      try {
        adapter.beginTransaction();

        for (const statement of input.statements) {
          try {
            // Detect SELECT statements to return row data
            const isSelect = statement
              .trim()
              .toUpperCase()
              .startsWith("SELECT");

            if (isSelect) {
              const result = await adapter.executeReadQuery(statement);
              const rowCount = result.rows?.length ?? 0;
              const statementResult: {
                statement: string;
                rowCount: number;
                rows?: Record<string, unknown>[];
              } = {
                statement:
                  statement.substring(0, 100) +
                  (statement.length > 100 ? "..." : ""),
                rowCount,
              };
              if (result.rows) {
                statementResult.rows = result.rows;
              }
              results.push(statementResult);
            } else {
              const result = await adapter.executeWriteQuery(statement);
              results.push({
                statement:
                  statement.substring(0, 100) +
                  (statement.length > 100 ? "..." : ""),
                rowsAffected: result.rowsAffected ?? 0,
              });
            }
          } catch (error) {
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

        adapter.commitTransaction();

        return {
          success,
          message: success
            ? "Transaction completed successfully"
            : "Transaction completed with errors",
          statementsExecuted: input.statements.length,
          results,
        };
      } catch (error) {
        adapter.rollbackTransaction();
        const message = error instanceof Error ? error.message : String(error);

        return {
          success: false,
          message: `Transaction rolled back: ${message}`,
          statementsExecuted: results.length,
          results,
        };
      }
    },
  };
}
