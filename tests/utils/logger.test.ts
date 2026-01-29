/**
 * Logger Security Tests
 *
 * Tests for the logger's security features:
 * - Sensitive key redaction (passwords, tokens, secrets)
 * - Log injection prevention (newlines, control characters)
 * - Stack trace sanitization
 * - Module-prefixed error codes
 *
 * Phase 5 of db-mcp Security Test Coverage Improvement Plan
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  Logger,
  ModuleLogger,
  LogLevel,
  LogModule,
  createErrorCode,
  ERROR_CODES,
  createModuleLogger,
  logger as defaultLogger,
} from "../../src/utils/logger.js";

describe("Logger Security", () => {
  let logger: Logger;
  let stderrOutput: string[];

  beforeEach(() => {
    logger = new Logger();
    logger.setLevel("debug"); // Enable all log levels
    stderrOutput = [];

    // Capture stderr output
    vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      stderrOutput.push(args.map(String).join(" "));
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // Sensitive Key Redaction Tests
  // ==========================================================================

  describe("sensitive key redaction", () => {
    it("should redact password field", () => {
      logger.info("User login", { password: "secret123" });

      const output = stderrOutput.join("\n");
      expect(output).toContain("[REDACTED]");
      expect(output).not.toContain("secret123");
    });

    it("should redact token field", () => {
      logger.info("Auth check", { token: "eyJhbGciOiJIUzI1NiJ9.xyz" });

      const output = stderrOutput.join("\n");
      expect(output).toContain("[REDACTED]");
      expect(output).not.toContain("eyJhbGciOiJIUzI1NiJ9");
    });

    it("should redact api_key field", () => {
      logger.info("API call", { api_key: "sk_live_abc123" });

      const output = stderrOutput.join("\n");
      expect(output).toContain("[REDACTED]");
      expect(output).not.toContain("sk_live_abc123");
    });

    it("should redact access_token field", () => {
      logger.info("OAuth", { access_token: "gho_xxxxx" });

      const output = stderrOutput.join("\n");
      expect(output).toContain("[REDACTED]");
      expect(output).not.toContain("gho_xxxxx");
    });

    it("should redact refresh_token field", () => {
      logger.info("Token refresh", { refresh_token: "rt_secret" });

      const output = stderrOutput.join("\n");
      expect(output).toContain("[REDACTED]");
      expect(output).not.toContain("rt_secret");
    });

    it("should redact client_secret field", () => {
      logger.info("OAuth config", { client_secret: "cs_hidden" });

      const output = stderrOutput.join("\n");
      expect(output).toContain("[REDACTED]");
      expect(output).not.toContain("cs_hidden");
    });

    it("should redact authorization field", () => {
      logger.info("Request", { authorization: "Bearer xyz" });

      const output = stderrOutput.join("\n");
      expect(output).toContain("[REDACTED]");
      expect(output).not.toContain("Bearer xyz");
    });

    it("should redact credential field", () => {
      logger.info("Auth", { credential: "user:pass" });

      const output = stderrOutput.join("\n");
      expect(output).toContain("[REDACTED]");
      expect(output).not.toContain("user:pass");
    });

    it("should redact nested sensitive fields", () => {
      logger.info("Config", {
        auth: {
          password: "nested_secret",
        },
      });

      const output = stderrOutput.join("\n");
      expect(output).toContain("[REDACTED]");
      expect(output).not.toContain("nested_secret");
    });

    it("should redact fields containing sensitive key names", () => {
      // Fields like "userPassword" should also be redacted
      logger.info("User", { userPassword: "also_secret" });

      const output = stderrOutput.join("\n");
      expect(output).toContain("[REDACTED]");
      expect(output).not.toContain("also_secret");
    });

    it("should preserve non-sensitive fields", () => {
      logger.info("User info", {
        username: "alice",
        email: "alice@test.com",
        id: 123,
      });

      const output = stderrOutput.join("\n");
      expect(output).toContain("alice");
      expect(output).toContain("alice@test.com");
      expect(output).toContain("123");
    });

    it("should redact OAuth configuration fields", () => {
      logger.info("OAuth setup", {
        jwks_uri: "https://auth.example.com/.well-known/jwks.json",
        issuer: "https://auth.example.com",
      });

      const output = stderrOutput.join("\n");
      expect(output).toContain("[REDACTED]");
      expect(output).not.toContain("auth.example.com");
    });
  });

  // ==========================================================================
  // Log Injection Prevention Tests
  // ==========================================================================

  describe("log injection prevention", () => {
    it("should sanitize newlines in messages", () => {
      logger.info("Line 1\nInjected line 2");

      const output = stderrOutput.join("\n");
      // Should not have the injected line as a separate log entry
      expect(output).not.toContain("\nInjected");
      // Should have been converted to space
      expect(output).toContain("Line 1");
      expect(output).toContain("Injected line 2");
    });

    it("should sanitize carriage returns in messages", () => {
      logger.info("Real log\rFake log entry");

      const output = stderrOutput.join("\n");
      expect(output).not.toContain("\rFake");
    });

    it("should sanitize CRLF in messages", () => {
      logger.info("First\r\nSecond\r\nThird");

      const output = stderrOutput.join("\n");
      // Each line should appear but not as separate log entries
      expect(stderrOutput.length).toBe(1);
    });

    it("should sanitize null bytes in messages", () => {
      logger.info("Before\x00After");

      const output = stderrOutput.join("\n");
      expect(output).not.toContain("\x00");
      expect(output).toContain("Before");
      expect(output).toContain("After");
    });

    it("should sanitize tab characters in messages", () => {
      logger.info("Col1\tCol2");

      const output = stderrOutput.join("\n");
      expect(output).not.toContain("\t");
    });

    it("should sanitize backspace characters in messages", () => {
      logger.info("Clean\b\b\b\b\bEvil");

      const output = stderrOutput.join("\n");
      expect(output).not.toContain("\b");
    });

    it("should sanitize bell characters in messages", () => {
      logger.info("Alert\x07Alert");

      const output = stderrOutput.join("\n");
      expect(output).not.toContain("\x07");
    });

    it("should sanitize escape sequences in messages", () => {
      logger.info("Normal\x1b[31mRed\x1b[0m");

      const output = stderrOutput.join("\n");
      expect(output).not.toContain("\x1b");
    });
  });

  // ==========================================================================
  // Stack Trace Sanitization Tests
  // ==========================================================================

  describe("stack trace sanitization", () => {
    it("should sanitize newlines in stack traces", () => {
      logger.setIncludeStacks(true);
      const error = new Error("Test error");

      logger.error("Failed", { error });

      const output = stderrOutput.join(" || ");
      // Stack trace should be on single line with arrow separators
      expect(output).toContain("Stack:");
      // Should contain arrow separators instead of newlines
      expect(output).toContain("→");
    });

    it("should include stack for error level", () => {
      logger.setIncludeStacks(true);
      const error = new Error("Test");
      error.stack = "Error: Test\n    at test.js:1:1";

      logger.error("Error occurred", { stack: error.stack });

      const output = stderrOutput.join("\n");
      expect(output).toContain("Stack:");
    });

    it("should include stack for critical level", () => {
      logger.setIncludeStacks(true);
      const error = new Error("Critical issue");

      logger.critical("System critical", { error });

      const output = stderrOutput.join("\n");
      expect(output).toContain("Stack:");
    });

    it("should not include stack when disabled", () => {
      logger.setIncludeStacks(false);
      const error = new Error("Test");

      logger.error("Error occurred", { error });

      const output = stderrOutput.join("\n");
      expect(output).not.toContain("Stack:");
    });
  });

  // ==========================================================================
  // Error Code Tests
  // ==========================================================================

  describe("error codes", () => {
    it("should create properly formatted error codes", () => {
      const code = createErrorCode("DB", "CONNECT_FAILED");

      expect(code.module).toBe("DB");
      expect(code.code).toBe("CONNECT_FAILED");
      expect(code.full).toBe("DB_CONNECT_FAILED");
    });

    it("should uppercase module and code", () => {
      const code = createErrorCode("auth", "token_invalid");

      expect(code.module).toBe("AUTH");
      expect(code.code).toBe("TOKEN_INVALID");
      expect(code.full).toBe("AUTH_TOKEN_INVALID");
    });

    it("should include predefined error codes", () => {
      expect(ERROR_CODES.AUTH.TOKEN_INVALID.full).toBe("AUTH_TOKEN_INVALID");
      expect(ERROR_CODES.DB.CONNECT_FAILED.full).toBe("DB_CONNECT_FAILED");
      expect(ERROR_CODES.SERVER.START_FAILED.full).toBe("SERVER_START_FAILED");
    });

    it("should include code in log output", () => {
      logger.error("Failed", { code: "DB_QUERY_FAILED" });

      const output = stderrOutput.join("\n");
      expect(output).toContain("[DB_QUERY_FAILED]");
    });
  });

  // ==========================================================================
  // Log Level Tests
  // ==========================================================================

  describe("log level filtering", () => {
    it("should respect minimum log level", () => {
      logger.setLevel("error");

      logger.debug("Debug message");
      logger.info("Info message");
      logger.error("Error message");

      // Only error should be logged
      expect(stderrOutput.length).toBe(1);
      expect(stderrOutput[0]).toContain("Error message");
    });

    it("should log at all levels when set to debug", () => {
      logger.setLevel("debug");

      logger.debug("Debug");
      logger.info("Info");
      logger.warning("Warning");
      logger.error("Error");

      expect(stderrOutput.length).toBe(4);
    });

    it("should get current log level", () => {
      logger.setLevel("warning");
      expect(logger.getLevel()).toBe("warning");
    });
  });

  // ==========================================================================
  // Module Logger Tests
  // ==========================================================================

  describe("module logger", () => {
    it("should create module-scoped logger", () => {
      const dbLogger = logger.forModule("DB");

      dbLogger.info("Database operation");

      const output = stderrOutput.join("\n");
      expect(output).toContain("[DB]");
    });

    it("should create module logger using child method", () => {
      const authLogger = logger.child("AUTH");

      authLogger.error("Auth failed");

      const output = stderrOutput.join("\n");
      expect(output).toContain("[AUTH]");
      expect(output).toContain("[ERROR]");
    });

    it("should create module logger using factory function", () => {
      const moduleLogger = createModuleLogger("TOOLS");

      expect(moduleLogger).toBeInstanceOf(ModuleLogger);
    });
  });

  // ==========================================================================
  // Logger Configuration Tests
  // ==========================================================================

  describe("logger configuration", () => {
    it("should set and get logger name", () => {
      logger.setLoggerName("test-app");
      expect(logger.getLoggerName()).toBe("test-app");
    });

    it("should set default module", () => {
      logger.setDefaultModule("ADAPTER");
      logger.info("No module specified");

      const output = stderrOutput.join("\n");
      expect(output).toContain("[ADAPTER]");
    });
  });

  // ==========================================================================
  // Default Logger Tests
  // ==========================================================================

  describe("default logger instance", () => {
    it("should have a default logger instance", () => {
      expect(defaultLogger).toBeInstanceOf(Logger);
    });
  });

  // ==========================================================================
  // Log Format Tests
  // ==========================================================================

  describe("log format", () => {
    it("should include timestamp in ISO format", () => {
      logger.info("Test message");

      const output = stderrOutput[0];
      // Should match ISO date format [2025-12-18T01:30:00.000Z]
      expect(output).toMatch(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\]/);
    });

    it("should include level in uppercase", () => {
      logger.warning("Warning message");

      const output = stderrOutput[0];
      expect(output).toContain("[WARNING]");
    });

    it("should include module", () => {
      logger.info("Test", { module: "QUERY" as LogModule });

      const output = stderrOutput[0];
      expect(output).toContain("[QUERY]");
    });
  });
});
