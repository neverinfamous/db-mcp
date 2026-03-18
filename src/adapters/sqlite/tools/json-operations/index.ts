/**
 * SQLite JSON Operations â€” Barrel Index
 */

import type { SqliteAdapter } from "../../sqlite-adapter.js";
import type { ToolDefinition } from "../../../../types/index.js";
import {
  createValidateJsonTool,
  createJsonExtractTool,
  createJsonSetTool,
  createJsonRemoveTool,
  createJsonTypeTool,
  createJsonArrayLengthTool,
  createJsonArrayAppendTool,
} from "./crud.js";
import {
  createJsonKeysTool,
  createJsonEachTool,
  createJsonGroupArrayTool,
  createJsonGroupObjectTool,
} from "./query.js";
import {
  createJsonPrettyTool,
  createJsonbConvertTool,
  createJsonStorageInfoTool,
  createJsonNormalizeColumnTool,
} from "./transform.js";

/**
 * Get all JSON operation tools
 */
export function getJsonOperationTools(
  adapter: SqliteAdapter,
): ToolDefinition[] {
  return [
    createValidateJsonTool(),
    createJsonExtractTool(adapter),
    createJsonSetTool(adapter),
    createJsonRemoveTool(adapter),
    createJsonTypeTool(adapter),
    createJsonArrayLengthTool(adapter),
    createJsonArrayAppendTool(adapter),
    createJsonKeysTool(adapter),
    createJsonEachTool(adapter),
    createJsonGroupArrayTool(adapter),
    createJsonGroupObjectTool(adapter),
    createJsonPrettyTool(),
    createJsonbConvertTool(adapter),
    createJsonStorageInfoTool(adapter),
    createJsonNormalizeColumnTool(adapter),
  ];
}
