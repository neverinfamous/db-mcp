/**
 * Tool Registration for Native SQLite Adapter
 *
 * Extracts the lengthy tool registration array from the main adapter class.
 */

import type { ToolDefinition } from "../../../types/index.js";
import type { NativeSqliteAdapter } from "../native-sqlite-adapter.js";
import type { SqliteAdapter } from "../../sqlite/sqlite-adapter.js";
import { getToolGroupIcon } from "../../../utils/icons.js";

// Import shared tools from sql.js adapter
import { getCoreTools } from "../../sqlite/tools/core/index.js";
import { getJsonOperationTools } from "../../sqlite/tools/json-operations/index.js";
import { getJsonHelperTools } from "../../sqlite/tools/json-helpers/index.js";
import { getTextTools } from "../../sqlite/tools/text/index.js";
import { getFtsTools } from "../../sqlite/tools/fts.js";
import { getStatsTools } from "../../sqlite/tools/stats/index.js";
import { getVirtualTools } from "../../sqlite/tools/virtual/index.js";
import { getVectorTools } from "../../sqlite/tools/vector/index.js";
import { getGeoTools } from "../../sqlite/tools/geo.js";
import { getAdminTools } from "../../sqlite/tools/admin/index.js";
import { getIntrospectionTools } from "../../sqlite/tools/introspection/index.js";
import { getMigrationTools } from "../../sqlite/tools/migration/index.js";
import { getCodeModeTools } from "../../sqlite/tools/codemode.js";

// Import native-specific tools
import { getTransactionTools } from "../tools/transactions.js";
import { getWindowTools } from "../tools/window.js";
import { getSpatialiteTools } from "../tools/spatialite/index.js";

/**
 * Build the full list of tool definitions for the native adapter.
 */
export function getNativeToolDefinitions(
  adapter: NativeSqliteAdapter,
): ToolDefinition[] {
  // Cast to SqliteAdapter format for shared tools
  const sharedAdapter = adapter as unknown as SqliteAdapter;

  const tools = [
    ...getCoreTools(sharedAdapter),
    ...getJsonOperationTools(sharedAdapter),
    ...getJsonHelperTools(sharedAdapter),
    ...getTextTools(sharedAdapter),
    ...getFtsTools(sharedAdapter),
    ...getStatsTools(sharedAdapter),
    ...getVirtualTools(sharedAdapter),
    ...getVectorTools(sharedAdapter),
    ...getGeoTools(sharedAdapter),
    ...getAdminTools(sharedAdapter),
    ...getIntrospectionTools(sharedAdapter),
    ...getMigrationTools(sharedAdapter),
    ...getCodeModeTools(sharedAdapter),

    // Native-only tools
    ...getTransactionTools(adapter),
    ...getWindowTools(adapter),
    ...getSpatialiteTools(adapter),
  ];

  // Attach group-level icons to each tool definition
  for (const tool of tools) {
    if (!tool.icons) {
      const icons = getToolGroupIcon(tool.group);
      if (icons) {
        tool.icons = icons;
      }
    }
  }

  return tools;
}
