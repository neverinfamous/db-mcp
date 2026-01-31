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
| \`sqlite_create_index\` | Create index |
`;

/**
 * Tool filtering instructions (~150 additional tokens)
 */
const FILTERING_INSTRUCTIONS = `
## Tool Filtering
Available presets via \`--tool-filter\`:
| Shortcut | Tools | Use Case |
|----------|-------|----------|
| \`starter\` | 38 | ⭐ Recommended: Core + JSON + Text |
| \`analytics\` | 42 | Core + JSON + Stats |
| \`search\` | 31 | Core + Text + Vector |
| \`minimal\` | 8 | Core only |
| \`full\` | 86 | All tools |

**Groups**: \`core\`, \`json\`, \`text\`, \`stats\`, \`vector\`, \`admin\`
**Syntax**: \`"core,json"\` (whitelist), \`"+stats"\` (add), \`"-admin"\` (remove)
`;

/**
 * Tool reference - comprehensive usage examples
 */
const TOOL_REFERENCE = `
## JSON Operations
\`\`\`javascript
sqlite_write_query({ query: "INSERT INTO t (data) VALUES (?)", params: [JSON.stringify({a:1})] })
sqlite_json_extract({ table: "t", column: "data", path: "$.a" })
\`\`\`

## Vector/Semantic Search
\`\`\`javascript
sqlite_vector_store({ table: "docs", id_column: "id", embedding_column: "emb", id: 1, embedding: [...] })
sqlite_vector_search({ table: "docs", embedding_column: "emb", query_embedding: [...], top_k: 10 })
\`\`\`

## Full-Text Search (FTS5)
\`\`\`javascript
sqlite_fts_create({ table: "articles", columns: ["title", "content"] })
sqlite_fts_search({ table: "articles", query: "machine learning", limit: 10 })
\`\`\`

## Statistical Analysis
\`\`\`javascript
sqlite_describe_stats({ table: "employees", column: "salary" }) // count, mean, std, percentiles
sqlite_percentile({ table: "sales", column: "revenue", percentiles: [25, 50, 75, 90] })
sqlite_histogram({ table: "products", column: "price", bins: 10 })
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
sqlite_regex_match({ table: "logs", column: "message", pattern: "ERROR:\\\\s+(\\\\w+)" })
sqlite_fuzzy_search({ table: "products", column: "name", query: "laptp", threshold: 0.6 })
sqlite_text_similarity({ text1: "machine learning", text2: "deep learning", algorithm: "levenshtein" })
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
