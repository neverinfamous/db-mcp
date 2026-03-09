/**
 * Introspection Tools Index
 *
 * Aggregates and exports all introspection tool definitions.
 * 6 read-only tools for schema analysis and dependency mapping.
 */

import type { SqliteAdapter } from "../../SqliteAdapter.js";
import type { ToolDefinition } from "../../../../types/index.js";

import {
  createDependencyGraphTool,
  createTopologicalSortTool,
  createCascadeSimulatorTool,
} from "./graph.js";

import {
  createSchemaSnapshotTool,
  createConstraintAnalysisTool,
  createMigrationRisksTool,
} from "./analysis.js";

/**
 * Get all introspection tools (6 read-only tools)
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
  ];
}

export {
  createDependencyGraphTool,
  createTopologicalSortTool,
  createCascadeSimulatorTool,
  createSchemaSnapshotTool,
  createConstraintAnalysisTool,
  createMigrationRisksTool,
};
