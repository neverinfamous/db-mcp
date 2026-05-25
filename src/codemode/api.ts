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

import type { ToolDefinition, ToolGroup, RequestContext } from "../types/index.js";
import { buildProgressContext, sendProgress } from "../utils/progress-utils.js";
import {
  METHOD_ALIASES,
  GROUP_EXAMPLES,
  POSITIONAL_PARAM_MAP,
  GROUP_PREFIX_MAP,
  KEEP_PREFIX_GROUPS,
} from "./api-constants.js";
import { scopesGrantToolAccess } from "../auth/scopes/enforcement.js";

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
 *   sqlite_transaction_begin (transactions) → begin
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
      
      throw new Error(`Positional arguments are not supported for method: ${methodName}. Please use an options object.`);
    }

    return arg;
  }

  // Multi-arg: use positional parameter mapping
  const paramMapping = POSITIONAL_PARAM_MAP[methodName];
  if (paramMapping === undefined) {
    throw new Error(`Positional arguments are not supported for method: ${methodName}. Please use an options object.`);
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
  baseContext?: RequestContext,
): GroupApiRecord {
  const api: GroupApiRecord = {};

  for (const tool of tools) {
    const methodName = toolNameToMethodName(tool.name, groupName);

    api[methodName] = async (...args: unknown[]) => {
      if (baseContext?.auth !== undefined) {
        if (!scopesGrantToolAccess(baseContext.auth.scopes ?? [], tool.name)) {
          throw new Error(`Forbidden: Required scope for tool '${tool.name}' not granted.`);
        }
      }

      const normalizedParams = normalizeParams(methodName, args) ?? {};
      const context: RequestContext = {
        timestamp: new Date(),
        requestId: crypto.randomUUID(),
        ...(baseContext?.server !== undefined ? { server: baseContext.server } : {}),
        ...(baseContext?.progressToken !== undefined ? { progressToken: baseContext.progressToken } : {}),
        ...(baseContext?.auth !== undefined ? { auth: baseContext.auth } : {}),
      };

      const result = await tool.handler(normalizedParams, context);

      return result;
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
  readonly transactions: GroupApiRecord;
  readonly geo: GroupApiRecord;
  readonly introspection: GroupApiRecord;
  readonly migration: GroupApiRecord;

  private readonly toolsByGroup: Map<string, ToolDefinition[]>;
  private readonly baseContext: RequestContext | undefined;

  constructor(tools: ToolDefinition[], baseContext?: RequestContext) {
    this.baseContext = baseContext;
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
    this.core = createGroupApi("core", this.toolsByGroup.get("core") ?? [], baseContext);
    this.json = createGroupApi("json", this.toolsByGroup.get("json") ?? [], baseContext);
    this.text = createGroupApi("text", this.toolsByGroup.get("text") ?? [], baseContext);
    this.stats = createGroupApi("stats", this.toolsByGroup.get("stats") ?? [], baseContext);
    this.vector = createGroupApi(
      "vector",
      this.toolsByGroup.get("vector") ?? [],
      baseContext,
    );
    this.admin = createGroupApi("admin", this.toolsByGroup.get("admin") ?? [], baseContext);
    this.transactions = createGroupApi(
      "transactions",
      this.toolsByGroup.get("transactions") ?? [],
      baseContext,
    );
    this.geo = createGroupApi("geo", this.toolsByGroup.get("geo") ?? [], baseContext);
    this.introspection = createGroupApi(
      "introspection",
      this.toolsByGroup.get("introspection") ?? [],
      baseContext,
    );
    this.migration = createGroupApi(
      "migration",
      this.toolsByGroup.get("migration") ?? [],
      baseContext,
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
    const bindings: Record<string, unknown> = {};

    // Only expose groups that actually have tools in the current environment
    const activeGroups = this.getGroups();
    for (const group of activeGroups) {
      const groupApi = this[group as keyof SqliteApi];
      if (groupApi !== undefined) {
        bindings[group] = groupApi;
      }
    }

    // Top-level convenience aliases (if core group is active)
    if (activeGroups.includes("core")) {
      bindings["readQuery"] = this.core["readQuery"];
      bindings["writeQuery"] = this.core["writeQuery"];
      bindings["listTables"] = this.core["listTables"];
      bindings["describeTable"] = this.core["describeTable"];
    }

    // Progress notification reporting
    bindings["reportProgress"] = async (
      progress: number,
      total?: number,
      message?: string,
    ): Promise<void> => {
      if (this.baseContext) {
        const progressCtx = buildProgressContext(this.baseContext);
        if (progressCtx) {
          await sendProgress(progressCtx, progress, total, message);
        }
      }
    };

    // Top-level help
    bindings["help"] = (): Promise<{
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
export function createSqliteApi(tools: ToolDefinition[], baseContext?: RequestContext): SqliteApi {
  return new SqliteApi(tools, baseContext);
}
