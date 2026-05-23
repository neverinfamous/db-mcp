/**
 * Window Function Tools for Native SQLite Adapter
 *
 * Provides window function tools for analytics and ranking operations.
 */

import { z } from "zod";
import type { ToolDefinition, RequestContext } from "../../../types/index.js";
import type { NativeSqliteAdapter } from "../native-sqlite-adapter.js";
import {
  validateWhereClause,
  validateIdentifier,
  sanitizeIdentifier,
} from "../../../utils/index.js";
import {
  formatHandlerError,
  ResourceNotFoundError,
} from "../../../utils/errors/index.js";
import { readOnly } from "../../../utils/annotations.js";
import { resolveAliases } from "../../sqlite/types.js";
import { DbMcpError } from "../../../utils/errors/base.js";
import { ErrorCategory } from "../../../utils/errors/categories.js";
import {
  WindowRowNumberOutputSchema,
  WindowRankOutputSchema,
  WindowLagLeadOutputSchema,
  WindowRunningTotalOutputSchema,
  WindowMovingAvgOutputSchema,
  WindowNtileOutputSchema,
} from "../../sqlite/schemas/index.js";

/**
 * Coerce string-typed numbers to actual numbers.
 * Returns the original string for non-numeric strings so Zod validation fails.
 */
const coerceNumber = (val: unknown): unknown => {
  if (typeof val === "string") {
    const num = Number(val);
    return isNaN(num) ? undefined : num;
  }
  return val;
};

/**
 * Create a coercer for optional enum params with defaults.
 * Returns `undefined` for any value NOT in the allowed set,
 * so `.optional().default()` kicks in.
 * Prevents raw MCP -32602 for invalid enum values.
 */
const coerceEnumValues =
  (allowed: readonly string[]) =>
  (val: unknown): unknown =>
    typeof val === "string" && allowed.includes(val) ? val : undefined;

/** Valid direction values for handler-side validation (required enum). */
const VALID_DIRECTIONS = ["lag", "lead"] as const;

// Schemas
const RowNumberSchema = z.object({
  table: z.string().describe("Table name"),
  orderBy: z.string().describe("Column(s) to order by"),
  partitionBy: z.string().optional().describe("Column(s) to partition by"),
  selectColumns: z
    .array(z.string())
    .optional()
    .describe("Columns to include in result"),
  whereClause: z.string().optional().describe("Optional WHERE clause"),
  limit: z.preprocess(
    coerceNumber,
    z.number().optional().default(20).describe("Maximum rows to return"),
  ),
});

const RankSchema = z.object({
  table: z.string().describe("Table name"),
  orderBy: z.string().describe("Column(s) to order by (determines rank)"),
  partitionBy: z.string().optional().describe("Column(s) to partition by"),
  selectColumns: z
    .array(z.string())
    .optional()
    .describe("Columns to include in result"),
  rankType: z.preprocess(
    coerceEnumValues(["rank", "dense_rank", "percent_rank"]),
    z
      .enum(["rank", "dense_rank", "percent_rank"])
      .optional()
      .default("rank")
      .describe("Rank function type"),
  ),
  whereClause: z.string().optional().describe("Optional WHERE clause"),
  limit: z.preprocess(
    coerceNumber,
    z.number().optional().default(20).describe("Maximum rows to return"),
  ),
});

const LagLeadSchema = z.object({
  table: z.string().describe("Table name"),
  column: z.string().describe("Column to get lag/lead value from"),
  orderBy: z.string().describe("Column(s) to order by"),
  direction: z.string().describe("LAG (previous) or LEAD (next) row"),
  offset: z.preprocess(
    coerceNumber,
    z
      .number()
      .optional()
      .default(1)
      .describe("Number of rows to look back/ahead"),
  ),
  defaultValue: z
    .string()
    .optional()
    .describe("Default value if no row exists"),
  partitionBy: z.string().optional().describe("Column(s) to partition by"),
  selectColumns: z
    .array(z.string())
    .optional()
    .describe("Columns to include in result"),
  whereClause: z.string().optional().describe("Optional WHERE clause"),
  limit: z.preprocess(
    coerceNumber,
    z.number().optional().default(20).describe("Maximum rows to return"),
  ),
});

const RunningTotalSchema = z.object({
  table: z.string().describe("Table name"),
  column: z.string().describe("Column to sum"),
  orderBy: z.string().describe("Column(s) to order by"),
  partitionBy: z
    .string()
    .optional()
    .describe("Reset running total for each partition"),
  selectColumns: z
    .array(z.string())
    .optional()
    .describe("Columns to include in result"),
  whereClause: z.string().optional().describe("Optional WHERE clause"),
  limit: z.preprocess(
    coerceNumber,
    z.number().optional().default(20).describe("Maximum rows to return"),
  ),
});

const MovingAverageSchema = z.object({
  table: z.string().describe("Table name"),
  column: z.string().describe("Column to average"),
  orderBy: z.string().describe("Column(s) to order by"),
  windowSize: z.preprocess(
    coerceNumber,
    z.number().optional().describe("Number of rows in the moving window"),
  ),
  partitionBy: z.string().optional().describe("Column(s) to partition by"),
  selectColumns: z
    .array(z.string())
    .optional()
    .describe("Columns to include in result"),
  whereClause: z.string().optional().describe("Optional WHERE clause"),
  limit: z.preprocess(
    coerceNumber,
    z.number().optional().default(20).describe("Maximum rows to return"),
  ),
});

const NtileSchema = z.object({
  table: z.string().describe("Table name"),
  orderBy: z.string().describe("Column(s) to order by"),
  buckets: z.preprocess(
    coerceNumber,
    z.number().optional().describe("Number of buckets (e.g., 4 for quartiles)"),
  ),
  partitionBy: z.string().optional().describe("Column(s) to partition by"),
  selectColumns: z
    .array(z.string())
    .optional()
    .describe("Columns to include in result"),
  whereClause: z.string().optional().describe("Optional WHERE clause"),
  limit: z.preprocess(
    coerceNumber,
    z.number().optional().default(20).describe("Maximum rows to return"),
  ),
});

/**
 * Validate table exists in database (format + existence check)
 */
async function validateTableExists(
  adapter: NativeSqliteAdapter,
  table: string,
): Promise<void> {
  // Use canonical identifier validation (CWE-89 remediation)
  validateIdentifier(table);

  const quoted = sanitizeIdentifier(table);
  const result = await adapter.executeReadQuery(
    `SELECT 1 FROM sqlite_master WHERE type IN ('table', 'view') AND name=${quoted}`,
  );
  if (!result.rows || result.rows.length === 0) {
    throw new ResourceNotFoundError(
      `Table '${table}' does not exist`,
      "TABLE_NOT_FOUND",
      {
        suggestion:
          "Table not found. Run sqlite_list_tables to see available tables.",
        resourceType: "table",
        resourceName: table,
      },
    );
  }
}

/**
 * Validate column exists in table
 */
async function validateColumnInTable(
  adapter: NativeSqliteAdapter,
  table: string,
  column: string,
): Promise<void> {
  // Use canonical identifier validation (CWE-89 remediation)
  validateIdentifier(column);

  const quotedTable = sanitizeIdentifier(table);
  const quotedColumn = sanitizeIdentifier(column);
  const tableInfo = await adapter.executeReadQuery(
    `SELECT name FROM pragma_table_info(${quotedTable}) WHERE name=${quotedColumn}`,
  );
  if (!tableInfo.rows || tableInfo.rows.length === 0) {
    throw new ResourceNotFoundError(
      `Column '${column}' not found in table '${table}'`,
      "COLUMN_NOT_FOUND",
      {
        suggestion:
          "Column not found. Use sqlite_describe_table to see available columns.",
        resourceType: "column",
        resourceName: column,
      },
    );
  }
}

/**
 * Validate that column names referenced in an ORDER BY clause exist in the table.
 * Handles multi-column ordering (comma-separated), directional keywords (ASC/DESC),
 * and gracefully skips expression-like tokens (containing parens, dots, etc.).
 */
async function validateOrderByColumns(
  adapter: NativeSqliteAdapter,
  table: string,
  orderBy: string,
): Promise<void> {
  const parts = orderBy.split(",");
  for (const part of parts) {
    const tokens = part.trim().split(/\s+/);
    const firstToken = tokens[0];
    if (!firstToken) continue;
    const colName = firstToken.replace(/^"|"$/g, "");
    // Reject expression-like tokens instead of skipping them (CWE-89 remediation)
    if (/[;()+*/]/.test(colName)) {
      throw new DbMcpError(
        `Invalid ORDER BY expression: '${colName}' contains disallowed characters. Only column names with optional ASC/DESC are permitted.`,
        "NATIVE_WINDOW_INVALID_ORDERBY",
        ErrorCategory.VALIDATION,
      );
    }
    if (/^(ASC|DESC)$/i.test(colName)) continue;
    // Allow dotted references (table.column) by validating each segment
    if (colName.includes(".")) {
      for (const segment of colName.split(".")) {
        validateIdentifier(segment);
      }
      continue;
    }
    await validateColumnInTable(adapter, table, colName);
  }
}

/**
 * Helper to format column selection and omit long content columns by default
 */
async function resolveSelectColumns(
  adapter: NativeSqliteAdapter,
  table: string,
  selectColumns: string[] | undefined,
  rankCol?: string,
): Promise<{ columnList: string; hint?: string }> {
  if (selectColumns && selectColumns.length > 0) {
    // Use canonical sanitization instead of manual quoting (CWE-89 remediation)
    return {
      columnList: selectColumns.map((c) => sanitizeIdentifier(c)).join(", "),
    };
  }

  // Auto-limit: exclude TEXT/BLOB columns likely to hold long content
  const tableInfo = await adapter.executeReadQuery(
    `PRAGMA table_info(${sanitizeIdentifier(table)})`,
  );

  const TEXT_TYPES = new Set([
    "text",
    "blob",
    "clob",
    "varchar",
    "nvarchar",
    "char",
  ]);
  const LONG_CONTENT_PATTERNS = [
    "description",
    "body",
    "bio",
    "content",
    "notes",
    "summary",
    "comment",
    "details",
    "html",
    "markdown",
    "text",
    "message",
    "payload",
    "raw",
    "data",
    "log",
    "blob",
  ];

  const excluded: string[] = [];
  const included: string[] = [];

  for (const c of tableInfo.rows ?? []) {
    const colName = c["name"] as string;
    const colType = ((c["type"] as string) ?? "").toLowerCase();
    const nameLower = colName.toLowerCase();

    const isText = [...TEXT_TYPES].some(
      (t) => colType === t || colType.startsWith(t),
    );
    const isRankCol = rankCol ? nameLower === rankCol.toLowerCase() : false;
    const isLongContent = LONG_CONTENT_PATTERNS.some(
      (p) =>
        nameLower === p ||
        nameLower.endsWith(`_${p}`) ||
        nameLower.startsWith(`${p}_`),
    );

    if (isText && !isRankCol && isLongContent) {
      excluded.push(colName);
    } else {
      included.push(colName);
    }
  }

  if (excluded.length > 0 && included.length > 0) {
    return {
      columnList: included.map((c) => sanitizeIdentifier(c)).join(", "),
      hint: `Excluded ${excluded.length} long-content column(s) (${excluded.join(", ")}) to reduce payload. Use selectColumns to override.`,
    };
  }

  return { columnList: "*" };
}

/**
 * Sanitize a PARTITION BY expression by validating each column reference.
 * Only allows comma-separated column names (no expressions).
 */
function sanitizePartitionBy(partitionBy: string): string {
  const columns = partitionBy.split(",").map((c) => c.trim()).filter(Boolean);
  for (const col of columns) {
    validateIdentifier(col);
  }
  return columns.map((c) => sanitizeIdentifier(c)).join(", ");
}

/**
 * Sanitize an ORDER BY expression by validating each column reference.
 * Preserves ASC/DESC direction keywords.
 */
function sanitizeOrderByExpr(orderBy: string): string {
  const parts = orderBy.split(",");
  const sanitized: string[] = [];
  for (const part of parts) {
    const tokens = part.trim().split(/\s+/);
    const colToken = tokens[0];
    if (!colToken) continue;
    const colName = colToken.replace(/^"|"$/g, "");
    validateIdentifier(colName);
    const direction = tokens[1];
    if (direction && /^(ASC|DESC)$/i.test(direction)) {
      sanitized.push(`${sanitizeIdentifier(colName)} ${direction.toUpperCase()}`);
    } else {
      sanitized.push(sanitizeIdentifier(colName));
    }
  }
  return sanitized.join(", ");
}

/**
 * Validate that a default value is a safe SQL literal (numeric or quoted string).
 * Rejects expressions, function calls, subqueries, and injection payloads.
 */
function validateDefaultValue(value: string): void {
  // Allow numeric literals (integers and decimals, optionally negative)
  if (/^-?\d+(\.\d+)?$/.test(value)) return;

  // Allow simple single-quoted string literals (no nested quotes or special chars)
  if (/^'[^']*'$/.test(value)) return;

  // Allow NULL keyword
  if (/^NULL$/i.test(value)) return;

  throw new DbMcpError(
    `Invalid default value: '${value}'. Only numeric literals, single-quoted strings, or NULL are permitted.`,
    "NATIVE_WINDOW_INVALID_DEFAULT",
    ErrorCategory.VALIDATION,
  );
}


/**
 * Get all window function tools
 */
export function getWindowTools(adapter: NativeSqliteAdapter): ToolDefinition[] {
  return [
    createRowNumberTool(adapter),
    createRankTool(adapter),
    createLagLeadTool(adapter),
    createRunningTotalTool(adapter),
    createMovingAverageTool(adapter),
    createNtileTool(adapter),
  ];
}

/**
 * ROW_NUMBER window function
 */
function createRowNumberTool(adapter: NativeSqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_window_row_number",
    description:
      "Assign sequential row numbers based on ordering. Useful for pagination and ranking.",
    group: "stats",
    inputSchema: RowNumberSchema,
    outputSchema: WindowRowNumberOutputSchema,
    annotations: readOnly("Window Row Number"),
    requiredScopes: ["read"],
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const input = RowNumberSchema.parse(params);

        await validateTableExists(adapter, input.table);
        await validateOrderByColumns(adapter, input.table, input.orderBy);

        const { columnList: columns, hint } = await resolveSelectColumns(
          adapter,
          input.table,
          input.selectColumns,
        );
        const partition = input.partitionBy
          ? `PARTITION BY ${sanitizePartitionBy(input.partitionBy)}`
          : "";
        const orderByExpr = sanitizeOrderByExpr(input.orderBy);

        let sql = `
                SELECT ${columns},
                    ROW_NUMBER() OVER (${partition} ORDER BY ${orderByExpr}) as row_number
                FROM ${sanitizeIdentifier(input.table)}
            `;

        if (input.whereClause) {
          validateWhereClause(input.whereClause);
          sql += ` WHERE ${input.whereClause}`;
        }
        sql += ` LIMIT ${input.limit}`;

        const result = await adapter.executeReadQuery(sql);

        const response: Record<string, unknown> = {
          success: true,
          rowCount: result.rows?.length ?? 0,
          rows: result.rows,
        };
        if (hint) response["hint"] = hint;
        return response;
      } catch (error) {
        return formatHandlerError(error);
      }
    },
  };
}

/**
 * RANK/DENSE_RANK/PERCENT_RANK window functions
 */
function createRankTool(adapter: NativeSqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_window_rank",
    description:
      "Calculate rank of rows. RANK leaves gaps after ties, DENSE_RANK does not, PERCENT_RANK gives 0-1 range.",
    group: "stats",
    inputSchema: RankSchema,
    outputSchema: WindowRankOutputSchema,
    annotations: readOnly("Window Rank"),
    requiredScopes: ["read"],
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const input = RankSchema.parse(params);

        await validateTableExists(adapter, input.table);
        await validateOrderByColumns(adapter, input.table, input.orderBy);

        const { columnList: columns, hint } = await resolveSelectColumns(
          adapter,
          input.table,
          input.selectColumns,
        );
        const partition = input.partitionBy
          ? `PARTITION BY ${sanitizePartitionBy(input.partitionBy)}`
          : "";
        const rankFunc = input.rankType.toUpperCase();
        const orderByExpr = sanitizeOrderByExpr(input.orderBy);

        let sql = `
                SELECT ${columns},
                    ${rankFunc}() OVER (${partition} ORDER BY ${orderByExpr}) as ${input.rankType}
                FROM ${sanitizeIdentifier(input.table)}
            `;

        if (input.whereClause) {
          validateWhereClause(input.whereClause);
          sql += ` WHERE ${input.whereClause}`;
        }
        sql += ` LIMIT ${input.limit}`;

        const result = await adapter.executeReadQuery(sql);

        const response: Record<string, unknown> = {
          success: true,
          rankType: input.rankType,
          rowCount: result.rows?.length ?? 0,
          rows: result.rows,
        };
        if (hint) response["hint"] = hint;
        return response;
      } catch (error) {
        return formatHandlerError(error);
      }
    },
  };
}

/**
 * LAG/LEAD window functions
 */
function createLagLeadTool(adapter: NativeSqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_window_lag_lead",
    description:
      "Access previous (LAG) or next (LEAD) row values. Useful for comparing consecutive rows.",
    group: "stats",
    inputSchema: LagLeadSchema,
    outputSchema: WindowLagLeadOutputSchema,
    annotations: readOnly("Window Lag/Lead"),
    requiredScopes: ["read"],
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const input = LagLeadSchema.parse(params);

        // Normalize direction to lowercase (schema describes as LAG/LEAD uppercase)
        const normalizedDirection = input.direction.toLowerCase();

        // Handler-side validation for required enum (z.string() in schema)
        if (
          !VALID_DIRECTIONS.includes(
            normalizedDirection as (typeof VALID_DIRECTIONS)[number],
          )
        ) {
          return {
            success: false,
            error: `Invalid direction '${input.direction}'. Must be one of: ${VALID_DIRECTIONS.join(", ")}`,
            code: "VALIDATION_ERROR",
            category: "validation",
            recoverable: false,
          };
        }

        await validateTableExists(adapter, input.table);
        await validateColumnInTable(adapter, input.table, input.column);
        await validateOrderByColumns(adapter, input.table, input.orderBy);

        const { columnList: columns, hint } = await resolveSelectColumns(
          adapter,
          input.table,
          input.selectColumns,
          input.column,
        );
        const partition = input.partitionBy
          ? `PARTITION BY ${sanitizePartitionBy(input.partitionBy)}`
          : "";
        const func = normalizedDirection.toUpperCase();
        // Validate defaultValue to prevent SQL injection (CWE-89 remediation)
        let defaultVal = "";
        if (input.defaultValue !== undefined) {
          validateDefaultValue(input.defaultValue);
          defaultVal = `, ${input.defaultValue}`;
        }
        const orderByExpr = sanitizeOrderByExpr(input.orderBy);

        let sql = `
                SELECT ${columns},
                    ${func}(${sanitizeIdentifier(input.column)}, ${input.offset}${defaultVal}) OVER (${partition} ORDER BY ${orderByExpr}) as ${normalizedDirection}_value
                FROM ${sanitizeIdentifier(input.table)}
            `;

        if (input.whereClause) {
          validateWhereClause(input.whereClause);
          sql += ` WHERE ${input.whereClause}`;
        }
        sql += ` LIMIT ${input.limit}`;

        const result = await adapter.executeReadQuery(sql);

        const response: Record<string, unknown> = {
          success: true,
          direction: normalizedDirection,
          offset: input.offset,
          rowCount: result.rows?.length ?? 0,
          rows: result.rows,
        };
        if (hint) response["hint"] = hint;
        return response;
      } catch (error) {
        return formatHandlerError(error);
      }
    },
  };
}

/**
 * Running total (cumulative SUM)
 */
function createRunningTotalTool(adapter: NativeSqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_window_running_total",
    description:
      "Calculate running (cumulative) total. Useful for balance tracking, cumulative metrics.",
    group: "stats",
    inputSchema: RunningTotalSchema,
    outputSchema: WindowRunningTotalOutputSchema,
    annotations: readOnly("Window Running Total"),
    requiredScopes: ["read"],
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const input = RunningTotalSchema.parse(
          resolveAliases(params, { valueColumn: "column" }),
        );

        await validateTableExists(adapter, input.table);
        await validateColumnInTable(adapter, input.table, input.column);
        await validateOrderByColumns(adapter, input.table, input.orderBy);

        const { columnList: columns, hint } = await resolveSelectColumns(
          adapter,
          input.table,
          input.selectColumns,
          input.column,
        );
        const partition = input.partitionBy
          ? `PARTITION BY ${sanitizePartitionBy(input.partitionBy)}`
          : "";
        const orderByExpr = sanitizeOrderByExpr(input.orderBy);

        let sql = `
                SELECT ${columns},
                    SUM(${sanitizeIdentifier(input.column)}) OVER (${partition} ORDER BY ${orderByExpr} ROWS UNBOUNDED PRECEDING) as running_total
                FROM ${sanitizeIdentifier(input.table)}
            `;

        if (input.whereClause) {
          validateWhereClause(input.whereClause);
          sql += ` WHERE ${input.whereClause}`;
        }
        sql += ` LIMIT ${input.limit}`;

        const result = await adapter.executeReadQuery(sql);

        const response: Record<string, unknown> = {
          success: true,
          valueColumn: input.column,
          rowCount: result.rows?.length ?? 0,
          rows: result.rows,
        };
        if (hint) response["hint"] = hint;
        return response;
      } catch (error) {
        return formatHandlerError(error);
      }
    },
  };
}

/**
 * Moving average
 */
function createMovingAverageTool(adapter: NativeSqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_window_moving_avg",
    description:
      "Calculate moving (rolling) average. Useful for smoothing time series data.",
    group: "stats",
    inputSchema: MovingAverageSchema,
    outputSchema: WindowMovingAvgOutputSchema,
    annotations: readOnly("Window Moving Average"),
    requiredScopes: ["read"],
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const input = MovingAverageSchema.parse(
          resolveAliases(params, { valueColumn: "column" }),
        );

        if (input.windowSize === undefined) {
          return {
            success: false,
            error: "'windowSize' is required",
            code: "VALIDATION_ERROR",
            category: "validation",
            recoverable: false,
          };
        }

        await validateTableExists(adapter, input.table);
        await validateColumnInTable(adapter, input.table, input.column);
        await validateOrderByColumns(adapter, input.table, input.orderBy);

        const { columnList: columns, hint } = await resolveSelectColumns(
          adapter,
          input.table,
          input.selectColumns,
          input.column,
        );
        const partition = input.partitionBy
          ? `PARTITION BY ${sanitizePartitionBy(input.partitionBy)}`
          : "";
        const preceding = input.windowSize - 1;
        const orderByExpr = sanitizeOrderByExpr(input.orderBy);

        let sql = `
                SELECT ${columns},
                    AVG(${sanitizeIdentifier(input.column)}) OVER (${partition} ORDER BY ${orderByExpr} ROWS BETWEEN ${preceding} PRECEDING AND CURRENT ROW) as moving_avg
                FROM ${sanitizeIdentifier(input.table)}
            `;

        if (input.whereClause) {
          validateWhereClause(input.whereClause);
          sql += ` WHERE ${input.whereClause}`;
        }
        sql += ` LIMIT ${input.limit}`;

        const result = await adapter.executeReadQuery(sql);

        const response: Record<string, unknown> = {
          success: true,
          valueColumn: input.column,
          windowSize: input.windowSize,
          rowCount: result.rows?.length ?? 0,
          rows: result.rows,
        };
        if (hint) response["hint"] = hint;
        return response;
      } catch (error) {
        return formatHandlerError(error);
      }
    },
  };
}

/**
 * NTILE (divide into buckets/quantiles)
 */
function createNtileTool(adapter: NativeSqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_window_ntile",
    description:
      "Divide rows into N buckets. E.g., 4 buckets = quartiles, 10 = deciles, 100 = percentiles.",
    group: "stats",
    inputSchema: NtileSchema,
    outputSchema: WindowNtileOutputSchema,
    annotations: readOnly("Window Ntile"),
    requiredScopes: ["read"],
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const input = NtileSchema.parse(params);

        if (input.buckets === undefined) {
          return {
            success: false,
            error: "'buckets' is required",
            code: "VALIDATION_ERROR",
            category: "validation",
            recoverable: false,
          };
        }

        await validateTableExists(adapter, input.table);
        await validateOrderByColumns(adapter, input.table, input.orderBy);

        const { columnList: columns, hint } = await resolveSelectColumns(
          adapter,
          input.table,
          input.selectColumns,
        );
        const partition = input.partitionBy
          ? `PARTITION BY ${sanitizePartitionBy(input.partitionBy)}`
          : "";
        const orderByExpr = sanitizeOrderByExpr(input.orderBy);

        let sql = `
                SELECT ${columns},
                    NTILE(${input.buckets}) OVER (${partition} ORDER BY ${orderByExpr}) as ntile
                FROM ${sanitizeIdentifier(input.table)}
            `;

        if (input.whereClause) {
          validateWhereClause(input.whereClause);
          sql += ` WHERE ${input.whereClause}`;
        }
        sql += ` LIMIT ${input.limit}`;

        const result = await adapter.executeReadQuery(sql);

        const response: Record<string, unknown> = {
          success: true,
          buckets: input.buckets,
          rowCount: result.rows?.length ?? 0,
          rows: result.rows,
        };
        if (hint) response["hint"] = hint;
        return response;
      } catch (error) {
        return formatHandlerError(error);
      }
    },
  };
}
