/**
 * db-mcp - HTTP Transport
 *
 * Streamable HTTP transport with OAuth 2.0 integration and SSE support.
 * Provides secure HTTP endpoints for MCP communication with optional
 * session management and server-sent events for notifications.
 *
 * Modes:
 * - Stateful (default): Multi-session management with SSE streaming
 * - Stateless (opt-in): Lightweight serverless-compatible mode
 */

import express, { type Express, type RequestHandler } from "express";
import type { Request, Response } from "express";
import cors from "cors";
import { randomUUID } from "node:crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { IncomingMessage, ServerResponse } from "node:http";
import { OAuthResourceServer } from "../auth/OAuthResourceServer.js";
import { AuthorizationServerDiscovery } from "../auth/AuthorizationServerDiscovery.js";
import { TokenValidator } from "../auth/TokenValidator.js";
import { createAuthMiddleware, oauthErrorHandler } from "../auth/middleware.js";
import { SUPPORTED_SCOPES } from "../auth/scopes.js";
import { createModuleLogger, ERROR_CODES } from "../utils/logger.js";
import type http from "node:http";

const logger = createModuleLogger("HTTP");

// =============================================================================
// Types
// =============================================================================

/**
 * HTTP transport configuration
 */
export interface HttpTransportConfig {
  /** Port to listen on */
  port: number;

  /** Host to bind to (default: '0.0.0.0') */
  host?: string;

  /**
   * Enable stateless HTTP mode (no session management, no SSE streaming).
   * Ideal for serverless deployments (Lambda, Workers, Vercel).
   * Default: false (stateful mode with session management and SSE support)
   */
  stateless?: boolean;

  /** OAuth configuration */
  oauth: {
    /** Enable OAuth authentication */
    enabled: boolean;

    /** Authorization server URL */
    authorizationServerUrl: string;

    /** Expected audience in tokens */
    audience: string;

    /** Expected issuer (defaults to authorizationServerUrl) */
    issuer?: string;

    /** JWKS URI (auto-discovered if not provided) */
    jwksUri?: string;

    /** Clock tolerance in seconds (default: 60) */
    clockTolerance?: number;

    /** Paths that bypass authentication */
    publicPaths?: string[];
  };

  /** CORS configuration */
  cors?: {
    /** Allowed origins */
    origin?: string | string[] | boolean;

    /** Allowed methods */
    methods?: string[];

    /** Allowed headers */
    allowedHeaders?: string[];

    /** Exposed headers */
    exposedHeaders?: string[];

    /** Allow credentials */
    credentials?: boolean;
  };

  /** Resource URI (defaults to http://localhost:{port}) */
  resourceUri?: string;
}

// =============================================================================
// HTTP Transport
// =============================================================================

/**
 * HTTP Transport for MCP with OAuth 2.0 integration and SSE support.
 *
 * Supports two modes:
 * - Stateful (default): Multi-session management with SSE streaming for notifications
 * - Stateless: Single transport, no session management - ideal for serverless
 */
export class HttpTransport {
  private readonly config: HttpTransportConfig;
  private app: Express | null = null;
  private httpServer: http.Server | null = null;

  // Session storage for stateful mode
  private transports = new Map<string, StreamableHTTPServerTransport>();

  // Single transport for stateless mode
  private statelessTransport: StreamableHTTPServerTransport | null = null;

  // OAuth components
  private resourceServer: OAuthResourceServer | null = null;
  private authServerDiscovery: AuthorizationServerDiscovery | null = null;
  private tokenValidator: TokenValidator | null = null;

  // Reference to the MCP server for stateful connections
  private mcpServer: McpServer | null = null;

  constructor(config: HttpTransportConfig) {
    this.config = {
      ...config,
      host: config.host ?? "0.0.0.0",
      stateless: config.stateless ?? false,
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
      stateless: this.config.stateless,
    });

    this.mcpServer = server;

    // Create Express app
    this.app = express();

    // Configure CORS with SSE-compatible headers
    this.setupCors();

    // Parse JSON bodies
    this.app.use(express.json());

    // Determine resource URI
    const resourceUri =
      this.config.resourceUri ?? `http://localhost:${String(this.config.port)}`;

    // Set up OAuth if enabled
    if (this.config.oauth.enabled) {
      await this.setupOAuth(resourceUri);
    }

    // Health check endpoint (always public)
    this.app.get("/health", (_req, res) => {
      res.json({
        status: "healthy",
        timestamp: new Date().toISOString(),
        oauth: this.config.oauth.enabled,
        mode: this.config.stateless ? "stateless" : "stateful",
        activeSessions: this.transports.size,
      });
    });

    // Root endpoint - helpful information for browser visitors
    this.app.get("/", (_req, res) => {
      res.json({
        name: "db-mcp",
        description: "SQLite MCP Server with HTTP/SSE transport",
        mode: this.config.stateless ? "stateless" : "stateful",
        endpoints: {
          "POST /mcp": "JSON-RPC requests (MCP protocol)",
          "GET /mcp":
            this.config.stateless === true
              ? "Not available in stateless mode"
              : "SSE stream for server-to-client notifications",
          "DELETE /mcp": "Session termination",
          "GET /health": "Health check",
        },
        documentation: "https://github.com/neverinfamous/db-mcp",
      });
    });

    // Set up MCP endpoints based on mode
    if (this.config.stateless) {
      await this.setupStatelessEndpoints();
    } else {
      this.setupStatefulEndpoints();
    }

    // Error handler
    this.app.use(oauthErrorHandler);

    logger.info("HTTP transport initialized", {
      code: "HTTP_INIT_COMPLETE",
      port: this.config.port,
      oauth: this.config.oauth.enabled,
      mode: this.config.stateless ? "stateless" : "stateful",
      resourceUri,
    });
  }

  /**
   * Configure CORS with SSE-compatible headers
   */
  private setupCors(): void {
    if (!this.app) return;

    // Manual CORS middleware for browser-based clients (e.g., MCP Inspector)
    this.app.use((req: Request, res: Response, next: () => void) => {
      // Set CORS headers on all responses
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader(
        "Access-Control-Allow-Methods",
        "GET, POST, DELETE, OPTIONS",
      );
      res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type, Accept, Authorization, mcp-session-id, Last-Event-ID, mcp-protocol-version",
      );
      res.setHeader("Access-Control-Expose-Headers", "mcp-session-id");

      // Handle OPTIONS preflight requests
      if (req.method === "OPTIONS") {
        res.status(204).end();
        return;
      }

      next();
    });

    // Additional CORS config if provided
    if (this.config.cors) {
      this.app.use(cors(this.config.cors) as RequestHandler);
    }

    // Explicit OPTIONS handler for /mcp - MUST be before other /mcp routes
    this.app.all("/mcp", (req: Request, res: Response, next: () => void) => {
      // Set CORS headers on ALL responses
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader(
        "Access-Control-Allow-Methods",
        "GET, POST, DELETE, OPTIONS",
      );
      res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type, Accept, Authorization, mcp-session-id, Last-Event-ID, mcp-protocol-version",
      );
      res.setHeader("Access-Control-Expose-Headers", "mcp-session-id");

      // For OPTIONS, respond immediately with CORS headers
      if (req.method === "OPTIONS") {
        res.status(204).end();
        return;
      }

      // For other methods, continue to next handler
      next();
    });
  }

  /**
   * Set up stateless mode endpoints (serverless-compatible)
   */
  private async setupStatelessEndpoints(): Promise<void> {
    if (!this.app || !this.mcpServer) {
      throw new Error("Transport or server not initialized");
    }

    // Apply auth middleware if OAuth is enabled
    this.applyAuthMiddleware();

    // Create single stateless transport
    // Note: omitting sessionIdGenerator signals stateless mode (no sessions)
    this.statelessTransport = new StreamableHTTPServerTransport({
      enableJsonResponse: true,
    });

    // Ensure transport has onclose handler (required by SDK 1.25.2+)
    this.statelessTransport.onclose ??= () => {
      logger.debug("Stateless transport closed", {
        code: "HTTP_STATELESS_CLOSE",
      });
    };

    // Connect transport to server (type assertion for SDK 1.25.2+ exact types)
    await this.mcpServer.connect(
      this.statelessTransport as Parameters<typeof this.mcpServer.connect>[0],
    );
    logger.info("Stateless transport connected", { code: "HTTP_STATELESS" });

    // POST /mcp - All requests go to the same transport (no session validation)
    this.app.post("/mcp", (req: Request, res: Response): void => {
      if (!this.statelessTransport) {
        res.status(500).json({ error: "Transport not initialized" });
        return;
      }

      void this.statelessTransport.handleRequest(
        req as unknown as IncomingMessage,
        res as unknown as ServerResponse,
        req.body as unknown,
      );
    });

    // GET /mcp - SSE not available in stateless mode
    this.app.get("/mcp", (_req: Request, res: Response): void => {
      res.status(405).json({
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message: "SSE streaming not available in stateless mode",
        },
        id: null,
      });
    });

    // DELETE /mcp - No-op in stateless mode (no sessions to terminate)
    this.app.delete("/mcp", (_req: Request, res: Response): void => {
      res.status(204).end();
    });
  }

  /**
   * Set up stateful mode endpoints with session management and SSE
   */
  private setupStatefulEndpoints(): void {
    if (!this.app || !this.mcpServer) {
      throw new Error("Transport or server not initialized");
    }

    // Apply auth middleware if OAuth is enabled
    this.applyAuthMiddleware();

    const server = this.mcpServer;

    // POST /mcp - Handle JSON-RPC requests with session management
    this.app.post("/mcp", (req: Request, res: Response): void => {
      const sessionId = req.headers["mcp-session-id"] as string | undefined;

      // Helper: Check if this is an initialize request (single or in batch)
      const isNewSessionRequest = (body: unknown): boolean => {
        // Single request
        if (isInitializeRequest(body)) {
          return true;
        }
        // Batch request - check if first item is initialize
        if (Array.isArray(body) && body.length > 0) {
          return isInitializeRequest(body[0]);
        }
        return false;
      };

      void (async () => {
        try {
          let httpTransport: StreamableHTTPServerTransport | undefined;

          if (sessionId && this.transports.has(sessionId)) {
            // Reuse existing transport
            httpTransport = this.transports.get(sessionId);
          } else if (sessionId === undefined && isNewSessionRequest(req.body)) {
            // New initialization request - create transport
            const newTransport = new StreamableHTTPServerTransport({
              sessionIdGenerator: () => randomUUID(),
              onsessioninitialized: (sid: string) => {
                logger.info("HTTP session initialized", {
                  code: "HTTP_SESSION_INIT",
                  sessionId: sid,
                });
                this.transports.set(sid, newTransport);
              },
            });

            // Clean up on transport close
            newTransport.onclose = () => {
              const sid = newTransport.sessionId;
              if (sid !== undefined && this.transports.has(sid)) {
                logger.info("HTTP transport closed", {
                  code: "HTTP_SESSION_CLOSE",
                  sessionId: sid,
                });
                this.transports.delete(sid);
              }
            };

            // Connect transport to server before handling request
            // Type assertion for SDK 1.25.2+ exact optional types
            await server.connect(
              newTransport as Parameters<typeof server.connect>[0],
            );
            await newTransport.handleRequest(
              req as unknown as IncomingMessage,
              res as unknown as ServerResponse,
              req.body as unknown,
            );
            return;
          } else {
            // Invalid request - no session ID or not initialization
            res.status(400).json({
              jsonrpc: "2.0",
              error: {
                code: -32000,
                message: "Bad Request: No valid session ID provided",
              },
              id: null,
            });
            return;
          }

          // Handle request with existing transport
          if (httpTransport !== undefined) {
            await httpTransport.handleRequest(
              req as unknown as IncomingMessage,
              res as unknown as ServerResponse,
              req.body as unknown,
            );
          }
        } catch (error) {
          logger.error("Error handling MCP request", {
            code: ERROR_CODES.SERVER.TRANSPORT_ERROR.full,
            error: error instanceof Error ? error : undefined,
          });
          if (!res.headersSent) {
            res.status(500).json({
              jsonrpc: "2.0",
              error: { code: -32603, message: "Internal server error" },
              id: null,
            });
          }
        }
      })();
    });

    // GET /mcp - SSE stream for server-to-client notifications
    this.app.get("/mcp", (req: Request, res: Response): void => {
      const sessionId = req.headers["mcp-session-id"] as string | undefined;

      if (sessionId === undefined || !this.transports.has(sessionId)) {
        res.status(400).send("Invalid or missing session ID");
        return;
      }

      const lastEventId = req.headers["last-event-id"];
      if (lastEventId !== undefined) {
        logger.debug("Client reconnecting with Last-Event-ID", {
          code: "HTTP_SSE_RECONNECT",
          sessionId,
          lastEventId,
        });
      }

      const httpTransport = this.transports.get(sessionId);
      if (httpTransport !== undefined) {
        void httpTransport.handleRequest(
          req as unknown as IncomingMessage,
          res as unknown as ServerResponse,
        );
      }
    });

    // DELETE /mcp - Session termination
    this.app.delete("/mcp", (req: Request, res: Response): void => {
      const sessionId = req.headers["mcp-session-id"] as string | undefined;

      if (sessionId === undefined || !this.transports.has(sessionId)) {
        res.status(400).send("Invalid or missing session ID");
        return;
      }

      logger.info("Session termination requested", {
        code: "HTTP_SESSION_DELETE",
        sessionId,
      });

      const httpTransport = this.transports.get(sessionId);
      if (httpTransport !== undefined) {
        void httpTransport.handleRequest(
          req as unknown as IncomingMessage,
          res as unknown as ServerResponse,
        );
      }
    });
  }

  /**
   * Apply OAuth authentication middleware if enabled
   */
  private applyAuthMiddleware(): void {
    if (
      this.config.oauth.enabled &&
      this.tokenValidator &&
      this.resourceServer &&
      this.app
    ) {
      const authMiddleware = createAuthMiddleware({
        tokenValidator: this.tokenValidator,
        resourceServer: this.resourceServer,
        publicPaths: ["/health", ...(this.config.oauth.publicPaths ?? [])],
      });

      this.app.use(authMiddleware);
    }
  }

  /**
   * Set up OAuth 2.0 components
   */
  private async setupOAuth(resourceUri: string): Promise<void> {
    logger.info("Setting up OAuth 2.0...", { code: "HTTP_OAUTH_SETUP" });

    // Create Resource Server
    this.resourceServer = new OAuthResourceServer({
      resource: resourceUri,
      authorizationServers: [this.config.oauth.authorizationServerUrl],
      scopesSupported: [...SUPPORTED_SCOPES],
    });

    // Serve Protected Resource Metadata endpoint
    this.app?.get(
      "/.well-known/oauth-protected-resource",
      this.resourceServer.getMetadataHandler(),
    );

    // Discover authorization server metadata
    this.authServerDiscovery = new AuthorizationServerDiscovery({
      authServerUrl: this.config.oauth.authorizationServerUrl,
    });

    try {
      const metadata = await this.authServerDiscovery.discover();

      // Create Token Validator
      this.tokenValidator = new TokenValidator({
        jwksUri: this.config.oauth.jwksUri ?? metadata.jwks_uri ?? "",
        issuer: this.config.oauth.issuer ?? metadata.issuer,
        audience: this.config.oauth.audience,
        clockTolerance: this.config.oauth.clockTolerance,
      });

      logger.info("OAuth 2.0 setup complete", { code: "HTTP_OAUTH_READY" });
    } catch (error) {
      // If discovery fails, we can still start without OAuth validation
      logger.warning(
        "Authorization server discovery failed. OAuth validation disabled.",
        {
          code: ERROR_CODES.AUTH.DISCOVERY_FAILED.full,
          error: error instanceof Error ? error : undefined,
        },
      );

      if (!this.config.oauth.jwksUri) {
        logger.error(
          "No JWKS URI available. Please provide oauth.jwksUri in config.",
          { code: ERROR_CODES.AUTH.DISCOVERY_FAILED.full },
        );
        throw error;
      }

      this.tokenValidator = new TokenValidator({
        jwksUri: this.config.oauth.jwksUri,
        issuer:
          this.config.oauth.issuer ?? this.config.oauth.authorizationServerUrl,
        audience: this.config.oauth.audience,
        clockTolerance: this.config.oauth.clockTolerance,
      });
    }
  }

  /**
   * Start listening on the configured port
   */
  async start(): Promise<void> {
    if (!this.app) {
      throw new Error("Transport not initialized. Call initialize() first.");
    }

    return new Promise((resolve, reject) => {
      try {
        this.httpServer =
          this.app?.listen(
            this.config.port,
            this.config.host ?? "0.0.0.0",
            () => {
              logger.info(
                `HTTP server listening on ${this.config.host ?? "0.0.0.0"}:${String(this.config.port)}`,
                {
                  code: "HTTP_SERVER_STARTED",
                  mode: this.config.stateless ? "stateless" : "stateful",
                },
              );
              resolve();
            },
          ) ?? null;

        this.httpServer?.on("error", (error) => {
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
    // Close all active transports in stateful mode
    for (const [sessionId, transport] of this.transports) {
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
    this.transports.clear();

    // Close stateless transport if in use
    if (this.statelessTransport) {
      try {
        await this.statelessTransport.close();
      } catch (error) {
        logger.error("Error closing stateless transport", {
          code: ERROR_CODES.SERVER.SHUTDOWN_FAILED.full,
          error: error instanceof Error ? error : undefined,
        });
      }
    }

    return new Promise((resolve, reject) => {
      if (!this.httpServer) {
        resolve();
        return;
      }

      this.httpServer.close((error) => {
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
  getApp(): Express | null {
    return this.app;
  }

  /**
   * Get the number of active sessions (stateful mode only)
   */
  getActiveSessionCount(): number {
    return this.transports.size;
  }

  /**
   * Get the OAuth Resource Server
   */
  getResourceServer(): OAuthResourceServer | null {
    return this.resourceServer;
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
