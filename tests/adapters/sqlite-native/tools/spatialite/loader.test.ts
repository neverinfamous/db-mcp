import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { tryLoadSpatialite } from "../../../../../src/adapters/sqlite-native/tools/spatialite/loader.js";

describe("SpatiaLite Loader", () => {
  const originalEnv = process.env;
  const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    if (originalPlatform) {
      Object.defineProperty(process, 'platform', originalPlatform);
    }
  });

  it("should fail if database is not connected", () => {
    const mockAdapter = {
      getDatabase: () => null,
    } as any;

    const result = tryLoadSpatialite(mockAdapter);
    expect(result.success).toBe(false);
    expect(result.error).toBe("Database not connected");
  });

  it("should handle win32 dll load path correctly when SPATIALITE_PATH is set", () => {
    Object.defineProperty(process, 'platform', { value: 'win32' });
    process.env["SPATIALITE_PATH"] = "C:/test/path/mod_spatialite.dll";

    const mockDb = {
      loadExtension: vi.fn().mockImplementation(() => { throw new Error("Mock fail"); }),
      exec: vi.fn(),
    };
    const mockAdapter = {
      getDatabase: () => mockDb,
    } as any;

    const result = tryLoadSpatialite(mockAdapter);
    
    // It should catch the require error for win32_dll.node, fail to loadExtension, and ultimately return false
    expect(result.success).toBe(false);
    expect(result.error).toContain("SpatiaLite extension not found");
  });
});
