/**
 * Text Search and Analysis Tools
 *
 * Fuzzy matching, phonetic search, text normalization, validation, advanced search.
 */

import { z } from "zod";
import type { SqliteAdapter } from "../../SqliteAdapter.js";
import type { ToolDefinition, RequestContext } from "../../../../types/index.js";
import { readOnly } from "../../../../utils/annotations.js";
import {
  validateWhereClause,
  sanitizeIdentifier,
} from "../../../../utils/index.js";
import { formatError } from "../../../../utils/errors.js";
import {
  levenshtein,
  metaphone,
  soundex,
  stripAccents,
  VALIDATION_PATTERNS,
} from "./formatting.js";
import {
  FuzzyMatchSchema,
  PhoneticMatchSchema,
  TextNormalizeSchema,
  TextValidateSchema,
  AdvancedSearchSchema,
  validateColumnExists,
} from "./helpers.js";

export function createFuzzyMatchTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_fuzzy_match",
    description:
      "Find fuzzy matches using Levenshtein distance. By default, splits values into tokens and matches against each word (use tokenize:false to match entire value). Use maxDistance 1-3 for similar-length strings.",
    group: "text",
    inputSchema: FuzzyMatchSchema,
    outputSchema: z.object({
      success: z.boolean(),
      matchCount: z.number(),
      tokenized: z.boolean(),
      matches: z.array(
        z.object({
          value: z.string(),
          matchedToken: z.string().optional(),
          tokenDistance: z.number().optional(),
          distance: z.number(),
        }),
      ),
    }),
    requiredScopes: ["read"],
    annotations: readOnly("Fuzzy Match"),
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const input = FuzzyMatchSchema.parse(params);
        // Validate and quote identifiers, then verify column exists
        const table = sanitizeIdentifier(input.table);
        const column = sanitizeIdentifier(input.column);
        await validateColumnExists(adapter, input.table, input.column);

        const sql = `SELECT ${column} FROM ${table} WHERE ${column} IS NOT NULL LIMIT 1000`;
        const result = await adapter.executeReadQuery(sql);

        const matches: {
          value: string;
          matchedToken?: string;
          tokenDistance?: number;
          distance: number;
        }[] = [];

        for (const row of result.rows ?? []) {
          const rawValue = row[input.column];
          const value =
            typeof rawValue === "string"
              ? rawValue
              : JSON.stringify(rawValue ?? "");

          if (input.tokenize) {
            // Token-based matching: split into words and find best match
            const tokens = value.split(/\s+/).filter((t) => t.length > 0);
            let bestToken = "";
            let bestDistance = Infinity;

            for (const token of tokens) {
              const dist = levenshtein(input.search, token);
              if (dist < bestDistance) {
                bestDistance = dist;
                bestToken = token;
              }
            }

            if (bestDistance <= input.maxDistance) {
              matches.push({
                value,
                matchedToken: bestToken,
                tokenDistance: bestDistance,
                distance: bestDistance,
              });
            }
          } else {
            // Legacy behavior: match against entire column value
            const distance = levenshtein(input.search, value);
            if (distance <= input.maxDistance) {
              matches.push({ value, distance });
            }
          }
        }

        // Sort by distance (ascending) and limit
        matches.sort((a, b) => a.distance - b.distance);
        const limited = matches.slice(0, input.limit);

        return {
          success: true,
          matchCount: limited.length,
          tokenized: input.tokenize,
          matches: limited,
        };
      } catch (error) {
        const structured = formatError(error);
        return {
          success: false,
          matchCount: 0,
          tokenized: ((params as { tokenize?: boolean } | null)?.tokenize) ?? true,
          matches: [],
          error: structured.error,
          code: structured.code,
          suggestion: structured.suggestion,
        };
      }
    },
  };
}

/**
 * Phonetic match using Soundex or Metaphone
 */
export function createPhoneticMatchTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_phonetic_match",
    description:
      "Find phonetically similar values using Soundex (SQLite native) or Metaphone algorithm.",
    group: "text",
    inputSchema: PhoneticMatchSchema,
    outputSchema: z.object({
      success: z.boolean(),
      searchCode: z.string(),
      matchCount: z.number(),
      matches: z.array(
        z.object({
          value: z.string(),
          phoneticCode: z.string(),
          row: z.record(z.string(), z.unknown()).optional(),
        }),
      ),
    }),
    requiredScopes: ["read"],
    annotations: readOnly("Phonetic Match"),
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const input = PhoneticMatchSchema.parse(params);
        // Validate and quote identifiers, then verify column exists
        const table = sanitizeIdentifier(input.table);
        const column = sanitizeIdentifier(input.column);
        await validateColumnExists(adapter, input.table, input.column);

        const searchCode =
          input.algorithm === "metaphone"
            ? metaphone(input.search)
            : soundex(input.search); // Compute locally to ensure it's always available

        // Use JS-based word splitting for both native and WASM to match
        // against individual words (consistent with advanced_search behavior).
        // SQLite's native soundex() computes on the full string, which doesn't
        // support per-word matching.
        const sql = `SELECT * FROM ${table} WHERE ${column} IS NOT NULL LIMIT 1000`;
        if (input.algorithm === "soundex") {
          const result = await adapter.executeReadQuery(sql);

          const matches: {
            value: string;
            phoneticCode: string;
            row?: Record<string, unknown>;
          }[] = [];

          for (const row of result.rows ?? []) {
            const rawValue = row[input.column];
            const value =
              typeof rawValue === "string"
                ? rawValue
                : JSON.stringify(rawValue ?? "");
            const words = value.split(/\s+/).filter((w) => w.length > 0);

            for (const word of words) {
              const code = soundex(word);
              if (code === searchCode) {
                const match: {
                  value: string;
                  phoneticCode: string;
                  row?: Record<string, unknown>;
                } = { value, phoneticCode: code };
                if (input.includeRowData) {
                  match.row = row;
                }
                matches.push(match);
                break; // Only match once per row
              }
            }
          }

          return {
            success: true,
            searchCode,
            matchCount: matches.length,
            matches: matches.slice(0, input.limit),
          };
        } else {
          // Metaphone in JS — split by words like soundex path
          const result = await adapter.executeReadQuery(sql);

          const matches: {
            value: string;
            phoneticCode: string;
            row?: Record<string, unknown>;
          }[] = [];

          for (const row of result.rows ?? []) {
            const rawValue = row[input.column];
            const value =
              typeof rawValue === "string"
                ? rawValue
                : JSON.stringify(rawValue ?? "");
            const words = value.split(/\s+/).filter((w) => w.length > 0);

            for (const word of words) {
              const code = metaphone(word);
              if (code === searchCode) {
                const match: {
                  value: string;
                  phoneticCode: string;
                  row?: Record<string, unknown>;
                } = { value, phoneticCode: code };
                if (input.includeRowData) {
                  match.row = row;
                }
                matches.push(match);
                break; // Only match once per row
              }
            }
          }

          return {
            success: true,
            searchCode,
            matchCount: matches.length,
            matches: matches.slice(0, input.limit),
          };
        }
      } catch (error) {
        const structured = formatError(error);
        return {
          success: false,
          searchCode: "",
          matchCount: 0,
          matches: [],
          error: structured.error,
          code: structured.code,
          suggestion: structured.suggestion,
        };
      }
    },
  };
}

/**
 * Normalize text (Unicode normalization or accent stripping)
 */
export function createTextNormalizeTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_text_normalize",
    description:
      "Normalize text using Unicode normalization (NFC, NFD, NFKC, NFKD) or strip accents.",
    group: "text",
    inputSchema: TextNormalizeSchema,
    outputSchema: z.object({
      success: z.boolean(),
      rowCount: z.number(),
      rows: z.array(
        z.object({
          original: z.string(),
          normalized: z.string(),
        }),
      ),
    }),
    requiredScopes: ["read"],
    annotations: readOnly("Text Normalize"),
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const input = TextNormalizeSchema.parse(params);
        // Validate and quote identifiers, then verify column exists
        const table = sanitizeIdentifier(input.table);
        const column = sanitizeIdentifier(input.column);
        await validateColumnExists(adapter, input.table, input.column);

        let sql = `SELECT ${column} as original FROM ${table}`;
        if (input.whereClause) {
          validateWhereClause(input.whereClause);
          sql += ` WHERE ${input.whereClause}`;
        }
        sql += ` LIMIT ${input.limit}`;

        const result = await adapter.executeReadQuery(sql);

        const rows = (result.rows ?? []).map((row) => {
          const rawOriginal = row["original"];
          const original =
            typeof rawOriginal === "string"
              ? rawOriginal
              : JSON.stringify(rawOriginal ?? "");
          let normalized: string;

          if (input.mode === "strip_accents") {
            normalized = stripAccents(original);
          } else {
            normalized = original.normalize(
              input.mode.toUpperCase() as "NFC" | "NFD" | "NFKC" | "NFKD",
            );
          }

          return { original, normalized };
        });

        return {
          success: true,
          rowCount: rows.length,
          rows,
        };
      } catch (error) {
        const structured = formatError(error);
        return {
          success: false,
          rowCount: 0,
          rows: [],
          error: structured.error,
          code: structured.code,
          suggestion: structured.suggestion,
        };
      }
    },
  };
}

/**
 * Validate text against common patterns
 */
export function createTextValidateTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_text_validate",
    description:
      "Validate text values against patterns: email, phone, URL, UUID, IPv4, or custom regex.",
    group: "text",
    inputSchema: TextValidateSchema,
    outputSchema: z.object({
      success: z.boolean(),
      totalRows: z.number(),
      validCount: z.number(),
      invalidCount: z.number(),
      invalidRows: z.array(
        z.object({
          value: z.string().nullable(),
          rowid: z.number().optional(),
        }),
      ),
    }),
    requiredScopes: ["read"],
    annotations: readOnly("Text Validate"),
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const input = TextValidateSchema.parse(params);
        // Validate and quote identifiers, then verify column exists
        const table = sanitizeIdentifier(input.table);
        const column = sanitizeIdentifier(input.column);
        await validateColumnExists(adapter, input.table, input.column);

        // Get validation pattern
        let pattern: RegExp;
        if (input.pattern === "custom") {
          if (!input.customPattern) {
            throw new Error("customPattern is required when pattern='custom'");
          }
          // Normalize pattern: handle common JSON double-escaping issues
          // e.g., "\\." in JSON becomes "\." in JavaScript string, but some clients
          // may send "\\\\." which becomes "\\" - normalize excessive backslashes
          const normalizedPattern = input.customPattern.replace(/\\\\/g, "\\");
          try {
            pattern = new RegExp(normalizedPattern);
          } catch {
            throw new Error(
              `Invalid regex pattern: ${input.customPattern} (normalized to: ${normalizedPattern})`,
            );
          }
        } else {
          const foundPattern = VALIDATION_PATTERNS[input.pattern];
          if (!foundPattern) {
            throw new Error(`Unknown pattern: ${input.pattern}`);
          }
          pattern = foundPattern;
        }

        let sql = `SELECT rowid, ${column} as value FROM ${table}`;
        if (input.whereClause) {
          validateWhereClause(input.whereClause);
          sql += ` WHERE ${input.whereClause}`;
        }
        sql += ` LIMIT ${input.limit}`;

        const result = await adapter.executeReadQuery(sql);

        const invalidRows: { value: string | null; rowid?: number }[] = [];
        let validCount = 0;

        for (const row of result.rows ?? []) {
          const rawValue = row["value"];
          // Handle null/empty values with user-friendly display
          const value =
            rawValue === null || rawValue === undefined
              ? ""
              : typeof rawValue === "string"
                ? rawValue
                : JSON.stringify(rawValue);
          // Display actual value: null for null/undefined, otherwise the value (truncated if long)
          const displayValue =
            rawValue === null || rawValue === undefined
              ? null
              : value.length > 100
                ? value.slice(0, 100) + "..."
                : value;
          if (pattern.test(value)) {
            validCount++;
          } else {
            const rowid = row["rowid"];
            if (typeof rowid === "number") {
              invalidRows.push({ value: displayValue, rowid });
            } else {
              invalidRows.push({ value: displayValue });
            }
          }
        }

        return {
          success: true,
          totalRows: result.rows?.length ?? 0,
          validCount,
          invalidCount: invalidRows.length,
          invalidRows,
        };
      } catch (error) {
        const structured = formatError(error);
        return {
          success: false,
          totalRows: 0,
          validCount: 0,
          invalidCount: 0,
          invalidRows: [],
          error: structured.error,
          code: structured.code,
          suggestion: structured.suggestion,
        };
      }
    },
  };
}

/**
 * Output schema for advanced search
 */
export const AdvancedSearchOutputSchema = z.object({
  success: z.boolean(),
  searchTerm: z.string(),
  techniques: z.array(z.string()),
  matchCount: z.number(),
  matches: z.array(
    z.object({
      rowid: z.number(),
      text: z.string(),
      matchTypes: z.array(z.string()),
      bestScore: z.number(),
      bestType: z.string(),
    }),
  ),
});

/**
 * Advanced search combining multiple text processing techniques
 */
export function createAdvancedSearchTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_advanced_search",
    description:
      "Advanced search combining exact, fuzzy (Levenshtein), and phonetic (Soundex) matching",
    group: "text",
    inputSchema: AdvancedSearchSchema,
    outputSchema: AdvancedSearchOutputSchema,
    requiredScopes: ["read"],
    annotations: readOnly("Advanced Search"),
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const input = AdvancedSearchSchema.parse(params);
        // Validate and quote identifiers, then verify column exists
        const table = sanitizeIdentifier(input.table);
        const column = sanitizeIdentifier(input.column);
        await validateColumnExists(adapter, input.table, input.column);

        // Fetch candidate rows
        let whereClause = "";
        if (input.whereClause) {
          validateWhereClause(input.whereClause);
          whereClause = ` AND ${input.whereClause}`;
        }
        const query = `SELECT rowid as id, ${column} AS value FROM ${table} WHERE ${column} IS NOT NULL${whereClause} LIMIT 1000`;
        const result = await adapter.executeReadQuery(query);

        if (!result.rows || result.rows.length === 0) {
          return {
            success: true,
            searchTerm: input.searchTerm,
            techniques: input.techniques,
            matchCount: 0,
            matches: [],
          };
        }

        const searchLower = input.searchTerm.toLowerCase();
        const searchSoundex = soundex(input.searchTerm);

        interface Match {
          rowid: number;
          text: string;
          matchTypes: string[];
          bestScore: number;
          bestType: string;
        }

        const allMatches: Match[] = [];

        for (const row of result.rows) {
          const rawValue: unknown = row["value"];
          const text =
            typeof rawValue === "string"
              ? rawValue
              : typeof rawValue === "number"
                ? String(rawValue)
                : "";
          const textLower = text.toLowerCase();
          const matches: { type: string; score: number }[] = [];

          // Exact match (case-insensitive substring)
          if (input.techniques.includes("exact")) {
            if (textLower.includes(searchLower)) {
              matches.push({ type: "exact", score: 1.0 });
            }
          }

          // Fuzzy match (Levenshtein ratio)
          if (input.techniques.includes("fuzzy")) {
            const distance = levenshtein(input.searchTerm, text);
            const maxLen = Math.max(input.searchTerm.length, text.length);
            const similarity = maxLen === 0 ? 1 : 1 - distance / maxLen;
            if (similarity >= input.fuzzyThreshold) {
              matches.push({ type: "fuzzy", score: similarity });
            }
          }

          // Phonetic match (Soundex)
          if (input.techniques.includes("phonetic")) {
            const words = text.split(/\s+/);
            for (const word of words) {
              if (soundex(word) === searchSoundex) {
                matches.push({ type: "phonetic", score: 0.8 });
                break;
              }
            }
          }

          if (matches.length > 0) {
            const best = matches.reduce((a, b) => (a.score > b.score ? a : b));
            // Safely coerce rowid to number, defaulting to 0 if undefined/null
            const rawRowid = row["id"];
            const rowid =
              typeof rawRowid === "number"
                ? rawRowid
                : typeof rawRowid === "string"
                  ? parseInt(rawRowid, 10) || 0
                  : 0;
            allMatches.push({
              rowid,
              text: text.length > 100 ? text.slice(0, 100) + "..." : text,
              matchTypes: matches.map((m) => m.type),
              bestScore: Math.round(best.score * 1000) / 1000,
              bestType: best.type,
            });
          }
        }

        // Sort by score and limit
        allMatches.sort((a, b) => b.bestScore - a.bestScore);
        const limited = allMatches.slice(0, input.limit);

        return {
          success: true,
          searchTerm: input.searchTerm,
          techniques: input.techniques,
          matchCount: limited.length,
          matches: limited,
        };
      } catch (error) {
        const structured = formatError(error);
        const rawParams = params as { searchTerm?: string; techniques?: string[] } | null;
        return {
          success: false,
          searchTerm: rawParams?.searchTerm ?? "",
          techniques: rawParams?.techniques ?? [],
          matchCount: 0,
          matches: [],
          error: structured.error,
          code: structured.code,
          suggestion: structured.suggestion,
        };
      }
    },
  };
}