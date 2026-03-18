/**
 * SQLite Core Database Tools — Public Exports
 *
 * Fundamental database operations: read, write, table management, indexes.
 * 9 tools total with OAuth scope enforcement.
 */

import type { SqliteAdapter } from "../../sqlite-adapter.js";
import type { ToolDefinition } from "../../../../types/index.js";
import { createReadQueryTool, createWriteQueryTool } from "./queries.js";
import {
  createCreateTableTool,
  createListTablesTool,
  createDescribeTableTool,
  createDropTableTool,
} from "./tables.js";
import {
  createGetIndexesTool,
  createCreateIndexTool,
  createDropIndexTool,
} from "./indexes.js";

// Re-export SpatiaLite system filters for external use
export {
  isSpatialiteSystemTable,
  isSpatialiteSystemIndex,
  isSpatialiteSystemView,
} from "./tables.js";

/**
 * Get all core database tools
 */
export function getCoreTools(adapter: SqliteAdapter): ToolDefinition[] {
  return [
    createReadQueryTool(adapter),
    createWriteQueryTool(adapter),
    createCreateTableTool(adapter),
    createListTablesTool(adapter),
    createDescribeTableTool(adapter),
    createDropTableTool(adapter),
    createGetIndexesTool(adapter),
    createCreateIndexTool(adapter),
    createDropIndexTool(adapter),
  ];
}
