/**
 * SpatiaLite Geospatial Tools — Public Exports
 *
 * Provides true GIS capabilities via SpatiaLite extension.
 * These tools gracefully fail if SpatiaLite is not installed.
 * 7 tools total (Native-only).
 */

import type { ToolDefinition } from "../../../../types/index.js";
import type { NativeSqliteAdapter } from "../../NativeSqliteAdapter.js";
import {
  createLoadSpatialiteTool,
  createSpatialTableTool,
  createSpatialQueryTool,
  createSpatialAnalysisTool,
  createSpatialIndexTool,
  createGeometryTransformTool,
  createSpatialImportTool,
} from "./tools.js";

export { isSpatialiteLoaded } from "./loader.js";

/**
 * Get all SpatiaLite tools
 */
export function getSpatialiteTools(
  adapter: NativeSqliteAdapter,
): ToolDefinition[] {
  return [
    createLoadSpatialiteTool(adapter),
    createSpatialTableTool(adapter),
    createSpatialQueryTool(adapter),
    createSpatialAnalysisTool(adapter),
    createSpatialIndexTool(adapter),
    createGeometryTransformTool(adapter),
    createSpatialImportTool(adapter),
  ];
}
