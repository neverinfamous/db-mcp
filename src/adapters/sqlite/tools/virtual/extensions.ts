/**
 * Virtual Table Extension Tools
 *
 * R*Tree and series table creation.
 */

import type { SqliteAdapter } from "../../sqlite-adapter.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../types/index.js";
import { idempotent } from "../../../../utils/annotations.js";
import { sanitizeIdentifier } from "../../../../utils/index.js";
import { formatHandlerError } from "../../../../utils/errors/index.js";
import { isModuleAvailable } from "./analysis.js";
import { CreateRtreeTableSchema, CreateSeriesTableSchema } from "./helpers.js";
import {
  CreateRtreeTableOutputSchema,
  CreateSeriesTableOutputSchema,
} from "../../output-schemas/index.js";

export function createRtreeTableTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_create_rtree_table",
    description:
      "Create an R-Tree virtual table for spatial indexing. Supports 2-5 dimensions.",
    group: "admin",
    inputSchema: CreateRtreeTableSchema,
    outputSchema: CreateRtreeTableOutputSchema,
    requiredScopes: ["write"],
    annotations: idempotent("Create R-Tree Table"),
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const input = CreateRtreeTableSchema.parse(params);

        // Validate table name
        sanitizeIdentifier(input.tableName);

        // Validate dimensions range (handler-level since schema refinements leak)
        if (input.dimensions < 2 || input.dimensions > 5) {
          return {
            success: false,
            error: `Dimensions must be between 2 and 5, got ${input.dimensions}`,
            code: "VALIDATION_ERROR",
            category: "validation",
            message: "",
            sql: "",
            columns: [],
          };
        }

        // Check if rtree module is available
        const rtreeAvailable = await isModuleAvailable(adapter, "rtree");
        if (!rtreeAvailable) {
          return {
            success: false,
            error:
              "R-Tree extension not available. Use a SQLite build with rtree support.",
            code: "VALIDATION_ERROR",
            category: "validation",
            message: "",
            sql: "",
            columns: [],
            wasmLimitation: true,
          };
        }

        // Build column list based on dimensions
        const columns = [input.idColumn];
        const dimNames = ["X", "Y", "Z", "W", "V"];
        for (let i = 0; i < input.dimensions; i++) {
          const dim = dimNames[i] ?? `D${i}`;
          columns.push(`min${dim}`, `max${dim}`);
        }

        const sql = `CREATE VIRTUAL TABLE "${input.tableName}" USING rtree(${columns.join(", ")})`;
        await adapter.executeWriteQuery(sql);

        return {
          success: true,
          message: `Created R-Tree table '${input.tableName}' with ${input.dimensions} dimensions`,
          sql,
          columns,
        };
      } catch (error) {
        return {
          ...formatHandlerError(error),
          message: "",
          sql: "",
          columns: [],
        };
      }
    },
  };
}

/**
 * Create persistent series table
 */
export function createSeriesTableTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_create_series_table",
    description:
      "Create a table populated with a series of numbers. Unlike generate_series, this creates a persistent table.",
    group: "admin",
    inputSchema: CreateSeriesTableSchema,
    outputSchema: CreateSeriesTableOutputSchema,
    requiredScopes: ["write"],
    annotations: idempotent("Create Series Table"),
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const input = CreateSeriesTableSchema.parse(params);

        // Validate required fields (schema uses .optional() for SDK compatibility)
        if (input.start === undefined || input.stop === undefined) {
          return {
            success: false,
            error: "start and stop are required parameters",
            message: "",
            rowCount: 0,
          };
        }

        // Validate and quote identifiers
        const tableName = sanitizeIdentifier(input.tableName);
        const columnName = sanitizeIdentifier(input.columnName);

        // Create table
        await adapter.executeWriteQuery(
          `CREATE TABLE IF NOT EXISTS ${tableName} (${columnName} INTEGER PRIMARY KEY)`,
        );

        // Insert series using generate_series if available, otherwise loop
        try {
          await adapter.executeWriteQuery(
            `INSERT OR IGNORE INTO ${tableName} (${columnName}) SELECT value FROM generate_series(${input.start}, ${input.stop}, ${input.step})`,
          );
        } catch {
          // Fallback: insert values manually
          const values: number[] = [];
          for (let v = input.start; v <= input.stop; v += input.step) {
            values.push(v);
          }
          if (values.length > 0) {
            const insertValues = values.map((v) => `(${v})`).join(",");
            await adapter.executeWriteQuery(
              `INSERT OR IGNORE INTO ${tableName} (${columnName}) VALUES ${insertValues}`,
            );
          }
        }

        // Count rows
        const countResult = await adapter.executeReadQuery(
          `SELECT COUNT(*) as cnt FROM ${tableName}`,
        );
        const rowCount =
          typeof countResult.rows?.[0]?.["cnt"] === "number"
            ? countResult.rows[0]["cnt"]
            : 0;

        return {
          success: true,
          message: `Created series table '${input.tableName}' with ${rowCount} rows`,
          rowCount,
        };
      } catch (error) {
        return {
          ...formatHandlerError(error),
          message: "",
          rowCount: 0,
        };
      }
    },
  };
}
