/**
 * Core Database Query Tools
 *
 * Read and write query execution.
 */

import type { SqliteAdapter } from "../../sqlite-adapter.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../types/index.js";
import { readOnly, write } from "../../../../utils/annotations.js";
import {
  formatHandlerError,
  ValidationError,
} from "../../../../utils/errors/index.js";
import {
  ReadQuerySchema,
  WriteQuerySchema,
  resolveAliases,
} from "../../types.js";
import {
  ReadQueryOutputSchema,
  WriteQueryOutputSchema,
} from "../../output-schemas/index.js";

/**
 * Execute a read-only SQL query
 */
export function createReadQueryTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_read_query",
    description:
      "Execute a SELECT query on the SQLite database. Returns rows as JSON. Use parameter binding for safety.",
    group: "core",
    inputSchema: ReadQuerySchema,
    outputSchema: ReadQueryOutputSchema,
    requiredScopes: ["read"],
    annotations: readOnly("Read Query"),
    handler: async (params: unknown, _context: RequestContext) => {
      let input: { query: string; params?: unknown[] | undefined };
      try {
        input = ReadQuerySchema.parse(resolveAliases(params, { sql: "query" }));
      } catch (error) {
        return {
          ...formatHandlerError(error),
          rowCount: 0,
          rows: [],
        };
      }

      // Reject empty queries
      const trimmedQuery = input.query.trim();
      if (trimmedQuery.length === 0) {
        return {
          ...formatHandlerError(
            new ValidationError(
              "Query cannot be empty. Provide a valid SELECT, PRAGMA, EXPLAIN, or WITH statement.",
            ),
          ),
          rowCount: 0,
          rows: [],
        };
      }

      // Validate statement type: only allow SELECT/PRAGMA/EXPLAIN/WITH
      const trimmedUpper = trimmedQuery.toUpperCase();
      const allowedPrefixes = ["SELECT", "PRAGMA", "EXPLAIN", "WITH"];
      const rejectedPrefixes = [
        "INSERT",
        "UPDATE",
        "DELETE",
        "REPLACE",
        "CREATE",
        "ALTER",
        "DROP",
        "TRUNCATE",
        "VACUUM",
        "REINDEX",
        "ANALYZE",
        "ATTACH",
        "DETACH",
      ];

      // Block mutating PRAGMAs while allowing read-only introspection PRAGMAs
      if (trimmedUpper.startsWith("PRAGMA")) {
        // Assignment form (PRAGMA [schema.]name = ...) is always mutating
        if (/^PRAGMA\s+(?:\w+\.)?\w+\s*=/i.test(trimmedQuery)) {
          return {
            ...formatHandlerError(
              new ValidationError(
                "Mutating PRAGMA not allowed in sqlite_read_query. Use admin tools to change database settings.",
              ),
            ),
            rowCount: 0,
            rows: [],
          };
        }

        // For function-call form PRAGMA [schema.]name(...), only allow known read-only PRAGMAs
        const pragmaMatch = /^PRAGMA\s+(?:\w+\.)?(\w+)\s*\(/i.exec(
          trimmedQuery,
        );
        if (pragmaMatch) {
          const pragmaName = (pragmaMatch[1] ?? "").toLowerCase();
          const readOnlyPragmas = new Set([
            "table_info",
            "table_xinfo",
            "table_list",
            "index_list",
            "index_info",
            "index_xinfo",
            "foreign_key_list",
            "foreign_key_check",
            "collation_list",
            "database_list",
            "compile_options",
            "integrity_check",
            "quick_check",
          ]);
          if (!readOnlyPragmas.has(pragmaName)) {
            return {
              ...formatHandlerError(
                new ValidationError(
                  `PRAGMA ${pragmaName}(...) is not allowed in sqlite_read_query. Only read-only PRAGMAs are permitted. Use admin tools to change database settings.`,
                ),
              ),
              rowCount: 0,
              rows: [],
            };
          }
        }
      }

      let isAllowed = allowedPrefixes.some((p) => trimmedUpper.startsWith(p));

      // CTE safety: WITH can prefix writes (WITH ... INSERT/UPDATE/DELETE).
      // Only allow WITH when the main statement after CTEs is SELECT or EXPLAIN.
      if (isAllowed && trimmedUpper.startsWith("WITH")) {
        // Strip CTEs by finding the last top-level ')' before the main statement
        let depth = 0;
        let mainStart = 0;
        for (let i = 0; i < trimmedQuery.length; i++) {
          if (trimmedQuery[i] === "(") depth++;
          else if (trimmedQuery[i] === ")") {
            depth--;
            if (depth === 0) mainStart = i + 1;
          }
        }
        const mainStmt = trimmedQuery.slice(mainStart).trim().toUpperCase();
        if (!mainStmt.startsWith("SELECT") && !mainStmt.startsWith("EXPLAIN")) {
          isAllowed = false;
        }
      }

      if (!isAllowed) {
        const rejectedPrefix = rejectedPrefixes.find((p) =>
          trimmedUpper.startsWith(p),
        );
        const message = rejectedPrefix
          ? `Statement type not allowed: ${rejectedPrefix} is not a SELECT query. Use sqlite_write_query for INSERT/UPDATE/DELETE, or appropriate admin tools for DDL.`
          : "Statement type not allowed in sqlite_read_query. Only SELECT, PRAGMA, EXPLAIN, or WITH statements are permitted.";
        return {
          ...formatHandlerError(new ValidationError(message)),
          rowCount: 0,
          rows: [],
        };
      }

      try {
        // Normalize: strip trailing whitespace and semicolons so appending
        // LIMIT won't produce invalid SQL like "SELECT ...; LIMIT 1000".
        let finalQuery = input.query.replace(/[\s;]+$/g, "");
        // Inject a safety limit if none is provided to prevent OOM or event loop blocking
        // on massive tables, especially critical for the WASM backend.
        // Only apply to SELECT/WITH — PRAGMA and EXPLAIN don't support LIMIT.
        const upperForLimit = finalQuery.toUpperCase();
        const isLimitable =
          upperForLimit.startsWith("SELECT") ||
          upperForLimit.startsWith("WITH");
        if (isLimitable && !/\bLIMIT\b/i.test(finalQuery)) {
          finalQuery = `${finalQuery} LIMIT 1000`;
        }

        const result = await adapter.executeReadQuery(finalQuery, input.params);

        return {
          success: true,
          rowCount: result.rows?.length ?? 0,
          rows: result.rows,
          executionTimeMs: result.executionTimeMs,
        };
      } catch (error) {
        return {
          ...formatHandlerError(error),
          rowCount: 0,
          rows: [],
        };
      }
    },
  };
}

/**
 * Execute a write SQL query (INSERT, UPDATE, DELETE)
 */
export function createWriteQueryTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_write_query",
    description:
      "Execute an INSERT, UPDATE, or DELETE query. Returns affected row count. Use parameter binding for safety.",
    group: "core",
    inputSchema: WriteQuerySchema,
    outputSchema: WriteQueryOutputSchema,
    requiredScopes: ["write"],
    annotations: write("Write Query"),
    handler: async (params: unknown, _context: RequestContext) => {
      let input: { query: string; params?: unknown[] | undefined };
      try {
        input = WriteQuerySchema.parse(
          resolveAliases(params, { sql: "query" }),
        );
      } catch (error) {
        return {
          ...formatHandlerError(error),
          rowsAffected: 0,
        };
      }

      // Validate statement type: only allow DML statements.
      // Support CTE-prefixed writes (WITH ... INSERT/UPDATE/DELETE/REPLACE).
      const trimmedUpper = input.query.trim().toUpperCase();
      const allowedPrefixes = ["INSERT", "UPDATE", "DELETE", "REPLACE"];
      const rejectedPrefixes = [
        "SELECT",
        "PRAGMA",
        "EXPLAIN",
        "CREATE",
        "ALTER",
        "DROP",
        "TRUNCATE",
        "ATTACH",
        "DETACH",
        "VACUUM",
        "REINDEX",
        "ANALYZE",
      ];

      // For CTE-prefixed queries (WITH ...), look past the CTE preamble
      // to find the main DML keyword. We strip balanced parenthesized groups
      // so inner SELECT/etc. in CTE bodies don't cause false matches.
      let leadingKeyword = /^([A-Z]+)/.exec(trimmedUpper)?.[1] ?? "";
      if (leadingKeyword === "WITH") {
        // Strip balanced parenthesized groups so only top-level keywords remain
        let stripped = trimmedUpper.slice(4);
        let prev = "";
        while (prev !== stripped) {
          prev = stripped;
          stripped = stripped.replace(/\([^()]*\)/g, "");
        }
        const mainMatch =
          /\b(INSERT|UPDATE|DELETE|REPLACE|SELECT|PRAGMA|EXPLAIN|CREATE|ALTER|DROP|TRUNCATE|ATTACH|DETACH|VACUUM|REINDEX|ANALYZE)\b/.exec(
            stripped,
          );
        if (mainMatch) {
          leadingKeyword = mainMatch[1] ?? "";
        }
      }

      const isAllowed = allowedPrefixes.includes(leadingKeyword);
      if (!isAllowed) {
        const rejectedPrefix = rejectedPrefixes.find(
          (p) => p === leadingKeyword,
        );
        if (rejectedPrefix) {
          return {
            ...formatHandlerError(
              new ValidationError(
                `Statement type not allowed: ${rejectedPrefix} is not a DML statement. Use sqlite_read_query for SELECT, or appropriate admin tools for DDL.`,
              ),
            ),
            rowsAffected: 0,
          };
        }
        return {
          ...formatHandlerError(
            new ValidationError(
              `Unrecognized statement type. sqlite_write_query only accepts INSERT, UPDATE, DELETE, or REPLACE statements.`,
            ),
          ),
          rowsAffected: 0,
        };
      }

      try {
        const result = await adapter.executeWriteQuery(
          input.query,
          input.params,
        );

        return {
          success: true,
          rowsAffected: result.rowsAffected,
          executionTimeMs: result.executionTimeMs,
        };
      } catch (error) {
        return {
          ...formatHandlerError(error),
          rowsAffected: 0,
        };
      }
    },
  };
}
