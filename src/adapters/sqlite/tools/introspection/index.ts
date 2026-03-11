/**
 * Introspection Tools Index
 *
 * Aggregates and exports all introspection tool definitions.
 * 9 read-only tools for schema analysis, dependency mapping, and diagnostics.
 */

import type { SqliteAdapter } from "../../sqlite-adapter.js";
import type { ToolDefinition } from "../../../../types/index.js";

import {
  createDependencyGraphTool,
  createTopologicalSortTool,
  createCascadeSimulatorTool,
} from "./graph/index.js";

import {
  createSchemaSnapshotTool,
  createConstraintAnalysisTool,
  createMigrationRisksTool,
} from "./analysis/index.js";

import {
  createStorageAnalysisTool,
  createIndexAuditTool,
  createQueryPlanTool,
} from "./diagnostics/index.js";

/**
 * Get all introspection tools (9 read-only tools)
 */
export function getIntrospectionTools(
  adapter: SqliteAdapter,
): ToolDefinition[] {
  return [
    createDependencyGraphTool(adapter),
    createTopologicalSortTool(adapter),
    createCascadeSimulatorTool(adapter),
    createSchemaSnapshotTool(adapter),
    createConstraintAnalysisTool(adapter),
    createMigrationRisksTool(adapter),
    createStorageAnalysisTool(adapter),
    createIndexAuditTool(adapter),
    createQueryPlanTool(adapter),
  ];
}

export {
  createDependencyGraphTool,
  createTopologicalSortTool,
  createCascadeSimulatorTool,
  createSchemaSnapshotTool,
  createConstraintAnalysisTool,
  createMigrationRisksTool,
  createStorageAnalysisTool,
  createIndexAuditTool,
  createQueryPlanTool,
};
