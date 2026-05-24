/**
 * db-mcp — Path Validation Utility
 *
 * Shared validation for filesystem-sensitive tools that restrict
 * target paths to the same directory as the primary database.
 *
 * Extracted from duplicated inline implementations in:
 *   - sqlite_attach_database (pragma.ts)
 *   - sqlite_vacuum_into (create.ts)
 *   - sqlite_dump (dump.ts)
 */

import { resolve, dirname, normalize, sep, basename } from "node:path";
import { realpathSync } from "node:fs";

/**
 * Result of path validation — structured to match the
 * `{ success: false, error, code }` pattern used by tool handlers.
 */
export type PathValidationResult =
  | { valid: true }
  | { valid: false; error: string; dbDir: string };

/**
 * Validate that a target filesystem path is within the same directory
 * as the primary database file.
 *
 * Skips validation for in-memory databases (`:memory:`).
 *
 * @param targetPath - The path the tool wants to read/write
 * @param dbPath - The configured path of the primary database
 * @returns Structured result — callers check `result.valid` and return
 *          `{ success: false, error: result.error, code: "SECURITY_ERROR" }`
 *          on failure.
 */
export function validateSameDirPath(
  targetPath: string,
  dbPath: string,
): PathValidationResult {
  if (targetPath.includes("\x00")) {
    return {
      valid: false,
      error: "Security: path must not contain null bytes.",
      dbDir: dbPath === ":memory:" ? "" : dirname(resolve(dbPath)),
    };
  }

  // In-memory databases have no directory constraint
  if (dbPath === ":memory:") {
    return { valid: true };
  }

  const dbDir = dirname(resolve(dbPath));
  
  let resolvedTarget = resolve(targetPath);
  try {
    resolvedTarget = realpathSync(resolvedTarget);
  } catch {
    // If the file doesn't exist yet, try resolving its parent directory
    try {
      const parentDir = realpathSync(dirname(resolvedTarget));
      resolvedTarget = resolve(parentDir, basename(resolvedTarget));
    } catch {
      // Fallback to lexical
    }
  }

  let resolvedDbDir = dbDir;
  try {
    resolvedDbDir = realpathSync(dbDir);
  } catch {
    // Fallback to lexical
  }

  const normalizedTarget = normalize(resolvedTarget);
  const normalizedDir = normalize(resolvedDbDir);

  const dirWithSep = normalizedDir.endsWith(sep) ? normalizedDir : normalizedDir + sep;

  if (normalizedTarget !== normalizedDir && !normalizedTarget.startsWith(dirWithSep)) {
    return {
      valid: false,
      error: `Security: path must be within the database directory (${dbDir}). Path traversal is not allowed.`,
      dbDir,
    };
  }

  return { valid: true };
}
