import type { SqliteAdapter } from "../../../sqlite-adapter.js";
import type { ToolDefinition, RequestContext } from "../../../../../types/index.js";
import { destructive } from "../../../../../utils/annotations.js";
import { sanitizeIdentifier } from "../../../../../utils/index.js";
import { formatHandlerError } from "../../../../../utils/errors/index.js";
import { DropVirtualTableSchema } from "../helpers.js";
import { DropVirtualTableOutputSchema } from "../../../output-schemas/index.js";

export function createDropVirtualTableTool(
  adapter: SqliteAdapter,
): ToolDefinition {
  return {
    name: "sqlite_drop_virtual_table",
    description: "Drop a virtual table.",
    group: "admin",
    inputSchema: DropVirtualTableSchema,
    outputSchema: DropVirtualTableOutputSchema,
    requiredScopes: ["write"],
    annotations: destructive("Drop Virtual Table"),
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const input = DropVirtualTableSchema.parse(params);

        const tableName = sanitizeIdentifier(input.tableName);

        const escapedName = input.tableName.replace(/'/g, "''");
        const existsResult = await adapter.executeReadQuery(
          `SELECT name, sql FROM sqlite_master WHERE type='table' AND name='${escapedName}'`,
        );
        const tableExists =
          existsResult.rows !== undefined && existsResult.rows.length > 0;
        const sqlValue = existsResult.rows?.[0]?.["sql"];
        const isVirtualTable =
          tableExists &&
          typeof sqlValue === "string" &&
          sqlValue.toUpperCase().includes("CREATE VIRTUAL TABLE");

        if (tableExists && !isVirtualTable) {
          return {
            success: false,
            message: `'${input.tableName}' is a regular table, not a virtual table. Use sqlite_drop_table instead.`,
          };
        }

        const sql = input.ifExists
          ? `DROP TABLE IF EXISTS ${tableName}`
          : `DROP TABLE ${tableName}`;

        await adapter.executeWriteQuery(sql);

        if (tableExists) {
          return {
            success: true,
            message: `Dropped virtual table '${input.tableName}'`,
          };
        } else if (input.ifExists) {
          return {
            success: true,
            message: `Virtual table '${input.tableName}' did not exist (no action taken)`,
          };
        } else {
          return {
            success: true,
            message: `Dropped virtual table '${input.tableName}'`,
          };
        }
      } catch (error) {
        return {
          ...formatHandlerError(error),
          message: "",
        };
      }
    },
  };
}
