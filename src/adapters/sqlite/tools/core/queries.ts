/**
 * Core Database Query Tools
 *
 * Read and write query execution.
 */

import type { SqliteAdapter } from "../../sqlite-adapter.js";
import type { ToolDefinition, RequestContext } from "../../../../types/index.js";
import { readOnly, write } from "../../../../utils/annotations.js";
import { formatHandlerError, ValidationError } from "../../../../utils/errors/index.js";
import { ReadQuerySchema, WriteQuerySchema } from "../../types.js";
import {
  ReadQueryOutputSchema,
  WriteQueryOutputSchema,
} from "../../output-schemas/index.js";

/**
 * Execute a read-only SQL query
 */
export function createReadQueryTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_read_query",
    description:
      "Execute a SELECT query on the SQLite database. Returns rows as JSON. Use parameter binding for safety.",
    group: "core",
    inputSchema: ReadQuerySchema,
    outputSchema: ReadQueryOutputSchema,
    requiredScopes: ["read"],
    annotations: readOnly("Read Query"),
    handler: async (params: unknown, _context: RequestContext) => {
      let input: { query: string; params?: unknown[] | undefined };
      try {
        input = ReadQuerySchema.parse(params);
      } catch (error) {
        return {
          ...formatHandlerError(error),
          rowCount: 0,
          rows: [],
        };
      }

      // Reject empty queries
      const trimmedQuery = input.query.trim();
      if (trimmedQuery.length === 0) {
        return {
          ...formatHandlerError(
            new ValidationError(
              "Query cannot be empty. Provide a valid SELECT, PRAGMA, EXPLAIN, or WITH statement.",
            ),
          ),
          rowCount: 0,
          rows: [],
        };
      }

      // Validate statement type: only allow SELECT/PRAGMA/EXPLAIN/WITH
      const trimmedUpper = trimmedQuery.toUpperCase();
      const allowedPrefixes = ["SELECT", "PRAGMA", "EXPLAIN", "WITH"];
      const rejectedPrefixes = [
        "INSERT",
        "UPDATE",
        "DELETE",
        "REPLACE",
        "CREATE",
        "ALTER",
        "DROP",
        "TRUNCATE",
        "VACUUM",
        "REINDEX",
        "ANALYZE",
        "ATTACH",
        "DETACH",
      ];

      const isAllowed = allowedPrefixes.some((p) => trimmedUpper.startsWith(p));
      if (!isAllowed) {
        const rejectedPrefix = rejectedPrefixes.find((p) =>
          trimmedUpper.startsWith(p),
        );
        if (rejectedPrefix) {
          return {
            ...formatHandlerError(
              new ValidationError(
                `Statement type not allowed: ${rejectedPrefix} is not a SELECT query. Use sqlite_write_query for INSERT/UPDATE/DELETE, or appropriate admin tools for DDL.`,
              ),
            ),
            rowCount: 0,
            rows: [],
          };
        }
        // Fall through to let the adapter handle unrecognized statements
      }

      try {
        const result = await adapter.executeReadQuery(
          input.query,
          input.params,
        );

        return {
          success: true,
          rowCount: result.rows?.length ?? 0,
          rows: result.rows,
          executionTimeMs: result.executionTimeMs,
        };
      } catch (error) {
        return {
          ...formatHandlerError(error),
          rowCount: 0,
          rows: [],
        };
      }
    },
  };
}

/**
 * Execute a write SQL query (INSERT, UPDATE, DELETE)
 */
export function createWriteQueryTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_write_query",
    description:
      "Execute an INSERT, UPDATE, or DELETE query. Returns affected row count. Use parameter binding for safety.",
    group: "core",
    inputSchema: WriteQuerySchema,
    outputSchema: WriteQueryOutputSchema,
    requiredScopes: ["write"],
    annotations: write("Write Query"),
    handler: async (params: unknown, _context: RequestContext) => {
      let input: { query: string; params?: unknown[] | undefined };
      try {
        input = WriteQuerySchema.parse(params);
      } catch (error) {
        return {
          ...formatHandlerError(error),
          rowsAffected: 0,
        };
      }

      // Validate statement type: only allow DML statements
      const trimmedUpper = input.query.trim().toUpperCase();
      const allowedPrefixes = [
        "INSERT",
        "UPDATE",
        "DELETE",
        "REPLACE",
        "UPSERT",
      ];
      const rejectedPrefixes = [
        "SELECT",
        "PRAGMA",
        "EXPLAIN",
        "CREATE",
        "ALTER",
        "DROP",
        "TRUNCATE",
        "ATTACH",
        "DETACH",
        "VACUUM",
        "REINDEX",
        "ANALYZE",
      ];

      const isAllowed = allowedPrefixes.some((p) => trimmedUpper.startsWith(p));
      if (!isAllowed) {
        const rejectedPrefix = rejectedPrefixes.find((p) =>
          trimmedUpper.startsWith(p),
        );
        if (rejectedPrefix) {
          return {
            ...formatHandlerError(
              new ValidationError(
                `Statement type not allowed: ${rejectedPrefix} is not a DML statement. Use sqlite_read_query for SELECT, or appropriate admin tools for DDL.`,
              ),
            ),
            rowsAffected: 0,
          };
        }
        return {
          ...formatHandlerError(
            new ValidationError(
              `Unrecognized statement type. sqlite_write_query only accepts INSERT, UPDATE, DELETE, or REPLACE statements.`,
            ),
          ),
          rowsAffected: 0,
        };
      }

      try {
        const result = await adapter.executeWriteQuery(
          input.query,
          input.params,
        );

        return {
          success: true,
          rowsAffected: result.rowsAffected,
          executionTimeMs: result.executionTimeMs,
        };
      } catch (error) {
        return {
          ...formatHandlerError(error),
          rowsAffected: 0,
        };
      }
    },
  };
}
