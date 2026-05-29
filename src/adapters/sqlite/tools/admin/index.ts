/**
 * SQLite Admin Tools — Barrel Index
 */

import type { SqliteAdapter } from "../../sqlite-adapter.js";
import type { ToolDefinition } from "../../../../types/index.js";
import {
  createBackupTool,
  createAnalyzeTool,
  createIntegrityCheckTool,
  createOptimizeTool,
  createRestoreTool,
  createVacuumIntoTool,
  createDumpTool,
} from "./backup/index.js";
import { createVerifyBackupTool, createIndexStatsTool } from "./verify.js";
import {
  createPragmaCompileOptionsTool,
  createPragmaDatabaseListTool,
  createPragmaOptimizeTool,
  createPragmaSettingsTool,
  createPragmaTableInfoTool,
  createAppendInsightTool,
  createAttachDatabaseTool,
  createDetachDatabaseTool,
} from "./pragma.js";
import { createReindexTool } from "./reindex.js";
import { createWalTool } from "./wal.js";

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
    createAttachDatabaseTool(adapter),
    createDetachDatabaseTool(adapter),
    createVacuumIntoTool(adapter),
    createDumpTool(adapter),
    createReindexTool(adapter),
    createWalTool(adapter),
  ];
}
