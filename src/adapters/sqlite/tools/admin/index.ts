/**
 * SQLite Admin Tools â€” Barrel Index
 */

import type { SqliteAdapter } from "../../sqlite-adapter.js";
import type { ToolDefinition } from "../../../../types/index.js";
import {
  createBackupTool,
  createAnalyzeTool,
  createIntegrityCheckTool,
  createOptimizeTool,
  createRestoreTool,
} from "./backup/index.js";
import { createVerifyBackupTool, createIndexStatsTool } from "./verify.js";
import {
  createPragmaCompileOptionsTool,
  createPragmaDatabaseListTool,
  createPragmaOptimizeTool,
  createPragmaSettingsTool,
  createPragmaTableInfoTool,
  createAppendInsightTool,
} from "./pragma.js";

/**
 * Get all admin tools
 */
export function getAdminTools(adapter: SqliteAdapter): ToolDefinition[] {
  return [
    createBackupTool(adapter),
    createAnalyzeTool(adapter),
    createIntegrityCheckTool(adapter),
    createOptimizeTool(adapter),
    createRestoreTool(adapter),
    createVerifyBackupTool(adapter),
    createIndexStatsTool(adapter),
    createPragmaCompileOptionsTool(adapter),
    createPragmaDatabaseListTool(adapter),
    createPragmaOptimizeTool(adapter),
    createPragmaSettingsTool(adapter),
    createPragmaTableInfoTool(adapter),
    createAppendInsightTool(),
  ];
}
