import {
  CreateTableOutputSchema,
  DropTableOutputSchema,
} from "../../schemas/core.js";
/**
 * View Management Tools
 *
 * Create, list, and drop views; generate series.
 */

import type { SqliteAdapter } from "../../sqlite-adapter.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../types/index.js";
import {
  readOnly,
  idempotent,
  destructive,
} from "../../../../utils/annotations.js";
import { sanitizeIdentifier } from "../../../../utils/index.js";
import { formatHandlerError } from "../../../../utils/errors/index.js";
import {
  GenerateSeriesOutputSchema,
  ListViewsOutputSchema,
} from "../../schemas/virtual.js";
import { isSpatialiteSystemView } from "../core/index.js";
import {
  GenerateSeriesSchema,
  CreateViewSchema,
  ListViewsSchema,
  DropViewSchema,
} from "../../schemas/virtual.js";

export function createGenerateSeriesTool(
  _adapter: SqliteAdapter,
): ToolDefinition {
  return {
    name: "sqlite_generate_series",
    description:
      "Generate a series of numbers using generate_series() virtual table.",
    group: "admin",
    inputSchema: GenerateSeriesSchema,
    outputSchema: GenerateSeriesOutputSchema,
    requiredScopes: ["read"],
    annotations: readOnly("Generate Series"),
    handler: (params: unknown, _context: RequestContext) => {
      let input;
      
      try {
        input = GenerateSeriesSchema.parse(params);
      } catch (error: unknown) {
        return Promise.resolve({
          ...formatHandlerError(error),
          count: 0,
          values: [],
        });
      }

      // Generate in JS - better-sqlite3 doesn't include SQLITE_ENABLE_SERIES
      const values: number[] = [];
      const limit = Math.min(input.limit ?? 100, 1000);
      for (
        let i = input.start;
        input.step > 0 ? i <= input.stop : i >= input.stop;
        i += input.step
      ) {
        values.push(i);
        if (values.length >= limit) break; // Safety limit
      }

      return Promise.resolve({
        success: true,
        count: values.length,
        values,
      });
    },
  };
}

/**
 * Create a view
 */
export function createCreateViewTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_create_view",
    description: "Create a view based on a SELECT query.",
    group: "admin",
    inputSchema: CreateViewSchema,
    outputSchema: CreateTableOutputSchema,
    requiredScopes: ["write"],
    annotations: idempotent("Create View"),
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const input = CreateViewSchema.parse(params);
//       const queryParams: unknown[] = [];

        // Validate and quote view name
        const viewName = sanitizeIdentifier(input.viewName);

        // Basic validation that it's a SELECT
        if (!input.selectQuery.trim().toUpperCase().startsWith("SELECT")) {
          return {
            success: false,
            error: "View definition must be a SELECT query",
            code: "VALIDATION_ERROR",
            sql: "",
          };
        }

        // SQLite doesn't support CREATE OR REPLACE VIEW
        // Use DROP IF EXISTS + CREATE VIEW pattern instead
        if (input.replace) {
          await adapter.executeQuery(`DROP VIEW IF EXISTS ${viewName}`);
        }
        const sql = `CREATE VIEW ${viewName} AS ${input.selectQuery}`;

        await adapter.executeQuery(sql);

        return {
          success: true,
          message: `View '${input.viewName}' created`,
          sql,
        };
      } catch (error: unknown) {
        return {
          ...formatHandlerError(error),
          message: "",
          sql: "",
        };
      }
    },
  };
}

/**
 * List views
 */
export function createListViewsTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_list_views",
    description: "List all views in the database.",
    group: "admin",
    inputSchema: ListViewsSchema,
    outputSchema: ListViewsOutputSchema,
    requiredScopes: ["read"],
    annotations: readOnly("List Views"),
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const input = ListViewsSchema.parse(params);
      const queryParams: unknown[] = [];

        let sql = `SELECT name, sql FROM sqlite_master WHERE type = 'view'`;
        if (input.pattern) {
          const escapedPattern = input.pattern.replace(/'/g, "''");
          sql += ` AND name LIKE '${escapedPattern}'`;
        }
        sql += ` ORDER BY name`;

        const result = await adapter.executeReadQuery(sql, queryParams);

        let views = (result.rows ?? []).map((row) => ({
          name: typeof row["name"] === "string" ? row["name"] : "",
          sql: typeof row["sql"] === "string" ? row["sql"] : null,
        }));

        // Filter out SpatiaLite system views if requested (default: true)
        if (input.excludeSystemViews) {
          views = views.filter((v) => !isSpatialiteSystemView(v.name));
        }

        return {
          success: true,
          count: views.length,
          views,
        };
      } catch (error: unknown) {
        return {
          ...formatHandlerError(error),
          count: 0,
          views: [],
        };
      }
    },
  };
}

/**
 * Drop a view
 */
export function createDropViewTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_drop_view",
    description: "Drop (delete) a view from the database.",
    group: "admin",
    inputSchema: DropViewSchema,
    outputSchema: DropTableOutputSchema,
    requiredScopes: ["admin"],
    annotations: destructive("Drop View"),
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const input = DropViewSchema.parse(params);
//       const queryParams: unknown[] = [];

        // Validate and quote view name
        const viewName = sanitizeIdentifier(input.viewName);

        // Check if the view exists before dropping
        const escapedName = input.viewName.replace(/'/g, "''");
        const existsResult = await adapter.executeReadQuery(
          `SELECT name FROM sqlite_master WHERE type='view' AND name='${escapedName}'`,
        );
        const viewExists = (existsResult.rows?.length ?? 0) > 0;

        const ifExists = input.ifExists ? "IF EXISTS " : "";
        const sql = `DROP VIEW ${ifExists}${viewName}`;

        await adapter.executeQuery(sql);

        // Return accurate message based on whether view existed
        if (viewExists) {
          return {
            success: true,
            message: `View '${input.viewName}' dropped`,
          };
        } else if (input.ifExists) {
          return {
            success: true,
            message: `View '${input.viewName}' did not exist (no action taken)`,
          };
        }

        return {
          success: true,
          message: `View '${input.viewName}' dropped`,
        };
      } catch (error: unknown) {
        return {
          ...formatHandlerError(error),
          message: "",
        };
      }
    },
  };
}
