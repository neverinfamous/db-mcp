/**
 * db-mcp — Audit Interceptor
 *
 * Wraps tool execution to produce audit entries for all tool
 * invocations. Write/admin tools are always logged; read-scoped
 * tools are logged only when `--audit-reads` is enabled.
 *
 * Each entry includes a `tokenEstimate` (~4 bytes per token)
 * computed from the serialized result size.
 *
 * When a BackupManager is provided, captures pre-mutation
 * snapshots of target objects before destructive tool execution.
 *
 * The interceptor is injected into the registration layer
 * so that all tool handlers are audited without per-handler changes.
 *
 * OAuth identity (`user`/`scopes`) is read from AsyncLocalStorage
 * via `getAuthContext()`. When OAuth is configured, the HTTP
 * transport binds the validated auth context before MCP dispatch.
 * When OAuth is not configured (stdio, no auth), fields are `null`/`[]`.
 */

import { performance } from "node:perf_hooks";
import type { AuditLogger } from "./logger.js";
import type { BackupManager, SnapshotQueryAdapter } from "./backup-manager.js";
import type { AuditCategory } from "./types.js";
import { getAuthContext } from "../auth/auth-context.js";
import { getRequiredScope } from "../auth/scope-map.js";
import { sanitizeErrorMessage } from "../utils/errors/format.js";

/**
 * Keys that are always redacted from audit log args, regardless of the
 * global `redact` setting. Prevents credential echo (M-5 mitigation).
 */
const SENSITIVE_KEY_PATTERN =
  /^(password|passwd|token|secret|authorization|api_?key|credential|private_?key|access_?token|refresh_?token)$/i;

/**
 * Values that match this pattern are redacted from strings (like SQL queries).
 */
const SENSITIVE_VALUE_PATTERN =
  /(?:sk-|Bearer |token\s*[:=]\s*|password\s*[:=]\s*|secret\s*[:=]\s*|apikey\s*[:=]\s*|api_key\s*[:=]\s*|AWS_SECRET_ACCESS_KEY\s*[:=]\s*|GITHUB_TOKEN\s*[:=]\s*|ghp_|gho_|ghu_|ghs_|xoxb-|xoxp-|xoxs-|AZURE_[A-Z_]*\s*[:=]\s*|DATABASE_URL\s*[:=]\s*|AKIA|sk-ant-api[a-zA-Z0-9_-]+|sk_live_[a-zA-Z0-9_]+|rk_live_[a-zA-Z0-9_]+|SG\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+|npm_[a-zA-Z0-9]{30,}|dpl_[a-zA-Z0-9]{30,}|hvs\.[a-zA-Z0-9_-]+)[^\s'",;)}\]]{4,}/gi;

/**
 * Recursively redact sensitive keys from args before logging.
 * Returns a new object with sensitive values replaced by '[REDACTED]'.
 * Handles nested objects and arrays up to a configurable depth limit.
 */
function redactSensitiveKeys(
  value: unknown,
  depth = 0,
): unknown {
  const MAX_DEPTH = 5;
  if (depth > MAX_DEPTH || value === null || value === undefined) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactSensitiveKeys(item, depth + 1));
  }

  if (typeof value === "string") {
    const isSql = /^\s*(?:SELECT|INSERT|UPDATE|DELETE|WITH|CREATE|ALTER|DROP|PRAGMA)\b/i.test(value);
    const scrubbed = isSql ? value.replace(/'(?:''|[^'])*'/g, "'***'") : value;
    return scrubbed.replace(SENSITIVE_VALUE_PATTERN, "[REDACTED]");
  }

  if (typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEY_PATTERN.test(key)) {
        result[key] = "[REDACTED]";
      } else if (typeof val === "object" && val !== null) {
        result[key] = redactSensitiveKeys(val, depth + 1);
      } else if (typeof val === "string") {
        const isSql = key.toLowerCase() === "sql" || key.toLowerCase() === "query" || /^\s*(?:SELECT|INSERT|UPDATE|DELETE|WITH|CREATE|ALTER|DROP|PRAGMA)\b/i.test(val);
        const scrubbed = isSql ? val.replace(/'(?:''|[^'])*'/g, "'***'") : val;
        result[key] = scrubbed.replace(SENSITIVE_VALUE_PATTERN, "[REDACTED]");
      } else {
        result[key] = val;
      }
    }
    return result;
  }

  return value;
}

/**
 * Audit interceptor interface — used by the registration layer.
 */
export interface AuditInterceptor {
  /**
   * Wrap a tool invocation with audit logging.
   * Returns the tool result unchanged; re-throws any errors.
   *
   * @param toolName  MCP tool name
   * @param args      Tool input arguments
   * @param requestId Request ID from RequestContext
   * @param fn        The actual tool handler to execute
   * @param options   Optional configuration, such as overriding the recorded tool name
   */
  around<T>(
    toolName: string,
    args: unknown,
    requestId: string,
    fn: () => Promise<T>,
    options?: { logAs?: string },
  ): Promise<T>;

  /**
   * Dynamically wire the query adapter used for DDL snapshot capture.
   */
  setQueryAdapter(adapter: SnapshotQueryAdapter): void;
}

/**
 * Write/admin scopes are always audited.
 * Read scope is audited only when `auditReads` is enabled.
 */
const ALWAYS_AUDITED_SCOPES = new Set(["write", "admin"]);

/**
 * Map a scope string to an AuditCategory.
 */
function scopeToCategory(scope: string): AuditCategory {
  if (scope === "admin") return "admin";
  if (scope === "read") return "read";
  return "write";
}

/**
 * Create an audit interceptor bound to the given logger.
 *
 * @param auditLogger  The JSONL audit logger
 * @param backupManager Optional backup manager for pre-mutation snapshots
 * @param queryAdapter  Optional query adapter for snapshot DDL capture
 */
export function createAuditInterceptor(
  auditLogger: AuditLogger,
  backupManager?: BackupManager,
): AuditInterceptor {
  const auditReads = auditLogger.config.auditReads;
  let currentQueryAdapter: SnapshotQueryAdapter | undefined;

  return {
    setQueryAdapter(adapter: SnapshotQueryAdapter) {
      currentQueryAdapter = adapter;
    },

    async around<T>(
      toolName: string,
      args: unknown,
      requestId: string,
      fn: () => Promise<T>,
      options?: { logAs?: string },
    ): Promise<T> {
      const scope = getRequiredScope(toolName);

      // Read-scoped tools are only audited when --audit-reads is enabled
      if (!ALWAYS_AUDITED_SCOPES.has(scope) && !auditReads) {
        return fn();
      }

      const isReadScope = scope === "read";
      const authCtx = getAuthContext();
      const start = performance.now();
      let success = true;
      let error: string | undefined;
      let backupRef: string | undefined;
      let tokenEstimate: number | undefined;

      // Pre-mutation snapshot (before tool executes)
      if (
        backupManager !== undefined &&
        currentQueryAdapter !== undefined &&
        (
          backupManager as { shouldSnapshot(t: string): boolean }
        ).shouldSnapshot(toolName)
      ) {
        try {
          backupRef = await (
            backupManager as {
              createSnapshot(
                t: string,
                a: unknown,
                r: string,
                qa: SnapshotQueryAdapter,
                l?: string,
              ): Promise<string | undefined>;
            }
          ).createSnapshot(
            toolName,
            args ?? {},
            requestId,
            currentQueryAdapter,
            options?.logAs,
          );
        } catch {
          // Snapshot failure must not block tool execution
        }
      }

      try {
        const result = await fn();

        // Compute token estimate from result (~4 bytes per token)
        if (typeof result === "object" && result !== null) {
          try {
            // Match registration layer exact payload token calculation (minified + _meta)
            const json = JSON.stringify({
              ...result,
              _meta: { tokenEstimate: 0 },
            });
            tokenEstimate = Math.ceil(Buffer.byteLength(json, "utf8") / 4);
          } catch {
            // Serialization failure must not block tool execution
          }
        } else if (typeof result === "string") {
          tokenEstimate = Math.ceil(Buffer.byteLength(result, "utf8") / 4);
        }

        return result;
      } catch (err) {
        success = false;
        error = sanitizeErrorMessage(err instanceof Error ? err.message : String(err));

        // Match registration layer raw exception fallback token calculation
        const errorResult = {
          success: false,
          error: error,
          code: "INTERNAL_ERROR",
          category: "internal",
          recoverable: false,
        };
        const enriched = JSON.stringify({
          ...errorResult,
          _meta: { tokenEstimate: 0 },
        });
        tokenEstimate = Math.ceil(Buffer.byteLength(enriched, "utf8") / 4);

        throw err; // Re-throw — don't swallow
      } finally {
        const durationMs = Math.round(performance.now() - start);

        if (isReadScope) {
          // Compact read entries — omit args, user, scopes for ~100 byte entries
          auditLogger.log({
            timestamp: new Date().toISOString(),
            requestId,
            tool: options?.logAs ?? toolName,
            category: "read",
            scope,
            durationMs,
            success,
            error,
            tokenEstimate,
          } as Parameters<typeof auditLogger.log>[0]);
        } else {
          auditLogger.log({
            timestamp: new Date().toISOString(),
            requestId,
            tool: options?.logAs ?? toolName,
            category: scopeToCategory(scope),
            scope,
            user: authCtx?.claims?.sub ?? null,
            scopes: authCtx?.scopes ?? [],
            durationMs,
            success,
            error,
            args: auditLogger.config.redact
              ? undefined
              : redactSensitiveKeys(args) as Record<string, unknown>,
            backup: backupRef,
            tokenEstimate,
          });
        }
      }
    },
  };
}
