import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToolFilterConfig, ToolGroup } from "../../types/index.js";
import { HELP_CONTENT } from "../../constants/server-instructions.js";
import { logger } from "../../utils/logger/index.js";
import { ASSISTANT_FOCUSED } from "../../utils/resource-annotations.js";
import { metrics } from "../../observability/metrics.js";

/**
 * Register sqlite://help resources for on-demand reference documentation.
 */
export function registerHelpResources(
  server: McpServer,
  toolFilter: ToolFilterConfig,
): void {
  // Always register sqlite://help (gotchas + code mode + WASM vs native)
  const gotchasContent = HELP_CONTENT.get("gotchas");
  if (gotchasContent) {
    server.registerResource(
      "sqlite_help",
      "sqlite://help",
      {
        description:
          "Critical gotchas, WASM vs Native comparison, and Code Mode API reference",
        mimeType: "text/markdown",
        annotations: ASSISTANT_FOCUSED,
      },
      () => {
        metrics.recordResourceRead("sqlite://help");
        return {
          contents: [
            {
              uri: "sqlite://help",
              mimeType: "text/markdown",
              text: gotchasContent,
            },
          ],
        };
      },
    );
  }

  // Register group-specific help resources based on tool filter
  const groupHelpKeys: { group: ToolGroup; key: string }[] = [
    { group: "core", key: "core" },
    { group: "json", key: "json" },
    { group: "text", key: "text" },
    { group: "stats", key: "stats" },
    { group: "vector", key: "vector" },
    { group: "geo", key: "geo" },
    { group: "admin", key: "admin" },
    { group: "transactions", key: "transactions" },
    { group: "introspection", key: "introspection" },
    { group: "migration", key: "migration" },
  ];

  for (const { group, key } of groupHelpKeys) {
    const isCodemodeOnly =
      toolFilter.enabledGroups.size === 1 &&
      toolFilter.enabledGroups.has("codemode");

    if (!toolFilter.enabledGroups.has(group) && !isCodemodeOnly) {
      continue;
    }

    const content = HELP_CONTENT.get(key);
    if (!content) continue;

    server.registerResource(
      `sqlite_help_${key}`,
      `sqlite://help/${key}`,
      {
        description: `Tool reference for the ${group} tool group`,
        mimeType: "text/markdown",
        annotations: ASSISTANT_FOCUSED,
      },
      () => {
        metrics.recordResourceRead(`sqlite://help/${key}`);
        return {
          contents: [
            {
              uri: `sqlite://help/${key}`,
              mimeType: "text/markdown",
              text: content,
            },
          ],
        };
      },
    );
  }

  // Log registered help resources
  const registeredHelp = ["sqlite://help"];
  for (const { group, key } of groupHelpKeys) {
    if (toolFilter.enabledGroups.has(group)) {
      registeredHelp.push(`sqlite://help/${key}`);
    }
  }
  logger.info(`Help resources: ${registeredHelp.join(", ")}`, {
    module: "SERVER",
  });
}
