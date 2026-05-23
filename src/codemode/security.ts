/**
 * db-mcp - Code Mode Security
 *
 * Input validation, rate limiting, and audit logging for code execution.
 */

import { logger } from "../utils/logger/index.js";
import {
  DEFAULT_SECURITY_CONFIG,
  type SecurityConfig,
  type ValidationResult,
  type ExecutionRecord,
  type SandboxResult,
} from "./types.js";

/**
 * Security manager for Code Mode executions
 */
export class CodeModeSecurityManager {
  private readonly config: SecurityConfig;
  private readonly rateLimitMap = new Map<
    string,
    { count: number; resetTime: number }
  >();

  constructor(config?: Partial<SecurityConfig>) {
    this.config = { ...DEFAULT_SECURITY_CONFIG, ...config };
  }

  /**
   * Validate code before execution
   */
  validateCode(code: string): ValidationResult {
    const errors: string[] = [];

    // Check code length
    if (!code || typeof code !== "string") {
      errors.push("Code must be a non-empty string");
      return { valid: false, errors };
    }

    if (code.length > this.config.maxCodeLength) {
      errors.push(
        `Code exceeds maximum length of ${String(this.config.maxCodeLength)} bytes`,
      );
      return { valid: false, errors };
    }

    // Check for blocked patterns
    for (const pattern of this.config.blockedPatterns) {
      if (pattern.test(code)) {
        errors.push(`Blocked pattern detected: ${pattern.source}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Check rate limit for a client
   * @returns true if within limits, false if rate limited
   */
  checkRateLimit(clientId: string): boolean {
    const now = Date.now();
    const windowMs = 60000; // 1 minute window

    const existing = this.rateLimitMap.get(clientId);

    if (!existing || now >= existing.resetTime) {
      // Start new window
      this.rateLimitMap.set(clientId, {
        count: 1,
        resetTime: now + windowMs,
      });
      return true;
    }

    if (existing.count >= this.config.maxExecutionsPerMinute) {
      return false;
    }

    existing.count++;
    return true;
  }

  /**
   * Get remaining rate limit for a client
   */
  getRateLimitRemaining(clientId: string): number {
    const existing = this.rateLimitMap.get(clientId);
    if (!existing || Date.now() >= existing.resetTime) {
      return this.config.maxExecutionsPerMinute;
    }
    return Math.max(0, this.config.maxExecutionsPerMinute - existing.count);
  }

  /**
   * Sanitize and truncate result if too large
   */
  sanitizeResult(result: unknown): unknown {
    if (result === undefined) {
      return undefined;
    }

    try {
      const serialized = JSON.stringify(result);
      if (serialized === undefined) {
        throw new Error("Not serializable");
      }
      if (serialized.length > this.config.maxResultSize) {
        return {
          _truncated: true,
          _originalSize: serialized.length,
          _maxSize: this.config.maxResultSize,
          preview: serialized.substring(0, 1000) + "...",
        };
      }
      return result;
    } catch {
      return {
        _error: "Result could not be serialized",
        _type: typeof result,
      };
    }
  }

  /**
   * Log execution for audit purposes
   */
  auditLog(execution: ExecutionRecord): void {
    const { id, clientId, codePreview, result, readonly } = execution;

    const logContext = {
      module: "CODEMODE" as const,
      operation: "execute",
      entityId: id,
      clientId: clientId ?? "anonymous",
      readonly,
      success: result.success,
      wallTimeMs: result.metrics.wallTimeMs,
      memoryUsedMb: result.metrics.memoryUsedMb,
    };

    if (result.success) {
      // L-6: Redact common credential patterns from code preview before logging
      // to prevent leaking embedded secrets (e.g., `const key = "sk-live-..."`)
      const safePreview = codePreview
        .substring(0, 50)
        .replace(
          // L-2: Extended credential pattern covering common cloud/SaaS prefixes
          /(?:sk-|Bearer |token\s*[:=]\s*|password\s*[:=]\s*|secret\s*[:=]\s*|apikey\s*[:=]\s*|api_key\s*[:=]\s*|AWS_SECRET_ACCESS_KEY\s*[:=]\s*|GITHUB_TOKEN\s*[:=]\s*|ghp_|gho_|ghu_|ghs_|xoxb-|xoxp-|xoxs-|AZURE_[A-Z_]*\s*[:=]\s*)[^\s'",;)}\]]{4,}/gi,
          "[REDACTED]",
        );
      logger.info(
        `Code execution completed: ${safePreview}...`,
        logContext,
      );
    } else {
      logger.warning(
        `Code execution failed: ${result.error ?? "unknown error"}`,
        {
          ...logContext,
          ...(result.error !== undefined ? { errorMessage: result.error } : {}),
          ...(result.stack !== undefined ? { stack: result.stack } : {}),
        },
      );
    }
  }

  /**
   * Create execution record for audit
   */
  createExecutionRecord(
    code: string,
    result: SandboxResult,
    readonly: boolean,
    clientId?: string,
  ): ExecutionRecord {
    return {
      id: crypto.randomUUID(),
      clientId,
      timestamp: new Date(),
      codePreview: code.length > 200 ? code.substring(0, 200) + "..." : code,
      result,
      readonly,
    };
  }

  /**
   * Clean up old rate limit entries
   */
  cleanupRateLimits(): void {
    const now = Date.now();
    for (const [clientId, entry] of this.rateLimitMap) {
      if (now >= entry.resetTime) {
        this.rateLimitMap.delete(clientId);
      }
    }
  }
}
