/**
 * Pragma and Settings Tools
 *
 * SQLite pragma queries, settings management, and data insights.
 */

import { z } from "zod";
import type { SqliteAdapter } from "../../sqlite-adapter.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../types/index.js";
import { admin, readOnly } from "../../../../utils/annotations.js";
import { sanitizeIdentifier } from "../../../../utils/index.js";
import { formatHandlerError } from "../../../../utils/errors/index.js";
import { insightsManager } from "../../../../utils/insights-manager.js";
import {
  PragmaCompileOptionsOutputSchema,
  PragmaDatabaseListOutputSchema,
  PragmaOptimizeOutputSchema,
  PragmaSettingsOutputSchema,
  PragmaTableInfoOutputSchema,
} from "../../output-schemas/index.js";
import {
  PragmaCompileOptionsSchema,
  PragmaOptimizeSchema,
  PragmaSettingsSchema,
  PragmaTableInfoSchema,
  AppendInsightSchema,
  AppendInsightOutputSchema,
} from "./helpers.js";

export function createPragmaCompileOptionsTool(
  adapter: SqliteAdapter,
): ToolDefinition {
  return {
    name: "sqlite_pragma_compile_options",
    description:
      "Get the compile-time options used to build SQLite. Use the filter parameter to reduce output (~50+ options by default).",
    group: "admin",
    inputSchema: PragmaCompileOptionsSchema,
    outputSchema: PragmaCompileOptionsOutputSchema,
    requiredScopes: ["read"],
    annotations: readOnly("Compile Options"),
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const input = PragmaCompileOptionsSchema.parse(params);
        const result = await adapter.executeReadQuery("PRAGMA compile_options");
        let options = (result.rows ?? []).map(
          (r) => r["compile_options"] as string,
        );

        // Apply filter if provided
        if (input.filter) {
          const filterLower = input.filter.toLowerCase();
          options = options.filter((opt) =>
            opt.toLowerCase().includes(filterLower),
          );
        }

        return {
          success: true,
          options,
        };
      } catch (error) {
        return formatHandlerError(error);
      }
    },
  };
}

/**
 * List attached databases
 */
export function createPragmaDatabaseListTool(
  adapter: SqliteAdapter,
): ToolDefinition {
  return {
    name: "sqlite_pragma_database_list",
    description: "List all attached databases.",
    group: "admin",
    inputSchema: z.object({}).strict(),
    outputSchema: PragmaDatabaseListOutputSchema,
    requiredScopes: ["read"],
    annotations: readOnly("Database List"),
    handler: async (_params: unknown, _context: RequestContext) => {
      try {
        const result = await adapter.executeReadQuery("PRAGMA database_list");
        const databases = (result.rows ?? []).map((r) => ({
          seq: r["seq"] as number,
          name: r["name"] as string,
          file: r["file"] as string,
        }));

        // Get the user's configured path
        const configuredPath = adapter.getConfiguredPath();

        // Check if internal path differs from configured path (common in WASM mode)
        // Normalize slashes for comparison — Windows SQLite returns backslashes
        const normalize = (p: string): string => p.replace(/\\/g, "/");
        const mainDb = databases.find((db) => db.name === "main");
        const internalPathDiffers = Boolean(
          mainDb?.file &&
            normalize(mainDb.file) !== normalize(configuredPath),
        );

        return {
          success: true,
          databases,
          configuredPath,
          note: internalPathDiffers
            ? "Internal file paths shown above are WASM virtual filesystem paths. The configuredPath shows the original database location."
            : undefined,
        };
      } catch (error) {
        return formatHandlerError(error);
      }
    },
  };
}

/**
 * Run PRAGMA optimize
 */
export function createPragmaOptimizeTool(
  adapter: SqliteAdapter,
): ToolDefinition {
  return {
    name: "sqlite_pragma_optimize",
    description:
      "Run PRAGMA optimize to improve query performance based on usage patterns.",
    group: "admin",
    inputSchema: PragmaOptimizeSchema,
    outputSchema: PragmaOptimizeOutputSchema,
    requiredScopes: ["admin"],
    annotations: admin("PRAGMA Optimize"),
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const input = PragmaOptimizeSchema.parse(params);
        const start = Date.now();

        const sql =
          input.mask !== undefined
            ? `PRAGMA optimize(${input.mask})`
            : "PRAGMA optimize";
        await adapter.executeQuery(sql);

        const duration = Date.now() - start;

        return {
          success: true,
          message: "Database optimized",
          durationMs: duration,
        };
      } catch (error) {
        return formatHandlerError(error);
      }
    },
  };
}

/**
 * Get or set PRAGMA values
 */
export function createPragmaSettingsTool(
  adapter: SqliteAdapter,
): ToolDefinition {
  return {
    name: "sqlite_pragma_settings",
    description: "Get or set a PRAGMA value.",
    group: "admin",
    inputSchema: PragmaSettingsSchema,
    outputSchema: PragmaSettingsOutputSchema,
    requiredScopes: ["admin"],
    annotations: admin("PRAGMA Settings"),
    handler: async (params: unknown, _context: RequestContext) => {
      let input;
      try {
        input = PragmaSettingsSchema.parse(params);
      } catch (error) {
        return formatHandlerError(error);
      }

      // Validate pragma name (alphanumeric + underscore only)
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.pragma)) {
        return {
          success: false,
          error: "Invalid PRAGMA name",
        };
      }

      try {
        if (input.value !== undefined) {
          // Get old value first
          const oldResult = await adapter.executeReadQuery(
            `PRAGMA ${input.pragma}`,
          );
          const oldValue = oldResult.rows?.[0]?.[input.pragma];

          // Set new value
          await adapter.executeQuery(`PRAGMA ${input.pragma} = ${input.value}`);

          // Verify new value
          const newResult = await adapter.executeReadQuery(
            `PRAGMA ${input.pragma}`,
          );
          const newValue = newResult.rows?.[0]?.[input.pragma];

          return {
            success: true,
            pragma: input.pragma,
            value: newValue,
            oldValue,
            newValue,
          };
        } else {
          // Just read value
          const result = await adapter.executeReadQuery(
            `PRAGMA ${input.pragma}`,
          );
          const value = result.rows?.[0]?.[input.pragma];

          return {
            success: true,
            pragma: input.pragma,
            value,
          };
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        // Unknown PRAGMAs: better-sqlite3 treats them as statements (no cursor),
        // so executeReadQuery throws "does not return data"
        if (msg.includes("does not return data")) {
          return {
            success: false,
            error: `Unknown or write-only PRAGMA: '${input.pragma}'`,
          };
        }
        return formatHandlerError(error);
      }
    },
  };
}

/**
 * Get table column information
 */
export function createPragmaTableInfoTool(
  adapter: SqliteAdapter,
): ToolDefinition {
  return {
    name: "sqlite_pragma_table_info",
    description: "Get detailed column information for a table.",
    group: "admin",
    inputSchema: PragmaTableInfoSchema,
    outputSchema: PragmaTableInfoOutputSchema,
    requiredScopes: ["read"],
    annotations: readOnly("Table Info"),
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const input = PragmaTableInfoSchema.parse(params);

        // Validate and quote table name
        const table = sanitizeIdentifier(input.table);

        const result = await adapter.executeReadQuery(
          `PRAGMA table_info(${table})`,
        );

        const columns = (result.rows ?? []).map((r) => ({
          cid: r["cid"] as number,
          name: r["name"] as string,
          type: r["type"] as string,
          notNull: (r["notnull"] as number) === 1,
          defaultValue: r["dflt_value"],
          pk: r["pk"] as number,
        }));

        // If no columns returned, the table likely doesn't exist
        if (columns.length === 0) {
          return {
            success: false,
            table: input.table,
            columns: [],
            error: `Table '${input.table}' not found or has no columns`,
          };
        }

        return {
          success: true,
          table: input.table,
          columns,
        };
      } catch (error) {
        return {
          ...formatHandlerError(error),
          table: "",
          columns: [],
        };
      }
    },
  };
}

/**
 * Append a business insight to the memo resource
 */
export function createAppendInsightTool(): ToolDefinition {
  return {
    name: "sqlite_append_insight",
    description:
      "Add a business insight to the memo://insights resource. Use this to capture key findings during data analysis.",
    group: "admin",
    inputSchema: AppendInsightSchema,
    outputSchema: AppendInsightOutputSchema,
    requiredScopes: ["write"],
    annotations: admin("Append Insight"),
    handler: (params: unknown, _context: RequestContext) => {
      try {
        const input = AppendInsightSchema.parse(params);

        // Validate non-empty (can't use .min(1) on schema — SDK validates before handler)
        if (!input.insight || input.insight.trim().length === 0) {
          return Promise.resolve({
            success: false,
            error: "Insight must be a non-empty string",
            message: "",
            insightCount: insightsManager.count(),
          });
        }

        insightsManager.append(input.insight);

        return Promise.resolve({
          success: true,
          message: "Insight added to memo",
          insightCount: insightsManager.count(),
        });
      } catch (error) {
        return Promise.resolve({
          ...formatHandlerError(error),
          message: "",
          insightCount: insightsManager.count(),
        });
      }
    },
  };
}
