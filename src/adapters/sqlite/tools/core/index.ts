/**
 * SQLite Core Database Tools — Public Exports
 *
 * Fundamental database operations: read, write, table management, indexes,
 * triggers, and schema alteration.
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
import {
  createUpsertTool,
  createBatchInsertTool,
  createCountTool,
  createExistsTool,
  createTruncateTool,
} from "./convenience.js";
import {
  createListTriggersTool,
  createCreateTriggerTool,
  createDropTriggerTool,
} from "./triggers.js";
import { createListConstraintsTool } from "./constraints.js";
import { createDateAddTool, createDateDiffTool } from "./datetime.js";
import { createAlterTableTool } from "./alter-table.js";

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
    createUpsertTool(adapter),
    createBatchInsertTool(adapter),
    createCountTool(adapter),
    createExistsTool(adapter),
    createTruncateTool(adapter),
    createListTriggersTool(adapter),
    createCreateTriggerTool(adapter),
    createDropTriggerTool(adapter),
    createListConstraintsTool(adapter),
    createDateAddTool(adapter),
    createDateDiffTool(adapter),
    createAlterTableTool(adapter),
  ];
}
