import { describe, it, expect, vi } from "vitest";
import {
  loadSpatialite,
  loadCsvExtension,
} from "../../../src/adapters/sqlite-native/extensions.js";
import type { Database as BetterSqliteDb } from "better-sqlite3";
import type { ModuleLogger } from "../../../src/utils/logger/index.js";

describe("Native Extensions Loader", () => {
  it("should attempt to load spatialite and log appropriately", () => {
    let loadExtensionCalled = false;
    const pathsTried: string[] = [];
    const mockDb = {
      loadExtension: (extPath: string) => {
        pathsTried.push(extPath);
        // Fail the first few, succeed on one to simulate fallback
        if (
          extPath.includes("mod_spatialite.dll") ||
          extPath.includes("mod_spatialite.so")
        ) {
          loadExtensionCalled = true;
          return;
        }
        throw new Error("Cannot load");
      },
    } as unknown as BetterSqliteDb;

    const mockLog: ModuleLogger = {
      info: vi.fn(),
      warning: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    } as unknown as ModuleLogger;

    loadSpatialite(mockDb, mockLog);

    expect(pathsTried.length).toBeGreaterThan(0);
    expect(loadExtensionCalled).toBe(true);
    expect(mockLog.info).toHaveBeenCalledWith(
      expect.stringContaining("Loaded SpatiaLite extension"),
      expect.any(Object),
    );
  });

  it("should handle complete failure to load spatialite", () => {
    const mockDb = {
      loadExtension: () => {
        throw new Error("Cannot load");
      },
    } as unknown as BetterSqliteDb;

    const mockLog = {
      info: vi.fn(),
      warning: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    } as unknown as ModuleLogger;

    loadSpatialite(mockDb, mockLog);
    expect(mockLog.warning).toHaveBeenCalledWith(
      expect.stringContaining("SpatiaLite extension not available"),
      expect.any(Object),
    );
  });

  it("should attempt to load csv extension and log appropriately", () => {
    let loadExtensionCalled = false;
    const mockDb = {
      loadExtension: (extPath: string) => {
        if (extPath.includes("xsv0")) {
          loadExtensionCalled = true;
          return;
        }
        throw new Error("Cannot load");
      },
    } as unknown as BetterSqliteDb;

    const mockLog = {
      info: vi.fn(),
      warning: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    } as unknown as ModuleLogger;

    loadCsvExtension(mockDb, mockLog);

    expect(loadExtensionCalled).toBe(true);
    expect(mockLog.info).toHaveBeenCalledWith(
      expect.stringContaining("Loaded CSV extension"),
      expect.any(Object),
    );
  });

  it("should handle complete failure to load csv extension", () => {
    const mockDb = {
      loadExtension: () => {
        throw new Error("Cannot load");
      },
    } as unknown as BetterSqliteDb;

    const mockLog = {
      info: vi.fn(),
      warning: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    } as unknown as ModuleLogger;

    loadCsvExtension(mockDb, mockLog);
    expect(mockLog.warning).toHaveBeenCalledWith(
      expect.stringContaining("CSV extension not available"),
      expect.any(Object),
    );
  });
});
