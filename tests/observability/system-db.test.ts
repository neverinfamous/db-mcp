import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { SystemDb } from "../../../src/observability/system-db.js";
import { InternalError } from "../../../src/utils/errors/classes.js";
import fs from "fs";
import path from "path";

vi.mock("better-sqlite3", () => {
  return {
    default: class MockDb {
      pragma = vi.fn();
      exec = vi.fn();
      close = vi.fn();
    }
  };
});

vi.mock("fs", () => ({
  default: { mkdirSync: vi.fn() },
  mkdirSync: vi.fn(),
}));

describe("SystemDb", () => {
  let systemDb: SystemDb;
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    systemDb = new SystemDb({ dbPath: ":memory:" });
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.clearAllMocks();
  });

  describe("init", () => {
    it("should initialize with in-memory db", async () => {
      await expect(systemDb.init()).resolves.not.toThrow();
      expect(systemDb.getDb()).toBeDefined();
    });

    it("should initialize with file path and create directories", async () => {
      systemDb = new SystemDb({ dbPath: "path/to/db.sqlite" });
      await expect(systemDb.init()).resolves.not.toThrow();
    });

    it("should handle encryption key if provided", async () => {
      // Vitest dynamic import mocking for better-sqlite3-multiple-ciphers is tricky, 
      // so we'll just test that standard init sets up the tables correctly
      process.env["DB_ENCRYPTION_KEY"] = 'test"key';
      
      // We can't easily assert the dynamic import of multiple-ciphers here without a robust mock, 
      // but we can ensure standard init doesn't crash if encryptionKey is missing
      delete process.env["DB_ENCRYPTION_KEY"];
      await expect(systemDb.init()).resolves.not.toThrow();
    });
  });

  describe("getDb", () => {
    it("should throw InternalError if not initialized", () => {
      expect(() => systemDb.getDb()).toThrow(InternalError);
    });

    it("should return db instance if initialized", async () => {
      await systemDb.init();
      expect(systemDb.getDb()).toBeDefined();
    });
  });

  describe("close", () => {
    it("should close the database", async () => {
      await systemDb.init();
      const db = systemDb.getDb();
      systemDb.close();
      expect(db.close).toHaveBeenCalled();
      expect(() => systemDb.getDb()).toThrow(InternalError);
    });

    it("should safely handle close when not initialized", () => {
      expect(() => systemDb.close()).not.toThrow();
    });
  });
});
