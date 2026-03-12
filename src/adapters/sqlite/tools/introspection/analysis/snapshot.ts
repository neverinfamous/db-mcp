/**
 * Schema Snapshot Tool
 *
 * Generate a comprehensive snapshot of the database schema —
 * tables, views, indexes, and triggers — in a single call.
 */

import type { SqliteAdapter } from "../../../sqlite-adapter.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../../types/index.js";
import { readOnly } from "../../../../../utils/annotations.js";
import { formatHandlerErrorResponse } from "../../../../../utils/errors/index.js";
import { z } from "zod";
import { ErrorResponseFields } from "../../../../../utils/errors/error-response-fields.js";

// =============================================================================
// Schemas
// =============================================================================

const SchemaSnapshotSchema = z
  .object({
    sections: z
      .array(z.enum(["tables", "views", "indexes", "triggers"]))
      .optional()
      .describe("Specific sections to include (default: all)"),
    compact: z
      .boolean()
      .optional()
      .describe(
        "Omit column details from tables section for reduced payload (default: false)",
      ),
  })
  .default({});

const SchemaSnapshotOutputSchema = z.object({
  success: z.boolean(),
  snapshot: z
    .object({
      tables: z
        .array(
          z.object({
            name: z.string(),
            columnCount: z.number(),
            rowCount: z.number().optional(),
            columns: z
              .array(
                z.object({
                  name: z.string(),
                  type: z.string(),
                  nullable: z.boolean(),
                  primaryKey: z.boolean(),
                  defaultValue: z.unknown().optional(),
                }),
              )
              .optional(),
          }),
        )
        .optional(),
      views: z
        .array(z.object({ name: z.string(), sql: z.string() }))
        .optional(),
      indexes: z
        .array(
          z.object({
            name: z.string(),
            table: z.string(),
            unique: z.boolean(),
            sql: z.string(),
          }),
        )
        .optional(),
      triggers: z
        .array(
          z.object({
            name: z.string(),
            table: z.string(),
            sql: z.string(),
          }),
        )
        .optional(),
    })
    .optional(),
  stats: z
    .object({
      tables: z.number(),
      views: z.number(),
      indexes: z.number(),
      triggers: z.number(),
    })
    .optional(),
  generatedAt: z.string().optional(),
  error: z.string().optional(),
}).extend(ErrorResponseFields.shape);

// =============================================================================
// Tool Creator
// =============================================================================

export function createSchemaSnapshotTool(
  adapter: SqliteAdapter,
): ToolDefinition {
  return {
    name: "sqlite_schema_snapshot",
    description:
      "Generate a comprehensive snapshot of the database schema — tables, views, indexes, and triggers — in a single call. Useful for understanding an unfamiliar database or diffing schema changes.",
    group: "introspection",
    inputSchema: SchemaSnapshotSchema,
    outputSchema: SchemaSnapshotOutputSchema,
    requiredScopes: ["read"],
    annotations: readOnly("Schema Snapshot"),
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const input = SchemaSnapshotSchema.parse(params);
        const sections = input.sections ?? [
          "tables",
          "views",
          "indexes",
          "triggers",
        ];
        const compact = input.compact ?? false;
        const snapshot: Record<string, unknown> = {};
        const stats = { tables: 0, views: 0, indexes: 0, triggers: 0 };

        if (sections.includes("tables")) {
          // Ensure schema manager is initialized or fallback
          const adapterUnknown = adapter as unknown as Record<string, unknown>;
          const _schemaManager = "schemaManager" in adapterUnknown 
            ? adapterUnknown["schemaManager"] as { getRawTableNames: () => Promise<string[]> } 
            : undefined;
          let tablesList: string[];
          
          if (_schemaManager && typeof _schemaManager.getRawTableNames === "function") {
              tablesList = await _schemaManager.getRawTableNames();
          } else {
              const tablesResult = await adapter.executeReadQuery(
                `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_mcp_%' ORDER BY name`,
              );
              tablesList = (tablesResult.rows ?? []).map((r) => r["name"] as string);
          }
          
          const tables = [];
          for (const tableName of tablesList) {
            const tableEntry: Record<string, unknown> = {
              name: tableName,
            };

            if (!compact) {
              try {
                const colResult = await adapter.executeReadQuery(
                  `PRAGMA table_info("${tableName}")`,
                );
                const columns = (colResult.rows ?? []).map((c) => ({
                  name: c["name"] as string,
                  type: (c["type"] as string) || "TEXT",
                  nullable: (c["notnull"] as number) === 0,
                  primaryKey: (c["pk"] as number) > 0,
                  defaultValue: c["dflt_value"] ?? undefined,
                }));
                tableEntry["columnCount"] = columns.length;
                tableEntry["columns"] = columns;
              } catch {
                tableEntry["columnCount"] = 0;
              }
            } else {
              try {
                const colResult = await adapter.executeReadQuery(
                  `PRAGMA table_info("${tableName}")`,
                );
                tableEntry["columnCount"] = colResult.rows?.length ?? 0;
              } catch {
                tableEntry["columnCount"] = 0;
              }
            }

            tables.push(tableEntry);
          }
          snapshot["tables"] = tables;
          stats.tables = tables.length;
        }

        if (sections.includes("views")) {
          const viewsResult = await adapter.executeReadQuery(
            `SELECT name, sql FROM sqlite_master WHERE type='view' ORDER BY name`,
          );
          const views = (viewsResult.rows ?? []).map((v) => ({
            name: v["name"] as string,
            sql: v["sql"] as string,
          }));
          snapshot["views"] = views;
          stats.views = views.length;
        }

        if (sections.includes("indexes")) {
          const indexResult = await adapter.executeReadQuery(
            `SELECT name, tbl_name, sql FROM sqlite_master WHERE type='index' AND sql IS NOT NULL ORDER BY tbl_name, name`,
          );
          const indexes = (indexResult.rows ?? []).map((idx) => ({
            name: idx["name"] as string,
            table: idx["tbl_name"] as string,
            unique: ((idx["sql"] as string) || "").includes("UNIQUE"),
            sql: idx["sql"] as string,
          }));
          snapshot["indexes"] = indexes;
          stats.indexes = indexes.length;
        }

        if (sections.includes("triggers")) {
          const trigResult = await adapter.executeReadQuery(
            `SELECT name, tbl_name, sql FROM sqlite_master WHERE type='trigger' ORDER BY tbl_name, name`,
          );
          const triggers = (trigResult.rows ?? []).map((t) => ({
            name: t["name"] as string,
            table: t["tbl_name"] as string,
            sql: t["sql"] as string,
          }));
          snapshot["triggers"] = triggers;
          stats.triggers = triggers.length;
        }

        return {
          success: true,
          snapshot,
          stats,
          generatedAt: new Date().toISOString(),
        };
      } catch (error) {
        return formatHandlerErrorResponse(error);
      }
    },
  };
}
