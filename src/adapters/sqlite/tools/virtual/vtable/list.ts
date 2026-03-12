import { z } from "zod";
import type { SqliteAdapter } from "../../../sqlite-adapter.js";
import type { ToolDefinition, RequestContext } from "../../../../../types/index.js";
import { readOnly } from "../../../../../utils/annotations.js";
import { ErrorResponseFields } from "../../../../../utils/errors/error-response-fields.js";
import { ListVirtualTablesSchema } from "../helpers.js";

export function createListVirtualTablesTool(
  adapter: SqliteAdapter,
): ToolDefinition {
  return {
    name: "sqlite_list_virtual_tables",
    description: "List all virtual tables in the database.",
    group: "admin",
    inputSchema: ListVirtualTablesSchema,
    outputSchema: z.object({
      success: z.boolean(),
      count: z.number(),
      virtualTables: z.array(
        z.object({
          name: z.string(),
          module: z.string(),
          sql: z.string(),
        }),
      ),
    }).extend(ErrorResponseFields.shape),
    requiredScopes: ["read"],
    annotations: readOnly("List Virtual Tables"),
    handler: async (params: unknown, _context: RequestContext) => {
      const input = ListVirtualTablesSchema.parse(params);

      let sql = `SELECT name, sql FROM sqlite_master WHERE type = 'table' AND sql LIKE 'CREATE VIRTUAL TABLE%'`;
      if (input.pattern) {
        sql += ` AND name LIKE '${input.pattern.replace(/'/g, "''")}'`;
      }

      const result = await adapter.executeReadQuery(sql);

      const virtualTables = (result.rows ?? []).map((row) => {
        const sqlStr = typeof row["sql"] === "string" ? row["sql"] : "";
        const match = /USING\s+(\w+)/i.exec(sqlStr);
        return {
          name: typeof row["name"] === "string" ? row["name"] : "",
          module: match?.[1] ?? "unknown",
          sql: sqlStr,
        };
      });

      return {
        success: true,
        count: virtualTables.length,
        virtualTables,
      };
    },
  };
}
