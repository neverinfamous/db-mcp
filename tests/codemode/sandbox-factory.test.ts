/**
 * Sandbox Factory Unit Tests
 *
 * Tests factory functions, mode management, and mode info.
 */

import { describe, it, expect, afterEach, vi } from "vitest";
import {
  createSandbox,
  createSandboxPool,
  setDefaultSandboxMode,
  getDefaultSandboxMode,
  getAvailableSandboxModes,
  getSandboxModeInfo,
} from "../../src/codemode/sandbox-factory.js";

describe("sandbox-factory", () => {
  // Reset default mode after each test to avoid cross-test pollution
  afterEach(() => {
    vi.unstubAllEnvs();
    setDefaultSandboxMode("isolate");
  });

  // ===========================================================================
  // Mode Management
  // ===========================================================================

  describe("setDefaultSandboxMode / getDefaultSandboxMode", () => {
    it("should set and get isolate mode", () => {
      setDefaultSandboxMode("isolate");
      expect(getDefaultSandboxMode()).toBe("isolate");
    });
  });

  describe("getAvailableSandboxModes", () => {
    it("should return isolate mode", () => {
      const modes = getAvailableSandboxModes();
      expect(modes).toEqual(["isolate"]);
    });
  });

  // ===========================================================================
  // createSandbox
  // ===========================================================================

  describe("createSandbox", () => {
    it("should create an isolate sandbox when mode is isolate", () => {
      const sandbox = createSandbox("isolate");
      expect(sandbox).toBeDefined();
      expect(sandbox.isHealthy()).toBe(true);
      sandbox.dispose();
    });

    it("should use default mode when none specified", () => {
      setDefaultSandboxMode("isolate");
      const sandbox = createSandbox();
      expect(sandbox).toBeDefined();
      expect(sandbox.isHealthy()).toBe(true);
      sandbox.dispose();
    });

    it("should pass options to the sandbox", () => {
      const sandbox = createSandbox("isolate", { timeoutMs: 5000 });
      expect(sandbox.isHealthy()).toBe(true);
      sandbox.dispose();
    });
  });

  // ===========================================================================
  // createSandboxPool
  // ===========================================================================

  describe("createSandboxPool", () => {
    it("should create an isolate sandbox pool", () => {
      const pool = createSandboxPool("isolate", {
        minInstances: 1,
        maxInstances: 3,
      });
      expect(pool).toBeDefined();
      expect(pool.getStats().max).toBe(3);
      pool.dispose();
    });

    it("should use default mode when none specified", () => {
      setDefaultSandboxMode("isolate");
      const pool = createSandboxPool();
      expect(pool).toBeDefined();
      pool.dispose();
    });

    it("should initialize pool correctly", () => {
      const pool = createSandboxPool("isolate", {
        minInstances: 2,
        maxInstances: 5,
      });
      pool.initialize();
      const stats = pool.getStats();
      expect(stats.available).toBe(5);
      expect(stats.inUse).toBe(0);
      expect(stats.max).toBe(5);
      pool.dispose();
    });
  });

  // ===========================================================================
  // getSandboxModeInfo
  // ===========================================================================

  describe("getSandboxModeInfo", () => {
    it("should return isolate mode info", () => {
      const info = getSandboxModeInfo("isolate");
      expect(info.name).toBe("Isolated VM");
      expect(info.isolation).toContain("True V8 Isolate");
      expect(info.performance).toContain("Low overhead");
    });

    it("should have all required fields", () => {
      for (const mode of getAvailableSandboxModes()) {
        const info = getSandboxModeInfo(mode);
        expect(info.name).toBeTruthy();
        expect(info.isolation).toBeTruthy();
        expect(info.performance).toBeTruthy();
        expect(info.security).toBeTruthy();
        expect(info.requirements).toBeTruthy();
      }
    });
  });
});
