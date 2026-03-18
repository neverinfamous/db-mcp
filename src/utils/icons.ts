/**
 * Tool Group Icons
 *
 * Maps tool groups to Material Design Icons (MDI) hosted on jsDelivr CDN.
 * Follows the MCP 2025-11-25 icon specification.
 *
 * @see https://modelcontextprotocol.io/specification/draft
 */

import type { McpIcon, ToolGroup } from "../types/index.js";

/** jsDelivr CDN base URL for MDI SVG icons (pinned version) */
const MDI_BASE = "https://cdn.jsdelivr.net/npm/@mdi/svg@7.4.47/svg";

// =============================================================================
// Icon Definitions
// =============================================================================

/** Server icon for built-in tools (server_info, server_health, list_adapters) */
export const SERVER_ICONS: McpIcon[] = [
  {
    src: `${MDI_BASE}/server.svg`,
    mimeType: "image/svg+xml",
  },
];

/** Icon map keyed by tool group */
const TOOL_GROUP_ICONS: Record<ToolGroup, McpIcon[]> = {
  core: [{ src: `${MDI_BASE}/database.svg`, mimeType: "image/svg+xml" }],
  json: [{ src: `${MDI_BASE}/code-json.svg`, mimeType: "image/svg+xml" }],
  text: [{ src: `${MDI_BASE}/format-text.svg`, mimeType: "image/svg+xml" }],
  stats: [{ src: `${MDI_BASE}/chart-bar.svg`, mimeType: "image/svg+xml" }],
  vector: [
    { src: `${MDI_BASE}/vector-polyline.svg`, mimeType: "image/svg+xml" },
  ],
  admin: [{ src: `${MDI_BASE}/cog.svg`, mimeType: "image/svg+xml" }],
  geo: [{ src: `${MDI_BASE}/earth.svg`, mimeType: "image/svg+xml" }],
  introspection: [
    { src: `${MDI_BASE}/graph-outline.svg`, mimeType: "image/svg+xml" },
  ],
  migration: [
    { src: `${MDI_BASE}/source-branch.svg`, mimeType: "image/svg+xml" },
  ],
  codemode: [{ src: `${MDI_BASE}/code-braces.svg`, mimeType: "image/svg+xml" }],
};

// =============================================================================
// Public API
// =============================================================================

/**
 * Get the icon array for a tool group.
 *
 * @param group - Tool group identifier
 * @returns McpIcon array for the group, or undefined if unknown
 */
export function getToolGroupIcon(group: string): McpIcon[] | undefined {
  return TOOL_GROUP_ICONS[group as ToolGroup];
}
