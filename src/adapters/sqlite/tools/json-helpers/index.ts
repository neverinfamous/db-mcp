/**
 * SQLite JSON Helper Tools — Barrel Re-export
 *
 * High-level JSON operations for common patterns:
 * insert, update, select, query, validate path, merge, analyze schema, create collection.
 * 8 tools total.
 */

import type { SqliteAdapter } from "../../sqlite-adapter.js";
import type { ToolDefinition } from "../../../../types/index.js";
import {
  createJsonSelectTool,
  createJsonQueryTool,
  createJsonValidatePathTool,
  createAnalyzeJsonSchemaTool,
} from "./read.js";
import {
  createJsonInsertTool,
  createJsonUpdateTool,
  createJsonMergeTool,
  createJsonCollectionTool,
} from "./write.js";

/**
 * Get all JSON helper tools
 */
export function getJsonHelperTools(adapter: SqliteAdapter): ToolDefinition[] {
  return [
    createJsonInsertTool(adapter),
    createJsonUpdateTool(adapter),
    createJsonSelectTool(adapter),
    createJsonQueryTool(adapter),
    createJsonValidatePathTool(),
    createJsonMergeTool(adapter),
    createAnalyzeJsonSchemaTool(adapter),
    createJsonCollectionTool(adapter),
  ];
}

// Re-export individual creators for direct access
export {
  createJsonSelectTool,
  createJsonQueryTool,
  createJsonValidatePathTool,
  createAnalyzeJsonSchemaTool,
} from "./read.js";

export {
  createJsonInsertTool,
  createJsonUpdateTool,
  createJsonMergeTool,
  createJsonCollectionTool,
} from "./write.js";

export {
  extractColumnNameFromPath,
  getUniqueColumnNames,
} from "./helpers.js";
