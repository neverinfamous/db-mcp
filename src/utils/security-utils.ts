import { resolve, dirname, join, relative, isAbsolute, sep, parse as pathParse } from "node:path";
import { realpathSync, existsSync, lstatSync } from "node:fs";
import { DbMcpError } from "./errors/base.js";
import { ErrorCategory } from "./errors/categories.js";
import { ConfigurationError } from "./errors/classes.js";

/**
 * Thrown when a path validation fails the security boundaries.
 */
export class IoPathError extends DbMcpError {
  constructor(message: string) {
    super(message, "SECURITY_ERROR", ErrorCategory.VALIDATION, {
      suggestion: "Check that the target path is within the allowed IO roots.",
      recoverable: false,
    });
    this.name = "IoPathError";
  }
}

/**
 * Validates that a target filesystem path is strictly bounded within the allowed IO roots.
 *
 * This enforces strict file-system isolation. The target path MUST reside within
 * at least one of the explicitly configured allowed roots.
 *
 * @param targetPath - The path the tool wants to read/write
 * @param allowedRoots - Array of allowed absolute root directory paths
 * @param validateExtension - Whether to restrict to known safe database extensions
 * @throws IoPathError if the path escapes the sandboxed boundaries or fails basic checks
 */
export function assertSafeIoPath(
  targetPath: string,
  allowedRoots: string[],
  validateExtension = true,
): void {
  // 1. Initial basic check for null bytes, schemes, traversal strings
  if (targetPath.includes("\x00")) {
    throw new IoPathError("Security: path must not contain null bytes.");
  }

  if (targetPath.startsWith("file:") || targetPath.includes("?")) {
    throw new IoPathError(
      "Security: SQLite URIs and query parameters are not allowed.",
    );
  }

  const normalized = targetPath.replace(/\\/g, "/");
  const segments = normalized.split("/");
  if (segments.some((s) => s === "..")) {
    throw new IoPathError("Security: Path traversal (..) detected.");
  }

  const base = segments[segments.length - 1];
  if (!base) {
    throw new IoPathError("Security: Invalid path structure.");
  }

  if (base.startsWith(".")) {
    throw new IoPathError("Security: Cannot access hidden files or dotfiles.");
  }

  if (validateExtension) {
    const validExtensions = [
      ".db",
      ".sqlite",
      ".sqlite3",
      ".sql",
      ".csv",
      ".tsv",
    ];
    const hasValidExt = validExtensions.some((ext) =>
      base.toLowerCase().endsWith(ext),
    );
    if (!hasValidExt) {
      throw new IoPathError(
        `Security: Invalid file extension. Allowed extensions are: ${validExtensions.join(", ")}`,
      );
    }
  }

  // 2. Resolve realpath iteratively to defeat symlink traversal
  const resolved = resolve(targetPath);
  let currentDir = resolved;
  let existingRealPath = "";

  while (currentDir !== pathParse(currentDir).root) {
    try {
      existingRealPath = realpathSync(currentDir);
      break;
    } catch {
      currentDir = dirname(currentDir);
    }
  }

  if (!existingRealPath) {
    try {
      existingRealPath = realpathSync(currentDir); // root resolution
    } catch {
      existingRealPath = currentDir;
    }
  }

  const remainder = relative(currentDir, resolved);
  const finalTargetPath = remainder
    ? join(existingRealPath, remainder)
    : existingRealPath;

  // 3. Define safe boundaries
  if (allowedRoots.length === 0) {
    throw new IoPathError(
      "No allowed input/output roots configured for sandbox boundary. Please configure ALLOWED_IO_ROOTS env variable or pass --allowed-io-roots with absolute paths to enable filesystem operations.",
    );
  }

  const safeRoots: string[] = [];
  for (const root of allowedRoots) {
    try {
      safeRoots.push(realpathSync(resolve(root)));
    } catch {
      safeRoots.push(resolve(root));
    }
  }

  // 4. Verify target is within at least one root
  const isAllowed = safeRoots.some((root) => {
    const rel = relative(root, finalTargetPath);
    return rel !== ".." && !rel.startsWith(".." + sep) && !isAbsolute(rel);
  });

  if (!isAllowed) {
    throw new IoPathError(
      `Directory path escapes allowed sandbox boundaries: ${targetPath}`,
    );
  }

  // 5. Ensure the target file itself is not a symlink (if it exists)
  let isSymlink = false;
  try {
    const stats = lstatSync(resolved);
    if (stats.isSymbolicLink()) {
      isSymlink = true;
    }
  } catch {
    // If file doesn't exist, that's fine
  }

  if (isSymlink) {
    throw new IoPathError(
      `Symlinks are strictly forbidden for file operations: ${targetPath}`,
    );
  }
}

/**
 * Parses and validates the raw ALLOWED_IO_ROOTS input from CLI or env.
 * Accepts a JSON array string or a comma-separated list of paths.
 *
 * @param raw - Raw input string
 * @returns Array of absolute paths
 * @throws Error if invalid or not absolute
 */
export function parseAllowedIoRoots(raw: string | undefined): string[] | undefined {
  if (!raw) return undefined;

  if (raw.length > 51200) {
    throw new ConfigurationError(
      "ALLOWED_IO_ROOTS configuration exceeds size limit (50KB)",
    );
  }

  let paths: string[];

  try {
    if (raw.trim().startsWith("[")) {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.every((p) => typeof p === "string" && isAbsolute(p))) {
        paths = parsed as string[];
      } else {
        throw new ConfigurationError("Must be an array of absolute paths");
      }
    } else {
      paths = raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
        
      if (paths.some((p) => !isAbsolute(p))) {
        throw new ConfigurationError("All paths must be absolute");
      }
    }
  } catch (e: unknown) {
    const errName = e instanceof Error ? e.message : String(e);
    throw new ConfigurationError(`Invalid ALLOWED_IO_ROOTS configuration: ${errName}`, "CONFIG_ERROR", {
      cause: e instanceof Error ? e : undefined,
    });
  }

  for (const p of paths) {
    try {
      if (!existsSync(p)) {
        console.warn(`\n[WARN] ALLOWED_IO_ROOTS path does not exist: ${p}\n`);
      }
    } catch {
      // ignore
    }
  }

  return paths;
}
