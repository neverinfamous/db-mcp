import {
  buildWhereClause,
  sanitizeWhereClause,
} from "../../../../utils/where-clause.js";
/**
 * SQLite Core Tools - Convenience Operations
 *
 * Implements simplified wrappers for common operations:
 * upsert, batch_insert, count, exists, truncate.
 */

import type { SqliteAdapter } from "../../sqlite-adapter.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../types/index.js";
import { readOnly, write, destructive } from "../../../../utils/annotations.js";
import { formatHandlerError } from "../../../../utils/errors/index.js";
import { resolveAliases } from "../../types.js";

import {
  UpsertSchema,
  BatchInsertSchema,
  CountSchema,
  ExistsSchema,
  TruncateSchema,
} from "../../schemas/core.js";
import { validateTableExists } from "./convenience-schemas.js";
import { validateColumnExists } from "../column-validation.js";

import { sanitizeIdentifier } from "../../../../utils/identifiers.js";

import {
  WriteQueryOutputSchema,
  CountOutputSchema,
  ExistsOutputSchema,
} from "../../schemas/core.js";

/**
 * Execute an upsert (INSERT ... ON CONFLICT DO UPDATE)
 */
export function createUpsertTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_upsert",
    description:
      "Insert a row or update it if it already exists (INSERT ON CONFLICT DO UPDATE / INSERT OR REPLACE).",
    group: "core",
    inputSchema: UpsertSchema,
    outputSchema: WriteQueryOutputSchema,
    requiredScopes: ["write"],
    annotations: write("Upsert Data"),
    handler: async (params: unknown, _context: RequestContext) => {
      const queryParams: unknown[] = [];
      let input;
      try {
        const aliasedParams = resolveAliases(params, {
          tableName: "table",
          values: "data",
          conflictColumn: "conflictColumns",
        });
        const parsed = UpsertSchema.parse(aliasedParams);
        input = {
          ...parsed,
          data: parsed.data ?? parsed.values ?? {},
          conflictColumns:
            parsed.conflictColumns !== undefined
              ? Array.isArray(parsed.conflictColumns)
                ? parsed.conflictColumns
                : [parsed.conflictColumns]
              : [],
        };
        if (Object.keys(input.data).length === 0)
          throw new Error("data (or values alias) is required");
      } catch (error: unknown) {
        return { ...formatHandlerError(error), rowsAffected: 0 };
      }

      const validationError = await validateTableExists(adapter, input.table);
      if (validationError) return { ...validationError, rowsAffected: 0 };

      const columns = Object.keys(input.data);
      const values = Object.values(input.data);
      const placeholders = columns.map(() => "?").join(", ");

      const safeTable = sanitizeIdentifier(input.table);
      const safeColumns = columns.map(sanitizeIdentifier);

      let sql = `INSERT INTO ${safeTable} (${safeColumns.join(", ")}) VALUES (${placeholders})`;
      queryParams.push(...values);

      if (input.conflictColumns.length > 0) {
        const conflictCols = input.conflictColumns
          .map(sanitizeIdentifier)
          .join(", ");

        // Determine which columns to update
        const colsToUpdate =
          input.updateColumns !== undefined && input.updateColumns.length > 0
            ? input.updateColumns
            : columns.filter((c) => !input.conflictColumns.includes(c));

        if (colsToUpdate.length > 0) {
          const updateSets = colsToUpdate
            .map(
              (c: string) =>
                `${sanitizeIdentifier(c)} = EXCLUDED.${sanitizeIdentifier(c)}`,
            )
            .join(", ");
          sql += ` ON CONFLICT (${conflictCols}) DO UPDATE SET ${updateSets}`;
        } else {
          sql += ` ON CONFLICT (${conflictCols}) DO NOTHING`;
        }
      } else {
        // Fallback to INSERT OR REPLACE if no conflict columns are provided
        sql = `INSERT OR REPLACE INTO ${safeTable} (${safeColumns.join(", ")}) VALUES (${placeholders})`;
      }

      if (input.returning !== undefined && input.returning !== false) {
        if (input.returning === true) {
          sql += ` RETURNING *`;
        } else if (
          Array.isArray(input.returning) &&
          input.returning.length > 0
        ) {
          const safeReturning = input.returning.map(sanitizeIdentifier);
          sql += ` RETURNING ${safeReturning.join(", ")}`;
        }
      }

      try {
        const result = await adapter.executeWriteQuery(sql, queryParams);
        const response: {
          success: boolean;
          rowsAffected?: number | undefined;
          rows?: Record<string, unknown>[] | undefined;
          executionTimeMs?: number | undefined;
        } = {
          success: true,
          rowsAffected: result.rowsAffected,
          executionTimeMs: result.executionTimeMs,
        };
        if (input.returning !== undefined && input.returning !== false) {
          response.rows = result.rows ?? [];
        }
        return response;
      } catch (error: unknown) {
        return { ...formatHandlerError(error), rowsAffected: 0 };
      }
    },
  };
}

/**
 * Execute a batch insert
 */
export function createBatchInsertTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_batch_insert",
    description: "Insert multiple rows in a single statement.",
    group: "core",
    inputSchema: BatchInsertSchema,
    outputSchema: WriteQueryOutputSchema,
    requiredScopes: ["write"],
    annotations: write("Batch Insert Data"),
    handler: async (params: unknown, _context: RequestContext) => {
      const queryParams: unknown[] = [];
      let input;
      try {
        const aliasedParams = resolveAliases(params, { tableName: "table" });
        const parsed = BatchInsertSchema.parse(aliasedParams);
        input = {
          ...parsed,
          rows: parsed.rows ?? [],
        };
      } catch (error: unknown) {
        return { ...formatHandlerError(error), rowsAffected: 0 };
      }

      const validationError = await validateTableExists(adapter, input.table);
      if (validationError) return { ...validationError, rowsAffected: 0 };

      if (input.rows.length === 0) {
        return { success: true, rowsAffected: 0 };
      }

      // Collect all unique columns across all rows to ensure consistent structure
      const columnSet = new Set<string>();
      for (const row of input.rows) {
        Object.keys(row).forEach((k) => columnSet.add(k));
      }
      const columns = Array.from(columnSet);

      const safeTable = sanitizeIdentifier(input.table);
      const safeColumns = columns.map(sanitizeIdentifier);

      const valueGroups: string[] = [];

      for (const row of input.rows) {
        const placeholders = [];
        for (const col of columns) {
          placeholders.push("?");
          queryParams.push(row[col] ?? null);
        }
        valueGroups.push(`(${placeholders.join(", ")})`);
      }

      let sql = `INSERT INTO ${safeTable} (${safeColumns.join(", ")}) VALUES ${valueGroups.join(", ")}`;

      if (input.returning !== undefined && input.returning !== false) {
        if (input.returning === true) {
          sql += ` RETURNING *`;
        } else if (
          Array.isArray(input.returning) &&
          input.returning.length > 0
        ) {
          const safeReturning = input.returning.map(sanitizeIdentifier);
          sql += ` RETURNING ${safeReturning.join(", ")}`;
        }
      }

      try {
        const result = await adapter.executeWriteQuery(sql, queryParams);
        const response: {
          success: boolean;
          rowsAffected?: number | undefined;
          rows?: Record<string, unknown>[] | undefined;
          executionTimeMs?: number | undefined;
        } = {
          success: true,
          rowsAffected: result.rowsAffected,
          executionTimeMs: result.executionTimeMs,
        };
        if (input.returning !== undefined && input.returning !== false) {
          response.rows = result.rows ?? [];
        }
        return response;
      } catch (error: unknown) {
        return { ...formatHandlerError(error), rowsAffected: 0 };
      }
    },
  };
}

/**
 * Execute a count query
 */
export function createCountTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_count",
    description:
      "Count rows in a table, optionally filtered by a WHERE clause.",
    group: "core",
    inputSchema: CountSchema,
    outputSchema: CountOutputSchema,
    requiredScopes: ["read"],
    annotations: readOnly("Count Rows"),
    handler: async (params: unknown, _context: RequestContext) => {
      const queryParams: unknown[] = [];
      let input;
      try {
        let aliasedParams = resolveAliases(params, {
          tableName: "table",
          columnName: "column",
        });
        aliasedParams = resolveAliases(aliasedParams, {
          condition: "conditions",
          filter: "conditions",
          where: "whereClause",
        });
        input = CountSchema.parse(aliasedParams);
      } catch (error: unknown) {
        return { ...formatHandlerError(error) };
      }

      const validationError = await validateTableExists(adapter, input.table);
      if (validationError) return validationError;

      if (input.column && input.column !== "*") {
        try {
          await validateColumnExists(adapter, input.table, input.column);
        } catch (error: unknown) {
          return formatHandlerError(error);
        }
      }

      const safeTable = sanitizeIdentifier(input.table);
      const column =
        input.column && input.column !== "*"
          ? sanitizeIdentifier(input.column)
          : "*";
      const distinctStr = input.distinct && column !== "*" ? "DISTINCT " : "";
      let sql = `SELECT COUNT(${distinctStr}${column}) as count FROM ${safeTable}`;

      const clauses: string[] = [];
      if (input.whereClause) {
        clauses.push(`(${sanitizeWhereClause(input.whereClause)})`);
      }
      if (input.conditions !== undefined && input.conditions.length > 0) {
        const { sql: whereSql, params: whereParams } = buildWhereClause(
          input.conditions,
          input.whereClause,
        );
        if (whereSql !== "") {
          clauses.push(`(${whereSql})`);
          queryParams.push(...whereParams);
        }
      }
      if (clauses.length > 0) {
        sql += ` WHERE ` + clauses.join(" AND ");
      }

      try {
        const result = await adapter.executeReadQuery(sql, queryParams);
        return {
          success: true,
          count: Number(result.rows?.[0]?.["count"] ?? 0),
        };
      } catch (error: unknown) {
        return formatHandlerError(error);
      }
    },
  };
}

/**
 * Execute an exists query
 */
export function createExistsTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_exists",
    description:
      "Check whether rows exist in a table, optionally filtered by a WHERE clause.",
    group: "core",
    inputSchema: ExistsSchema,
    outputSchema: ExistsOutputSchema,
    requiredScopes: ["read"],
    annotations: readOnly("Check Existence"),
    handler: async (params: unknown, _context: RequestContext) => {
      const queryParams: unknown[] = [];
      let input;
      try {
        let aliasedParams = resolveAliases(params, { tableName: "table" });
        aliasedParams = resolveAliases(aliasedParams, {
          condition: "conditions",
          filter: "conditions",
          where: "whereClause",
        });
        input = ExistsSchema.parse(aliasedParams);
      } catch (error: unknown) {
        return { ...formatHandlerError(error) };
      }

      const validationError = await validateTableExists(adapter, input.table);
      if (validationError) return validationError;

      const safeTable = sanitizeIdentifier(input.table);
      let sql = `SELECT 1 FROM ${safeTable}`;

      const clauses: string[] = [];
      if (input.whereClause) {
        clauses.push(`(${sanitizeWhereClause(input.whereClause)})`);
      }
      if (input.conditions !== undefined && input.conditions.length > 0) {
        const { sql: whereSql, params: whereParams } = buildWhereClause(
          input.conditions,
          input.whereClause,
        );
        if (whereSql !== "") {
          clauses.push(`(${whereSql})`);
          queryParams.push(...whereParams);
        }
      }
      if (clauses.length > 0) {
        sql += ` WHERE ` + clauses.join(" AND ");
      }

      sql += " LIMIT 1";

      try {
        const result = await adapter.executeReadQuery(sql, queryParams);
        return {
          success: true,
          exists: (result.rows?.length ?? 0) > 0,
        };
      } catch (error: unknown) {
        return formatHandlerError(error);
      }
    },
  };
}

/**
 * Execute a truncate equivalent (DELETE FROM)
 */
export function createTruncateTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_truncate",
    description: "Truncate a table (executes DELETE FROM table).",
    group: "core",
    inputSchema: TruncateSchema,
    outputSchema: WriteQueryOutputSchema,
    requiredScopes: ["write"],
    annotations: destructive("Truncate Table"),
    handler: async (params: unknown, _context: RequestContext) => {
      const queryParams: unknown[] = [];
      let input;
      try {
        const aliasedParams = resolveAliases(params, { tableName: "table" });
        input = TruncateSchema.parse(aliasedParams);
      } catch (error: unknown) {
        return { ...formatHandlerError(error), rowsAffected: 0 };
      }

      const validationError = await validateTableExists(adapter, input.table);
      if (validationError) return { ...validationError, rowsAffected: 0 };

      const safeTable = sanitizeIdentifier(input.table);

      try {
        // SQLite does not have TRUNCATE TABLE. We use DELETE FROM.
        const sql = `DELETE FROM ${safeTable}`;
        const result = await adapter.executeWriteQuery(sql, queryParams);

        if (input.restartIdentity) {
          try {
            await adapter.executeWriteQuery(
              `DELETE FROM sqlite_sequence WHERE name = ?`,
              [input.table],
            );
          } catch {
            // Ignore error if sqlite_sequence doesn't exist
          }
        }

        return {
          success: true,
          rowsAffected: result.rowsAffected,
          executionTimeMs: result.executionTimeMs,
        };
      } catch (error: unknown) {
        return { ...formatHandlerError(error), rowsAffected: 0 };
      }
    },
  };
}
