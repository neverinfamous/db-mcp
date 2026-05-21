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
