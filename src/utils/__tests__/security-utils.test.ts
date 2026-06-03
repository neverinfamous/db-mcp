import { describe, it, expect, vi, beforeEach } from "vitest";
import { resolve, join } from "node:path";
import * as fs from "node:fs";
import { assertSafeIoPath, parseAllowedIoRoots, IoPathError } from "../security-utils.js";

// Mock fs to simulate realpathSync behavior
vi.mock("node:fs", async () => {
  const actual = await import("node:fs");
  return {
    ...actual,
    realpathSync: vi.fn((path: string) => {
      // Basic mock: just return the path for these tests, unless it's a specific mock
      if (path.includes("symlink")) throw new Error("ENOENT");
      return path;
    }),
    existsSync: vi.fn(() => true),
    lstatSync: vi.fn(() => ({
      isSymbolicLink: () => false,
    })),
  };
});

describe("security-utils", () => {
  const allowedRoots = [resolve("/app/data"), resolve("/mnt/backups")];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("assertSafeIoPath", () => {
    it("should allow a valid path within allowed roots", () => {
      const targetPath = join("/app/data", "backup.db");
      expect(() => assertSafeIoPath(targetPath, allowedRoots)).not.toThrow();
    });

    it("should allow a valid path within a secondary allowed root", () => {
      const targetPath = join("/mnt/backups", "old_backup.sqlite");
      expect(() => assertSafeIoPath(targetPath, allowedRoots)).not.toThrow();
    });

    it("should reject a path outside all allowed roots", () => {
      const targetPath = join("/app/secrets", "passwords.txt");
      expect(() => assertSafeIoPath(targetPath, allowedRoots)).toThrow(
        IoPathError
      );
    });

    it("should reject path traversal using ..", () => {
      const targetPath = join("/app/data", "..", "secrets.txt");
      expect(() => assertSafeIoPath(targetPath, allowedRoots)).toThrow(
        IoPathError
      );
    });

    it("should reject path traversal strings even if resolved path is inside", () => {
      // The function rejects `..` segments upfront regardless of resolution
      // Use string concatenation to ensure the `..` is preserved and not resolved by join()
      const targetPath = ["/app/data", "subdir", "..", "backup.db"].join("/");
      expect(() => assertSafeIoPath(targetPath, allowedRoots)).toThrow(
        IoPathError
      );
    });

    it("should reject null bytes", () => {
      const targetPath = join("/app/data", "backup\x00.db");
      expect(() => assertSafeIoPath(targetPath, allowedRoots)).toThrow(
        IoPathError
      );
    });

    it("should reject URI schemes", () => {
      const targetPath = "file:///app/data/backup.db";
      expect(() => assertSafeIoPath(targetPath, allowedRoots)).toThrow(
        IoPathError
      );
    });

    it("should reject hidden files", () => {
      const targetPath = join("/app/data", ".hidden.db");
      expect(() => assertSafeIoPath(targetPath, allowedRoots)).toThrow(
        IoPathError
      );
    });

    it("should reject invalid extensions when validateExtension is true", () => {
      const targetPath = join("/app/data", "backup.exe");
      expect(() => assertSafeIoPath(targetPath, allowedRoots, true)).toThrow(
        IoPathError
      );
    });

    it("should allow invalid extensions when validateExtension is false", () => {
      const targetPath = join("/app/data", "backup.exe");
      expect(() => assertSafeIoPath(targetPath, allowedRoots, false)).not.toThrow();
    });

    it("should throw if no allowed roots are provided", () => {
      const targetPath = join("/app/data", "backup.db");
      expect(() => assertSafeIoPath(targetPath, [])).toThrow(IoPathError);
    });
    
    it("should throw if the target is a symlink", () => {
      const targetPath = join("/app/data", "backup.db");
      vi.mocked(fs.lstatSync).mockReturnValueOnce({
        isSymbolicLink: () => true,
      } as fs.Stats);
      expect(() => assertSafeIoPath(targetPath, allowedRoots)).toThrow(
        IoPathError
      );
    });
  });

  describe("parseAllowedIoRoots", () => {
    it("should parse a JSON array of absolute paths", () => {
      const raw = JSON.stringify([resolve("/path/one"), resolve("/path/two")]);
      const parsed = parseAllowedIoRoots(raw);
      expect(parsed).toEqual([resolve("/path/one"), resolve("/path/two")]);
    });

    it("should parse a comma-separated list of absolute paths", () => {
      const raw = `${resolve("/path/one")}, ${resolve("/path/two")}`;
      const parsed = parseAllowedIoRoots(raw);
      expect(parsed).toEqual([resolve("/path/one"), resolve("/path/two")]);
    });

    it("should reject relative paths", () => {
      const raw = "relative/path";
      expect(() => parseAllowedIoRoots(raw)).toThrow(
        "Invalid ALLOWED_IO_ROOTS configuration: All paths must be absolute"
      );
    });

    it("should return undefined for empty string", () => {
      expect(parseAllowedIoRoots("")).toBeUndefined();
      expect(parseAllowedIoRoots(undefined)).toBeUndefined();
    });
  });
});
