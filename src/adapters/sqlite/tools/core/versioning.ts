import type { SqliteAdapter } from "../../sqlite-adapter.js";
import type { ToolDefinition, RequestContext } from "../../../../types/index.js";
import { readOnly, write } from "../../../../utils/annotations.js";
import { formatHandlerError, ValidationError, ConflictError, ResourceNotFoundError } from "../../../../utils/errors/index.js";
import { sanitizeIdentifier } from "../../../../utils/identifiers.js";
import { buildWhereClause } from "../../../../utils/where-clause.js";
import { validateTableExists } from "./convenience-schemas.js";
import {
  EnableVersioningSchema,
  EnableVersioningOutputSchema,
  DisableVersioningSchema,
  DisableVersioningOutputSchema,
  CheckVersionSchema,
  CheckVersionOutputSchema,
  ConditionalUpdateSchema,
  ConditionalUpdateOutputSchema,
} from "../../schemas/core.js";

/**
 * Enable Optimistic Concurrency Control on a table.
 */
export function createEnableVersioningTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_enable_versioning",
    description: "Enable optimistic concurrency control (OCC) on a table. Adds a _version column and an auto-increment trigger.",
    group: "core",
    inputSchema: EnableVersioningSchema,
    outputSchema: EnableVersioningOutputSchema,
    requiredScopes: ["admin"],
    annotations: write("Enable Versioning"),
    handler: async (params: unknown, _context: RequestContext) => {
      let input;
      try {
        input = EnableVersioningSchema.parse(params);
      } catch (error: unknown) {
        return { ...formatHandlerError(error), sql: "" };
      }

      const validationError = await validateTableExists(adapter, input.table);
      if (validationError) return { ...validationError, sql: "" };

      const safeTable = sanitizeIdentifier(input.table);
      const triggerName = sanitizeIdentifier(`_mcp_version_${input.table}`);

      try {
        // Check if _version already exists
        const pragmaCheck = await adapter.executeReadQuery(`PRAGMA table_info(${safeTable})`);
        const hasVersionColumn = (pragmaCheck.rows ?? []).some((col: Record<string, unknown>) => col["name"] === "_version");

        const statements: string[] = [];
        
        if (!hasVersionColumn) {
          statements.push(`ALTER TABLE ${safeTable} ADD COLUMN _version INTEGER NOT NULL DEFAULT 1;`);
        }

        // Create the trigger
        const triggerSql = `
CREATE TRIGGER IF NOT EXISTS ${triggerName}
BEFORE UPDATE ON ${safeTable}
FOR EACH ROW
BEGIN
  UPDATE ${safeTable} SET _version = OLD._version + 1 WHERE rowid = OLD.rowid;
END;`;
        statements.push(triggerSql.trim());

        for (const stmt of statements) {
          await adapter.executeWriteQuery(stmt);
        }

        const sql = statements.join("\n");

        return {
          success: true,
          message: hasVersionColumn 
            ? `Versioning already active on '${input.table}', trigger ensured.` 
            : `Versioning enabled on '${input.table}'. Added _version column and trigger.`,
          sql,
          alreadyEnabled: hasVersionColumn,
        };
      } catch (error: unknown) {
        return { ...formatHandlerError(error), sql: "" };
      }
    },
  };
}

/**
 * Disable Optimistic Concurrency Control on a table.
 */
export function createDisableVersioningTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_disable_versioning",
    description: "Disable optimistic concurrency control (OCC) on a table. Drops the _version column and its trigger.",
    group: "core",
    inputSchema: DisableVersioningSchema,
    outputSchema: DisableVersioningOutputSchema,
    requiredScopes: ["admin"],
    annotations: write("Disable Versioning"),
    handler: async (params: unknown, _context: RequestContext) => {
      let input;
      try {
        input = DisableVersioningSchema.parse(params);
      } catch (error: unknown) {
        return { ...formatHandlerError(error), sql: "" };
      }

      const safeTable = sanitizeIdentifier(input.table);
      const triggerName = sanitizeIdentifier(`_mcp_version_${input.table}`);

      const tableCheck = await adapter.executeReadQuery(`SELECT 1 FROM pragma_table_list(?) WHERE type IN ('table', 'view') LIMIT 1`, [input.table]);
      if (!tableCheck.rows || tableCheck.rows.length === 0) {
        if (input.ifExists) {
          return { success: true, message: `Table '${input.table}' does not exist (no changes made).`, sql: "" };
        }
        return { ...formatHandlerError(new ValidationError(`Table '${input.table}' does not exist.`)), sql: "" };
      }

      try {
        const pragmaCheck = await adapter.executeReadQuery(`PRAGMA table_info(${safeTable})`);
        const hasVersionColumn = (pragmaCheck.rows ?? []).some((col: Record<string, unknown>) => col["name"] === "_version");

        const statements: string[] = [];
        statements.push(`DROP TRIGGER IF EXISTS ${triggerName};`);
        
        if (hasVersionColumn) {
          statements.push(`ALTER TABLE ${safeTable} DROP COLUMN _version;`);
        }

        for (const stmt of statements) {
          await adapter.executeWriteQuery(stmt);
        }

        const sql = statements.join("\n");

        return {
          success: true,
          message: hasVersionColumn 
            ? `Versioning disabled on '${input.table}'. Dropped _version column and trigger.` 
            : `Versioning already disabled on '${input.table}', trigger dropped if existed.`,
          sql,
        };
      } catch (error: unknown) {
        return { ...formatHandlerError(error), sql: "" };
      }
    },
  };
}

/**
 * Check current version of a row.
 */
export function createCheckVersionTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_check_version",
    description: "Read the current _version of a specific row for optimistic concurrency control.",
    group: "core",
    inputSchema: CheckVersionSchema,
    outputSchema: CheckVersionOutputSchema,
    requiredScopes: ["read"],
    annotations: readOnly("Check Version"),
    handler: async (params: unknown, _context: RequestContext) => {
      let input;
      try {
        input = CheckVersionSchema.parse(params);
      } catch (error: unknown) {
        return formatHandlerError(error);
      }

      const validationError = await validateTableExists(adapter, input.table);
      if (validationError) return validationError;

      const safeTable = sanitizeIdentifier(input.table);
      const safeIdCol = sanitizeIdentifier(input.idColumn ?? "rowid");

      try {
        const sql = `SELECT * FROM ${safeTable} WHERE ${safeIdCol} = ? LIMIT 1`;
        const result = await adapter.executeReadQuery(sql, [input.rowId]);

        if (!result.rows || result.rows.length === 0) {
          return formatHandlerError(new ResourceNotFoundError(`Row not found in table '${input.table}' with ${safeIdCol} = ${input.rowId}`));
        }

        const row = result.rows[0];
        if (row && typeof row["_version"] === "number") {
          return { success: true, version: row["_version"], row };
        } else {
          return formatHandlerError(new ValidationError(`Table '${input.table}' does not appear to have versioning enabled (missing _version column).`));
        }
      } catch (error: unknown) {
        return formatHandlerError(error);
      }
    },
  };
}

/**
 * Conditionally update a row if the version matches.
 */
export function createConditionalUpdateTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_conditional_update",
    description: "Update a row only if its _version matches expectedVersion. Prevents lost updates in multi-agent environments.",
    group: "core",
    inputSchema: ConditionalUpdateSchema,
    outputSchema: ConditionalUpdateOutputSchema,
    requiredScopes: ["write"],
    annotations: write("Conditional Update"),
    handler: async (params: unknown, _context: RequestContext) => {
      let input;
      try {
        input = ConditionalUpdateSchema.parse(params);
      } catch (error: unknown) {
        return formatHandlerError(error);
      }

      const validationError = await validateTableExists(adapter, input.table);
      if (validationError) return validationError;

      const safeTable = sanitizeIdentifier(input.table);
      const columns = Object.keys(input.data);
      if (columns.length === 0) {
        return formatHandlerError(new ValidationError("Update data cannot be empty"));
      }

      if (input.conditions.length === 0) {
        return formatHandlerError(new ValidationError("Conditions are required to identify the row"));
      }

      try {
        const queryParams: unknown[] = [];
        const safeColumns = columns.map(sanitizeIdentifier);
        const setClauses = safeColumns.map(c => `${c} = ?`).join(", ");
        queryParams.push(...Object.values(input.data));

        const { sql: whereSql, params: whereParams } = buildWhereClause(input.conditions);
        queryParams.push(...whereParams);
        
        // Append version guard
        queryParams.push(input.expectedVersion);

        const updateSql = `UPDATE ${safeTable} SET ${setClauses} WHERE (${whereSql}) AND _version = ? RETURNING *`;
        const result = await adapter.executeWriteQuery(updateSql, queryParams);

        if (result.rowsAffected === 0) {
          // Check if row exists at all to differentiate NotFound from Conflict
          const checkSql = `SELECT _version FROM ${safeTable} WHERE ${whereSql}`;
          const checkResult = await adapter.executeReadQuery(checkSql, whereParams);

          if (!checkResult.rows || checkResult.rows.length === 0) {
            return formatHandlerError(new ResourceNotFoundError("Row not found matching the provided conditions"));
          }

          const currentVersionRaw = checkResult.rows[0]?.["_version"];
          if (currentVersionRaw === undefined || currentVersionRaw === null) {
             return formatHandlerError(new ValidationError(`Table '${input.table}' does not appear to have versioning enabled (missing _version column).`));
          }

          const currentVersion = Number(currentVersionRaw);
          return formatHandlerError(new ConflictError(
            `Version conflict: expected version ${input.expectedVersion} but row has version ${currentVersion}. Re-read the row and retry.`,
            "CONFLICT_ERROR",
            {
              conflictType: "version_mismatch",
              suggestion: "Re-read the row to get the current version, then retry the update.",
              details: { table: input.table, expectedVersion: input.expectedVersion, currentVersion }
            }
          ));
        }

        const newRow = result.rows?.[0];
        const currentVersion = newRow ? (newRow["_version"] as number) : undefined;

        return {
          success: true,
          rowsAffected: result.rowsAffected,
          currentVersion,
          rows: result.rows,
        };
      } catch (error: unknown) {
        return formatHandlerError(error);
      }
    },
  };
}
