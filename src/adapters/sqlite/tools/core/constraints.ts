/**
 * List Constraints Tool
 *
 * Aggregates all constraint information for a given table:
 * primary keys, foreign keys, unique indexes, and CHECK constraints.
 */

import type { SqliteAdapter } from "../../sqlite-adapter.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../types/index.js";
import { readOnly } from "../../../../utils/annotations.js";
import {
  formatHandlerError,
  ResourceNotFoundError,
} from "../../../../utils/errors/index.js";
import { sanitizeIdentifier } from "../../../../utils/index.js";
import {
  ListConstraintsSchema,
  ListConstraintsOutputSchema,
} from "../../schemas/core.js";

/**
 * Parse CHECK constraints from a CREATE TABLE DDL string.
 * Extracts inline and table-level CHECK(...) clauses.
 */
function parseCheckConstraints(ddl: string): string[] {
  const checks: string[] = [];
  // Match CHECK(...) — handles nested parentheses one level deep
  const pattern = /CHECK\s*\(([^()]*(?:\([^()]*\)[^()]*)*)\)/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(ddl)) !== null) {
    if (match[1]) {
      checks.push(match[1].trim());
    }
  }
  return checks;
}

export function createListConstraintsTool(
  adapter: SqliteAdapter,
): ToolDefinition {
  return {
    name: "sqlite_list_constraints",
    description:
      "List all constraints for a table: primary key columns, foreign keys, unique indexes, and CHECK constraints. Provides a unified view of table integrity rules.",
    group: "core",
    inputSchema: ListConstraintsSchema,
    outputSchema: ListConstraintsOutputSchema,
    requiredScopes: ["read"],
    annotations: readOnly("List Constraints"),
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const input = ListConstraintsSchema.parse(params);
        const table = sanitizeIdentifier(input.table);

        // Verify table exists
        const tableCheck = await adapter.executeReadQuery(
          `PRAGMA table_info(${table})`,
        );
        if (!tableCheck.rows || tableCheck.rows.length === 0) {
          throw new ResourceNotFoundError(
            `Table '${input.table}' does not exist`,
            "TABLE_NOT_FOUND",
            {
              suggestion:
                "Table not found. Run sqlite_list_tables to see available tables.",
              resourceType: "table",
              resourceName: input.table,
            },
          );
        }

        // 1. Extract primary key columns from PRAGMA table_info
        const primaryKey = (tableCheck.rows ?? [])
          .filter((row) => (row["pk"] as number) > 0)
          .sort((a, b) => (a["pk"] as number) - (b["pk"] as number))
          .map((row) => row["name"] as string);

        // 2. Extract foreign keys from PRAGMA foreign_key_list
        const fkResult = await adapter.executeReadQuery(
          `PRAGMA foreign_key_list(${table})`,
        );
        const foreignKeys = (fkResult.rows ?? []).map((row) => ({
          id: row["id"] as number,
          table: row["table"] as string,
          from: row["from"] as string,
          to: row["to"] as string,
          onUpdate: row["on_update"] as string,
          onDelete: row["on_delete"] as string,
        }));

        // 3. Extract unique indexes via PRAGMA index_list + PRAGMA index_info
        const indexResult = await adapter.executeReadQuery(
          `PRAGMA index_list(${table})`,
        );
        const uniqueIndexes: { name: string; columns: string[] }[] = [];

        for (const indexRow of indexResult.rows ?? []) {
          const isUnique = (indexRow["unique"] as number) === 1;
          if (!isUnique) continue;

          const indexName = indexRow["name"] as string;
          const infoResult = await adapter.executeReadQuery(
            `PRAGMA index_info("${indexName.replace(/"/g, '""')}")`,
          );
          const columns = (infoResult.rows ?? [])
            .sort((a, b) => (a["seqno"] as number) - (b["seqno"] as number))
            .map((row) => row["name"] as string);

          uniqueIndexes.push({ name: indexName, columns });
        }

        // 4. Parse CHECK constraints from DDL
        const ddlResult = await adapter.executeReadQuery(
          "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ? UNION ALL SELECT sql FROM sqlite_temp_master WHERE type = 'table' AND name = ?",
          [input.table, input.table],
        );
        const ddl = (ddlResult.rows?.[0]?.["sql"] as string) ?? "";
        const checkConstraints = parseCheckConstraints(ddl);

        return {
          success: true,
          table: input.table,
          primaryKey,
          foreignKeys,
          uniqueIndexes,
          checkConstraints,
        };
      } catch (error: unknown) {
        return formatHandlerError(error);
      }
    },
  };
}
