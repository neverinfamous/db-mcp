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
import {
  formatHandlerError,
  DbMcpError,
  ErrorCategory,
} from "../../../utils/errors/index.js";
import {
  ExecuteCodeSchema,
  ExecuteCodeOutputSchema,
} from "../schemas/codemode.js";

// =============================================================================
// Module State
// =============================================================================

/** Shared sandbox pool (lazy-initialized) */
let pool: ISandboxPool | null = null;

/** Shared security manager — honor MCP_CODEMODE_RATE_LIMIT env var for tests */
const codemodeRateLimit = Number(process.env["MCP_CODEMODE_RATE_LIMIT"]) || 60;
const security = new CodeModeSecurityManager({
  maxExecutionsPerMinute: codemodeRateLimit,
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
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: true,
    },
    handler: async (
      params: unknown,
      _context: RequestContext,
    ): Promise<unknown> => {
      try {
        const parsed = ExecuteCodeSchema.parse(params);
        const { code, timeout: timeoutMs, readonly: isReadonly } = parsed;

        // Validate timeout range (handler-level since schema refinements leak)
        if (timeoutMs < 500 || timeoutMs > 30000) {
          return {
            success: false,
            error: `Timeout must be between 500 and 30000 ms, got ${timeoutMs}`,
            code: "CODEMODE_VALIDATION_FAILED",
            category: "validation",
            suggestion:
              "Provide a timeout value between 500 and 30000 milliseconds.",
            recoverable: false,
            metrics: { wallTimeMs: 0, cpuTimeMs: 0, memoryUsedMb: 0 },
          };
        }

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
        const clientId = _context.auth?.sub ?? _context.clientIp ?? "anonymous";
        if (!security.checkRateLimit(clientId)) {
          return {
            success: false,
            error: `Rate limit exceeded. Maximum ${String(codemodeRateLimit)} executions per minute.`,
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

        // Build API bindings from adapter's tool definitions
        // Use capability-filtered tools if available to accurately reflect runtime
        const allTools =
          "getAvailableToolDefinitions" in adapter &&
          typeof adapter.getAvailableToolDefinitions === "function"
            ? adapter.getAvailableToolDefinitions()
            : adapter.getToolDefinitions();
        const api = createSqliteApi(allTools, _context);
        const bindings = api.createSandboxBindings();

        // If readonly, wrap write methods with guards that return
        // structured errors instead of executing
        if (isReadonly) {
          wrapReadonlyGuards(api, allTools, bindings);
        }

        // Execute in sandbox
        if (!pool) {
          throw new DbMcpError(
            "Sandbox pool not initialized",
            "CODEMODE_POOL_UNINITIALIZED",
            ErrorCategory.INTERNAL,
          );
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

        // Compute token estimate from result (~4 bytes per token)
        let tokenEstimate = 0;
        if (sanitizedResult !== undefined) {
          try {
            const json = JSON.stringify(sanitizedResult);
            tokenEstimate = Math.ceil(Buffer.byteLength(json, "utf8") / 4);
          } catch {
            // Serialization failure — leave at 0
          }
        }

        return {
          success: result.success,
          result: sanitizedResult,
          error: result.error,
          metrics: {
            ...result.metrics,
            tokenEstimate,
          },
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
 * Check if a tool is a write tool (not read-safe).
 *
 * Fail-closed: tools are assumed to be write tools UNLESS explicitly
 * annotated with `readOnlyHint: true`. This prevents unannotated tools
 * from bypassing the readonly guard.
 */
function isWriteTool(tool: ToolDefinition): boolean {
  // Only explicitly read-only tools are exempt
  if (tool.annotations?.readOnlyHint === true) return false;
  // Everything else (readOnlyHint: false, undefined, or missing annotations) is a write tool
  return true;
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
    // Defense-in-depth: warn about unannotated tools that are blocked
    if (!tool.annotations) {
      logger.warn(
        `Tool '${tool.name}' has no annotations — blocked in readonly mode (add annotations)`,
        {
          module: "CODEMODE" as const,
          operation: "readonlyGuard",
        },
      );
    }

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

  // M-3: vm mode lacks frozen prototypes and Proxy nullification — not safe
  // for production or untrusted code. Require explicit opt-in via
  // CODEMODE_ISOLATION_INSECURE=1 to prevent operator misconfiguration.
  let mode: SandboxMode = "worker";
  if (modeEnv === "vm") {
    const insecureAck =
      process.env["CODEMODE_ISOLATION_INSECURE"]?.toLowerCase();
    if (insecureAck === "1" || insecureAck === "true") {
      mode = "vm";
      logger.warning(
        "CODEMODE_ISOLATION=vm with CODEMODE_ISOLATION_INSECURE=1: " +
          "VM sandbox shares host prototypes without freezing. " +
          "Use worker mode for production deployments.",
        { module: "CODEMODE" as const, operation: "initialize" },
      );
    } else {
      logger.warning(
        "CODEMODE_ISOLATION=vm requires CODEMODE_ISOLATION_INSECURE=1 to acknowledge " +
          "unfrozen host prototypes. Falling back to worker mode.",
        { module: "CODEMODE" as const, operation: "initialize" },
      );
    }
  }

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
