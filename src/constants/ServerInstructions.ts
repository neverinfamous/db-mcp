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

## Core Tools
| Tool | Description |
|------|-------------|
| \`sqlite_read_query\` | Execute SELECT queries |
| \`sqlite_write_query\` | Execute INSERT/UPDATE/DELETE |
| \`sqlite_list_tables\` | List all tables |
| \`sqlite_describe_table\` | Get table schema |
| \`sqlite_create_table\` | Create new table |
| \`sqlite_drop_table\` | Drop (delete) a table |
| \`sqlite_get_indexes\` | List indexes |
| \`sqlite_create_index\` | Create index |

## WASM vs Native
| Feature | Native | WASM | Fallback |
|---------|--------|------|----------|
| FTS5 full-text search | ✅ | ❌ | None |
| Transactions (7 tools) | ✅ | ❌ | None |
| Window functions (6 tools) | ✅ | ❌ | None |
| SpatiaLite GIS (7 tools) | ✅ | ❌ | None |
| Backup/Restore (3 tools) | ✅ | ❌ | Graceful error |
| R-Tree spatial indexing | ✅ | ❌ | None |
| CSV virtual tables | ✅ | ❌ | None (requires absolute paths) |
| generate_series | ✅ native | ❌ | JS |
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
| \`analytics\` | 44 | 50 | Core(8) + JSON(23) + Stats(13-19) |
| \`search\` | 36 | 36 | Core(8) + Text(17) + Vector(11) |
| \`spatial\` | 23 | 30 | Core(8) + Geo(4-11) + Vector(11) |
| \`minimal\` | 8 | 8 | Core only |
| \`full\` | 102 | 122 | All tools |

**Groups**: \`core\`, \`json\`, \`text\`, \`stats\`, \`vector\`, \`admin\`, \`geo\`
**Syntax**: \`"core,json"\` (whitelist), \`"+stats"\` (add), \`"-admin"\` (remove)
*17* = 13 in WASM (4 FTS5 tools require native)
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

// Array operations
sqlite_json_array_append({ table: "docs", column: "data", path: "$.tags", value: "featured", whereClause: "id = 1" })
sqlite_json_each({ table: "docs", column: "data", path: "$.tags" }) // expand array to rows

// Aggregation and analysis
// Regular tables: use column names directly for groupByColumn
sqlite_json_group_array({ table: "events", valueColumn: "user_id", groupByColumn: "event_type" })
// JSON collections: use allowExpressions with json_extract for both value and group columns
sqlite_json_group_array({ table: "docs", valueColumn: "json_extract(data, '$.author')", groupByColumn: "json_extract(data, '$.type')", allowExpressions: true })
sqlite_analyze_json_schema({ table: "docs", column: "data" }) // infer schema types

// JSONB optimization (SQLite 3.45+)
sqlite_json_storage_info({ table: "docs", column: "data" }) // check text vs JSONB format
sqlite_jsonb_convert({ table: "docs", column: "data" }) // convert to JSONB for faster queries
// Note: sqlite_json_normalize_column converts JSONB back to text format
\`\`\`

## Vector/Semantic Search
\`\`\`javascript
sqlite_vector_store({ table: "docs", idColumn: "id", vectorColumn: "emb", id: 1, vector: [...] })
sqlite_vector_search({ table: "docs", vectorColumn: "emb", queryVector: [...], limit: 10 })
\`\`\`

## Full-Text Search (FTS5)
\`\`\`javascript
sqlite_fts_create({ table: "articles", columns: ["title", "content"] })
sqlite_fts_search({ table: "articles", query: "machine learning", limit: 10 })
\`\`\`

## Statistical Analysis
\`\`\`javascript
sqlite_stats_basic({ table: "employees", column: "salary" }) // count, sum, avg, min, max
sqlite_stats_percentile({ table: "sales", column: "revenue", percentiles: [25, 50, 75, 90] })
sqlite_stats_histogram({ table: "products", column: "price", buckets: 10 })
sqlite_stats_regression({ table: "data", xColumn: "year", yColumn: "revenue" }) // linear
sqlite_stats_regression({ table: "data", xColumn: "year", yColumn: "revenue", degree: 2 }) // quadratic
sqlite_stats_outliers({ table: "sales", column: "amount", method: "iqr" }) // or "zscore"
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
sqlite_spatialite_analyze({ analysisType: "spatial_extent", sourceTable: "places", geometryColumn: "geom" })
sqlite_spatialite_transform({ operation: "buffer", geometry1: "POINT(-73.99 40.75)", distance: 0.01 })
sqlite_spatialite_index({ tableName: "places", geometryColumn: "geom", action: "create" })
\`\`\`

## Window Functions (Native Only)
\`\`\`javascript
sqlite_window_row_number({ table: "employees", order_by: "hire_date", partition_by: "department" })
sqlite_window_rank({ table: "sales", value_column: "revenue", partition_by: "region", rank_type: "dense_rank" })
sqlite_window_running_total({ table: "transactions", value_column: "amount", order_by: "date" })
sqlite_window_moving_avg({ table: "stock_prices", value_column: "close_price", order_by: "date", window_size: 7 })
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
sqlite_fuzzy_match({ table: "products", column: "name", search: "laptp", maxDistance: 3 })
sqlite_text_validate({ table: "users", column: "email", pattern: "email" }) // email, phone, url, uuid, ipv4
sqlite_advanced_search({ table: "products", column: "name", searchTerm: "laptop", techniques: ["exact", "fuzzy", "phonetic"] })
\`\`\`

## Database Administration
\`\`\`javascript
sqlite_integrity_check({ maxErrors: 10 }) // Check for corruption
sqlite_optimize({ analyze: true, reindex: true }) // Optimize performance
sqlite_vacuum() // Reclaim space
sqlite_pragma_settings({ pragma: "journal_mode" }) // Get/set PRAGMA values
sqlite_pragma_table_info({ table: "users" }) // Get column details
sqlite_backup({ targetPath: "/path/to/backup.db" }) // Native only

// CSV Virtual Tables (Native only - requires ABSOLUTE paths)
sqlite_analyze_csv_schema({ filePath: "/absolute/path/to/data.csv" })
sqlite_create_csv_table({ tableName: "csv_data", filePath: "/absolute/path/to/data.csv" })
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
