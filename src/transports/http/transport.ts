/**
 * HTTP Transport
 *
 * Dual-protocol HTTP transport with OAuth 2.1 integration.
 * Supports both Streamable HTTP (MCP 2025-03-26) and Legacy SSE
 * (MCP 2024-11-05) simultaneously, with security headers, CORS,
 * rate limiting, and body size enforcement.
 *
 * Modes:
 * - Stateful (default): Multi-session management with SSE streaming
 * - Stateless (opt-in): Lightweight serverless-compatible mode
 */

import express, { type RequestHandler } from "express";
import type { Request, Response } from "express";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { localhostHostValidation } from "@modelcontextprotocol/sdk/server/middleware/hostHeaderValidation.js";
import { oauthErrorHandler } from "../../auth/middleware/index.js";
import { createModuleLogger, ERROR_CODES } from "../../utils/logger/index.js";
import { DbMcpError } from "../../utils/errors/base.js";
import { ErrorCategory } from "../../utils/errors/categories.js";
import {
  DEFAULT_MAX_BODY_BYTES,
  HTTP_REQUEST_TIMEOUT_MS,
  HTTP_KEEP_ALIVE_TIMEOUT_MS,
  HTTP_HEADERS_TIMEOUT_MS,
  type HttpTransportConfig,
  type HttpTransportState,
  type RateLimitEntry,
} from "./types.js";
import {
  setupSecurityHeaders,
  setupCors,
  setupRateLimiting,
} from "./middleware.js";
import {
  setupStatelessEndpoints,
  setupStatefulEndpoints,
  setupLegacySSEEndpoints,
} from "./session.js";
import { applyAuthMiddleware, setupOAuth } from "./oauth.js";
import type { OAuthResourceServer } from "../../auth/oauth-resource-server.js";

const logger = createModuleLogger("HTTP");

// =============================================================================
// HTTP Transport
// =============================================================================

/**
 * HTTP Transport for MCP with OAuth 2.1 integration.
 *
 * Supports both Streamable HTTP (MCP 2025-03-26) and Legacy SSE
 * (MCP 2024-11-05) protocols simultaneously.
 *
 * Modes:
 * - Stateful (default): Multi-session management with SSE streaming for notifications
 * - Stateless: Single transport, no session management - ideal for serverless
 */
export class HttpTransport {
  /** Internal state shared with session/middleware/oauth modules */
  private readonly state: HttpTransportState;

  constructor(config: HttpTransportConfig) {
    this.state = {
      config: {
        ...config,
        host: config.host ?? "0.0.0.0",
        stateless: config.stateless ?? false,
      },
      app: null,
      httpServer: null,
      transports: new Map(),
      sseTransports: new Map(),
      statelessTransport: null,
      resourceServer: null,
      authServerDiscovery: null,
      tokenValidator: null,
      mcpServer: null,
      rateLimitMap: new Map<string, RateLimitEntry>(),
      rateLimitCleanupTimer: null,
    };
  }

  /**
   * Initialize the transport with the MCP server.
   *
   * For stateful mode, the server reference is stored to connect new sessions.
   * For stateless mode, a single transport is created and connected.
   *
   * @param server - The MCP server instance
   */
  async initialize(server: McpServer): Promise<void> {
    logger.info("Initializing HTTP transport...", {
      code: "HTTP_INIT",
      stateless: this.state.config.stateless,
    });

    this.state.mcpServer = server;

    // Create Express app
    this.state.app = express();

    // DNS rebinding protection — reject requests with unrecognized Host headers
    this.state.app.use(localhostHostValidation() as unknown as RequestHandler);

    // Security headers on all responses
    setupSecurityHeaders(this.state);

    // Configure CORS
    setupCors(this.state);

    // Rate limiting
    setupRateLimiting(this.state);

    // Body size enforcement via express.json limit
    const maxBodyBytes =
      this.state.config.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES;
    this.state.app.use(
      express.json({ limit: maxBodyBytes }) as unknown as RequestHandler,
    );

    // Determine resource URI
    const resourceUri =
      this.state.config.resourceUri ??
      `http://localhost:${String(this.state.config.port)}`;

    // Set up OAuth if enabled
    if (this.state.config.oauth.enabled) {
      await setupOAuth(this.state, resourceUri);
    }

    // Health check endpoint (always public)
    this.state.app.get("/health", (_req, res) => {
      res.json({
        status: "healthy",
        timestamp: new Date().toISOString(),
        oauth: this.state.config.oauth.enabled,
        mode: this.state.config.stateless ? "stateless" : "stateful",
        activeSessions: this.state.transports.size,
      });
    });

    // Root endpoint - helpful information for browser visitors
    this.state.app.get("/", (_req, res) => {
      res.json({
        name: "db-mcp",
        description: "SQLite MCP Server with dual HTTP transport",
        mode: this.state.config.stateless ? "stateless" : "stateful",
        endpoints: {
          "POST /mcp": "JSON-RPC requests (Streamable HTTP, MCP 2025-03-26)",
          "GET /mcp":
            this.state.config.stateless === true
              ? "Not available in stateless mode"
              : "SSE stream for server-to-client notifications",
          "DELETE /mcp": "Session termination",
          "GET /sse": "Legacy SSE connection (MCP 2024-11-05)",
          "POST /messages": "Legacy SSE message endpoint",
          "GET /health": "Health check",
        },
        documentation: "https://github.com/neverinfamous/db-mcp",
      });
    });

    // Apply auth middleware before MCP endpoints
    applyAuthMiddleware(this.state);

    // Set up MCP endpoints based on mode
    if (this.state.config.stateless) {
      await setupStatelessEndpoints(this.state);
    } else {
      setupStatefulEndpoints(this.state);
    }

    // Legacy SSE endpoints (always available in stateful mode)
    if (!this.state.config.stateless) {
      setupLegacySSEEndpoints(this.state);
    }

    // Error handler
    this.state.app.use(oauthErrorHandler);

    // 404 handler for unknown paths (must be last)
    this.state.app.use((_req: Request, res: Response) => {
      res.status(404).json({ error: "Not found" });
    });

    logger.info("HTTP transport initialized", {
      code: "HTTP_INIT_COMPLETE",
      port: this.state.config.port,
      oauth: this.state.config.oauth.enabled,
      mode: this.state.config.stateless ? "stateless" : "stateful",
      resourceUri,
    });
  }

  /**
   * Start listening on the configured port
   */
  async start(): Promise<void> {
    if (!this.state.app) {
      throw new DbMcpError(
        "Transport not initialized. Call initialize() first.",
        ERROR_CODES.SERVER.START_FAILED.full,
        ErrorCategory.INTERNAL
      );
    }

    return new Promise((resolve, reject) => {
      try {
        this.state.httpServer =
          this.state.app?.listen(
            this.state.config.port,
            this.state.config.host ?? "0.0.0.0",
            () => {
              // Set HTTP server timeouts to prevent slowloris-style DoS attacks
              if (this.state.httpServer) {
                this.state.httpServer.setTimeout(HTTP_REQUEST_TIMEOUT_MS);
                this.state.httpServer.keepAliveTimeout = HTTP_KEEP_ALIVE_TIMEOUT_MS;
                this.state.httpServer.headersTimeout = HTTP_HEADERS_TIMEOUT_MS;
              }

              logger.info(
                `HTTP server listening on ${this.state.config.host ?? "0.0.0.0"}:${String(this.state.config.port)}`,
                {
                  code: "HTTP_SERVER_STARTED",
                  mode: this.state.config.stateless
                    ? "stateless"
                    : "stateful",
                },
              );
              resolve();
            },
          ) ?? null;

        this.state.httpServer?.on("error", (error) => {
          logger.error("Failed to start HTTP server", {
            code: ERROR_CODES.SERVER.START_FAILED.full,
            error,
          });
          reject(error);
        });
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  /**
   * Stop the server and close all active sessions
   */
  async stop(): Promise<void> {
    // Stop rate limit cleanup timer
    if (this.state.rateLimitCleanupTimer) {
      clearInterval(this.state.rateLimitCleanupTimer);
      this.state.rateLimitCleanupTimer = null;
    }

    // Close all active Streamable HTTP transports
    for (const [sessionId, transport] of this.state.transports) {
      try {
        logger.debug("Closing transport", {
          code: "HTTP_SESSION_CLEANUP",
          sessionId,
        });
        await transport.close();
      } catch (error) {
        logger.error("Error closing transport", {
          code: ERROR_CODES.SERVER.SHUTDOWN_FAILED.full,
          sessionId,
          error: error instanceof Error ? error : undefined,
        });
      }
    }
    this.state.transports.clear();

    // Close all active SSE transports
    for (const [sessionId, transport] of this.state.sseTransports) {
      try {
        logger.debug("Closing SSE transport", {
          code: "SSE_SESSION_CLEANUP",
          sessionId,
        });
        await transport.close();
      } catch (error) {
        logger.error("Error closing SSE transport", {
          code: ERROR_CODES.SERVER.SHUTDOWN_FAILED.full,
          sessionId,
          error: error instanceof Error ? error : undefined,
        });
      }
    }
    this.state.sseTransports.clear();

    // Close stateless transport if in use
    if (this.state.statelessTransport) {
      try {
        await this.state.statelessTransport.close();
      } catch (error) {
        logger.error("Error closing stateless transport", {
          code: ERROR_CODES.SERVER.SHUTDOWN_FAILED.full,
          error: error instanceof Error ? error : undefined,
        });
      }
    }

    return new Promise((resolve, reject) => {
      if (!this.state.httpServer) {
        resolve();
        return;
      }

      this.state.httpServer.close((error) => {
        if (error) {
          logger.error("Error stopping HTTP server", {
            code: ERROR_CODES.SERVER.SHUTDOWN_FAILED.full,
            error,
          });
          reject(error);
        } else {
          logger.info("HTTP server stopped", { code: "HTTP_SERVER_STOPPED" });
          resolve();
        }
      });
    });
  }

  /**
   * Get the underlying Express app
   */
  getApp(): express.Express | null {
    return this.state.app;
  }

  /**
   * Get the number of active sessions (stateful mode only)
   */
  getActiveSessionCount(): number {
    return this.state.transports.size;
  }

  /**
   * Get the OAuth Resource Server
   */
  getResourceServer(): OAuthResourceServer | null {
    return this.state.resourceServer;
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create an HTTP transport instance
 */
export function createHttpTransport(
  config: HttpTransportConfig,
): HttpTransport {
  return new HttpTransport(config);
}
