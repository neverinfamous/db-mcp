/**
 * db-mcp — Tool Filtering Types
 *
 * Tool groups, meta-groups, and filter configuration types.
 */

// =============================================================================
// Tool Filtering Types
// =============================================================================

/**
 * Tool group identifiers
 */
export type ToolGroup =
  | "core" // Basic CRUD, schema operations (8 tools)
  | "json" // JSON/JSONB operations (23 tools)
  | "text" // Text processing + FTS5 (16 tools)
  | "stats" // Statistical analysis (13 WASM / 19 Native)
  | "vector" // Vector/semantic search (11 tools)
  | "admin" // Administration (25 WASM / 32 Native)
  | "geo" // Geospatial (4 WASM / 11 Native)
  | "introspection" // Schema analysis, dependency graphs (6 tools)
  | "migration" // Migration tracking (6 tools, opt-in)
  | "codemode"; // Sandboxed code execution (1 tool)

/**
 * Meta-group identifiers for common multi-group selections.
 * These are shortcuts that expand to multiple ToolGroups.
 */
export type MetaGroup =
  | "starter" // Core + JSON + Text (47 tools)
  | "analytics" // Core + JSON + Stats (44 WASM / 50 Native)
  | "search" // Core + Text + Vector (35 tools)
  | "spatial" // Core + Geo + Vector (23 WASM / 30 Native)
  | "dev-schema" // Core + Introspection + Migration (22 tools)
  | "minimal" // Core only (8 tools)
  | "full"; // All tools (112 WASM / 136 Native)

/**
 * Tool filter rule
 */
export interface ToolFilterRule {
  /** Rule type: include or exclude */
  type: "include" | "exclude";

  /** Target: group name or tool name */
  target: string;

  /** Whether target is a group (true) or individual tool (false) */
  isGroup: boolean;
}

/**
 * Parsed tool filter configuration
 */
export interface ToolFilterConfig {
  /** Original filter string */
  raw: string;

  /** Parsed rules in order */
  rules: ToolFilterRule[];

  /** Set of enabled tool groups after applying rules */
  enabledGroups: Set<ToolGroup>;

  /** Set of explicitly excluded tool names (base names without prefix) */
  excludedTools: Set<string>;

  /** Set of explicitly included tool names (base names without prefix) */
  includedTools: Set<string>;
}
