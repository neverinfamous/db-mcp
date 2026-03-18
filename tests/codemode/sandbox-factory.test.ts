/**
 * Sandbox Factory Unit Tests
 *
 * Tests factory functions, mode management, and mode info.
 */

import { describe, it, expect, afterEach } from "vitest";
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
    setDefaultSandboxMode("worker");
  });

  // ===========================================================================
  // Mode Management
  // ===========================================================================

  describe("setDefaultSandboxMode / getDefaultSandboxMode", () => {
    it("should set and get vm mode", () => {
      setDefaultSandboxMode("vm");
      expect(getDefaultSandboxMode()).toBe("vm");
    });

    it("should set and get worker mode", () => {
      setDefaultSandboxMode("worker");
      expect(getDefaultSandboxMode()).toBe("worker");
    });
  });

  describe("getAvailableSandboxModes", () => {
    it("should return vm and worker modes", () => {
      const modes = getAvailableSandboxModes();
      expect(modes).toEqual(["vm", "worker"]);
    });
  });

  // ===========================================================================
  // createSandbox
  // ===========================================================================

  describe("createSandbox", () => {
    it("should create a vm sandbox when mode is vm", () => {
      const sandbox = createSandbox("vm");
      expect(sandbox).toBeDefined();
      expect(sandbox.isHealthy()).toBe(true);
      sandbox.dispose();
    });

    it("should create a worker sandbox when mode is worker", () => {
      const sandbox = createSandbox("worker");
      expect(sandbox).toBeDefined();
      expect(sandbox.isHealthy()).toBe(true);
      sandbox.dispose();
    });

    it("should use default mode when none specified", () => {
      setDefaultSandboxMode("vm");
      const sandbox = createSandbox();
      expect(sandbox).toBeDefined();
      expect(sandbox.isHealthy()).toBe(true);
      sandbox.dispose();
    });

    it("should pass options to the sandbox", () => {
      const sandbox = createSandbox("vm", { timeoutMs: 5000 });
      expect(sandbox.isHealthy()).toBe(true);
      sandbox.dispose();
    });
  });

  // ===========================================================================
  // createSandboxPool
  // ===========================================================================

  describe("createSandboxPool", () => {
    it("should create a vm sandbox pool", () => {
      const pool = createSandboxPool("vm", { minInstances: 1, maxInstances: 3 });
      expect(pool).toBeDefined();
      expect(pool.getStats().max).toBe(3);
      pool.dispose();
    });

    it("should create a worker sandbox pool", () => {
      const pool = createSandboxPool("worker", { maxInstances: 5 });
      expect(pool).toBeDefined();
      expect(pool.getStats().max).toBe(5);
      pool.dispose();
    });

    it("should use default mode when none specified", () => {
      setDefaultSandboxMode("vm");
      const pool = createSandboxPool();
      expect(pool).toBeDefined();
      pool.dispose();
    });

    it("should initialize pool correctly", () => {
      const pool = createSandboxPool("vm", { minInstances: 2, maxInstances: 5 });
      pool.initialize();
      const stats = pool.getStats();
      expect(stats.available).toBe(2);
      expect(stats.inUse).toBe(0);
      pool.dispose();
    });
  });

  // ===========================================================================
  // getSandboxModeInfo
  // ===========================================================================

  describe("getSandboxModeInfo", () => {
    it("should return worker mode info", () => {
      const info = getSandboxModeInfo("worker");
      expect(info.name).toBe("Worker Thread");
      expect(info.isolation).toContain("V8");
      expect(info.security).toContain("Enhanced");
      expect(info.requirements).toContain("worker_threads");
    });

    it("should return vm mode info", () => {
      const info = getSandboxModeInfo("vm");
      expect(info.name).toBe("VM Context");
      expect(info.isolation).toContain("Script isolation");
      expect(info.security).toContain("Standard");
      expect(info.requirements).toContain("vm module");
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
