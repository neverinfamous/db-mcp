import type { SqliteAdapter } from "../../../sqlite-adapter.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../../types/index.js";
import { readOnly } from "../../../../../utils/annotations.js";
import { sanitizeIdentifier } from "../../../../../utils/index.js";
import { formatHandlerError } from "../../../../../utils/errors/index.js";
import { VirtualTableInfoSchema } from "../helpers.js";
import { VirtualTableInfoOutputSchema } from "../../../output-schemas/index.js";

export function createVirtualTableInfoTool(
  adapter: SqliteAdapter,
): ToolDefinition {
  return {
    name: "sqlite_virtual_table_info",
    description: "Get metadata about a specific virtual table.",
    group: "admin",
    inputSchema: VirtualTableInfoSchema,
    outputSchema: VirtualTableInfoOutputSchema,
    requiredScopes: ["read"],
    annotations: readOnly("Virtual Table Info"),
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const input = VirtualTableInfoSchema.parse(params);

        sanitizeIdentifier(input.tableName);

        const sqlResult = await adapter.executeReadQuery(
          `SELECT sql FROM sqlite_master WHERE type = 'table' AND name = '${input.tableName.replace(/'/g, "''")}' AND sql LIKE 'CREATE VIRTUAL TABLE%'`,
        );

        if (!sqlResult.rows || sqlResult.rows.length === 0) {
          return {
            success: false,
            name: input.tableName,
            module: "unknown",
            sql: "",
            error: `Virtual table '${input.tableName}' not found`,
            code: "TABLE_NOT_FOUND",
          };
        }

        const sqlStr =
          typeof sqlResult.rows[0]?.["sql"] === "string"
            ? sqlResult.rows[0]["sql"]
            : "";
        const match = /USING\s+(\w+)/i.exec(sqlStr);
        const moduleName = match?.[1] ?? "unknown";

        try {
          const colResult = await adapter.executeReadQuery(
            `PRAGMA table_info("${input.tableName}")`,
          );

          const columns = (colResult.rows ?? []).map((row) => ({
            name: typeof row["name"] === "string" ? row["name"] : "",
            type: typeof row["type"] === "string" ? row["type"] : "TEXT",
          }));

          return {
            success: true,
            name: input.tableName,
            module: moduleName,
            moduleAvailable: true,
            columns,
            sql: sqlStr,
          };
        } catch (error) {
          const errMsg = error instanceof Error ? error.message : String(error);
          const isModuleError =
            errMsg.includes("no such module") ||
            errMsg.includes("unknown module");

          if (isModuleError) {
            return {
              success: true,
              name: input.tableName,
              module: moduleName,
              moduleAvailable: false,
              sql: sqlStr,
              note: `Module '${moduleName}' not available in this environment. Column info cannot be retrieved.`,
            };
          }
          throw error;
        }
      } catch (error) {
        return {
          ...formatHandlerError(error),
          name: "",
          module: "unknown",
          sql: "",
        };
      }
    },
  };
}
