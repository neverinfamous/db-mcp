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
} from "./inference/index.js";
import {
  createDetectAnomaliesTool,
  createDetectBloatTool,
} from "./anomaly-detection.js";
import { createDetectSchemaRisksTool } from "./schema-risks.js";

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
    // Statistical inference tools
    createOutlierTool(adapter),
    createRegressionTool(adapter),
    createHypothesisTool(adapter),
    // Anomaly detection suite
    createDetectAnomaliesTool(adapter),
    createDetectBloatTool(adapter),
    createDetectSchemaRisksTool(adapter),
  ];
}
