/**
 * validateSameDirPath Unit Tests
 *
 * Tests the path traversal prevention utility used by filesystem-sensitive
 * tools (attach_database, vacuum_into, dump).
 *
 * Covers:
 * - Happy path: files within the database directory
 * - Directory traversal attacks (../, ../../)
 * - Absolute paths outside the database directory
 * - In-memory database bypass
 * - Edge cases: trailing separators, dot segments, subdirectories
 */

import { describe, it, expect } from "vitest";
import { resolve, join, sep } from "node:path";
import { validateSameDirPath } from "../../src/utils/validate-path.js";

const DB_DIR = resolve("/data/databases");
const DB_PATH = join(DB_DIR, "main.db");

// =============================================================================
// Happy Path
// =============================================================================

describe("validateSameDirPath — valid paths", () => {
  it("should allow files in the same directory", () => {
    const result = validateSameDirPath(join(DB_DIR, "backup.db"), DB_PATH);
    expect(result.valid).toBe(true);
  });

  it("should allow files in a subdirectory", () => {
    const result = validateSameDirPath(
      join(DB_DIR, "backups", "daily.db"),
      DB_PATH,
    );
    expect(result.valid).toBe(true);
  });

  it("should allow the database file itself", () => {
    const result = validateSameDirPath(DB_PATH, DB_PATH);
    expect(result.valid).toBe(true);
  });

  it("should allow files with different extensions", () => {
    const result = validateSameDirPath(join(DB_DIR, "export.sql"), DB_PATH);
    expect(result.valid).toBe(true);
  });
});

// =============================================================================
// In-memory Database
// =============================================================================

describe("validateSameDirPath — in-memory database", () => {
  it("should allow any path when database is :memory:", () => {
    const result = validateSameDirPath("/arbitrary/path/file.db", ":memory:");
    expect(result.valid).toBe(true);
  });

  it("should allow parent directory traversal when database is :memory:", () => {
    const result = validateSameDirPath("/../../../etc/passwd", ":memory:");
    // Fails due to extension validation, not directory traversal
    expect(result.valid).toBe(false);
  });
});

// =============================================================================
// Directory Traversal Attacks
// =============================================================================

describe("validateSameDirPath — traversal prevention", () => {
  it("should reject simple parent directory traversal", () => {
    const result = validateSameDirPath(
      join(DB_DIR, "..", "secret.db"),
      DB_PATH,
    );
    expect(result.valid).toBe(false);
  });

  it("should reject multi-level parent traversal", () => {
    const result = validateSameDirPath(
      join(DB_DIR, "..", "..", "etc", "passwd"),
      DB_PATH,
    );
    expect(result.valid).toBe(false);
  });

  it("should reject absolute paths outside database directory", () => {
    const result = validateSameDirPath("/tmp/exfil.db", DB_PATH);
    expect(result.valid).toBe(false);
  });

  it("should reject paths with dot-dot in middle segments", () => {
    const result = validateSameDirPath(
      join(DB_DIR, "subdir", "..", "..", "escape.db"),
      DB_PATH,
    );
    expect(result.valid).toBe(false);
  });

  it("should return structured error with dbDir on failure", () => {
    const result = validateSameDirPath("/tmp/exfil.db", DB_PATH);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toContain("Security");
      expect(result.error).toContain("Path traversal");
      expect(result.dbDir).toBe(DB_DIR);
    }
  });
});

// =============================================================================
// Edge Cases
// =============================================================================

describe("validateSameDirPath — edge cases", () => {
  it("should handle paths with trailing separator", () => {
    const result = validateSameDirPath(
      DB_DIR + sep + "backup.db",
      DB_PATH,
    );
    expect(result.valid).toBe(true);
  });

  it("should handle relative target paths (resolved against cwd)", () => {
    // Relative paths are resolved against cwd, which won't be DB_DIR
    const result = validateSameDirPath("relative.db", DB_PATH);
    // This should fail unless cwd happens to be DB_DIR
    expect(result.valid).toBe(false);
  });

  it("should reject path with directory name as prefix (H-3 boundary fix)", () => {
    // H-3: validateSameDirPath now requires a path separator boundary.
    // /data/databases-evil/ is a sibling directory, not a subdirectory of
    // /data/databases/, so it must be rejected to prevent path boundary escape.
    const siblingPath = resolve("/data/databases-evil/file.db");
    const result = validateSameDirPath(siblingPath, DB_PATH);
    expect(result.valid).toBe(false);
  });

  it("should handle deeply nested subdirectories", () => {
    const deepPath = join(DB_DIR, "a", "b", "c", "d", "backup.db");
    const result = validateSameDirPath(deepPath, DB_PATH);
    expect(result.valid).toBe(true);
  });

  it("should handle database path in root directory", () => {
    const rootDb = resolve("/db.sqlite");
    const target = resolve("/backup.sqlite");
    const result = validateSameDirPath(target, rootDb);
    // Both files are in the root directory — this should be valid.
    // The root dir already ends with a separator, so the boundary check
    // needs to handle the trailing-sep case.
    expect(result.valid).toBe(true);
  });
});
