/**
 * db-mcp - Code Mode API Constants
 *
 * Static constant maps for the sandbox API:
 * - METHOD_ALIASES: shorthand names within each group
 * - GROUP_EXAMPLES: help() output per group
 * - POSITIONAL_PARAM_MAP: positional → named arg mapping
 * - GROUP_PREFIX_MAP: tool name prefix stripping rules
 * - KEEP_PREFIX_GROUPS: groups that retain their prefix in method names
 */

// =============================================================================
// Method Aliases
// =============================================================================

/**
 * Aliases for common naming shortcuts within each group.
 * Maps alias name → canonical method name.
 */
export const METHOD_ALIASES: Record<string, Record<string, string>> = {
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
  introspection: {
    deps: "dependencyGraph",
    toposort: "topologicalSort",
    cascade: "cascadeSimulator",
    snapshot: "schemaSnapshot",
    constraints: "constraintAnalysis",
    risks: "migrationRisks",
  },
  migration: {
    setup: "migrationInit",
    log: "migrationHistory",
    run: "migrationApply",
    undo: "migrationRollback",
  },
};

// =============================================================================
// Group Examples (for help())
// =============================================================================

/**
 * Usage examples for each group's help() output
 */
export const GROUP_EXAMPLES: Record<string, string[]> = {
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
    'sqlite.stats.statsBasic({ table: "orders", column: "amount" })',
    'sqlite.stats.statsHistogram({ table: "products", column: "price", buckets: 10 })',
    'sqlite.stats.statsPercentile({ table: "sales", column: "revenue", percentiles: [25, 50, 75] })',
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
  introspection: [
    "sqlite.introspection.dependencyGraph()",
    'sqlite.introspection.cascadeSimulator({ table: "users" })',
    'sqlite.introspection.schemaSnapshot({ sections: ["tables", "indexes"] })',
    'sqlite.introspection.constraintAnalysis({ table: "orders" })',
  ],
  migration: [
    "sqlite.migration.migrationInit()",
    'sqlite.migration.migrationApply({ version: "1.0.0", migrationSql: "ALTER TABLE users ADD COLUMN email TEXT" })',
    "sqlite.migration.migrationStatus()",
    'sqlite.migration.migrationHistory({ status: "applied" })',
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
export const POSITIONAL_PARAM_MAP: Record<string, string | string[]> = {
  // Core
  readQuery: "query",
  writeQuery: "query",
  describeTable: "tableName",
  dropTable: "tableName",
  getIndexes: "tableName",
  dropIndex: "indexName",
  createTable: ["tableName", "columns"],
  createIndex: ["tableName", "columns", "indexName"],

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
  statsBasic: ["table", "column", "whereClause"],
  statsCount: ["table", "column", "distinct", "whereClause"],
  statsGroupBy: [
    "table",
    "valueColumn",
    "groupByColumn",
    "stat",
    "whereClause",
  ],
  statsHistogram: ["table", "column", "buckets", "whereClause"],
  statsPercentile: ["table", "column", "percentiles", "whereClause"],
  statsCorrelation: ["table", "column1", "column2", "whereClause"],
  statsRegression: ["table", "xColumn", "yColumn", "whereClause"],
  statsTopN: ["table", "column", "n", "orderDirection", "selectColumns"],
  statsDistinct: ["table", "column", "whereClause"],
  statsSummary: ["table", "columns", "whereClause"],
  statsFrequency: ["table", "column", "whereClause"],
  statsOutliers: ["table", "column", "whereClause"],
  statsHypothesis: [
    "table",
    "column",
    "testType",
    "expectedMean",
    "whereClause",
  ],

  // Vector
  vectorCreateTable: ["tableName", "dimensions"],
  store: ["table", "idColumn", "vectorColumn"],
  batchStore: ["table", "idColumn", "vectorColumn"],
  search: ["table", "vectorColumn", "queryVector"],

  // Admin
  analyze: "table",
  backup: "targetPath",
  restore: "sourcePath",
  verifyBackup: "backupPath",
  indexStats: "table",
  pragmaSettings: "pragma",
  pragmaTableInfo: "table",
  pragmaCompileOptions: "filter",
  appendInsight: "insight",
  generateSeries: ["start", "stop", "step"],
  createView: ["viewName", "selectQuery"],
  dropView: "viewName",
  createSeriesTable: ["tableName", "start", "stop", "step"],
  virtualTableInfo: "tableName",
  dropVirtualTable: "tableName",
  createRtreeTable: "tableName",
  createCsvTable: ["tableName", "filePath"],
  analyzeCsvSchema: "filePath",

  // Introspection
  cascadeSimulator: "table",
  constraintAnalysis: "table",
  migrationRisks: "statements",

  // Migration
  migrationRollback: "id",
};

// =============================================================================
// Tool Name → Method Name Conversion
// =============================================================================

/**
 * Map group name to the prefix used in tool names.
 * Some groups use different prefixes.
 */
export const GROUP_PREFIX_MAP: Record<string, string> = {
  // Most groups: use group name as prefix after "sqlite_"
  // Example: sqlite_json_extract → group=json, prefix="json_"
  // Exceptions handled here:
  stats: "stats_",
  vector: "vector_",
  geo: "geo_",
  admin: "", // Admin tools have varied prefixes — handled case-by-case
  introspection: "", // Introspection tools have varied prefixes
  migration: "migration_", // sqlite_migration_* → migration*
  codemode: "execute_",
};

/**
 * Groups where the prefix should be kept in the method name
 * (because it's semantically part of the method identity)
 */
export const KEEP_PREFIX_GROUPS = new Set(["stats", "admin", "migration"]);
