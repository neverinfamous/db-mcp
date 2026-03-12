/**
 * Vector Storage Tool Implementations
 *
 * Create, store, batch store, and delete vectors.
 */

import type { SqliteAdapter } from "../../sqlite-adapter.js";
import type { ToolDefinition, RequestContext } from "../../../../types/index.js";
import { write, idempotent, destructive } from "../../../../utils/annotations.js";
import { sanitizeIdentifier } from "../../../../utils/index.js";
import { formatHandlerErrorResponse } from "../../../../utils/errors/index.js";
import {
  CreateTableOutputSchema,
  VectorStoreOutputSchema,
  VectorBatchStoreOutputSchema,
  VectorDeleteOutputSchema,
} from "../../output-schemas/index.js";
import {
  VectorStoreSchema,
  VectorCreateTableSchema,
  VectorBatchStoreSchema,
  VectorDeleteSchema,
} from "./schemas.js";

/**
 * Create a table for vector storage
 */
export function createVectorCreateTableTool(
  adapter: SqliteAdapter,
): ToolDefinition {
  return {
    name: "sqlite_vector_create_table",
    description:
      "Create a table optimized for vector storage with JSON vector column.",
    group: "vector",
    inputSchema: VectorCreateTableSchema,
    outputSchema: CreateTableOutputSchema,
    requiredScopes: ["write"],
    annotations: idempotent("Create Vector Table"),
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const input = VectorCreateTableSchema.parse(params);

        if (input.dimensions < 1) {
          return {
            success: false,
            error: "Dimensions must be at least 1",
          };
        }

        // Validate and quote table name
        const tableName = sanitizeIdentifier(input.tableName);

        const columns = [
          "id INTEGER PRIMARY KEY",
          "vector TEXT NOT NULL", // JSON array
          `dimensions INTEGER DEFAULT ${input.dimensions}`,
        ];

        if (input.additionalColumns.length > 0) {
          for (const col of input.additionalColumns) {
            const colName = sanitizeIdentifier(col.name);
            columns.push(`${colName} ${col.type}`);
          }
        }

        const sql = `CREATE TABLE IF NOT EXISTS ${tableName} (${columns.join(", ")})`;

        await adapter.executeQuery(sql);

        return {
          success: true,
          message: `Vector table '${input.tableName}' created with ${input.dimensions} dimensions`,
          sql,
        };
      } catch (error) {
        return formatHandlerErrorResponse(error);
      }
    },
  };
}

/**
 * Validate vector dimensions against table schema.
 * Returns expected dimensions and whether the table has a dimensions column.
 */
async function validateDimensions(
  adapter: SqliteAdapter,
  tableName: string,
  quotedTable: string,
): Promise<{ expectedDims?: number; hasDimsColumn: boolean }> {
  let expectedDims: number | undefined;
  let hasDimsColumn = false;

  // Try DDL-based check first (works even on empty tables)
  const ddlResult = await adapter.executeReadQuery(
    `SELECT sql FROM sqlite_master WHERE type='table' AND name='${tableName}'`,
  );
  const ddlSql = ddlResult.rows?.[0]?.["sql"] as string | undefined;
  if (ddlSql) {
    hasDimsColumn = /\bdimensions\b/i.test(ddlSql);
    const defaultMatch =
      /dimensions\s+INTEGER\s+DEFAULT\s+(\d+)/i.exec(ddlSql);
    if (defaultMatch?.[1]) {
      expectedDims = parseInt(defaultMatch[1], 10);
    }
  }

  // Fallback: check existing row data (only if column exists)
  if (expectedDims === undefined && hasDimsColumn) {
    const dimCheck = await adapter.executeReadQuery(
      `SELECT dimensions FROM ${quotedTable} LIMIT 1`,
    );
    const rowDims = dimCheck.rows?.[0]?.["dimensions"] as
      | number
      | undefined;
    if (rowDims !== undefined && rowDims !== null) {
      expectedDims = rowDims;
    }
  }

  return {
    ...(expectedDims !== undefined ? { expectedDims } : {}),
    hasDimsColumn,
  };
}

/**
 * Store a vector
 */
export function createVectorStoreTool(
  adapter: SqliteAdapter,
): ToolDefinition {
  return {
    name: "sqlite_vector_store",
    description: "Store or update a vector in the database.",
    group: "vector",
    inputSchema: VectorStoreSchema,
    outputSchema: VectorStoreOutputSchema,
    requiredScopes: ["write"],
    annotations: write("Store Vector"),
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const input = VectorStoreSchema.parse(params);

        // Validate and quote identifiers
        const table = sanitizeIdentifier(input.table);
        const idColumn = sanitizeIdentifier(input.idColumn);
        const vectorColumn = sanitizeIdentifier(input.vectorColumn);

        // Validate dimensions against table schema
        let hasDimsColumn = false;
        try {
          const dims = await validateDimensions(adapter, input.table, table);
          hasDimsColumn = dims.hasDimsColumn;

          if (
            dims.expectedDims !== undefined &&
            input.vector.length !== dims.expectedDims
          ) {
            return {
              success: false,
              error: `Dimension mismatch: vector has ${input.vector.length} dimensions but table expects ${dims.expectedDims}`,
              code: "DIMENSION_MISMATCH",
            };
          }
        } catch {
          // Table lacks dimensions column — skip validation
        }

        const vectorJson = JSON.stringify(input.vector);
        const idValue =
          typeof input.id === "string" ? `'${input.id}'` : input.id;

        // Try update first, then insert
        const updateSql = `UPDATE ${table} SET ${vectorColumn} = '${vectorJson}' WHERE ${idColumn} = ${idValue}`;
        const updateResult = await adapter.executeWriteQuery(updateSql);

        if (updateResult.rowsAffected === 0) {
          // Only include dimensions column if the table has it
          const insertSql = hasDimsColumn
            ? `INSERT INTO ${table} (${idColumn}, ${vectorColumn}, dimensions) VALUES (${idValue}, '${vectorJson}', ${input.vector.length})`
            : `INSERT INTO ${table} (${idColumn}, ${vectorColumn}) VALUES (${idValue}, '${vectorJson}')`;
          await adapter.executeWriteQuery(insertSql);
        }

        return {
          success: true,
          id: input.id,
          dimensions: input.vector.length,
        };
      } catch (error) {
        return formatHandlerErrorResponse(error);
      }
    },
  };
}

/**
 * Batch store vectors
 */
export function createVectorBatchStoreTool(
  adapter: SqliteAdapter,
): ToolDefinition {
  return {
    name: "sqlite_vector_batch_store",
    description: "Store multiple vectors in a batch operation.",
    group: "vector",
    inputSchema: VectorBatchStoreSchema,
    outputSchema: VectorBatchStoreOutputSchema,
    requiredScopes: ["write"],
    annotations: write("Batch Store Vectors"),
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const input = VectorBatchStoreSchema.parse(params);

        // Validate table exists before early-returning for empty items
        const table = sanitizeIdentifier(input.table);
        if (input.items.length === 0) {
          // Verify the table exists even with no items to avoid silent success on nonexistent tables
          const checkSql = `SELECT name FROM sqlite_master WHERE type='table' AND name='${input.table}'`;
          const checkResult = await adapter.executeReadQuery(checkSql);
          if (!checkResult.rows || checkResult.rows.length === 0) {
            return {
              success: false,
              error: `Table '${input.table}' does not exist`,
            };
          }
          return {
            success: true,
            stored: 0,
            message: "No items provided",
          };
        }

        const idColumn = sanitizeIdentifier(input.idColumn);
        const vectorColumn = sanitizeIdentifier(input.vectorColumn);

        // Validate dimensions against table schema
        let hasDimsColumn = false;
        try {
          const dims = await validateDimensions(adapter, input.table, table);
          hasDimsColumn = dims.hasDimsColumn;

          if (
            dims.expectedDims !== undefined &&
            input.items[0] &&
            input.items[0].vector.length !== dims.expectedDims
          ) {
            return {
              success: false,
              error: `Dimension mismatch: vectors have ${input.items[0].vector.length} dimensions but table expects ${dims.expectedDims}`,
              code: "DIMENSION_MISMATCH",
            };
          }
        } catch {
          // Table lacks dimensions column — skip validation
        }

        let stored = 0;
        for (const item of input.items) {
          const vectorJson = JSON.stringify(item.vector);
          const idValue =
            typeof item.id === "string" ? `'${item.id}'` : item.id;

          // Only include dimensions column if the table has it
          const sql = hasDimsColumn
            ? `INSERT OR REPLACE INTO ${table} (${idColumn}, ${vectorColumn}, dimensions) VALUES (${idValue}, '${vectorJson}', ${item.vector.length})`
            : `INSERT OR REPLACE INTO ${table} (${idColumn}, ${vectorColumn}) VALUES (${idValue}, '${vectorJson}')`;
          await adapter.executeWriteQuery(sql);
          stored++;
        }

        return {
          success: true,
          stored,
          dimensions: input.items[0]?.vector.length,
        };
      } catch (error) {
        return formatHandlerErrorResponse(error);
      }
    },
  };
}

/**
 * Delete vectors by ID
 */
export function createVectorDeleteTool(
  adapter: SqliteAdapter,
): ToolDefinition {
  return {
    name: "sqlite_vector_delete",
    description: "Delete vectors by their IDs.",
    group: "vector",
    inputSchema: VectorDeleteSchema,
    outputSchema: VectorDeleteOutputSchema,
    requiredScopes: ["write"],
    annotations: destructive("Delete Vectors"),
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const input = VectorDeleteSchema.parse(params);

        // Validate and quote identifiers
        const table = sanitizeIdentifier(input.table);
        const idColumn = sanitizeIdentifier(input.idColumn);

        const idValues = input.ids
          .map((id) => (typeof id === "string" ? `'${id}'` : String(id)))
          .join(", ");

        const sql = `DELETE FROM ${table} WHERE ${idColumn} IN (${idValues})`;
        const result = await adapter.executeWriteQuery(sql);

        return {
          success: true,
          deleted: result.rowsAffected,
        };
      } catch (error) {
        return formatHandlerErrorResponse(error);
      }
    },
  };
}
