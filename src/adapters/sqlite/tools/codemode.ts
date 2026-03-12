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
import type { SqliteAdapter } from "../sqlite-adapter.js";
import type { ToolDefinition, RequestContext } from "../../../types/index.js";
import {
  createSqliteApi,
  toolNameToMethodName,
  type SqliteApi,
} from "../../../codemode/api.js";
import { CodeModeSecurityManager } from "../../../codemode/security.js";
import {
  createSandboxPool,
  setDefaultSandboxMode,
  type ISandboxPool,
  type SandboxMode,
} from "../../../codemode/sandbox-factory.js";
import { logger } from "../../../utils/logger/index.js";
import { formatHandlerError, DbMcpError, ErrorCategory } from "../../../utils/errors/index.js";
import { ErrorResponseFields } from "../../../utils/errors/error-response-fields.js";

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
}).extend(ErrorResponseFields.shape);

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
      "sqlite.admin, sqlite.geo, sqlite.introspection, sqlite.migration. " +
      "Use sqlite.help() for all groups, sqlite.<group>.help() for methods. " +
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
      const { code, timeout: timeoutMs, readonly: isReadonly } = parsed;

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
        // Always use all tools so help() shows the complete API surface
        const allTools = adapter.getToolDefinitions();
        const api = createSqliteApi(allTools);
        const bindings = api.createSandboxBindings();

        // If readonly, wrap write methods with guards that return
        // structured errors instead of executing
        if (isReadonly) {
          wrapReadonlyGuards(api, allTools, bindings);
        }

        // Execute in sandbox
        if (!pool) {
          throw new DbMcpError("Sandbox pool not initialized", "CODEMODE_POOL_UNINITIALIZED", ErrorCategory.INTERNAL);
        }
        const result = await pool.execute(code, bindings, timeoutMs);

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

        return formatHandlerError(error);
      }
    },
  };
}

// =============================================================================
// Readonly Guards
// =============================================================================

/**
 * Read-safe tool name patterns.
 * Tools matching these patterns are considered read-only even if
 * their readOnlyHint annotation is not explicitly set.
 */
const READ_SAFE_PATTERNS = [
  "read",
  "list",
  "describe",
  "get",
  "search",
  "stats",
  "count",
];

/**
 * Check if a tool is a write tool (not read-safe).
 */
function isWriteTool(tool: ToolDefinition): boolean {
  // Explicitly marked as read-only → not a write tool
  if (tool.annotations?.readOnlyHint !== false) return false;

  // Check if tool name matches any read-safe pattern
  return !READ_SAFE_PATTERNS.some((pattern) => tool.name.includes(pattern));
}

/**
 * Create a readonly guard stub that returns a structured error.
 */
function createReadonlyGuard(
  methodName: string,
): (...args: unknown[]) => Promise<unknown> {
  return () =>
    Promise.resolve({
      success: false,
      error: `Method '${methodName}' is not available in readonly mode. Set readonly: false to use write operations.`,
      code: "CODEMODE_READONLY_VIOLATION",
      category: "permission",
      suggestion:
        "Remove readonly: true or set readonly: false to access write operations.",
      recoverable: false,
    });
}

/**
 * Wrap write methods in the API with readonly guards.
 * Methods are kept in help() output for discoverability but return
 * structured errors when invoked in readonly mode.
 */
function wrapReadonlyGuards(
  api: SqliteApi,
  allTools: ToolDefinition[],
  bindings: Record<string, unknown>,
): void {
  const writeTools = allTools.filter(isWriteTool);

  for (const tool of writeTools) {
    const methodName = toolNameToMethodName(tool.name, tool.group);
    const guard = createReadonlyGuard(methodName);

    // Replace on the group API object
    const groupApi = api[tool.group as keyof SqliteApi];
    if (
      groupApi !== undefined &&
      typeof groupApi === "object" &&
      methodName in groupApi
    ) {
      (groupApi as Record<string, unknown>)[methodName] = guard;
    }

    // Replace on top-level bindings if aliased there
    if (methodName in bindings) {
      bindings[methodName] = guard;
    }
  }
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
