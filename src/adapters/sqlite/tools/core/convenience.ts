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
import { validateWhereClause } from "../../../../utils/where-clause.js";

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
      } catch (error) {
        return { ...formatHandlerError(error), rowsAffected: 0 };
      }

      const validationError = await validateTableExists(adapter, input.table);
      if (validationError) return { ...validationError, rowsAffected: 0 };

      const columns = Object.keys(input.data);
      const values = Object.values(input.data);
      const placeholders = columns.map(() => "?").join(", ");

      let sql = `INSERT INTO "${input.table}" ("${columns.join('", "')}") VALUES (${placeholders})`;
      const queryParams: unknown[] = [...values];

      if (input.conflictColumns.length > 0) {
        const conflictCols = input.conflictColumns
          .map((c: string) => `"${c}"`)
          .join(", ");

        // Determine which columns to update
        const colsToUpdate =
          input.updateColumns !== undefined && input.updateColumns.length > 0
            ? input.updateColumns
            : columns.filter((c) => !input.conflictColumns.includes(c));

        if (colsToUpdate.length > 0) {
          const updateSets = colsToUpdate
            .map((c: string) => `"${c}" = EXCLUDED."${c}"`)
            .join(", ");
          sql += ` ON CONFLICT (${conflictCols}) DO UPDATE SET ${updateSets}`;
        } else {
          sql += ` ON CONFLICT (${conflictCols}) DO NOTHING`;
        }
      } else {
        // Fallback to INSERT OR REPLACE if no conflict columns are provided
        sql = `INSERT OR REPLACE INTO "${input.table}" ("${columns.join('", "')}") VALUES (${placeholders})`;
      }

      if (input.returning !== undefined && input.returning !== false) {
        if (input.returning === true) {
          sql += ` RETURNING *`;
        } else if (
          Array.isArray(input.returning) &&
          input.returning.length > 0
        ) {
          sql += ` RETURNING "${input.returning.join('", "')}"`;
        }
      }

      try {
        const result = await adapter.executeWriteQuery(sql, queryParams);
        return {
          success: true,
          rowsAffected: result.rowsAffected,
          rows: result.rows,
          executionTimeMs: result.executionTimeMs,
        };
      } catch (error) {
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
      let input;
      try {
        const aliasedParams = resolveAliases(params, { tableName: "table" });
        const parsed = BatchInsertSchema.parse(aliasedParams);
        input = {
          ...parsed,
          rows: parsed.rows ?? [],
        };
        if (input.rows.length === 0)
          throw new Error(
            "rows must not be empty. Provide at least one row to insert.",
          );
      } catch (error) {
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

      const queryParams: unknown[] = [];
      const valueGroups: string[] = [];

      for (const row of input.rows) {
        const placeholders = [];
        for (const col of columns) {
          placeholders.push("?");
          queryParams.push(row[col] ?? null);
        }
        valueGroups.push(`(${placeholders.join(", ")})`);
      }

      let sql = `INSERT INTO "${input.table}" ("${columns.join('", "')}") VALUES ${valueGroups.join(", ")}`;

      if (input.returning !== undefined && input.returning !== false) {
        if (input.returning === true) {
          sql += ` RETURNING *`;
        } else if (
          Array.isArray(input.returning) &&
          input.returning.length > 0
        ) {
          sql += ` RETURNING "${input.returning.join('", "')}"`;
        }
      }

      try {
        const result = await adapter.executeWriteQuery(sql, queryParams);
        return {
          success: true,
          rowsAffected: result.rowsAffected,
          rows: result.rows,
          executionTimeMs: result.executionTimeMs,
        };
      } catch (error) {
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
      let input;
      try {
        let aliasedParams = resolveAliases(params, {
          tableName: "table",
          columnName: "column",
        });
        aliasedParams = resolveAliases(aliasedParams, {
          condition: "where",
          filter: "where",
          whereClause: "where",
        });
        const parsed = CountSchema.parse(aliasedParams);
        input = {
          ...parsed,
          where:
            parsed.where ??
            parsed.condition ??
            parsed.filter ??
            parsed.whereClause,
          params: Array.isArray(parsed.params)
            ? parsed.params
            : parsed.params !== undefined && parsed.params !== null
              ? [parsed.params]
              : [],
        };
      } catch (error) {
        return { ...formatHandlerError(error) };
      }

      const validationError = await validateTableExists(adapter, input.table);
      if (validationError) return validationError;

      const column =
        input.column && input.column !== "*" ? `"${input.column}"` : "*";
      const distinctStr = input.distinct && column !== "*" ? "DISTINCT " : "";
      let sql = `SELECT COUNT(${distinctStr}${column}) as count FROM "${input.table}"`;

      if (input.where) {
        validateWhereClause(input.where);
        sql += ` WHERE ${input.where}`;
      }

      try {
        const result = await adapter.executeReadQuery(sql, input.params);
        return {
          success: true,
          count: Number(result.rows?.[0]?.["count"] ?? 0),
        };
      } catch (error) {
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
      let input;
      try {
        let aliasedParams = resolveAliases(params, { tableName: "table" });
        aliasedParams = resolveAliases(aliasedParams, {
          condition: "where",
          filter: "where",
          whereClause: "where",
        });
        const parsed = ExistsSchema.parse(aliasedParams);
        input = {
          ...parsed,
          where:
            parsed.where ??
            parsed.condition ??
            parsed.filter ??
            parsed.whereClause,
          params: Array.isArray(parsed.params)
            ? parsed.params
            : parsed.params !== undefined && parsed.params !== null
              ? [parsed.params]
              : [],
        };
      } catch (error) {
        return { ...formatHandlerError(error) };
      }

      const validationError = await validateTableExists(adapter, input.table);
      if (validationError) return validationError;

      let sql = `SELECT 1 FROM "${input.table}"`;

      if (input.where) {
        validateWhereClause(input.where);
        sql += ` WHERE ${input.where}`;
      }

      sql += " LIMIT 1";

      try {
        const result = await adapter.executeReadQuery(sql, input.params);
        return {
          success: true,
          exists: (result.rows?.length ?? 0) > 0,
        };
      } catch (error) {
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
      let input;
      try {
        const aliasedParams = resolveAliases(params, { tableName: "table" });
        input = TruncateSchema.parse(aliasedParams);
      } catch (error) {
        return { ...formatHandlerError(error), rowsAffected: 0 };
      }

      const validationError = await validateTableExists(adapter, input.table);
      if (validationError) return { ...validationError, rowsAffected: 0 };

      try {
        // SQLite does not have TRUNCATE TABLE. We use DELETE FROM.
        const sql = `DELETE FROM "${input.table}"`;
        const result = await adapter.executeWriteQuery(sql);

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
      } catch (error) {
        return { ...formatHandlerError(error), rowsAffected: 0 };
      }
    },
  };
}
