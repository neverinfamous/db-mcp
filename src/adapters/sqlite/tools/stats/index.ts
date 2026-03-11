/**
 * SQLite Statistics Tools — Barrel Index
 *
 * Re-exports all statistics tool creators and the main entry point.
 */

import type { SqliteAdapter } from "../../sqlite-adapter.js";
import type { ToolDefinition } from "../../../../types/index.js";
import {
  createBasicStatsTool,
  createCountTool,
  createGroupByStatsTool,
  createHistogramTool,
  createPercentileTool,
} from "./basic.js";
import {
  createCorrelationTool,
  createTopNTool,
  createDistinctValuesTool,
  createSummaryStatsTool,
  createFrequencyTool,
} from "./advanced.js";
import {
  createOutlierTool,
  createRegressionTool,
  createHypothesisTool,
} from "./inference.js";

/**
 * Get all statistics tools
 */
export function getStatsTools(adapter: SqliteAdapter): ToolDefinition[] {
  return [
    createBasicStatsTool(adapter),
    createCountTool(adapter),
    createGroupByStatsTool(adapter),
    createHistogramTool(adapter),
    createPercentileTool(adapter),
    createCorrelationTool(adapter),
    createTopNTool(adapter),
    createDistinctValuesTool(adapter),
    createSummaryStatsTool(adapter),
    createFrequencyTool(adapter),
    // New statistical tools
    createOutlierTool(adapter),
    createRegressionTool(adapter),
    createHypothesisTool(adapter),
  ];
}
