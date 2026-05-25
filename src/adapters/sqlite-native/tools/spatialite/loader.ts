import type { NativeSqliteAdapter } from "../../native-sqlite-adapter.js";
import { ExtensionNotAvailableError } from "../../../../utils/errors/index.js";
import { createRequire } from "module";
import { fileURLToPath } from "url";
import path from "path";

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

interface Win32DllAddon {
  addDllDirectory(path: string): unknown;
  removeDllDirectory(cookie: unknown): void;
}

/**
 * Try to load SpatiaLite extension
 */
export function tryLoadSpatialite(
  adapter: NativeSqliteAdapter,
): { success: boolean; path?: string; error?: string } {
  const db = adapter.getDatabase();
  if (db === null) {
    return { success: false, error: "Database not connected" };
  }

  const paths = SPATIALITE_PATHS;

  // On Windows, SpatiaLite DLL has many dependencies (libgeos, libproj, etc.)
  // We use our native addon to securely add the directory to the DLL search path
  // without mutating the global process.env.PATH.
  const chosenPathForEnv = process.env["SPATIALITE_PATH"];
  let dllCookie: unknown = null;
  let win32Dll: Win32DllAddon | null = null;

  if (process.platform === "win32" && chosenPathForEnv) {
    const looksLikeFsPath = chosenPathForEnv.includes("/") || chosenPathForEnv.includes("\\");
    if (looksLikeFsPath) {
      const extensionDir = chosenPathForEnv.replace(/[/\\][^/\\]+$/, ""); // Get directory from DLL path
      try {
        // Require the built native addon
        // Use a relative path from the built dist/ or src/ location.
        // It might be running from dist/adapters/sqlite-native/tools/spatialite/loader.js
        // so we navigate up to the root build/Release/win32_dll.node.
        const addonPath = path.resolve(__dirname, "../../../../../build/Release/win32_dll.node");
        win32Dll = require(addonPath) as Win32DllAddon;
        dllCookie = win32Dll.addDllDirectory(extensionDir);
      } catch {
        // Ignore native addon load errors and attempt to proceed without it
      }
    }
  }

  for (const candidatePath of paths) {
    try {
      db.loadExtension(candidatePath);
      // Initialize spatial metadata
      db.exec("SELECT InitSpatialMetaData(1)");
      loadedDatabases.add(db);
      if (win32Dll !== null && dllCookie !== null) {
        win32Dll.removeDllDirectory(dllCookie);
      }
      return { success: true, path: candidatePath };
    } catch {
      // Try next path
    }
  }

  if (win32Dll !== null && dllCookie !== null) {
    win32Dll.removeDllDirectory(dllCookie);
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
      throw new ExtensionNotAvailableError("SpatiaLite", {
        suggestion:
          "Install mod_spatialite and set SPATIALITE_PATH environment variable.",
      });
    }
  }
}
