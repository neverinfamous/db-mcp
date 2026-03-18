/**
 * WorkerSandbox + WorkerSandboxPool Unit Tests
 *
 * Tests the worker_threads-based sandbox and its pool management.
 * Focuses on testable parts: serialization, lifecycle, pool logic.
 */

import { describe, it, expect, afterEach } from "vitest";
import {
  WorkerSandbox,
  WorkerSandboxPool,
} from "../../src/codemode/worker-sandbox.js";

// =============================================================================
// WorkerSandbox
// =============================================================================

describe("WorkerSandbox", () => {
  describe("create", () => {
    it("should create a healthy sandbox with default options", () => {
      const sandbox = WorkerSandbox.create();
      expect(sandbox.isHealthy()).toBe(true);
      sandbox.dispose();
    });

    it("should accept custom options", () => {
      const sandbox = WorkerSandbox.create({ timeoutMs: 5000 });
      expect(sandbox.isHealthy()).toBe(true);
      sandbox.dispose();
    });
  });

  describe("lifecycle", () => {
    it("should report healthy before dispose", () => {
      const sandbox = WorkerSandbox.create();
      expect(sandbox.isHealthy()).toBe(true);
      sandbox.dispose();
    });

    it("should report unhealthy after dispose", () => {
      const sandbox = WorkerSandbox.create();
      sandbox.dispose();
      expect(sandbox.isHealthy()).toBe(false);
    });

    it("should return error when executing on disposed sandbox", async () => {
      const sandbox = WorkerSandbox.create();
      sandbox.dispose();
      const result = await sandbox.execute("return 1;", {});
      expect(result.success).toBe(false);
      expect(result.error).toBe("Sandbox has been disposed");
      expect(result.metrics.wallTimeMs).toBe(0);
    });
  });

  describe("serializeBindings", () => {
    it("should serialize group objects with method names", () => {
      const sandbox = WorkerSandbox.create();
      const bindings = {
        core: {
          readQuery: () => {},
          listTables: () => {},
        },
      };
      const result = sandbox.serializeBindings(bindings);
      expect(result).toEqual({ core: ["readQuery", "listTables"] });
      sandbox.dispose();
    });

    it("should collect top-level functions under _topLevel", () => {
      const sandbox = WorkerSandbox.create();
      const bindings = {
        help: () => {},
        readQuery: () => {},
      };
      const result = sandbox.serializeBindings(bindings);
      expect(result).toEqual({ _topLevel: ["help", "readQuery"] });
      sandbox.dispose();
    });

    it("should handle mixed bindings", () => {
      const sandbox = WorkerSandbox.create();
      const bindings = {
        core: { listTables: () => {} },
        stats: { basic: () => {}, count: () => {} },
        help: () => {},
      };
      const result = sandbox.serializeBindings(bindings);
      expect(result.core).toEqual(["listTables"]);
      expect(result.stats).toEqual(["basic", "count"]);
      expect(result._topLevel).toEqual(["help"]);
      sandbox.dispose();
    });

    it("should skip group objects with no methods", () => {
      const sandbox = WorkerSandbox.create();
      const bindings = {
        emptyGroup: { notAFunction: "value" },
      };
      const result = sandbox.serializeBindings(bindings);
      expect(result).toEqual({});
      sandbox.dispose();
    });

    it("should skip null and non-object values", () => {
      const sandbox = WorkerSandbox.create();
      const bindings = {
        nullVal: null,
        numVal: 42,
        strVal: "hello",
      };
      const result = sandbox.serializeBindings(
        bindings as unknown as Record<string, unknown>,
      );
      expect(result).toEqual({});
      sandbox.dispose();
    });

    it("should return empty object for empty bindings", () => {
      const sandbox = WorkerSandbox.create();
      const result = sandbox.serializeBindings({});
      expect(result).toEqual({});
      sandbox.dispose();
    });
  });
});

// =============================================================================
// WorkerSandboxPool
// =============================================================================

describe("WorkerSandboxPool", () => {
  let pool: WorkerSandboxPool;

  afterEach(() => {
    pool?.dispose();
  });

  describe("initialize", () => {
    it("should initialize without error", () => {
      pool = new WorkerSandboxPool();
      expect(() => pool.initialize()).not.toThrow();
    });
  });

  describe("getStats", () => {
    it("should return correct statistics", () => {
      pool = new WorkerSandboxPool({ maxInstances: 5 }, { timeoutMs: 10000 });
      const stats = pool.getStats();
      expect(stats.available).toBe(5);
      expect(stats.inUse).toBe(0);
      expect(stats.max).toBe(5);
    });

    it("should use default options when none provided", () => {
      pool = new WorkerSandboxPool();
      const stats = pool.getStats();
      expect(stats.max).toBe(10); // DEFAULT_POOL_OPTIONS.maxInstances
      expect(stats.inUse).toBe(0);
    });
  });

  describe("dispose", () => {
    it("should not throw on dispose", () => {
      pool = new WorkerSandboxPool();
      expect(() => pool.dispose()).not.toThrow();
    });
  });

  describe("execute - pool exhaustion", () => {
    it("should return error when pool is exhausted", async () => {
      pool = new WorkerSandboxPool({ maxInstances: 0 });
      const result = await pool.execute("return 1;", {});
      expect(result.success).toBe(false);
      expect(result.error).toBe("Worker sandbox pool exhausted");
      expect(result.metrics.wallTimeMs).toBe(0);
    });
  });
});
