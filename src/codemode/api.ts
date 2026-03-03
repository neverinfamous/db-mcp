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

// =============================================================================
// Method Aliases
// =============================================================================

/**
 * Aliases for common naming shortcuts within each group.
 * Maps alias name → canonical method name.
 */
const METHOD_ALIASES: Record<string, Record<string, string>> = {
  core: {
    query: "readQuery",
    select: "readQuery",
    exec: "writeQuery",
    tables: "listTables",
    schema: "describeTable",
    describe: "describeTable",
    indexes: "getIndexes",
  },
  json: {
    get: "extract",
    put: "set",
    add: "insert",
    delete: "remove",
    validate: "validatePath",
    schema: "analyzeSchema",
    collection: "createJsonCollection",
  },
  text: {
    regex: "regexMatch",
    fuzzy: "fuzzyMatch",
    phonetic: "phoneticMatch",
    search: "advancedSearch",
  },
  stats: {
    summary: "statsSummary",
    describe: "statsBasic",
    average: "statsBasic",
  },
  vector: {
    find: "search",
    insert: "store",
    batchInsert: "batchStore",
    remove: "delete",
  },
  admin: {
    check: "integrityCheck",
    tables: "listVirtualTables",
    pragma: "pragmaSettings",
  },
  geo: {
    near: "nearby",
    bbox: "boundingBox",
  },
};

// =============================================================================
// Group Examples (for help())
// =============================================================================

/**
 * Usage examples for each group's help() output
 */
const GROUP_EXAMPLES: Record<string, string[]> = {
  core: [
    'sqlite.core.readQuery({ query: "SELECT * FROM users LIMIT 10" })',
    'sqlite.core.describeTable({ tableName: "users" })',
    "sqlite.core.listTables()",
    "sqlite.core.writeQuery({ query: \"INSERT INTO users (name) VALUES ('Alice')\" })",
  ],
  json: [
    'sqlite.json.extract({ table: "docs", column: "data", path: "$.title" })',
    'sqlite.json.insert({ table: "docs", column: "data", data: { title: "Hello" } })',
    'sqlite.json.query({ table: "docs", column: "data", filterPaths: { "$.type": "article" } })',
    'sqlite.json.analyzeSchema({ table: "docs", column: "data" })',
  ],
  text: [
    'sqlite.text.regexMatch({ table: "logs", column: "message", pattern: "ERROR" })',
    'sqlite.text.fuzzyMatch({ table: "products", column: "name", search: "laptop", maxDistance: 2 })',
    'sqlite.text.advancedSearch({ table: "products", column: "name", searchTerm: "laptop" })',
  ],
  stats: [
    'sqlite.stats.basic({ table: "orders", column: "amount" })',
    'sqlite.stats.histogram({ table: "products", column: "price", buckets: 10 })',
    'sqlite.stats.percentile({ table: "sales", column: "revenue", percentiles: [25, 50, 75] })',
  ],
  vector: [
    'sqlite.vector.createTable({ tableName: "docs", dimensions: 384 })',
    'sqlite.vector.store({ table: "docs", idColumn: "id", vectorColumn: "emb", id: 1, vector: [...] })',
    'sqlite.vector.search({ table: "docs", vectorColumn: "emb", queryVector: [...], limit: 10 })',
  ],
  admin: [
    "sqlite.admin.vacuum()",
    "sqlite.admin.integrityCheck({ maxErrors: 10 })",
    'sqlite.admin.analyze({ table: "orders" })',
    'sqlite.admin.backup({ targetPath: "/path/to/backup.db" })',
  ],
  geo: [
    "sqlite.geo.distance({ lat1: 40.7128, lon1: -74.006, lat2: 34.0522, lon2: -118.2437 })",
    'sqlite.geo.nearby({ table: "stores", latColumn: "lat", lonColumn: "lon", centerLat: 40.7, centerLon: -74, radius: 10 })',
  ],
};

// =============================================================================
// Positional Parameter Mapping
// =============================================================================

/**
 * Maps method names to their parameter names for positional argument support.
 * Single string = first positional arg maps to this key.
 * Array = multiple positional args map to these keys in order.
 *
 * Enables:
 * - `sqlite.core.readQuery("SELECT...")` → `{ query: "SELECT..." }`
 * - `sqlite.core.describeTable("users")` → `{ tableName: "users" }`
 */
const POSITIONAL_PARAM_MAP: Record<string, string | string[]> = {
  // Core
  readQuery: "query",
  writeQuery: "query",
  describeTable: "tableName",
  dropTable: "tableName",
  getIndexes: "tableName",
  dropIndex: "indexName",
  createTable: ["tableName", "columns"],
  createIndex: ["tableName", "columns"],

  // JSON
  extract: ["table", "column", "path", "whereClause"],
  set: ["table", "column", "path", "value", "whereClause"],
  remove: ["table", "column", "path", "whereClause"],
  insert: ["table", "column", "data"],
  update: ["table", "column", "path", "value", "whereClause"],
  select: ["table", "column", "paths"],
  query: ["table", "column", "filterPaths"],
  merge: ["table", "column", "mergeData", "whereClause"],
  validatePath: "path",
  analyzeSchema: ["table", "column"],
  valid: "json",
  type: ["table", "column", "path", "whereClause"],
  arrayLength: ["table", "column", "path", "whereClause"],
  arrayAppend: ["table", "column", "path", "value", "whereClause"],
  keys: ["table", "column", "path", "whereClause"],
  each: ["table", "column", "path", "whereClause"],
  groupArray: ["table", "valueColumn"],
  groupObject: ["table", "keyColumn"],
  pretty: "json",
  storageInfo: ["table", "column"],
  normalizeColumn: ["table", "column"],
  jsonbConvert: ["table", "column"],
  createJsonCollection: "tableName",

  // Text
  regexExtract: ["table", "column", "pattern"],
  regexMatch: ["table", "column", "pattern"],
  split: ["table", "column", "delimiter"],
  concat: ["table", "columns"],
  replace: ["table", "column", "searchPattern", "replaceWith", "whereClause"],
  trim: ["table", "column"],
  case: ["table", "column", "mode"],
  substring: ["table", "column", "start"],
  validate: ["table", "column", "pattern"],
  normalize: ["table", "column", "mode"],
  fuzzyMatch: ["table", "column", "search"],
  phoneticMatch: ["table", "column", "search"],
  advancedSearch: ["table", "column", "searchTerm"],

  // Stats
  statsBasic: ["table", "column"],
  statsCount: ["table"],
  statsGroupBy: ["table", "column"],
  statsHistogram: ["table", "column", "buckets"],
  statsPercentile: ["table", "column", "percentiles"],
  statsCorrelation: ["table", "column1", "column2"],
  statsRegression: ["table", "xColumn", "yColumn"],
  statsTopN: ["table", "column"],

  // Vector
  vectorCreateTable: ["tableName", "dimensions"],
  store: ["table", "idColumn", "vectorColumn"],
  batchStore: ["table", "idColumn", "vectorColumn"],
  search: ["table", "vectorColumn", "queryVector"],

  // Admin
  analyze: "table",
  backup: "targetPath",
  restore: "sourcePath",
  indexStats: "table",
  pragmaSettings: "pragma",
  pragmaTableInfo: "table",
  appendInsight: "insight",
};

// =============================================================================
// Tool Name → Method Name Conversion
// =============================================================================

/**
 * Map group name to the prefix used in tool names.
 * Some groups use different prefixes.
 */
const GROUP_PREFIX_MAP: Record<string, string> = {
  // Most groups: use group name as prefix after "sqlite_"
  // Example: sqlite_json_extract → group=json, prefix="json_"
  // Exceptions handled here:
  stats: "stats_",
  vector: "vector_",
  geo: "geo_",
  admin: "", // Admin tools have varied prefixes — handled case-by-case
  codemode: "execute_",
};

/**
 * Groups where the prefix should be kept in the method name
 * (because it's semantically part of the method identity)
 */
const KEEP_PREFIX_GROUPS = new Set(["stats", "admin"]);

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

    // String arg — use positional mapping
    if (typeof arg === "string") {
      const paramMapping = POSITIONAL_PARAM_MAP[methodName];
      if (typeof paramMapping === "string") {
        return { [paramMapping]: arg };
      }
      if (Array.isArray(paramMapping) && paramMapping[0] !== undefined) {
        return { [paramMapping[0]]: arg };
      }
      // Fallback: try common names
      return { sql: arg, query: arg, table: arg, name: arg };
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

    // Create group-specific APIs for all 7 groups
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
