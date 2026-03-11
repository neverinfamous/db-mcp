/**
 * SQLite Vector Search Tools — Public Exports
 *
 * Vector similarity search and embedding operations.
 * Uses JSON arrays for vector storage (no external extensions needed).
 * 11 tools total.
 */

import type { SqliteAdapter } from "../../sqlite-adapter.js";
import type { ToolDefinition } from "../../../../types/index.js";
import {
  createVectorCreateTableTool,
  createVectorStoreTool,
  createVectorBatchStoreTool,
  createVectorSearchTool,
  createVectorGetTool,
  createVectorDeleteTool,
  createVectorCountTool,
  createVectorStatsTool,
  createVectorDimensionsTool,
  createVectorNormalizeTool,
  createVectorDistanceTool,
} from "./tools.js";

/**
 * Get all vector tools
 */
export function getVectorTools(adapter: SqliteAdapter): ToolDefinition[] {
  return [
    createVectorCreateTableTool(adapter),
    createVectorStoreTool(adapter),
    createVectorBatchStoreTool(adapter),
    createVectorSearchTool(adapter),
    createVectorGetTool(adapter),
    createVectorDeleteTool(adapter),
    createVectorCountTool(adapter),
    createVectorStatsTool(adapter),
    createVectorDimensionsTool(adapter),
    createVectorNormalizeTool(),
    createVectorDistanceTool(),
  ];
}
