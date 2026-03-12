/**
 * Virtual Table Extension Tools
 *
 * R*Tree and series table creation.
 */

import { z } from "zod";
import type { SqliteAdapter } from "../../sqlite-adapter.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../types/index.js";
import { idempotent } from "../../../../utils/annotations.js";
import { sanitizeIdentifier } from "../../../../utils/index.js";
import { isModuleAvailable } from "./analysis.js";
import { CreateRtreeTableSchema, CreateSeriesTableSchema } from "./helpers.js";
import { ErrorResponseFields } from "../../../../utils/errors/error-response-fields.js";

export function createRtreeTableTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_create_rtree_table",
    description:
      "Create an R-Tree virtual table for spatial indexing. Supports 2-5 dimensions.",
    group: "admin",
    inputSchema: CreateRtreeTableSchema,
    outputSchema: z.object({
      success: z.boolean(),
      message: z.string(),
      sql: z.string(),
      columns: z.array(z.string()),
    }).extend(ErrorResponseFields.shape),
    requiredScopes: ["write"],
    annotations: idempotent("Create R-Tree Table"),
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const input = CreateRtreeTableSchema.parse(params);

        // Validate table name
        sanitizeIdentifier(input.tableName);

        // Check if rtree module is available
        const rtreeAvailable = await isModuleAvailable(adapter, "rtree");
        if (!rtreeAvailable) {
          return {
            success: false,
            message:
              "R-Tree extension not available. Use a SQLite build with rtree support.",
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
          success: false,
          message: error instanceof Error ? error.message : String(error),
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
    outputSchema: z.object({
      success: z.boolean(),
      message: z.string(),
      rowCount: z.number(),
    }).extend(ErrorResponseFields.shape),
    requiredScopes: ["write"],
    annotations: idempotent("Create Series Table"),
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const input = CreateSeriesTableSchema.parse(params);

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
          success: false,
          message: error instanceof Error ? error.message : String(error),
          rowCount: 0,
        };
      }
    },
  };
}
