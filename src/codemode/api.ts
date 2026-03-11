/**
 * db-mcp - Code Mode API
 *
 * Generates the `sqlite.*` API object that is injected into the sandbox.
 * Each tool group becomes a namespace (e.g., `sqlite.core.readQuery()`).
 *
 * Architecture:
 * - Reads tool definitions from the adapter
 * - Groups tools by their `group` property
 * - Converts tool names to camelCase method names
 * - Creates proxy methods that normalize positional args and call handlers
 * - Exposes `help()` at top level and per-group for discoverability
 */

import type { ToolDefinition, ToolGroup } from "../types/index.js";
import {
  METHOD_ALIASES,
  GROUP_EXAMPLES,
  POSITIONAL_PARAM_MAP,
  GROUP_PREFIX_MAP,
  KEEP_PREFIX_GROUPS,
} from "./api-constants.js";

/**
 * Convert tool name to camelCase method name.
 *
 * Examples:
 *   sqlite_read_query (core) → readQuery
 *   sqlite_json_extract (json) → extract
 *   sqlite_stats_basic (stats) → statsBasic
 *   sqlite_vector_search (vector) → search
 *   sqlite_geo_distance (geo) → distance
 *   sqlite_backup (admin) → backup
 *   sqlite_transaction_begin (admin) → transactionBegin
 */
export function toolNameToMethodName(
  toolName: string,
  groupName: string,
): string {
  // Remove sqlite_ prefix
  let name = toolName.replace(/^sqlite_/, "");

  // For groups not in KEEP_PREFIX_GROUPS, strip the group prefix
  if (!KEEP_PREFIX_GROUPS.has(groupName)) {
    const groupPrefix = GROUP_PREFIX_MAP[groupName] ?? groupName + "_";
    if (name.startsWith(groupPrefix) && groupPrefix !== "") {
      name = name.substring(groupPrefix.length);
    }
  }

  // Convert snake_case to camelCase
  return name.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

// =============================================================================
// Parameter Normalization
// =============================================================================

/**
 * Normalize parameters to support positional arguments.
 * Handles both single positional args and multiple positional args.
 */
function normalizeParams(methodName: string, args: unknown[]): unknown {
  if (args.length === 0) return undefined;

  if (args.length === 1) {
    const arg = args[0];

    // Object arg — pass through
    if (typeof arg === "object" && arg !== null && !Array.isArray(arg)) {
      return arg;
    }

    // Primitive arg (string, number, boolean) — use positional mapping
    if (
      typeof arg === "string" ||
      typeof arg === "number" ||
      typeof arg === "boolean"
    ) {
      const paramMapping = POSITIONAL_PARAM_MAP[methodName];
      if (typeof paramMapping === "string") {
        return { [paramMapping]: arg };
      }
      if (Array.isArray(paramMapping) && paramMapping[0] !== undefined) {
        return { [paramMapping[0]]: arg };
      }
      // Fallback: try common names (only for strings)
      if (typeof arg === "string") {
        return { sql: arg, query: arg, table: arg, name: arg };
      }
      return arg;
    }

    return arg;
  }

  // Multi-arg: use positional parameter mapping
  const paramMapping = POSITIONAL_PARAM_MAP[methodName];
  if (paramMapping === undefined) {
    return args[0];
  }

  if (typeof paramMapping === "string") {
    const result: Record<string, unknown> = { [paramMapping]: args[0] };
    if (args.length > 1) {
      const lastArg = args[args.length - 1];
      if (
        typeof lastArg === "object" &&
        lastArg !== null &&
        !Array.isArray(lastArg)
      ) {
        Object.assign(result, lastArg);
      }
    }
    return result;
  }

  // Array mapping — map positional args to named params
  const result: Record<string, unknown> = {};

  for (let i = 0; i < paramMapping.length && i < args.length; i++) {
    const key = paramMapping[i];
    if (key !== undefined) {
      result[key] = args[i];
    }
  }

  // Merge trailing options object
  if (args.length > paramMapping.length) {
    const lastArg = args[args.length - 1];
    if (
      typeof lastArg === "object" &&
      lastArg !== null &&
      !Array.isArray(lastArg)
    ) {
      Object.assign(result, lastArg);
    }
  }

  return result;
}

// =============================================================================
// Group API Factory
// =============================================================================

/** Type alias for group API record */
type GroupApiRecord = Record<string, (...args: unknown[]) => Promise<unknown>>;

/**
 * Create a group API from tool definitions.
 * Each tool becomes a method on the group object.
 */
function createGroupApi(
  groupName: string,
  tools: ToolDefinition[],
): GroupApiRecord {
  const api: GroupApiRecord = {};

  for (const tool of tools) {
    const methodName = toolNameToMethodName(tool.name, groupName);

    api[methodName] = async (...args: unknown[]) => {
      const normalizedParams = normalizeParams(methodName, args) ?? {};
      const context = {
        timestamp: new Date(),
        requestId: crypto.randomUUID(),
      };
      return tool.handler(normalizedParams, context);
    };
  }

  // Add method aliases
  const aliases = METHOD_ALIASES[groupName];
  if (aliases) {
    for (const [aliasName, canonicalName] of Object.entries(aliases)) {
      if (api[canonicalName] !== undefined) {
        api[aliasName] = api[canonicalName];
      }
    }
  }

  // Add help() for discoverability
  api["help"] = (): Promise<{
    group: string;
    methods: string[];
    examples: string[];
  }> => {
    const methods = Object.keys(api)
      .filter((k) => k !== "help")
      .sort();

    return Promise.resolve({
      group: groupName,
      methods,
      examples: GROUP_EXAMPLES[groupName] ?? [],
    });
  };

  return api;
}

// =============================================================================
// SqliteApi Class
// =============================================================================

/**
 * Main API class exposing all SQLite tool groups.
 * This is the object injected as `sqlite` in the sandbox.
 */
export class SqliteApi {
  readonly core: GroupApiRecord;
  readonly json: GroupApiRecord;
  readonly text: GroupApiRecord;
  readonly stats: GroupApiRecord;
  readonly vector: GroupApiRecord;
  readonly admin: GroupApiRecord;
  readonly geo: GroupApiRecord;
  readonly introspection: GroupApiRecord;
  readonly migration: GroupApiRecord;

  private readonly toolsByGroup: Map<string, ToolDefinition[]>;

  constructor(tools: ToolDefinition[]) {
    // Group tools by their group property
    this.toolsByGroup = new Map();
    for (const tool of tools) {
      // Skip codemode tools (no recursion)
      if (tool.group === "codemode") continue;

      const existing = this.toolsByGroup.get(tool.group) ?? [];
      existing.push(tool);
      this.toolsByGroup.set(tool.group, existing);
    }

    // Create group-specific APIs for all 9 groups
    this.core = createGroupApi("core", this.toolsByGroup.get("core") ?? []);
    this.json = createGroupApi("json", this.toolsByGroup.get("json") ?? []);
    this.text = createGroupApi("text", this.toolsByGroup.get("text") ?? []);
    this.stats = createGroupApi("stats", this.toolsByGroup.get("stats") ?? []);
    this.vector = createGroupApi(
      "vector",
      this.toolsByGroup.get("vector") ?? [],
    );
    this.admin = createGroupApi("admin", this.toolsByGroup.get("admin") ?? []);
    this.geo = createGroupApi("geo", this.toolsByGroup.get("geo") ?? []);
    this.introspection = createGroupApi(
      "introspection",
      this.toolsByGroup.get("introspection") ?? [],
    );
    this.migration = createGroupApi(
      "migration",
      this.toolsByGroup.get("migration") ?? [],
    );
  }

  /**
   * Get all available groups
   */
  getGroups(): string[] {
    return [...this.toolsByGroup.keys()].sort();
  }

  /**
   * Get method names for a group
   */
  getGroupMethods(group: ToolGroup): string[] {
    const groupApi = this[group as keyof SqliteApi] as
      | GroupApiRecord
      | undefined;
    if (!groupApi || typeof groupApi !== "object") return [];
    return Object.keys(groupApi)
      .filter((k) => k !== "help")
      .sort();
  }

  /**
   * Create the sandbox bindings object.
   * This is the object injected as `sqlite` in the sandbox.
   * Includes group namespaces + top-level aliases for common operations.
   */
  createSandboxBindings(): Record<string, unknown> {
    const bindings: Record<string, unknown> = {
      // Group namespaces
      core: this.core,
      json: this.json,
      text: this.text,
      stats: this.stats,
      vector: this.vector,
      admin: this.admin,
      geo: this.geo,
      introspection: this.introspection,
      migration: this.migration,

      // Top-level convenience aliases
      readQuery: this.core["readQuery"],
      writeQuery: this.core["writeQuery"],
      listTables: this.core["listTables"],
      describeTable: this.core["describeTable"],

      // Top-level help
      help: (): Promise<{
        groups: string[];
        totalMethods: number;
        usage: string;
      }> => {
        const groups = this.getGroups();
        let totalMethods = 0;
        for (const group of groups) {
          totalMethods += this.getGroupMethods(group as ToolGroup).length;
        }
        return Promise.resolve({
          groups,
          totalMethods,
          usage:
            "Use sqlite.<group>.help() for group details. Example: sqlite.core.help()",
        });
      },
    };

    return bindings;
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a SqliteApi instance from tool definitions.
 * Convenience factory for use in tool handler setup.
 */
export function createSqliteApi(tools: ToolDefinition[]): SqliteApi {
  return new SqliteApi(tools);
}
