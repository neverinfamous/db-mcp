/**
 * db-mcp — Observability Resources
 *
 * Registers the sqlite://metrics resource.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { metrics } from "../../observability/metrics.js";

/**
 * Register the metrics resource
 */
export function registerObservabilityResources(server: McpServer): void {
  server.registerResource(
    "sqlite://metrics",
    "sqlite://metrics",
    {
      description: "Returns in-memory streaming metrics including p50/p95/p99 latency percentiles and token usage.",
      mimeType: "application/json",
    },
    () => {
      const summary = metrics.getSummary();
      return {
        contents: [
          {
            uri: "sqlite://metrics",
            mimeType: "application/json",
            text: JSON.stringify(summary, null, 2),
          },
        ],
      };
    },
  );
}
