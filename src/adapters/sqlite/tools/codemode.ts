/**
 * db-mcp - Code Mode Tool Handler
 *
 * Registers the `sqlite_execute_code` tool that enables agents to execute
 * JavaScript in a sandboxed environment with access to all SQLite tools
 * via the `sqlite.*` API.
 *
 * Provides 70-90% token reduction by replacing multiple tool calls with
 * a single code execution containing the equivalent logic.
 */

import { z } from "zod";
import type { SqliteAdapter } from "../SqliteAdapter.js";
import type { ToolDefinition, RequestContext } from "../../../types/index.js";
import { createSqliteApi } from "../../../codemode/api.js";
import { CodeModeSecurityManager } from "../../../codemode/security.js";
import {
  createSandboxPool,
  setDefaultSandboxMode,
  type ISandboxPool,
  type SandboxMode,
} from "../../../codemode/sandbox-factory.js";
import { logger } from "../../../utils/logger.js";
import { formatError } from "../../../utils/errors.js";

// =============================================================================
// Module State
// =============================================================================

/** Shared sandbox pool (lazy-initialized) */
let pool: ISandboxPool | null = null;

/** Shared security manager */
const security = new CodeModeSecurityManager();

// =============================================================================
// Schemas
// =============================================================================

const ExecuteCodeSchema = z.object({
  code: z
    .string()
    .describe(
      "JavaScript code to execute. Access all SQLite tools via sqlite.* API. " +
        "Use sqlite.help() to discover groups, sqlite.<group>.help() for methods. " +
        "Example: const tables = await sqlite.core.listTables(); return tables;",
    ),
  timeout: z
    .number()
    .int()
    .min(1000)
    .max(30000)
    .optional()
    .default(30000)
    .describe("Execution timeout in milliseconds (1000-30000, default: 30000)"),
  readonly: z
    .boolean()
    .optional()
    .default(false)
    .describe("Restrict to read-only operations (default: false)"),
});

const ExecuteCodeOutputSchema = z.object({
  success: z.boolean().describe("Whether execution completed successfully"),
  result: z.unknown().optional().describe("Return value from the code"),
  error: z.string().optional().describe("Error message if execution failed"),
  code: z
    .string()
    .optional()
    .describe(
      "Error code for programmatic handling (e.g., CODEMODE_VALIDATION_FAILED)",
    ),
  category: z
    .string()
    .optional()
    .describe(
      "Error category: validation, permission, query, resource, internal",
    ),
  suggestion: z
    .string()
    .optional()
    .describe("Actionable suggestion for resolving the error"),
  recoverable: z
    .boolean()
    .optional()
    .describe("Whether the error is recoverable by retrying"),
  consoleOutput: z
    .array(z.string())
    .optional()
    .describe("Console output captured during execution"),
  metrics: z
    .object({
      wallTimeMs: z.number().describe("Wall clock time in milliseconds"),
      cpuTimeMs: z.number().describe("CPU time in milliseconds"),
      memoryUsedMb: z.number().describe("Memory used in MB"),
    })
    .describe("Execution performance metrics"),
});

// =============================================================================
// Tool Definition
// =============================================================================

/**
 * Get Code Mode tools for the SQLite adapter.
 * Uses the adapter's existing tool definitions to build the sandbox API.
 */
export function getCodeModeTools(adapter: SqliteAdapter): ToolDefinition[] {
  return [createExecuteCodeTool(adapter)];
}

/**
 * Create the sqlite_execute_code tool definition
 */
function createExecuteCodeTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_execute_code",
    description:
      "Execute JavaScript in a sandboxed environment with access to all SQLite tools " +
      "via the sqlite.* API. Enables complex multi-step operations in a single call. " +
      "Groups: sqlite.core, sqlite.json, sqlite.text, sqlite.stats, sqlite.vector, " +
      "sqlite.admin, sqlite.geo. Use sqlite.help() for all groups, " +
      "sqlite.<group>.help() for methods. " +
      "Example: const tables = await sqlite.core.listTables(); " +
      "const schema = await sqlite.core.describeTable(tables[0].name); return schema;",
    group: "codemode",
    inputSchema: ExecuteCodeSchema,
    outputSchema: ExecuteCodeOutputSchema,
    annotations: {
      title: "Execute Code (Sandbox)",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
    },
    handler: async (
      params: unknown,
      _context: RequestContext,
    ): Promise<unknown> => {
      const parsed = ExecuteCodeSchema.parse(params);
      const { code, readonly: isReadonly } = parsed;

      // Validate code
      const validation = security.validateCode(code);
      if (!validation.valid) {
        return {
          success: false,
          error: `Code validation failed: ${validation.errors.join("; ")}`,
          code: "CODEMODE_VALIDATION_FAILED",
          category: "validation",
          suggestion:
            "Review blocked patterns: require(), process., eval(), Function(), import(). Use sqlite.* API instead.",
          recoverable: false,
          metrics: { wallTimeMs: 0, cpuTimeMs: 0, memoryUsedMb: 0 },
        };
      }

      // Check rate limit
      const clientId = _context.auth?.sub ?? "anonymous";
      if (!security.checkRateLimit(clientId)) {
        return {
          success: false,
          error: "Rate limit exceeded. Maximum 60 executions per minute.",
          code: "CODEMODE_RATE_LIMITED",
          category: "permission",
          suggestion:
            "Wait before retrying. Combine multiple operations into fewer execute_code calls.",
          recoverable: true,
          metrics: { wallTimeMs: 0, cpuTimeMs: 0, memoryUsedMb: 0 },
        };
      }

      // Initialize pool lazily
      if (!pool) {
        initializePool();
      }

      try {
        // Build API bindings from adapter's tool definitions
        const allTools = adapter.getToolDefinitions();

        // If readonly, filter out write tools
        const tools = isReadonly
          ? allTools.filter(
              (t) =>
                t.annotations?.readOnlyHint !== false ||
                t.name.includes("read") ||
                t.name.includes("list") ||
                t.name.includes("describe") ||
                t.name.includes("get") ||
                t.name.includes("search") ||
                t.name.includes("stats") ||
                t.name.includes("count"),
            )
          : allTools;

        const api = createSqliteApi(tools);
        const bindings = api.createSandboxBindings();

        // Execute in sandbox
        if (!pool) {
          throw new Error("Sandbox pool not initialized");
        }
        const result = await pool.execute(code, bindings);

        // Sanitize result
        const sanitizedResult = result.success
          ? security.sanitizeResult(result.result)
          : undefined;

        // Audit log
        const record = security.createExecutionRecord(
          code,
          result,
          isReadonly,
          clientId,
        );
        security.auditLog(record);

        return {
          success: result.success,
          result: sanitizedResult,
          error: result.error,
          metrics: result.metrics,
        };
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logger.error(`Code execution error: ${errorMsg}`, {
          module: "CODEMODE" as const,
          operation: "executeCode",
          error: error instanceof Error ? error : undefined,
        });

        const structured = formatError(error);
        return {
          success: false,
          error: errorMsg,
          code:
            structured.code === "UNKNOWN_ERROR"
              ? "CODEMODE_EXECUTION_FAILED"
              : structured.code,
          category: structured.category,
          suggestion: structured.suggestion,
          recoverable: structured.recoverable,
          metrics: { wallTimeMs: 0, cpuTimeMs: 0, memoryUsedMb: 0 },
        };
      }
    },
  };
}

// =============================================================================
// Pool Management
// =============================================================================

/**
 * Initialize the sandbox pool.
 * Reads CODEMODE_ISOLATION env var to select sandbox mode.
 */
function initializePool(): void {
  const modeEnv = process.env["CODEMODE_ISOLATION"]?.toLowerCase();
  const mode: SandboxMode =
    modeEnv === "vm" || modeEnv === "worker" ? modeEnv : "worker";

  setDefaultSandboxMode(mode);
  pool = createSandboxPool(mode, undefined, { timeoutMs: 30000 });
  pool.initialize();

  logger.info(`Code Mode initialized with ${mode} sandbox`, {
    module: "CODEMODE" as const,
    operation: "initialize",
  });
}

/**
 * Cleanup Code Mode resources (for graceful shutdown).
 */
export function cleanupCodeMode(): void {
  if (pool) {
    pool.dispose();
    pool = null;
    logger.info("Code Mode sandbox pool disposed", {
      module: "CODEMODE" as const,
      operation: "cleanup",
    });
  }
}
