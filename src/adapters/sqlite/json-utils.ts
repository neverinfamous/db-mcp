/**
 * SQLite JSON Utilities
 *
 * Provides JSON normalization and JSONB binary storage support for SQLite 3.45+.
 * Features:
 * - Deep key sorting for consistent storage
 * - Whitespace normalization (compact format)
 * - Unicode normalization (NFC)
 * - Optional type coercion
 * - JSONB format detection and conversion
 */

import type { JsonNormalizationResult, JsonValue } from "./types.js";

// =============================================================================
// Types
// =============================================================================

/**
 * Options for JSON normalization
 */
export interface NormalizationOptions {
  /** Sort object keys alphabetically (deep) */
  sortKeys?: boolean;

  /** Remove unnecessary whitespace */
  compact?: boolean;

  /** Apply Unicode NFC normalization to strings */
  unicodeNormalize?: boolean;

  /** Coerce string values to numbers/booleans when possible */
  typeCoercion?: boolean;

  /** How to handle duplicate keys: 'last' (default), 'first', 'error' */
  duplicateKeys?: "last" | "first" | "error";
}

/**
 * Default normalization options
 */
export const DEFAULT_NORMALIZATION_OPTIONS: Required<NormalizationOptions> = {
  sortKeys: true,
  compact: true,
  unicodeNormalize: true,
  typeCoercion: false,
  duplicateKeys: "last",
};

// =============================================================================
// JSON Normalization
// =============================================================================

/**
 * Normalize a JSON value for consistent storage
 *
 * @param value - The value to normalize (can be any JSON-compatible value)
 * @param options - Normalization options
 * @returns Normalization result with the normalized string and change details
 */
export function normalizeJson(
  value: unknown,
  options: NormalizationOptions = {},
): JsonNormalizationResult {
  const opts = { ...DEFAULT_NORMALIZATION_OPTIONS, ...options };
  const changes: string[] = [];

  // Parse if string
  let parsed: unknown;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch {
      // Not valid JSON, return as-is
      return {
        normalized: value,
        wasModified: false,
        changes: ["Input is not valid JSON"],
      };
    }
  } else {
    parsed = value;
  }

  // Apply normalization recursively
  const normalized = normalizeValue(parsed, opts, changes, "");

  // Stringify with appropriate formatting
  const normalizedStr = opts.compact
    ? JSON.stringify(normalized)
    : JSON.stringify(normalized, null, 2);

  // Check if modified
  const originalStr = typeof value === "string" ? value : JSON.stringify(value);
  const wasModified = normalizedStr !== originalStr;

  return {
    normalized: normalizedStr,
    wasModified,
    changes,
  };
}

/**
 * Recursively normalize a JSON value
 */
function normalizeValue(
  value: unknown,
  options: Required<NormalizationOptions>,
  changes: string[],
  path: string,
): unknown {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "string") {
    let result = value;

    // Unicode normalization
    if (options.unicodeNormalize && value !== value.normalize("NFC")) {
      result = result.normalize("NFC");
      changes.push(`${path || "$"}: Unicode normalized`);
    }

    // Type coercion
    if (options.typeCoercion) {
      // Try boolean
      if (result.toLowerCase() === "true") {
        changes.push(`${path || "$"}: Coerced "true" to boolean`);
        return true;
      }
      if (result.toLowerCase() === "false") {
        changes.push(`${path || "$"}: Coerced "false" to boolean`);
        return false;
      }

      // Try number
      const num = Number(result);
      if (!isNaN(num) && result.trim() !== "") {
        changes.push(`${path || "$"}: Coerced "${result}" to number`);
        return num;
      }
    }

    return result;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item, index) =>
      normalizeValue(item, options, changes, `${path || "$"}[${index}]`),
    );
  }

  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    let keys = Object.keys(obj);

    // Sort keys if enabled
    if (options.sortKeys) {
      const originalOrder = keys.join(",");
      keys = keys.sort();
      if (keys.join(",") !== originalOrder) {
        changes.push(`${path || "$"}: Keys sorted`);
      }
    }

    const result: Record<string, unknown> = {};
    for (const key of keys) {
      result[key] = normalizeValue(
        obj[key],
        options,
        changes,
        `${path || "$"}.${key}`,
      );
    }
    return result;
  }

  return value;
}

// =============================================================================
// JSONB Support Detection
// =============================================================================

/** Cached JSONB support status */
let jsonbSupportedCache: boolean | null = null;

/**
 * Check if SQLite version supports JSONB (3.45.0+)
 *
 * @param versionString - SQLite version string (e.g., "3.45.0")
 * @returns true if JSONB is supported
 */
export function isJsonbSupportedVersion(versionString: string): boolean {
  const versionRegex = /^(\d+)\.(\d+)\.?(\d+)?/;
  const match = versionRegex.exec(versionString);
  if (!match) return false;

  const major = parseInt(match[1] ?? "0", 10);
  const minor = parseInt(match[2] ?? "0", 10);

  // JSONB was introduced in SQLite 3.45.0
  return major > 3 || (major === 3 && minor >= 45);
}

/**
 * Check if JSONB is supported (uses cached value)
 */
export function isJsonbSupported(): boolean {
  return jsonbSupportedCache ?? false;
}

/**
 * Set JSONB support status (called by adapter on connect)
 */
export function setJsonbSupported(supported: boolean): void {
  jsonbSupportedCache = supported;
}

// =============================================================================
// JSONB Conversion Utilities
// =============================================================================

/**
 * Wrap JSON in jsonb() for storage
 * Returns SQL fragment that converts JSON to JSONB
 *
 * @param jsonValue - JSON string value
 * @returns SQL expression for JSONB storage
 */
export function toJsonbSql(jsonValue: string): string {
  const escaped = jsonValue.replace(/'/g, "''");
  return `jsonb('${escaped}')`;
}

/**
 * Wrap JSON in json() for text storage
 *
 * @param jsonValue - JSON string value
 * @returns SQL expression for text JSON storage
 */
export function toJsonSql(jsonValue: string): string {
  const escaped = jsonValue.replace(/'/g, "''");
  return `json('${escaped}')`;
}

/**
 * Get SQL function name for JSONB-aware operations
 * Falls back to text JSON functions if JSONB not supported
 */
export function getJsonFunction(baseName: string, useJsonb: boolean): string {
  if (!useJsonb || !isJsonbSupported()) {
    return baseName; // json_extract, json_set, etc.
  }
  return baseName.replace("json_", "jsonb_"); // jsonb_extract, jsonb_set, etc.
}

/**
 * Detect storage format of a JSON value from SQLite
 *
 * @param value - Value from SQLite query result
 * @returns 'jsonb' if BLOB, 'text' if string, 'unknown' otherwise
 */
export function detectJsonStorageFormat(
  value: unknown,
): "jsonb" | "text" | "unknown" {
  if (value instanceof Buffer || value instanceof Uint8Array) {
    return "jsonb";
  }
  if (typeof value === "string") {
    return "text";
  }
  return "unknown";
}

/**
 * Parse JSON from various storage formats
 *
 * @param value - Value from SQLite (could be string, Buffer, or already parsed)
 * @returns Parsed JSON value
 */
export function parseJsonValue(value: unknown): JsonValue {
  if (value === null || value === undefined) {
    return null;
  }

  // Already parsed object/array
  if (typeof value === "object" && !(value instanceof Buffer)) {
    return value as JsonValue;
  }

  // JSONB blob - need to query through SQLite's json() function
  if (value instanceof Buffer || value instanceof Uint8Array) {
    // JSONB blobs cannot be parsed in JS directly
    // They must be retrieved using SQLite's json() function
    throw new Error(
      "JSONB blob cannot be parsed directly. Use json() in SQL query.",
    );
  }

  // Text JSON string
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as JsonValue;
    } catch {
      // Return as-is if not valid JSON
      return value;
    }
  }

  // Primitives
  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  return null;
}

// =============================================================================
// Validation Utilities
// =============================================================================

/**
 * Validate JSON path syntax
 *
 * @param path - JSON path (e.g., "$.foo.bar[0]")
 * @returns true if valid
 */
export function isValidJsonPath(path: string): boolean {
  if (!path.startsWith("$")) {
    return false;
  }

  // Basic validation: alphanumeric, dots, brackets, underscores
  const pathRegex = /^\$(\.[a-zA-Z_][a-zA-Z0-9_]*|\[\d+\])*$/;
  return pathRegex.test(path);
}

/**
 * Check if a string is valid JSON
 */
export function isValidJson(str: string): boolean {
  try {
    JSON.parse(str);
    return true;
  } catch {
    return false;
  }
}
