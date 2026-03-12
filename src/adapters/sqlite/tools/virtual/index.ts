/**
 * SQLite Virtual Table Tools â€” Barrel Index
 */

import type { SqliteAdapter } from "../../sqlite-adapter.js";
import type { ToolDefinition } from "../../../../types/index.js";
import {
  createGenerateSeriesTool,
  createCreateViewTool,
  createListViewsTool,
  createDropViewTool,
} from "./views.js";
import {
  createDbStatTool,
  createVacuumTool,
} from "./analysis.js";
import {
  createListVirtualTablesTool,
  createVirtualTableInfoTool,
  createDropVirtualTableTool,
  createCsvTableTool,
  createAnalyzeCsvSchemaTool,
} from "./vtable/index.js";
import {
  createRtreeTableTool,
  createSeriesTableTool,
} from "./extensions.js";

/**
 * Get all virtual table tools
 */
export function getVirtualTools(adapter: SqliteAdapter): ToolDefinition[] {
  return [
    createGenerateSeriesTool(adapter),
    createCreateViewTool(adapter),
    createListViewsTool(adapter),
    createDropViewTool(adapter),
    createDbStatTool(adapter),
    createVacuumTool(adapter),
    createListVirtualTablesTool(adapter),
    createVirtualTableInfoTool(adapter),
    createDropVirtualTableTool(adapter),
    createCsvTableTool(adapter),
    createAnalyzeCsvSchemaTool(adapter),
    createRtreeTableTool(adapter),
    createSeriesTableTool(adapter),
  ];
}