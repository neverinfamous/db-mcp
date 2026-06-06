import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { logger } from "../../utils/logger/index.js";
import type { LogLevel } from "../../utils/logger/types.js";
import {
  registerToolScopes,
  scopesGrantToolAccess,
} from "../../auth/scopes/enforcement.js";
import { getAuthContext } from "../../auth/auth-context.js";
import { InsufficientScopeError } from "../../auth/errors.js";
import { formatHandlerError } from "../../utils/errors/index.js";
import { toSDK } from "../../utils/annotations.js";

/**
 * Register administrative tools
 */
export function registerAdminTools(server: McpServer): void {
  server.registerTool(
    "sqlite_server_config",
    {
      title: "Server Configuration",
      description:
        "Get or update runtime configuration values for the server. Currently supports updating the log level.",
      inputSchema: z.object({
        action: z
          .enum(["get", "set"])
          .describe("Whether to get or set the configuration value"),
        setting: z
          .enum(["logLevel"])
          .optional()
          .describe("The setting to modify"),
        value: z
          .string()
          .optional()
          .describe(
            "The new value for the setting (e.g., 'debug', 'info', 'warning')",
          ),
      }),
      annotations: toSDK({
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
        sensitiveHint: true,
      }),
    },
    (args: unknown) => {
      const authCtx = getAuthContext();
      if (
        authCtx &&
        !scopesGrantToolAccess(authCtx.scopes, "sqlite_server_config")
      ) {
        throw new InsufficientScopeError(["admin"], authCtx.scopes);
      }
      try {
        const parsed = z
          .object({
            action: z.enum(["get", "set"]),
            setting: z.enum(["logLevel"]).optional(),
            value: z.string().optional(),
          })
          .parse(args ?? {});

        const { action, setting, value } = parsed;

        if (action === "get") {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(
                  {
                    success: true,
                    config: {
                      logLevel: logger.getLevel(),
                    },
                  },
                  null,
                  2,
                ),
              },
            ],
          };
        }

        if (action === "set") {
          if (setting === "logLevel" && value) {
            const validLevels = [
              "debug",
              "info",
              "notice",
              "warning",
              "error",
              "critical",
              "alert",
              "emergency",
            ];
            if (!validLevels.includes(value.toLowerCase())) {
              return {
                content: [
                  {
                    type: "text" as const,
                    text: JSON.stringify(
                      {
                        success: false,
                        error: `Invalid log level: ${value}. Must be one of: ${validLevels.join(", ")}`,
                        code: "INVALID_CONFIG",
                        category: "validation",
                      },
                      null,
                      2,
                    ),
                  },
                ],
                isError: true,
              };
            }

            logger.setLevel(value.toLowerCase() as LogLevel);
            logger.info(
              `Log level dynamically changed to ${value} via sqlite_server_config tool`,
              {
                module: "SERVER",
              },
            );

            return {
              content: [
                {
                  type: "text" as const,
                  text: JSON.stringify(
                    {
                      success: true,
                      message: `Log level successfully updated to ${value}`,
                    },
                    null,
                    2,
                  ),
                },
              ],
            };
          }

          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(
                  {
                    success: false,
                    error: "Missing setting or value for set action",
                    code: "INVALID_CONFIG",
                    category: "validation",
                  },
                  null,
                  2,
                ),
              },
            ],
            isError: true,
          };
        }

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ 
                success: false, 
                error: "Invalid action",
                code: "INVALID_CONFIG",
                category: "validation"
              }),
            },
          ],
          isError: true,
        };
      } catch (error) {
        const structured = formatHandlerError(error);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(structured, null, 2),
            },
          ],
          isError: true,
          structuredContent: structured as unknown as Record<string, unknown>,
        };
      }
    },
  );

  registerToolScopes(new Map([["sqlite_server_config", ["admin"]]]));
}
