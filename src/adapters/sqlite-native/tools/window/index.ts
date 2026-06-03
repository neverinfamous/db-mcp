import type { ToolDefinition } from "../../../../types/index.js";
import type { NativeSqliteAdapter } from "../../native-sqlite-adapter.js";
import { createRowNumberTool } from "./row-number.js";
import { createRankTool } from "./rank.js";
import { createLagLeadTool } from "./lag-lead.js";
import { createRunningTotalTool } from "./running-total.js";
import { createMovingAverageTool } from "./moving-average.js";
import { createNtileTool } from "./ntile.js";

/**
 * Get all window function tools
 */
export function getWindowTools(adapter: NativeSqliteAdapter): ToolDefinition[] {
  return [
    createRowNumberTool(adapter),
    createRankTool(adapter),
    createLagLeadTool(adapter),
    createRunningTotalTool(adapter),
    createMovingAverageTool(adapter),
    createNtileTool(adapter),
  ];
}
