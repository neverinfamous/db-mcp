/**
 * List Triggers Tool
 *
 * Lists database triggers with optional table-name filtering.
 * Parses trigger DDL to extract event type and timing.
 */

import type { SqliteAdapter } from "../../sqlite-adapter.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../types/index.js";
import { readOnly } from "../../../../utils/annotations.js";
import { formatHandlerError } from "../../../../utils/errors/index.js";
import {
  ListTriggersSchema,
  ListTriggersOutputSchema,
} from "../../schemas/core.js";

/**
 * Parse trigger timing from DDL (BEFORE, AFTER, INSTEAD OF).
 */
function parseTriggerTiming(sql: string): string {
  const upper = sql.toUpperCase();
  if (upper.includes("INSTEAD OF")) return "INSTEAD OF";
  if (upper.includes("BEFORE")) return "BEFORE";
  if (upper.includes("AFTER")) return "AFTER";
  return "UNKNOWN";
}

/**
 * Parse trigger event from DDL (INSERT, UPDATE, DELETE).
 */
function parseTriggerEvent(sql: string): string {
  const upper = sql.toUpperCase();
  if (upper.includes("INSERT")) return "INSERT";
  if (upper.includes("UPDATE")) return "UPDATE";
  if (upper.includes("DELETE")) return "DELETE";
  return "UNKNOWN";
}

export function createListTriggersTool(
  adapter: SqliteAdapter,
): ToolDefinition {
  return {
    name: "sqlite_list_triggers",
    description:
      "List database triggers. Optionally filter by associated table name. Shows trigger name, table, event type (INSERT/UPDATE/DELETE), timing (BEFORE/AFTER/INSTEAD OF), and full SQL definition.",
    group: "core",
    inputSchema: ListTriggersSchema,
    outputSchema: ListTriggersOutputSchema,
    requiredScopes: ["read"],
    annotations: readOnly("List Triggers"),
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const input = ListTriggersSchema.parse(params);

        let sql =
          "SELECT name, tbl_name, sql FROM sqlite_master WHERE type = 'trigger'";
        const queryParams: unknown[] = [];

        if (input.table) {
          sql += " AND tbl_name = ?";
          queryParams.push(input.table);
        }

        sql += " ORDER BY tbl_name, name";

        const result = await adapter.executeReadQuery(sql, queryParams);

        const triggers = (result.rows ?? []).map((row) => {
          const triggerSql = (row["sql"] as string) ?? "";
          return {
            name: row["name"] as string,
            table: row["tbl_name"] as string,
            event: parseTriggerEvent(triggerSql),
            timing: parseTriggerTiming(triggerSql),
            sql: triggerSql,
          };
        });

        return {
          success: true,
          count: triggers.length,
          triggers,
        };
      } catch (error) {
        return formatHandlerError(error);
      }
    },
  };
}
