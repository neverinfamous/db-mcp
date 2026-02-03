/**
 * Server instructions for db-mcp (SQLite MCP Server).
 *
 * These instructions are automatically sent to MCP clients during initialization,
 * providing guidance for AI agents on tool usage.
 *
 * Optimized for token efficiency with tiered instruction levels.
 */

import type { ToolGroup } from "../types/index.js";
import { TOOL_GROUPS, ALL_TOOL_GROUPS } from "../filtering/ToolConstants.js";

/**
 * Resource definition for instruction generation
 */
export interface ResourceDefinition {
  uri: string;
  name: string;
  description?: string;
}

/**
 * Prompt definition for instruction generation
 */
export interface PromptDefinition {
  name: string;
  description?: string;
}

/**
 * Instruction detail level for token efficiency
 * - essential: ~200 tokens - Core behaviors only (for token-constrained clients)
 * - standard: ~400 tokens - + Tool filtering and groups (default)
 * - full: ~600 tokens - + Complete tool/resource reference
 */
export type InstructionLevel = "essential" | "standard" | "full";

/**
 * Essential behavioral guidance (~200 tokens)
 * Core patterns every AI agent should follow.
 */
const ESSENTIAL_INSTRUCTIONS = `# db-mcp (SQLite MCP Server)

## Quick Access
| Purpose | Action |
|---------|--------|
| Health check | \`server_health\` tool |
| Server info | \`server_info\` tool |
| List adapters | \`list_adapters\` tool |
| Database schema | \`sqlite://schema\` resource |
| List tables | \`sqlite://tables\` resource |

## Built-in Tools (always available)
| Tool | Description |
|------|-------------|
| \`server_info\` | Get server name, version, adapters, tool filter config |
| \`server_health\` | Check adapter connections, latency, SQLite version |
| \`list_adapters\` | List registered database adapters |

## Core Tools (8)
| Tool | Description |
|------|-------------|
| \`sqlite_read_query\` | Execute SELECT queries |
| \`sqlite_write_query\` | Execute INSERT/UPDATE/DELETE |
| \`sqlite_list_tables\` | List tables with column counts (excludeSystemTables hides SpatiaLite; views via sqlite_list_views) |
| \`sqlite_describe_table\` | Get table schema |
| \`sqlite_create_table\` | Create new table |
| \`sqlite_drop_table\` | Drop (delete) a table |
| \`sqlite_get_indexes\` | List indexes (use excludeSystemIndexes to hide SpatiaLite indexes) |
| \`sqlite_create_index\` | Create index |

## WASM vs Native
| Feature | Native | WASM | Fallback |
|---------|--------|------|----------|
| FTS5 full-text search | ✅ | ❌ | None |
| Transactions (7 tools) | ✅ | ❌ | None |
| Window functions (6 tools in stats group) | ✅ | ❌ | None |
| SpatiaLite GIS (7 tools; 4 basic geo always work) | ✅ | ❌ | None |
| Backup/Restore (3 tools) | ✅ | ❌ | Graceful error |
| R-Tree spatial indexing | ✅ | ❌ | Graceful error |
| CSV virtual tables | ✅ | ❌ | Graceful error |
| generate_series | JS fallback | JS fallback | — |
| dbstat | ✅ native | ❌ | JS (basic) |
| soundex() | ✅ native | ❌ | JS |
`;

/**
 * Tool filtering instructions (~150 additional tokens)
 */
const FILTERING_INSTRUCTIONS = `
## Tool Filtering
Available presets via \`--tool-filter\`:
| Shortcut | WASM | Native | Use Case |
|----------|------|--------|----------|
| \`starter\` | 44 | 48 | ⭐ Recommended: Core(8) + JSON(23) + Text(17*) |
| \`analytics\` | 44 | 50 | Core(8) + JSON(23) + Stats(19: 13 core + 6 window) |
| \`search\` | 36 | 36 | Core(8) + Text(17) + Vector(11) |
| \`spatial\` | 23 | 30 | Core(8) + Geo(4-11) + Vector(11) |
| \`minimal\` | 8 | 8 | Core only |
| \`full\` | 102 | 122 | All tools |

*+3 built-in tools (\`server_info\`, \`server_health\`, \`list_adapters\`) always included*

**Groups**: \`core\`, \`json\`, \`text\`, \`stats\`, \`vector\`, \`admin\`, \`geo\`
**Syntax**: \`"core,json"\` (whitelist), \`"+stats"\` (add), \`"-admin"\` (remove)
*Text group: 17 native, 13 in WASM (4 FTS5 tools require native)*
`;

/**
 * Tool reference - comprehensive usage examples
 */
const TOOL_REFERENCE = `
## JSON Operations
\`\`\`javascript
// Create optimized JSON collection with indexes
sqlite_create_json_collection({ tableName: "docs", indexes: [{ path: "$.type" }, { path: "$.author" }] })

// Insert and query JSON documents
sqlite_json_insert({ table: "docs", column: "data", data: { type: "article", title: "Hello", tags: ["news"] } })
sqlite_json_query({ table: "docs", column: "data", filterPaths: { "$.type": "article" }, selectPaths: ["$.title"] })

// Path operations (extract, set, merge, remove)
sqlite_json_extract({ table: "docs", column: "data", path: "$.title" })
sqlite_json_set({ table: "docs", column: "data", path: "$.views", value: 100, whereClause: "id = 1" })
sqlite_json_merge({ table: "docs", column: "data", mergeData: { featured: true }, whereClause: "id = 1" })

// Array operations (Note: json_each multiplies output rows—use limit param for large arrays)
sqlite_json_array_append({ table: "docs", column: "data", path: "$.tags", value: "featured", whereClause: "id = 1" })
sqlite_json_each({ table: "docs", column: "data", path: "$.tags", limit: 50 }) // expand array to rows

// Aggregation and analysis
// Regular tables: use column names directly for groupByColumn
sqlite_json_group_array({ table: "events", valueColumn: "user_id", groupByColumn: "event_type" })
// JSON collections: use allowExpressions with json_extract for both value and group columns
// Note: allowExpressions is for column extraction ONLY, NOT aggregate functions
// Note: Without groupByColumn, each row creates a key-value pair; duplicate keys result if key values aren't unique
sqlite_json_group_array({ table: "docs", valueColumn: "json_extract(data, '$.author')", groupByColumn: "json_extract(data, '$.type')", allowExpressions: true })
// For aggregate values (COUNT, SUM, AVG), use aggregateFunction parameter instead
sqlite_json_group_object({ table: "events", keyColumn: "event_type", aggregateFunction: "COUNT(*)" })
sqlite_json_group_object({ table: "orders", keyColumn: "status", aggregateFunction: "SUM(total)" })
sqlite_analyze_json_schema({ table: "docs", column: "data" }) // infer schema types

// JSONB optimization (SQLite 3.45+)
sqlite_json_storage_info({ table: "docs", column: "data" }) // check text vs JSONB format
sqlite_jsonb_convert({ table: "docs", column: "data" }) // convert to JSONB for faster queries
// Note: sqlite_json_normalize_column defaults to 'preserve' (maintains original format); use outputFormat: 'text' to force text
\`\`\`

## Vector/Semantic Search
\`\`\`javascript
// Create vector table with metadata columns
sqlite_vector_create_table({ tableName: "docs", dimensions: 384, additionalColumns: [{ name: "content", type: "TEXT" }] })

// Store vectors (single and batch)
sqlite_vector_store({ table: "docs", idColumn: "id", vectorColumn: "emb", id: 1, vector: [...] })
sqlite_vector_batch_store({ table: "docs", idColumn: "id", vectorColumn: "emb", items: [{ id: 1, vector: [...] }, { id: 2, vector: [...] }] })

// Search vectors (returnColumns omits vector data from results for smaller payloads)
sqlite_vector_search({ table: "docs", vectorColumn: "emb", queryVector: [...], limit: 10, returnColumns: ["id", "title"] })

// Retrieve and delete vectors
// Note: sqlite_vector_get returns parsed 'vector' array + raw JSON string in 'metadata' for flexibility
sqlite_vector_get({ table: "docs", idColumn: "id", vectorColumn: "emb", id: 1 })
sqlite_vector_delete({ table: "docs", idColumn: "id", ids: [1, 2, 3] })

// Vector metadata
sqlite_vector_count({ table: "docs" }) // or with dimensions filter: { table: "docs", dimensions: 384 }
sqlite_vector_dimensions({ table: "docs", vectorColumn: "emb" })
sqlite_vector_stats({ table: "docs", vectorColumn: "emb" }) // magnitude min/max/avg

// Utility tools for preprocessing
sqlite_vector_normalize({ vector: [3, 4, 0, 0] }) // returns unit vector [0.6, 0.8, 0, 0]
sqlite_vector_distance({ vector1: [...], vector2: [...], metric: "cosine" }) // or "euclidean", "dot"
\`\`\`

## Full-Text Search (FTS5)
\`\`\`javascript
// Create FTS5 table with triggers for auto-sync on future changes
sqlite_fts_create({ tableName: "articles_fts", sourceTable: "articles", columns: ["title", "content"] })
sqlite_fts_rebuild({ table: "articles_fts" })  // Required: populate index with existing data
// FTS5 uses AND by default: "machine learning" = rows containing BOTH words
// Use OR explicitly: "machine OR learning" for rows containing EITHER word
sqlite_fts_search({ table: "articles_fts", query: "machine learning", limit: 10 })
// Note: FTS5 virtual tables (*_fts) and shadow tables (*_fts_*) are hidden from sqlite_list_tables for cleaner output
\`\`\`

## Statistical Analysis
\`\`\`javascript
sqlite_stats_basic({ table: "employees", column: "salary" }) // count, sum, avg, min, max
sqlite_stats_percentile({ table: "sales", column: "revenue", percentiles: [25, 50, 75, 90] })
sqlite_stats_histogram({ table: "products", column: "price", buckets: 10 })
sqlite_stats_regression({ table: "data", xColumn: "year", yColumn: "revenue" }) // linear
sqlite_stats_regression({ table: "data", xColumn: "year", yColumn: "revenue", degree: 2 }) // quadratic
sqlite_stats_outliers({ table: "sales", column: "amount", method: "iqr" }) // or "zscore"
// ⚠️ Always use selectColumns to avoid returning all columns (large payloads with text fields)
sqlite_stats_top_n({ table: "products", column: "price", n: 10, selectColumns: ["id", "name", "price"] })
sqlite_stats_hypothesis({ table: "samples", column: "value", testType: "ttest_one", expectedMean: 100 })
\`\`\`

## Geospatial Operations
\`\`\`javascript
// Basic geo (always available - Haversine formula)
sqlite_geo_distance({ lat1: 40.7128, lon1: -74.006, lat2: 34.0522, lon2: -118.2437 }) // km
sqlite_geo_bounding_box({ table: "stores", latColumn: "lat", lonColumn: "lon", minLat: 40, maxLat: 41, minLon: -75, maxLon: -73 })
sqlite_geo_nearby({ table: "stores", latColumn: "lat", lonColumn: "lon", centerLat: 40.7, centerLon: -74, radius: 10, unit: "km" })
sqlite_geo_cluster({ table: "customers", latColumn: "lat", lonColumn: "lon", gridSize: 0.1 })
\`\`\`

## SpatiaLite (Advanced GIS)
\`\`\`javascript
// Create spatial table with geometry column
sqlite_spatialite_create_table({ tableName: "places", geometryColumn: "geom", geometryType: "POINT", srid: 4326 })

// Import data (WKT or GeoJSON)
sqlite_spatialite_import({ tableName: "places", format: "wkt", data: "POINT(-73.99 40.75)", additionalData: { name: "NYC" } })
sqlite_spatialite_import({ tableName: "places", format: "geojson", data: '{"type":"Point","coordinates":[-73.99,40.75]}' })

// Spatial queries and analysis
sqlite_spatialite_query({ query: "SELECT name, AsText(geom) FROM places WHERE ST_Within(geom, ...)" })
// analysisType: "spatial_extent" | "point_in_polygon" | "nearest_neighbor" | "distance_matrix"
// Note: nearest_neighbor/distance_matrix return CARTESIAN distance (degrees), not geodetic (km/miles)
// For same source/target table, use excludeSelf: true to avoid self-matches
sqlite_spatialite_analyze({ analysisType: "spatial_extent", sourceTable: "places", geometryColumn: "geom" })
sqlite_spatialite_analyze({ analysisType: "nearest_neighbor", sourceTable: "pts", targetTable: "pts", excludeSelf: true })
// transform: buffer uses 'distance' param for radius; simplify uses 'distance' as tolerance (0.0001 for lat/lon)
// Buffer now auto-simplifies output by default (tolerance=0.0001). Use simplifyTolerance: 0 to disable.
sqlite_spatialite_transform({ operation: "buffer", geometry1: "POINT(-73.99 40.75)", distance: 0.01 })
sqlite_spatialite_transform({ operation: "simplify", geometry1: "...", distance: 0.001 })
sqlite_spatialite_index({ tableName: "places", geometryColumn: "geom", action: "create" })
\`\`\`

## Window Functions (Native Only)
\`\`\`javascript
sqlite_window_row_number({ table: "employees", orderBy: "hire_date", partitionBy: "department" })
sqlite_window_rank({ table: "sales", orderBy: "revenue DESC", partitionBy: "region", rankType: "dense_rank" })
sqlite_window_running_total({ table: "transactions", valueColumn: "amount", orderBy: "date" })
sqlite_window_moving_avg({ table: "stock_prices", valueColumn: "close_price", orderBy: "date", windowSize: 7 })
\`\`\`

## Transactions (Native Only)
\`\`\`javascript
sqlite_transaction_execute({ statements: ["UPDATE a SET x=1", "UPDATE b SET y=2"] }) // atomic
sqlite_transaction_begin({ mode: "immediate" })
sqlite_transaction_savepoint({ name: "checkpoint" })
sqlite_transaction_rollback_to({ name: "checkpoint" })
sqlite_transaction_commit()
\`\`\`

## Text Processing
\`\`\`javascript
// Regex patterns: Double-escape backslashes (\\\\) when passing through JSON/MCP
sqlite_regex_match({ table: "logs", column: "message", pattern: "ERROR:\\\\s+(\\\\w+)" })
sqlite_regex_extract({ table: "users", column: "email", pattern: "@([a-zA-Z0-9.-]+)", groupIndex: 1 })

// Text manipulation
sqlite_text_split({ table: "users", column: "email", delimiter: "@" }) // Split into parts array
sqlite_text_concat({ table: "users", columns: ["first_name", "last_name"], separator: " " })
sqlite_text_normalize({ table: "docs", column: "content", mode: "strip_accents" }) // or nfc, nfd, nfkc, nfkd

// Validation patterns: email, phone, url, uuid, ipv4, custom
sqlite_text_validate({ table: "users", column: "email", pattern: "email" })
sqlite_text_validate({ table: "data", column: "field", pattern: "custom", customPattern: "^[A-Z]{2}[0-9]{4}$" })

// Fuzzy matching - matches against WORD TOKENS by default (not entire value)
// "laptop" now matches "Laptop Pro 15" (distance 0 on first token). Use tokenize:false for legacy behavior.
sqlite_fuzzy_match({ table: "products", column: "name", search: "laptp", maxDistance: 2 })

// Phonetic matching - finds words that sound alike (matches FIRST word only)
// Soundex compares only the first word: "laptop" matches "Laptop Pro 15", but "pro" won't
sqlite_phonetic_match({ table: "products", column: "name", search: "laptop", algorithm: "soundex" })

// Advanced search - combines exact, fuzzy, and phonetic techniques
// fuzzyThreshold: 0.3-0.4 = loose matching (more results), 0.6-0.8 = strict matching (fewer results)
sqlite_advanced_search({ table: "products", column: "name", searchTerm: "laptop", techniques: ["exact", "fuzzy", "phonetic"], fuzzyThreshold: 0.4 })
\`\`\`

## Database Administration
\`\`\`javascript
// Database maintenance
sqlite_integrity_check({ maxErrors: 10 }) // Check for corruption
sqlite_optimize({ analyze: true, reindex: true }) // Optimize performance
sqlite_vacuum() // Reclaim space
sqlite_analyze({ table: "orders" }) // Update statistics for query planner
sqlite_dbstat({ summarize: true }) // Storage statistics (JS fallback in WASM)

// Backup and restore (Native only)
sqlite_backup({ targetPath: "/path/to/backup.db" })
sqlite_verify_backup({ backupPath: "/path/to/backup.db" }) // Check integrity without restoring
sqlite_restore({ sourcePath: "/path/to/backup.db" }) // WARNING: Replaces current database

// PRAGMA utilities
sqlite_pragma_settings({ pragma: "journal_mode" }) // Get value
sqlite_pragma_settings({ pragma: "cache_size", value: 10000 }) // Set value
sqlite_pragma_table_info({ table: "users" }) // Column details
sqlite_pragma_compile_options({ filter: "FTS" }) // Filter compile options
sqlite_pragma_database_list() // List attached databases
sqlite_pragma_optimize() // Run PRAGMA optimize

// Index statistics
sqlite_index_stats({ table: "orders" }) // Stats for explicit indexes

// Views (SELECT-based virtual tables)
sqlite_create_view({ viewName: "active_orders", selectQuery: "SELECT * FROM orders WHERE status = 'active'" })
sqlite_create_view({ viewName: "v", selectQuery: "...", replace: true }) // CREATE OR REPLACE
sqlite_list_views() // List all views
sqlite_drop_view({ viewName: "active_orders" })

// Virtual tables
sqlite_list_virtual_tables() // List FTS5, R-Tree, CSV tables
sqlite_virtual_table_info({ tableName: "articles_fts" }) // Module and column info
sqlite_drop_virtual_table({ tableName: "old_fts", ifExists: true })

// Generate series (JS fallback in WASM)
sqlite_generate_series({ start: 1, stop: 100, step: 5 }) // Returns array of values
sqlite_create_series_table({ tableName: "numbers", start: 1, stop: 1000 }) // Persistent table

// R-Tree spatial indexing (Native only)
sqlite_create_rtree_table({ tableName: "locations_idx", dimensions: 2 }) // 2D: minX, maxX, minY, maxY

// CSV Virtual Tables (Native only - not available in WASM; requires ABSOLUTE paths)
sqlite_analyze_csv_schema({ filePath: "/absolute/path/to/data.csv" })
sqlite_create_csv_table({ tableName: "csv_data", filePath: "/absolute/path/to/data.csv" })

// Business insights capture
sqlite_append_insight({ insight: "Q4 revenue increased 23% YoY" }) // Add to memo://insights
\`\`\`
`;

/**
 * Generate dynamic instructions based on enabled tools, resources, and prompts
 *
 * @param enabledTools - Set of enabled tool names
 * @param resources - Available resource definitions
 * @param prompts - Available prompt definitions
 * @param level - Instruction detail level (default: 'standard')
 */
export function generateInstructions(
  enabledTools: Set<string>,
  _resources: ResourceDefinition[],
  prompts: PromptDefinition[],
  level: InstructionLevel = "standard",
): string {
  let instructions = ESSENTIAL_INSTRUCTIONS;

  // Standard and full levels include filtering patterns
  if (level === "standard" || level === "full") {
    instructions += FILTERING_INSTRUCTIONS;
  }

  // Full level includes complete tool reference
  if (level === "full") {
    instructions += TOOL_REFERENCE;

    // Add active tools summary
    const activeGroups = getActiveToolGroups(enabledTools);
    if (activeGroups.length > 0) {
      instructions += `\n## Active Tools (${String(enabledTools.size)})\n`;
      for (const { group, tools } of activeGroups) {
        instructions += `**${group}**: ${tools.map((t) => `\`${t}\``).join(", ")}\n`;
      }
    }

    // Add prompts section
    if (prompts.length > 0) {
      instructions += `\n## Prompts (${String(prompts.length)})\n`;
      instructions += "Pre-built templates and guided workflows:\n";
      for (const prompt of prompts) {
        instructions += `- \`${prompt.name}\` - ${prompt.description ?? ""}\n`;
      }
    }
  }

  return instructions;
}

/**
 * Get active tool groups with their enabled tools
 */
function getActiveToolGroups(
  enabledTools: Set<string>,
): { group: ToolGroup; tools: string[] }[] {
  const activeGroups: { group: ToolGroup; tools: string[] }[] = [];

  for (const group of ALL_TOOL_GROUPS) {
    const allTools = TOOL_GROUPS[group];
    const enabledInGroup = allTools.filter((tool) => enabledTools.has(tool));
    if (enabledInGroup.length > 0) {
      activeGroups.push({ group, tools: enabledInGroup });
    }
  }

  return activeGroups;
}

/**
 * Static instructions for backward compatibility
 * @deprecated Use generateInstructions() instead for dynamic content
 */
export const SERVER_INSTRUCTIONS =
  ESSENTIAL_INSTRUCTIONS + FILTERING_INSTRUCTIONS;
