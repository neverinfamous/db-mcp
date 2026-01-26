/**
 * SQLite Virtual Table Tools
 *
 * Create and manage virtual tables for CSV, generation, etc.
 * 6 tools total.
 */

import { z } from "zod";
import type { SqliteAdapter } from "../SqliteAdapter.js";
import type { ToolDefinition, RequestContext } from "../../../types/index.js";
import { readOnly, idempotent, destructive, admin } from "../../../utils/annotations.js";

// Virtual table schemas
const GenerateSeriesSchema = z.object({
  start: z.number().describe("Start value"),
  stop: z.number().describe("Stop value"),
  step: z.number().optional().default(1).describe("Step value"),
});

const CreateViewSchema = z.object({
  viewName: z.string().describe("Name of the view"),
  selectQuery: z.string().describe("SELECT query for view definition"),
  replace: z.boolean().optional().default(false),
});

const ListViewsSchema = z.object({
  pattern: z
    .string()
    .optional()
    .describe("Optional LIKE pattern to filter views"),
});

const DropViewSchema = z.object({
  viewName: z.string().describe("Name of the view to drop"),
  ifExists: z.boolean().optional().default(true),
});

const DbStatSchema = z.object({
  table: z.string().optional().describe("Optional table name to filter"),
});

const VacuumSchema = z.object({
  into: z.string().optional().describe("Optional file path to vacuum into"),
});

/**
 * Get all virtual table tools
 */
export function getVirtualTools(adapter: SqliteAdapter): ToolDefinition[] {
  return [
    createGenerateSeriesTool(adapter),
    createCreateViewTool(adapter),
    createListViewsTool(adapter),
    createDropViewTool(adapter),
    createDbStatTool(adapter),
    createVacuumTool(adapter),
  ];
}

/**
 * Generate series of numbers
 */
function createGenerateSeriesTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_generate_series",
    description:
      "Generate a series of numbers using generate_series() virtual table.",
    group: "admin",
    inputSchema: GenerateSeriesSchema,
    requiredScopes: ["read"],
    annotations: readOnly("Generate Series"),
    handler: async (params: unknown, _context: RequestContext) => {
      const input = GenerateSeriesSchema.parse(params);

      // SQLite 3.40+ has built-in generate_series
      // For older versions, we generate in JS
      const sql = `SELECT value FROM generate_series(${input.start}, ${input.stop}, ${input.step})`;

      try {
        const result = await adapter.executeReadQuery(sql);
        return {
          success: true,
          count: result.rows?.length ?? 0,
          values: result.rows?.map((r) => r["value"]),
        };
      } catch {
        // Fallback: generate in JS
        const values: number[] = [];
        for (
          let i = input.start;
          input.step > 0 ? i <= input.stop : i >= input.stop;
          i += input.step
        ) {
          values.push(i);
          if (values.length > 10000) break; // Safety limit
        }
        return {
          success: true,
          count: values.length,
          values,
          note: "Generated in JavaScript (generate_series not available)",
        };
      }
    },
  };
}

/**
 * Create a view
 */
function createCreateViewTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_create_view",
    description: "Create a view based on a SELECT query.",
    group: "admin",
    inputSchema: CreateViewSchema,
    requiredScopes: ["write"],
    annotations: idempotent("Create View"),
    handler: async (params: unknown, _context: RequestContext) => {
      const input = CreateViewSchema.parse(params);

      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.viewName)) {
        throw new Error("Invalid view name");
      }

      // Basic validation that it's a SELECT
      if (!input.selectQuery.trim().toUpperCase().startsWith("SELECT")) {
        throw new Error("View definition must be a SELECT query");
      }

      const createOrReplace = input.replace
        ? "CREATE OR REPLACE VIEW"
        : "CREATE VIEW";
      const sql = `${createOrReplace} "${input.viewName}" AS ${input.selectQuery}`;

      await adapter.executeQuery(sql);

      return {
        success: true,
        message: `View '${input.viewName}' created`,
        sql,
      };
    },
  };
}

/**
 * List views
 */
function createListViewsTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_list_views",
    description: "List all views in the database.",
    group: "admin",
    inputSchema: ListViewsSchema,
    requiredScopes: ["read"],
    annotations: readOnly("List Views"),
    handler: async (params: unknown, _context: RequestContext) => {
      const input = ListViewsSchema.parse(params);

      let sql = `SELECT name, sql FROM sqlite_master WHERE type = 'view'`;
      if (input.pattern) {
        const escapedPattern = input.pattern.replace(/'/g, "''");
        sql += ` AND name LIKE '${escapedPattern}'`;
      }
      sql += ` ORDER BY name`;

      const result = await adapter.executeReadQuery(sql);

      return {
        success: true,
        count: result.rows?.length ?? 0,
        views: result.rows,
      };
    },
  };
}

/**
 * Drop a view
 */
function createDropViewTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_drop_view",
    description: "Drop (delete) a view from the database.",
    group: "admin",
    inputSchema: DropViewSchema,
    requiredScopes: ["admin"],
    annotations: destructive("Drop View"),
    handler: async (params: unknown, _context: RequestContext) => {
      const input = DropViewSchema.parse(params);

      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.viewName)) {
        throw new Error("Invalid view name");
      }

      const ifExists = input.ifExists ? "IF EXISTS " : "";
      const sql = `DROP VIEW ${ifExists}"${input.viewName}"`;

      await adapter.executeQuery(sql);

      return {
        success: true,
        message: `View '${input.viewName}' dropped`,
      };
    },
  };
}

/**
 * Database statistics via dbstat
 */
function createDbStatTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_dbstat",
    description: "Get database storage statistics using dbstat virtual table.",
    group: "admin",
    inputSchema: DbStatSchema,
    requiredScopes: ["read"],
    annotations: readOnly("Database Stats"),
    handler: async (params: unknown, _context: RequestContext) => {
      const input = DbStatSchema.parse(params);

      try {
        let sql = `SELECT name, path, pageno, pagetype, ncell, payload, unused, mx_payload 
                    FROM dbstat`;

        if (input.table) {
          if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.table)) {
            throw new Error("Invalid table name");
          }
          sql += ` WHERE name = '${input.table}'`;
        }

        sql += ` LIMIT 100`;

        const result = await adapter.executeReadQuery(sql);

        return {
          success: true,
          rowCount: result.rows?.length ?? 0,
          stats: result.rows,
        };
      } catch {
        // dbstat may not be available
        // Fallback to basic page count
        const sql = "PRAGMA page_count";
        const result = await adapter.executeReadQuery(sql);

        return {
          success: true,
          pageCount: result.rows?.[0]?.["page_count"],
          note: "dbstat virtual table not available, showing basic stats",
        };
      }
    },
  };
}

/**
 * Vacuum database
 */
function createVacuumTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_vacuum",
    description:
      "Rebuild the database to reclaim space and optimize structure.",
    group: "admin",
    inputSchema: VacuumSchema,
    requiredScopes: ["admin"],
    annotations: admin("Vacuum Database"),
    handler: async (params: unknown, _context: RequestContext) => {
      const input = VacuumSchema.parse(params);

      let sql = "VACUUM";
      if (input.into) {
        // VACUUM INTO creates a compacted copy
        const escapedPath = input.into.replace(/'/g, "''");
        sql = `VACUUM INTO '${escapedPath}'`;
      }

      const start = Date.now();
      await adapter.executeQuery(sql);
      const duration = Date.now() - start;

      return {
        success: true,
        message: input.into
          ? `Database vacuumed into '${input.into}'`
          : "Database vacuumed",
        durationMs: duration,
      };
    },
  };
}
