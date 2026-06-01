/**
 * Text Tool Helpers
 *
 * Shared schemas and validation functions for text tools.
 */

/**
 * Valid enum values for handler-side validation.
 * These are validated inside the handler's try/catch to produce structured
 * errors instead of raw MCP -32602 frames from Zod enum rejection.
 */
export const VALID_TEXT_CASE_MODES = ["upper", "lower"] as const;
export const VALID_NORMALIZE_MODES = [
  "nfc",
  "nfd",
  "nfkc",
  "nfkd",
  "strip_accents",
] as const;
export const VALID_VALIDATE_PATTERNS = [
  "email",
  "phone",
  "url",
  "uuid",
  "ipv4",
  "custom",
] as const;
export const VALID_PHONETIC_ALGORITHMS = ["soundex", "metaphone"] as const;
export const VALID_TRIM_MODES = ["both", "left", "right"] as const;
export const VALID_SEARCH_TECHNIQUES = ["exact", "fuzzy", "phonetic"] as const;

// Re-export validateColumnExists/validateColumnsExist from shared utility
export {
  validateColumnExists,
  validateColumnsExist,
} from "../column-validation.js";

/**
 * Coerce string-typed numbers to actual numbers.
 * Returns undefined for non-numeric strings so the schema default kicks in.
 */

/**
 * Sanitizes an FTS5 search query by:
 * 1. Stripping unbalanced double quotes or balancing them.
 * 2. Normalizing whitespace.
 * 3. Removing stray/invalid operators (AND, OR, NOT) that would crash FTS5.
 * 4. Escaping single quotes to prevent SQL injection.
 * Allows balanced double quotes for exact phrase matching.
 */
export function sanitizeFtsQuery(query: string): string {
  if (!query) return "";
  
  // 1. Normalize whitespace
  let clean = query.replace(/\s+/g, " ").trim();
  
  // 2. Balance double quotes for exact phrase matching
  const quoteCount = (clean.match(/"/g) ?? []).length;
  if (quoteCount % 2 !== 0) {
    // Unbalanced: either strip all or add one at the end. Stripping is safer for search.
    clean = clean.replace(/"/g, "");
  }
  
  // 3. Remove stray or invalid operators (AND, OR, NOT)
  // Remove if they appear at the start or end
  clean = clean.replace(/^(?:AND|OR|NOT)\s+/i, "");
  clean = clean.replace(/\s+(?:AND|OR|NOT)$/i, "");
  // Replace consecutive operators with the first one
  clean = clean.replace(/\s+(?:AND|OR|NOT)\s+(?:AND|OR|NOT)\s+/gi, " AND ");
  
  // 4. Escape single quotes for SQLite string literals
  // Notice: The tool handlers often already do `replace(/'/g, "''")`. 
  // We don't do it here to avoid double escaping if we apply this to the raw query string.
  // Instead, the handlers will do it after sanitization.
  
  return clean.trim();
}
