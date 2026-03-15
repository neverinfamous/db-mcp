/**
 * Native SQLite Extension Loading
 *
 * Handles loading SpatiaLite and CSV extensions for better-sqlite3.
 * Extracted from NativeSqliteAdapter for modularity.
 */

import type { Database as BetterSqliteDb } from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import type { ModuleLogger } from "../../utils/logger/index.js";

// =============================================================================
// Extension Directory
// =============================================================================

/**
 * Find the project root by walking up from the compiled file's directory.
 * Resilient to bundler output structure (tsup code splitting puts files in dist/).
 */
function findProjectRoot(startDir: string): string {
  let dir = startDir;
  for (let i = 0; i < 10; i++) {
    if (fs.existsSync(path.join(dir, "package.json"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break; // filesystem root
    dir = parent;
  }
  return startDir; // fallback to start directory
}

/** Absolute path to the extensions directory (computed once at module load). */
const __moduleFilename = fileURLToPath(import.meta.url);
const PROJECT_ROOT = findProjectRoot(path.dirname(__moduleFilename));
const EXTENSIONS_DIR = path.join(PROJECT_ROOT, "extensions");

// =============================================================================
// Extension Loader
// =============================================================================

/**
 * Attempt to load a SQLite extension from a list of candidate paths.
 * Tries each path in order; logs success on the first hit or a warning if none work.
 */
function tryLoadExtension(
  db: BetterSqliteDb,
  name: string,
  envVar: string,
  candidates: string[],
  log: ModuleLogger,
): void {
  for (const extPath of candidates) {
    try {
      db.loadExtension(extPath);
      log.info(`Loaded ${name} extension from ${extPath}`, {
        code: "SQLITE_EXTENSION",
      });
      return;
    } catch {
      // Try next path
    }
  }
  log.warning(
    `${name} extension not available. Set ${envVar} env var.`,
    { code: "SQLITE_EXTENSION" },
  );
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Load the SpatiaLite extension for GIS capabilities.
 */
export function loadSpatialite(
  db: BetterSqliteDb,
  log: ModuleLogger,
): void {
  const spatialitePaths = [
    process.env["SPATIALITE_PATH"],
    // Absolute paths to local extensions
    path.join(
      EXTENSIONS_DIR,
      "mod_spatialite-5.1.0-win-amd64",
      "mod_spatialite",
    ),
    path.join(
      EXTENSIONS_DIR,
      "mod_spatialite-5.1.0-win-amd64",
      "mod_spatialite.dll",
    ),
    // System paths
    "mod_spatialite",
    "mod_spatialite.dll",
    "/usr/lib/x86_64-linux-gnu/mod_spatialite.so",
    "/usr/local/lib/mod_spatialite.so",
    "/usr/local/lib/mod_spatialite.dylib",
  ].filter((p): p is string => Boolean(p));

  // On Windows, SpatiaLite DLL has many dependencies (libgeos, libproj, etc.)
  // These must be in PATH for Windows to find them when loading the extension.
  // Prepend the extension directory to PATH before attempting to load.
  const envSpatialitePath = process.env["SPATIALITE_PATH"];
  if (envSpatialitePath && process.platform === "win32") {
    const spatialiteExtDir = path.dirname(envSpatialitePath);
    const currentPath = process.env["PATH"] ?? "";
    if (!currentPath.includes(spatialiteExtDir)) {
      process.env["PATH"] = spatialiteExtDir + ";" + currentPath;
    }
  }

  tryLoadExtension(db, "SpatiaLite", "SPATIALITE_PATH", spatialitePaths, log);
}

/**
 * Load the CSV extension for CSV virtual tables.
 */
export function loadCsvExtension(
  db: BetterSqliteDb,
  log: ModuleLogger,
): void {
  const csvPaths = [
    process.env["CSV_EXTENSION_PATH"],
    // sqlite-xsv extension with absolute paths
    path.join(EXTENSIONS_DIR, "xsv0.dll"),
    path.join(EXTENSIONS_DIR, "xsv0"),
    // System paths
    "xsv0",
    "xsv0.dll",
    "csv",
    "csv.dll",
    "csv.so",
    "/usr/local/lib/csv.so",
    "/usr/local/lib/csv.dylib",
  ].filter((p): p is string => Boolean(p));

  tryLoadExtension(db, "CSV", "CSV_EXTENSION_PATH", csvPaths, log);
}
