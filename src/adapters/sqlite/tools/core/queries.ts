import { ReadQuerySchema, WriteQuerySchema } from "../../schemas/core.js";
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
  ConflictError,
} from "../../../../utils/errors/index.js";
import { resolveAliases } from "../../types.js";
import {
  ReadQueryOutputSchema,
  WriteQueryOutputSchema,
} from "../../schemas/core.js";
import { buildProgressContext } from "../../../../utils/progress-utils.js";
import { streamResultRows } from "../../../../utils/stream-utils.js";
import { sanitizeIdentifier } from "../../../../utils/identifiers.js";

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
    annotations: { ...readOnly("Read Query"), idempotentHint: true },
    handler: async (params: unknown, _context: RequestContext) => {
      let input: {
        query: string;
        params?: unknown[] | undefined;
        cursor?: string | undefined;
        stream?: boolean | undefined;
        chunkSize?: number | undefined;
      };
      try {
        input = ReadQuerySchema.parse(resolveAliases(params, { sql: "query" }));
      } catch (error: unknown) {
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
        // Strip comments before checking to prevent bypass
        const sqlWithoutComments = trimmedQuery
          .replace(/--.*$/gm, "")
          .replace(/\/\*[\s\S]*?\*\//g, "");
        // Assignment form (PRAGMA [schema.]name = ...) is always mutating
        if (/^PRAGMA\s+(?:\w+\.)?\w+\s*=/i.test(sqlWithoutComments.trim())) {
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
        // Walk past WITH [RECURSIVE] and each CTE definition to find the main statement.
        let i = 4; // skip "WITH"
        // Skip whitespace
        while (i < trimmedUpper.length && /\s/.test(trimmedUpper[i] ?? "")) i++;
        // Skip optional RECURSIVE
        if (trimmedUpper.startsWith("RECURSIVE", i)) i += 9;

        // Parse each CTE: name [(cols)] AS (body) [, ...]
        let foundMain = false;
        while (i < trimmedUpper.length) {
          // Skip whitespace before CTE name
          while (i < trimmedUpper.length && /\s/.test(trimmedUpper[i] ?? ""))
            i++;
          // Skip CTE name (identifier or quoted)
          while (
            i < trimmedUpper.length &&
            /[A-Z0-9_]/i.test(trimmedQuery[i] ?? "")
          )
            i++;
          // Skip whitespace
          while (i < trimmedUpper.length && /\s/.test(trimmedUpper[i] ?? ""))
            i++;
          // Optional column list in parens
          if (trimmedQuery[i] === "(") {
            let d = 0;
            while (i < trimmedQuery.length) {
              if (trimmedQuery[i] === "(") d++;
              else if (trimmedQuery[i] === ")") {
                d--;
                if (d === 0) {
                  i++;
                  break;
                }
              }
              i++;
            }
          }
          // Skip whitespace before AS
          while (i < trimmedUpper.length && /\s/.test(trimmedUpper[i] ?? ""))
            i++;
          // Expect AS keyword
          if (!trimmedUpper.startsWith("AS", i)) break;
          i += 2;
          // Skip whitespace before CTE body
          while (i < trimmedUpper.length && /\s/.test(trimmedUpper[i] ?? ""))
            i++;
          // Skip CTE body (balanced parens)
          if (trimmedQuery[i] === "(") {
            let d = 0;
            while (i < trimmedQuery.length) {
              if (trimmedQuery[i] === "(") d++;
              else if (trimmedQuery[i] === ")") {
                d--;
                if (d === 0) {
                  i++;
                  break;
                }
              }
              i++;
            }
          }
          // Skip whitespace after CTE body
          while (i < trimmedUpper.length && /\s/.test(trimmedUpper[i] ?? ""))
            i++;
          // Another CTE?
          if (trimmedQuery[i] === ",") {
            i++;
            continue;
          }
          // No more CTEs — remainder is the main statement
          foundMain = true;
          break;
        }

        if (!foundMain) {
          isAllowed = false;
        } else {
          const mainStmt = trimmedUpper.slice(i).trim();
          if (
            !mainStmt.startsWith("SELECT") &&
            !mainStmt.startsWith("EXPLAIN")
          ) {
            isAllowed = false;
          }
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
          ...formatHandlerError(
            new ValidationError(message, "VALIDATION_ERROR", {
              suggestion:
                "Check your query syntax. For DML or DDL operations, use sqlite_write_query or appropriate admin tools.",
              details: {},
            }),
          ),
          rowCount: 0,
          rows: [],
        };
      }

      try {
        // Normalize: strip trailing whitespace and semicolons so appending
        // LIMIT won't produce invalid SQL like "SELECT ...; LIMIT 1000".
        let finalQuery = input.query.replace(/[\s;]+$/g, "");

        let offset = 0;
        if (input.cursor) {
          try {
            const cursorData = JSON.parse(
              Buffer.from(input.cursor, "base64").toString("utf8"),
            ) as Record<string, unknown>;
            if (typeof cursorData["offset"] === "number") {
              offset = cursorData["offset"];
            }
          } catch {
            return {
              ...formatHandlerError(
                new ValidationError(
                  "Invalid cursor format",
                  "VALIDATION_ERROR",
                  {
                    suggestion:
                      "Use the nextCursor value returned from a previous query.",
                    details: {},
                  },
                ),
              ),
              rowCount: 0,
              rows: [],
            };
          }
        }

        // Inject a safety limit if none is provided to prevent OOM or event loop blocking
        // on massive tables, especially critical for the WASM backend.
        // Only apply to SELECT/WITH — PRAGMA and EXPLAIN don't support LIMIT.
        const upperForLimit = finalQuery.toUpperCase();
        const isLimitable =
          upperForLimit.startsWith("SELECT") ||
          upperForLimit.startsWith("WITH");

        const limit = 50;
        const hasLimit = /\bLIMIT\b/i.test(finalQuery);
        if (isLimitable && !hasLimit) {
          finalQuery = `${finalQuery} LIMIT ${limit}`;
          if (offset > 0) {
            finalQuery = `${finalQuery} OFFSET ${offset}`;
          }
        } else if (isLimitable && hasLimit && offset > 0) {
          // Query already has LIMIT, just append OFFSET if it doesn't have one
          if (!/\bOFFSET\b/i.test(finalQuery)) {
            finalQuery = `${finalQuery} OFFSET ${offset}`;
          }
        }

        const result = await adapter.executeReadQuery(finalQuery, input.params);

        let nextCursor: string | undefined;
        // If we didn't have a LIMIT originally, and we got 50 rows, there might be more
        if (isLimitable && !hasLimit && result.rows?.length === limit) {
          const nextOffset = offset + limit;
          nextCursor = Buffer.from(
            JSON.stringify({ offset: nextOffset }),
          ).toString("base64");
        }

        // Handle streaming if requested and a progressToken is available
        if (input.stream) {
          const progressCtx = buildProgressContext(_context);
          if (progressCtx) {
            const chunksEmitted = await streamResultRows(
              progressCtx,
              result.rows ?? [],
              input.chunkSize,
            );
            return {
              success: true,
              rowCount: result.rows?.length ?? 0,
              nextCursor,
              executionTimeMs: result.executionTimeMs,
              streamed: true,
              chunksEmitted,
            };
          }
          // Fall back to returning all rows if progress token isn't available
        }

        return {
          success: true,
          rowCount: result.rows?.length ?? 0,
          rows: result.rows,
          nextCursor,
          executionTimeMs: result.executionTimeMs,
        };
      } catch (error: unknown) {
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
      let input: {
        query: string;
        params?: unknown[] | undefined;
        expectedVersion?: number | undefined;
      };
      try {
        input = WriteQuerySchema.parse(
          resolveAliases(params, { sql: "query" }),
        );
      } catch (error: unknown) {
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
        // Fast O(N) parenthetical stripping to find the main DML keyword
        let stripped = "";
        let depth = 0;
        for (let i = 4; i < trimmedUpper.length; i++) {
          if (trimmedUpper[i] === "(") depth++;
          else if (trimmedUpper[i] === ")") depth--;
          else if (depth === 0) stripped += trimmedUpper[i];
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
                "VALIDATION_ERROR",
                {
                  suggestion: "Use the appropriate tool for this operation.",
                  details: {},
                },
              ),
            ),
            rowsAffected: 0,
          };
        }
        return {
          ...formatHandlerError(
            new ValidationError(
              `Unrecognized statement type. sqlite_write_query only accepts INSERT, UPDATE, DELETE, or REPLACE statements.`,
              "VALIDATION_ERROR",
              {
                suggestion:
                  "Check your query syntax. For SELECT, use sqlite_read_query.",
                details: {},
              },
            ),
          ),
          rowsAffected: 0,
        };
      }

      if (input.expectedVersion === undefined) {
        // Strict Enforcement: Check if any modified table is versioned
        const tables: string[] = [];
        const tableRegex =
          /\b(?:UPDATE|INSERT\s+INTO|DELETE\s+FROM|REPLACE\s+INTO)\s+(?:["'`]?([a-zA-Z0-9_]+)["'`]?)\b/gi;
        let match;
        while ((match = tableRegex.exec(input.query)) !== null) {
          if (match[1]) tables.push(match[1]);
        }

        for (const tableName of tables) {
          try {
            const pragmaCheck = await adapter.executeReadQuery(
              `PRAGMA table_info(${sanitizeIdentifier(tableName)})`,
            );
            const isVersioned = (pragmaCheck.rows ?? []).some(
              (col: Record<string, unknown>) => col["name"] === "_version",
            );
            if (isVersioned) {
              return {
                ...formatHandlerError(
                  new ConflictError(
                    `expectedVersion is required when updating versioned table '${tableName}'`,
                    "CONFLICT_ERROR",
                    {
                      conflictType: "missing_expected_version",
                      suggestion:
                        "Use sqlite_check_version to get the current version, then include expectedVersion in your request.",
                    },
                  ),
                ),
                rowsAffected: 0,
              };
            }
          } catch {
            // Ignore table lookup errors here, they will fail naturally during execution
          }
        }
      }

      try {
        const result = await adapter.executeWriteQuery(
          input.query,
          input.params,
        );

        if (result.rowsAffected === 0 && input.expectedVersion !== undefined) {
          return {
            ...formatHandlerError(
              new ConflictError(
                `Version conflict or row not found. expectedVersion ${input.expectedVersion} was provided but 0 rows were affected.`,
                "CONFLICT_ERROR",
                {
                  conflictType: "version_mismatch_or_not_found",
                  suggestion: "Verify the row exists and the version matches.",
                },
              ),
            ),
            rowsAffected: 0,
          };
        }

        return {
          success: true,
          rowsAffected: result.rowsAffected,
          rows: result.rows,
          executionTimeMs: result.executionTimeMs,
        };
      } catch (error: unknown) {
        return {
          ...formatHandlerError(error),
          rowsAffected: 0,
        };
      }
    },
  };
}
