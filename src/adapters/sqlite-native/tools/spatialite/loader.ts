/**
 * SpatiaLite Extension Loader
 *
 * Utilities for loading, checking, and ensuring the SpatiaLite extension.
 */

import type { NativeSqliteAdapter } from "../../NativeSqliteAdapter.js";

// SpatiaLite extension paths to try (platform-aware)
const SPATIALITE_PATHS = [
  process.env["SPATIALITE_PATH"],
  "mod_spatialite",
  "mod_spatialite.dll",
  "mod_spatialite.so",
  "/usr/lib/x86_64-linux-gnu/mod_spatialite.so",
  "/usr/local/lib/mod_spatialite.so",
  "/usr/local/lib/mod_spatialite.dylib",
].filter((p): p is string => Boolean(p));

/** Exported for use by tool schemas */
export { SPATIALITE_PATHS };

// Track loaded state per database
const loadedDatabases = new WeakSet();

/**
 * Try to load SpatiaLite extension
 */
export function tryLoadSpatialite(
  adapter: NativeSqliteAdapter,
  customPath?: string,
): { success: boolean; path?: string; error?: string } {
  const db = adapter.getDatabase();
  if (db === null) {
    return { success: false, error: "Database not connected" };
  }

  const paths = customPath
    ? [customPath, ...SPATIALITE_PATHS]
    : SPATIALITE_PATHS;

  // On Windows, SpatiaLite DLL has many dependencies (libgeos, libproj, etc.)
  // These must be in PATH for Windows to find them when loading the extension.
  // Prepend the extension directory to PATH before attempting to load.
  const envPath = process.env["SPATIALITE_PATH"];
  if (envPath && process.platform === "win32") {
    const extensionDir = envPath.replace(/[/\\][^/\\]+$/, ""); // Get directory from DLL path
    const currentPath = process.env["PATH"] ?? "";
    if (!currentPath.includes(extensionDir)) {
      process.env["PATH"] = extensionDir + ";" + currentPath;
    }
  }

  for (const path of paths) {
    try {
      db.loadExtension(path);
      // Initialize spatial metadata
      db.exec("SELECT InitSpatialMetaData(1)");
      loadedDatabases.add(db);
      return { success: true, path };
    } catch {
      // Try next path
    }
  }

  return {
    success: false,
    error:
      "SpatiaLite extension not found. Install mod_spatialite and set SPATIALITE_PATH environment variable.",
  };
}

/**
 * Check if SpatiaLite is loaded
 * Exported for health check access
 */
export function isSpatialiteLoaded(adapter: NativeSqliteAdapter): boolean {
  const db = adapter.getDatabase();
  if (db === null) return false;

  if (loadedDatabases.has(db)) return true;

  try {
    db.exec("SELECT spatialite_version()");
    // Extension is loaded but not tracked - ensure metadata tables exist
    // InitSpatialMetaData(1) safely skips if already initialized
    db.exec("SELECT InitSpatialMetaData(1)");
    loadedDatabases.add(db);
    return true;
  } catch {
    return false;
  }
}

/**
 * Ensure SpatiaLite is loaded, throw if not
 */
export function ensureSpatialite(adapter: NativeSqliteAdapter): void {
  if (!isSpatialiteLoaded(adapter)) {
    const result = tryLoadSpatialite(adapter);
    if (!result.success) {
      throw new Error(result.error ?? "Failed to load SpatiaLite");
    }
  }
}
