/**
 * Trigger Management Tools
 *
 * List, create, and drop database triggers.
 * Parses trigger DDL to extract event type and timing.
 */

import type { SqliteAdapter } from "../../sqlite-adapter.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../types/index.js";
import { readOnly, idempotent, destructive } from "../../../../utils/annotations.js";
import { sanitizeIdentifier } from "../../../../utils/index.js";
import {
  formatHandlerError,
  ValidationError,
} from "../../../../utils/errors/index.js";
import {
  ListTriggersSchema,
  ListTriggersOutputSchema,
  CreateTriggerSchema,
  CreateTriggerOutputSchema,
  DropTriggerSchema,
  DropTriggerOutputSchema,
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

        let tempSql =
          "SELECT name, tbl_name, sql FROM sqlite_temp_master WHERE type = 'trigger'";
        if (input.table) {
          tempSql += " AND tbl_name = ?";
          queryParams.push(input.table);
        }

        sql = `${sql} UNION ALL ${tempSql} ORDER BY tbl_name, name`;

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

/**
 * Create a new trigger
 */
export function createCreateTriggerTool(
  adapter: SqliteAdapter,
): ToolDefinition {
  return {
    name: "sqlite_create_trigger",
    description:
      "Create a database trigger that fires on INSERT, UPDATE, or DELETE events. Supports BEFORE/AFTER/INSTEAD OF timing, column-specific UPDATE triggers, and WHEN conditions. Use for audit trails, updated_at timestamps, FTS5 sync, and data validation.",
    group: "core",
    inputSchema: CreateTriggerSchema,
    outputSchema: CreateTriggerOutputSchema,
    requiredScopes: ["admin"],
    annotations: idempotent("Create Trigger"),
    handler: async (params: unknown, _context: RequestContext) => {
      let input;
      try {
        input = CreateTriggerSchema.parse(params);
      } catch (error) {
        return { ...formatHandlerError(error), sql: "" };
      }

      // Validate trigger name
      try {
        sanitizeIdentifier(input.name);
      } catch {
        return {
          ...formatHandlerError(
            new ValidationError(
              `Invalid trigger name '${input.name}': must be a non-empty string starting with a letter or underscore`,
            ),
          ),
          sql: "",
        };
      }

      // Validate table name
      let quotedTable: string;
      try {
        quotedTable = sanitizeIdentifier(input.table);
      } catch {
        return {
          ...formatHandlerError(
            new ValidationError(
              `Invalid table name '${input.table}': must be a non-empty string starting with a letter or underscore`,
            ),
          ),
          sql: "",
        };
      }

      // Verify table exists
      const tableCheck = await adapter.executeReadQuery(
        `SELECT type FROM sqlite_master WHERE name=? AND type IN ('table', 'view')`,
        [input.table],
      );
      if ((tableCheck.rows?.length ?? 0) === 0) {
        return {
          ...formatHandlerError(
            new ValidationError(
              `Table '${input.table}' does not exist`,
              "TABLE_NOT_FOUND",
              {
                suggestion:
                  "Table not found. Run sqlite_list_tables to see available tables.",
              },
            ),
          ),
          sql: "",
        };
      }

      // INSTEAD OF triggers only work on views
      const targetType = tableCheck.rows?.[0]?.["type"] as string;
      if (input.timing === "INSTEAD OF" && targetType !== "view") {
        return {
          ...formatHandlerError(
            new ValidationError(
              "INSTEAD OF triggers can only be created on views, not tables",
              "SQLITE_LIMITATION",
            ),
          ),
          sql: "",
        };
      }

      // Column-specific triggers only valid for UPDATE
      if (input.columns && input.columns.length > 0 && input.event !== "UPDATE") {
        return {
          ...formatHandlerError(
            new ValidationError(
              "'columns' can only be specified for UPDATE triggers",
              "VALIDATION_ERROR",
            ),
          ),
          sql: "",
        };
      }

      // Validate body is not empty
      if (!input.body.trim()) {
        return {
          ...formatHandlerError(
            new ValidationError("Trigger body cannot be empty"),
          ),
          sql: "",
        };
      }

      try {
        // Build CREATE TRIGGER SQL
        const parts: string[] = ["CREATE"];
        if (input.temporary) parts.push("TEMP");
        parts.push("TRIGGER");
        if (input.ifNotExists) parts.push("IF NOT EXISTS");

        const quotedName = `"${input.name.replace(/"/g, '""')}"`;
        parts.push(quotedName);
        parts.push(input.timing);

        // Event with optional column list
        if (input.columns && input.columns.length > 0) {
          const quotedCols = input.columns.map(
            (c) => `"${c.replace(/"/g, '""')}"`,
          );
          parts.push(`${input.event} OF ${quotedCols.join(", ")}`);
        } else {
          parts.push(input.event);
        }

        parts.push("ON", quotedTable);

        if (input.forEachRow) {
          parts.push("FOR EACH ROW");
        }

        if (input.whenClause) {
          parts.push(`WHEN ${input.whenClause}`);
        }

        parts.push("BEGIN");
        // Ensure body ends with semicolon
        const body = input.body.trim();
        parts.push(body.endsWith(";") ? body : `${body};`);
        parts.push("END");

        const sql = parts.join(" ");
        await adapter.executeQuery(sql);

        return {
          success: true,
          message: `Trigger '${input.name}' created on table '${input.table}'`,
          sql,
        };
      } catch (error) {
        return { ...formatHandlerError(error), sql: "" };
      }
    },
  };
}

/**
 * Drop a trigger
 */
export function createDropTriggerTool(
  adapter: SqliteAdapter,
): ToolDefinition {
  return {
    name: "sqlite_drop_trigger",
    description:
      "Drop (delete) a database trigger. This is irreversible.",
    group: "core",
    inputSchema: DropTriggerSchema,
    outputSchema: DropTriggerOutputSchema,
    requiredScopes: ["admin"],
    annotations: destructive("Drop Trigger"),
    handler: async (params: unknown, _context: RequestContext) => {
      let input;
      try {
        input = DropTriggerSchema.parse(params);
      } catch (error) {
        return formatHandlerError(error);
      }

      // Validate trigger name
      try {
        sanitizeIdentifier(input.name);
      } catch {
        return formatHandlerError(
          new ValidationError(
            `Invalid trigger name '${input.name}': must be a non-empty string starting with a letter or underscore`,
          ),
        );
      }

      // Check if trigger exists
      const triggerCheck = await adapter.executeReadQuery(
        `SELECT 1 FROM sqlite_master WHERE type='trigger' AND name=?`,
        [input.name],
      );
      const triggerExists = (triggerCheck.rows?.length ?? 0) > 0;

      if (!triggerExists) {
        if (input.ifExists) {
          return {
            success: true,
            message: `Trigger '${input.name}' does not exist (no changes made)`,
          };
        }
        return formatHandlerError(
          new ValidationError(
            `Trigger '${input.name}' does not exist`,
            "TRIGGER_NOT_FOUND",
            {
              suggestion:
                "Trigger not found. Run sqlite_list_triggers to see available triggers.",
            },
          ),
        );
      }

      try {
        const quotedName = `"${input.name.replace(/"/g, '""')}"`;
        await adapter.executeQuery(`DROP TRIGGER ${quotedName}`);

        return {
          success: true,
          message: `Trigger '${input.name}' dropped successfully`,
        };
      } catch (error) {
        return formatHandlerError(error);
      }
    },
  };
}

