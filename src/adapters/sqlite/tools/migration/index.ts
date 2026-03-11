/**
 * Migration Tools Index
 *
 * Aggregates and exports all migration tool definitions.
 * 6 opt-in write tools for schema migration tracking.
 */

import type { SqliteAdapter } from "../../sqlite-adapter.js";
import type { ToolDefinition } from "../../../../types/index.js";

import {
  createMigrationInitTool,
  createMigrationRecordTool,
  createMigrationApplyTool,
  createMigrationRollbackTool,
  createMigrationHistoryTool,
  createMigrationStatusTool,
} from "./tracking.js";

/**
 * Get all migration tools (6 opt-in tools)
 */
export function getMigrationTools(adapter: SqliteAdapter): ToolDefinition[] {
  return [
    createMigrationInitTool(adapter),
    createMigrationRecordTool(adapter),
    createMigrationApplyTool(adapter),
    createMigrationRollbackTool(adapter),
    createMigrationHistoryTool(adapter),
    createMigrationStatusTool(adapter),
  ];
}

export {
  createMigrationInitTool,
  createMigrationRecordTool,
  createMigrationApplyTool,
  createMigrationRollbackTool,
  createMigrationHistoryTool,
  createMigrationStatusTool,
};
