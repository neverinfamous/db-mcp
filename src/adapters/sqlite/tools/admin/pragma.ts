/**
 * Pragma and Settings Tools
 *
 * SQLite pragma queries, settings management, and data insights.
 */

import type { SqliteAdapter } from "../../sqlite-adapter.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../types/index.js";
import { admin, adminFs, idempotent, readOnly, write } from "../../../../utils/annotations.js";
import { sanitizeIdentifier, validateSameDirPath } from "../../../../utils/index.js";
import { formatHandlerError } from "../../../../utils/errors/index.js";
import { insightsManager } from "../../../../utils/insights-manager.js";
import {
  AppendInsightOutputSchema,
  PragmaCompileOptionsOutputSchema,
  PragmaDatabaseListSchema,
  PragmaDatabaseListOutputSchema,
  PragmaOptimizeOutputSchema,
  PragmaSettingsOutputSchema,
  PragmaTableInfoOutputSchema,
  AttachDatabaseOutputSchema,
  DetachDatabaseOutputSchema,
} from "../../schemas/admin.js";
import {
  PragmaCompileOptionsSchema,
  PragmaOptimizeSchema,
  PragmaSettingsSchema,
  PragmaTableInfoSchema,
  AppendInsightSchema,
  AttachDatabaseSchema,
  DetachDatabaseSchema,
} from "../../schemas/admin.js";

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
    handler: async (_params: unknown, _context: RequestContext) => {
      try {
        const input = PragmaCompileOptionsSchema.parse(_params);
      
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
      } catch (error: unknown) {
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
    inputSchema: PragmaDatabaseListSchema,
    outputSchema: PragmaDatabaseListOutputSchema,
    requiredScopes: ["read"],
    annotations: readOnly("Database List"),
    handler: async (_params: unknown, _context: RequestContext) => {
      try {
        const result = await adapter.executeReadQuery("PRAGMA database_list");
        const databases = (result.rows ?? []).map((r) => {
          let fileName = "";
          if (typeof r["file"] === "string") {
            // E-8: Return only basename to prevent server path disclosure
            fileName = r["file"].split(/[\\/]/).pop() ?? "";
          }
          return {
            seq: r["seq"] as number,
            name: r["name"] as string,
            file: fileName,
          };
        });

        // Get the user's configured path
        const configuredPath = adapter.getConfiguredPath();

        // Check if internal path differs from configured path (common in WASM mode)
        // Normalize slashes for comparison — Windows SQLite returns backslashes
        const normalize = (p: string): string => p.replace(/\\/g, "/");
        const mainDb = databases.find((db) => db.name === "main");
        const internalPathDiffers = Boolean(
          mainDb?.file && normalize(mainDb.file) !== normalize(configuredPath),
        );

        return {
          success: true,
          databases,
          note: internalPathDiffers
            ? "Internal file paths shown above are WASM virtual filesystem paths. The actual database is located elsewhere."
            : undefined,
        };
      } catch (error: unknown) {
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
    description: "Run PRAGMA optimize to update query planner statistics",
    group: "admin",
    inputSchema: PragmaOptimizeSchema,
    outputSchema: PragmaOptimizeOutputSchema,
    requiredScopes: ["admin"],
    annotations: idempotent("PRAGMA Optimize"),
    handler: async (_params: unknown, _context: RequestContext) => {
      try {
        const input = PragmaOptimizeSchema.parse(_params);
//       const queryParams: unknown[] = [];
        const start = Date.now();

        const sql =
          input.mask !== undefined
            ? `PRAGMA optimize(${Math.trunc(input.mask)})`
            : "PRAGMA optimize";
        await adapter.executeQuery(sql);

        const duration = Date.now() - start;

        return {
          success: true,
          message: "Database optimized",
          durationMs: duration,
        };
      } catch (error: unknown) {
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
    description: "Get or set a PRAGMA value. WARNING: Do not use modifying PRAGMAs (like writable_schema or foreign_keys) without explicit user consent.",
    group: "admin",
    inputSchema: PragmaSettingsSchema,
    outputSchema: PragmaSettingsOutputSchema,
    requiredScopes: ["admin"],
    annotations: { ...admin("PRAGMA Settings"), openWorldHint: true },
    handler: async (_params: unknown, _context: RequestContext) => {
      let input;
      try {
        input = PragmaSettingsSchema.parse(_params);
      } catch (error: unknown) {
        return formatHandlerError(error);
      }

      // Validate pragma name (alphanumeric + underscore only)
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.pragma)) {
        return {
          success: false,
          error: "Invalid PRAGMA name",
          code: "VALIDATION_ERROR",
        };
      }

      const ALLOWED_WRITE_PRAGMAS = new Set([
        "journal_mode",
        "synchronous",
        "temp_store",
        "mmap_size",
        "page_size",
        "busy_timeout",
        "cache_size",
        "wal_autocheckpoint"
      ]);

      if (input.value !== undefined && !ALLOWED_WRITE_PRAGMAS.has(input.pragma.toLowerCase())) {
        return {
          success: false,
          error: `Mutating PRAGMA '${input.pragma}' is not permitted for security reasons`,
          code: "SECURITY_ERROR"
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
          const safeValue = typeof input.value === 'string' 
            ? `'${input.value.replace(/'/g, "''")}'` 
            : input.value;
          await adapter.executeWriteQuery(
            `PRAGMA ${input.pragma} = ${safeValue}`,
            undefined,
            true,
          );

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
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        // Unknown PRAGMAs: better-sqlite3 treats them as statements (no cursor),
        // so executeReadQuery throws "does not return data"
        if (msg.includes("does not return data")) {
          return {
            success: false,
            error: `Unknown or write-only PRAGMA: '${input.pragma}'`,
            code: "VALIDATION_ERROR",
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
    handler: async (_params: unknown, _context: RequestContext) => {
      try {
        const input = PragmaTableInfoSchema.parse(_params);
//       const queryParams: unknown[] = [];

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
            code: "TABLE_NOT_FOUND",
          };
        }

        return {
          success: true,
          table: input.table,
          columns,
        };
      } catch (error: unknown) {
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
    annotations: write("Append Insight"),
    handler: (_params: unknown, _context: RequestContext) => {
      try {
        const input = AppendInsightSchema.parse(_params);
//       const queryParams: unknown[] = [];

        // Validate non-empty (can't use .min(1) on schema — SDK validates before handler)
        let sanitizedInsight = input.insight.replace(/[<>]/g, "");
        if (sanitizedInsight.length > 500) {
          sanitizedInsight = sanitizedInsight.substring(0, 500) + "...";
        }
        if (!sanitizedInsight || sanitizedInsight.trim().length === 0) {
          return Promise.resolve({
            success: false,
            error: "Insight must be a non-empty string",
            message: "",
            insightCount: insightsManager.count(),
          });
        }

        insightsManager.append(sanitizedInsight);

        return Promise.resolve({
          success: true,
          message: "Insight added to memo",
          insightCount: insightsManager.count(),
        });
      } catch (error: unknown) {
        return Promise.resolve({
          ...formatHandlerError(error),
          message: "",
          insightCount: insightsManager.count(),
        });
      }
    },
  };
}

/**
 * Attach an external database
 */
export function createAttachDatabaseTool(
  adapter: SqliteAdapter,
): ToolDefinition {
  return {
    name: "sqlite_attach_database",
    description:
      "Attach an external SQLite database file under a schema alias. The filepath must be in the same directory as the primary database (security restriction). Use DETACH DATABASE to remove.",
    group: "admin",
    inputSchema: AttachDatabaseSchema,
    outputSchema: AttachDatabaseOutputSchema,
    requiredScopes: ["admin"],
    annotations: adminFs("Attach Database"),
    handler: async (_params: unknown, _context: RequestContext) => {
      try {
        const input = AttachDatabaseSchema.parse(_params);
//       const queryParams: unknown[] = [];

        // Prevent attaching as 'main' or 'temp'
        const aliasLower = input.alias.toLowerCase();
        if (aliasLower === "main" || aliasLower === "temp") {
          return {
            success: false,
            error: `Cannot attach using reserved alias '${input.alias}'`,
            code: "VALIDATION_ERROR",
          };
        }

        // Security: validate filepath is within the same directory as the primary DB
        const pathCheck = validateSameDirPath(
          input.filepath,
          adapter.getConfiguredPath(),
        );
        if (!pathCheck.valid) {
          return {
            success: false,
            error: pathCheck.error,
            code: "SECURITY_ERROR",
          };
        }

        const escapedPath = pathCheck.resolvedPath.replace(/'/g, "''");
        await adapter.executeQuery(
          `ATTACH DATABASE '${escapedPath}' AS "${input.alias.replace(/"/g, '""')}"`,
        );

        return {
          success: true,
          message: `Database attached as '${input.alias}'`,
          alias: input.alias,
          filepath: pathCheck.resolvedPath,
        };
      } catch (error: unknown) {
        return formatHandlerError(error);
      }
    },
  };
}

/**
 * Detach an attached database
 */
export function createDetachDatabaseTool(
  adapter: SqliteAdapter,
): ToolDefinition {
  return {
    name: "sqlite_detach_database",
    description:
      "Detach a previously attached database by its schema alias. Cannot detach 'main' or 'temp'.",
    group: "admin",
    inputSchema: DetachDatabaseSchema,
    outputSchema: DetachDatabaseOutputSchema,
    requiredScopes: ["admin"],
    annotations: admin("Detach Database"),
    handler: async (_params: unknown, _context: RequestContext) => {
      try {
        const input = DetachDatabaseSchema.parse(_params);
//       const queryParams: unknown[] = [];

        const aliasLower = input.alias.toLowerCase();
        if (aliasLower === "main" || aliasLower === "temp") {
          return {
            success: false,
            error: `Cannot detach reserved schema '${input.alias}'`,
            code: "VALIDATION_ERROR",
          };
        }

        await adapter.executeQuery(
          `DETACH DATABASE "${input.alias.replace(/"/g, '""')}"`,
        );

        return {
          success: true,
          message: `Database '${input.alias}' detached`,
          alias: input.alias,
        };
      } catch (error: unknown) {
        return formatHandlerError(error);
      }
    },
  };
}

