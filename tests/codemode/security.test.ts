/**
 * CodeModeSecurityManager Unit Tests
 *
 * Tests code validation, rate limiting, result sanitization, and audit logging.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { CodeModeSecurityManager } from "../../src/codemode/security.js";

describe("CodeModeSecurityManager", () => {
  let security: CodeModeSecurityManager;

  beforeEach(() => {
    security = new CodeModeSecurityManager();
  });

  // ===========================================================================
  // validateCode
  // ===========================================================================

  describe("validateCode", () => {
    it("should accept valid code", () => {
      const result = security.validateCode("return 42;");
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should reject empty string", () => {
      const result = security.validateCode("");
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Code must be a non-empty string");
    });

    it("should reject non-string input", () => {
      const result = security.validateCode(null as unknown as string);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Code must be a non-empty string");
    });

    it("should reject code exceeding max length", () => {
      const longCode = "x".repeat(60 * 1024); // > 50KB default
      const result = security.validateCode(longCode);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("exceeds maximum length");
    });

    it("should respect custom max code length", () => {
      const customSecurity = new CodeModeSecurityManager({
        maxCodeLength: 10,
      });
      const result = customSecurity.validateCode("x".repeat(11));
      expect(result.valid).toBe(false);
    });

    it("should block require()", () => {
      const result = security.validateCode('const fs = require("fs");');
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("Blocked pattern"))).toBe(
        true,
      );
    });

    it("should block dynamic import()", () => {
      const result = security.validateCode('await import("fs");');
      expect(result.valid).toBe(false);
    });

    it("should block process access", () => {
      const result = security.validateCode("process.exit(1);");
      expect(result.valid).toBe(false);
    });

    it("should block eval()", () => {
      const result = security.validateCode('eval("dangerous");');
      expect(result.valid).toBe(false);
    });

    it("should block Function constructor", () => {
      const result = security.validateCode('new Function("return this")();');
      expect(result.valid).toBe(false);
    });

    it("should block __proto__", () => {
      const result = security.validateCode("obj.__proto__ = {};");
      expect(result.valid).toBe(false);
    });

    it("should block constructor.constructor chaining", () => {
      const result = security.validateCode(
        "({}).constructor.constructor('return this')()",
      );
      expect(result.valid).toBe(false);
    });

    it("should block child_process", () => {
      const result = security.validateCode("child_process.exec('ls');");
      expect(result.valid).toBe(false);
    });

    it("should block fs access", () => {
      const result = security.validateCode("fs.readFileSync('/etc/passwd');");
      expect(result.valid).toBe(false);
    });

    it("should short-circuit and return the first violation", () => {
      const result = security.validateCode(
        'require("fs"); process.exit(); eval("x");',
      );
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBe(1);
    });

    it("should allow safe code patterns", () => {
      const result = security.validateCode(
        "const x = JSON.stringify({ a: 1 }); return x;",
      );
      expect(result.valid).toBe(true);
    });

    it("should allow sqlite API usage", () => {
      const result = security.validateCode(
        "const tables = await sqlite.core.listTables(); return tables;",
      );
      expect(result.valid).toBe(true);
    });
  });

  // ===========================================================================
  // checkRateLimit / getRateLimitRemaining
  // ===========================================================================

  describe("checkRateLimit", () => {
    it("should allow first request", async () => {
      expect(await security.checkRateLimit("client-1")).toBe(true);
    });

    it("should allow requests within limit", async () => {
      const customSecurity = new CodeModeSecurityManager({
        maxExecutionsPerMinute: 5,
      });
      for (let i = 0; i < 5; i++) {
        expect(await customSecurity.checkRateLimit("client-1")).toBe(true);
      }
    });

    it("should reject when rate limit exceeded", async () => {
      const customSecurity = new CodeModeSecurityManager({
        maxExecutionsPerMinute: 2,
      });
      expect(await customSecurity.checkRateLimit("client-1")).toBe(true);
      expect(await customSecurity.checkRateLimit("client-1")).toBe(true);
      expect(await customSecurity.checkRateLimit("client-1")).toBe(false);
    });

    it("should track rate limits per client", async () => {
      const customSecurity = new CodeModeSecurityManager({
        maxExecutionsPerMinute: 1,
      });
      expect(await customSecurity.checkRateLimit("client-a")).toBe(true);
      expect(await customSecurity.checkRateLimit("client-b")).toBe(true);
      expect(await customSecurity.checkRateLimit("client-a")).toBe(false);
      expect(await customSecurity.checkRateLimit("client-b")).toBe(false);
    });
  });

  describe("getRateLimitRemaining", () => {
    it("should return full limit for unknown client", async () => {
      expect(await security.getRateLimitRemaining("new-client")).toBe(10);
    });

    it("should decrease after usage", async () => {
      const customSecurity = new CodeModeSecurityManager({
        maxExecutionsPerMinute: 5,
      });
      await customSecurity.checkRateLimit("client");
      await customSecurity.checkRateLimit("client");
      expect(await customSecurity.getRateLimitRemaining("client")).toBe(3);
    });

    it("should not go below zero", async () => {
      const customSecurity = new CodeModeSecurityManager({
        maxExecutionsPerMinute: 1,
      });
      await customSecurity.checkRateLimit("client");
      await customSecurity.checkRateLimit("client");
      expect(await customSecurity.getRateLimitRemaining("client")).toBe(0);
    });
  });

  // ===========================================================================
  // sanitizeResult
  // ===========================================================================

  describe("sanitizeResult", () => {
    it("should pass through normal results", () => {
      const data = { tables: ["a", "b"], count: 42 };
      expect(security.sanitizeResult(data)).toEqual(data);
    });

    it("should truncate oversized results", () => {
      const customSecurity = new CodeModeSecurityManager({
        maxResultSize: 100,
      });
      const bigData = { data: "x".repeat(200) };
      const result = customSecurity.sanitizeResult(bigData) as Record<
        string,
        unknown
      >;
      expect(result._truncated).toBe(true);
      expect(result._originalSize).toBeGreaterThan(100);
      expect(result._maxSize).toBe(100);
      expect(typeof result.preview).toBe("string");
    });

    it("should handle non-serializable results", () => {
      const circular: Record<string, unknown> = {};
      circular.self = circular;
      const result = security.sanitizeResult(circular) as Record<
        string,
        unknown
      >;
      expect(result._error).toBe("Result could not be serialized");
      expect(result._type).toBe("object");
    });

    it("should handle null", () => {
      expect(security.sanitizeResult(null)).toBeNull();
    });

    it("should handle undefined", () => {
      expect(security.sanitizeResult(undefined)).toBeUndefined();
    });

    it("should handle primitive values", () => {
      expect(security.sanitizeResult(42)).toBe(42);
      expect(security.sanitizeResult("hello")).toBe("hello");
      expect(security.sanitizeResult(true)).toBe(true);
    });
  });

  // ===========================================================================
  // auditLog
  // ===========================================================================

  describe("auditLog", () => {
    it("should log successful execution without throwing", () => {
      const record = security.createExecutionRecord(
        "return 1;",
        {
          success: true,
          result: 1,
          metrics: { wallTimeMs: 10, cpuTimeMs: 8, memoryUsedMb: 1 },
        },
        false,
        "user-1",
      );
      expect(() => security.auditLog(record)).not.toThrow();
    });

    it("should log failed execution without throwing", () => {
      const record = security.createExecutionRecord(
        "throw new Error('fail');",
        {
          success: false,
          error: "fail",
          stack: "Error: fail\n    at ...",
          metrics: { wallTimeMs: 5, cpuTimeMs: 3, memoryUsedMb: 0.5 },
        },
        true,
        "user-2",
      );
      expect(() => security.auditLog(record)).not.toThrow();
    });
  });

  // ===========================================================================
  // createExecutionRecord
  // ===========================================================================

  describe("createExecutionRecord", () => {
    it("should create a record with UUID and timestamp", () => {
      const record = security.createExecutionRecord(
        "return 1;",
        {
          success: true,
          metrics: { wallTimeMs: 1, cpuTimeMs: 1, memoryUsedMb: 0 },
        },
        false,
      );
      expect(record.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
      expect(record.timestamp).toBeInstanceOf(Date);
      expect(record.readonly).toBe(false);
    });

    it("should truncate long code preview", () => {
      const longCode = "x".repeat(300);
      const record = security.createExecutionRecord(
        longCode,
        {
          success: true,
          metrics: { wallTimeMs: 1, cpuTimeMs: 1, memoryUsedMb: 0 },
        },
        true,
      );
      expect(record.codePreview.length).toBeLessThanOrEqual(203); // 200 + "..."
      expect(record.codePreview).toContain("...");
    });

    it("should keep short code preview as-is", () => {
      const shortCode = "return 42;";
      const record = security.createExecutionRecord(
        shortCode,
        {
          success: true,
          metrics: { wallTimeMs: 1, cpuTimeMs: 1, memoryUsedMb: 0 },
        },
        false,
      );
      expect(record.codePreview).toBe(shortCode);
    });

    it("should include clientId when provided", () => {
      const record = security.createExecutionRecord(
        "code",
        {
          success: true,
          metrics: { wallTimeMs: 0, cpuTimeMs: 0, memoryUsedMb: 0 },
        },
        false,
        "client-xyz",
      );
      expect(record.clientId).toBe("client-xyz");
    });

    it("should leave clientId undefined when not provided", () => {
      const record = security.createExecutionRecord(
        "code",
        {
          success: true,
          metrics: { wallTimeMs: 0, cpuTimeMs: 0, memoryUsedMb: 0 },
        },
        false,
      );
      expect(record.clientId).toBeUndefined();
    });
  });

  // ===========================================================================
  // cleanupRateLimits
  // ===========================================================================

  describe("cleanupRateLimits", () => {
    it("should clean up expired entries", async () => {
      const customSecurity = new CodeModeSecurityManager({
        maxExecutionsPerMinute: 10,
      });
      // Force an entry
      await customSecurity.checkRateLimit("old-client");
      // After cleanup immediately, the entry should still be active
      customSecurity.cleanupRateLimits();
      // Remaining should be 9 (1 used, not expired yet)
      expect(await customSecurity.getRateLimitRemaining("old-client")).toBe(9);
    });

    it("should not throw when no entries exist", () => {
      expect(() => security.cleanupRateLimits()).not.toThrow();
    });
  });
});
