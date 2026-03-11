/* eslint-disable @typescript-eslint/no-deprecated -- Intentional: SSEServerTransport provides backward compatibility for MCP 2024-11-05 clients */
/**
 * HTTP Transport Session Endpoints
 *
 * Stateless, stateful, and legacy SSE endpoint setup.
 * Each function registers Express routes on the transport state.
 */

import { randomUUID } from "node:crypto";
import type { Request, Response } from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import type { IncomingMessage, ServerResponse } from "node:http";
import { createModuleLogger, ERROR_CODES } from "../../utils/logger.js";
import type { HttpTransportState } from "./types.js";

const logger = createModuleLogger("HTTP");

// =============================================================================
// Stateless Endpoints
// =============================================================================

/**
 * Set up stateless mode endpoints (serverless-compatible)
 */
export async function setupStatelessEndpoints(
  state: HttpTransportState,
): Promise<void> {
  if (!state.app || !state.mcpServer) {
    throw new Error("Transport or server not initialized");
  }

  // Create single stateless transport
  // Note: omitting sessionIdGenerator signals stateless mode (no sessions)
  state.statelessTransport = new StreamableHTTPServerTransport({
    enableJsonResponse: true,
  });

  // Ensure transport has onclose handler (required by SDK 1.25.2+)
  state.statelessTransport.onclose ??= () => {
    logger.debug("Stateless transport closed", {
      code: "HTTP_STATELESS_CLOSE",
    });
  };

  // Connect transport to server (type assertion for SDK 1.25.2+ exact types)
  await state.mcpServer.connect(
    state.statelessTransport as Parameters<typeof state.mcpServer.connect>[0],
  );
  logger.info("Stateless transport connected", { code: "HTTP_STATELESS" });

  // POST /mcp - All requests go to the same transport (no session validation)
  state.app.post("/mcp", (req: Request, res: Response): void => {
    if (!state.statelessTransport) {
      res.status(500).json({ error: "Transport not initialized" });
      return;
    }

    void state.statelessTransport.handleRequest(
      req as unknown as IncomingMessage,
      res as unknown as ServerResponse,
      req.body as unknown,
    );
  });

  // GET /mcp - SSE not available in stateless mode
  state.app.get("/mcp", (_req: Request, res: Response): void => {
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
  state.app.delete("/mcp", (_req: Request, res: Response): void => {
    res.status(204).end();
  });
}

// =============================================================================
// Stateful Endpoints
// =============================================================================

/**
 * Set up stateful mode endpoints with session management and SSE
 */
export function setupStatefulEndpoints(state: HttpTransportState): void {
  if (!state.app || !state.mcpServer) {
    throw new Error("Transport or server not initialized");
  }

  const server = state.mcpServer;

  // POST /mcp - Handle JSON-RPC requests with session management
  state.app.post("/mcp", (req: Request, res: Response): void => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;

    // Cross-protocol guard: reject SSE session IDs on /mcp
    if (sessionId && state.sseTransports.has(sessionId)) {
      res.status(400).json({
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message:
            "Bad Request: Session exists but uses a different transport protocol",
        },
        id: null,
      });
      return;
    }

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

        if (sessionId && state.transports.has(sessionId)) {
          // Reuse existing transport
          httpTransport = state.transports.get(sessionId);
        } else if (sessionId === undefined && isNewSessionRequest(req.body)) {
          // New initialization request - create transport
          const newTransport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => randomUUID(),
            onsessioninitialized: (sid: string) => {
              logger.info("HTTP session initialized", {
                code: "HTTP_SESSION_INIT",
                sessionId: sid,
              });
              state.transports.set(sid, newTransport);
            },
          });

          // Clean up on transport close
          newTransport.onclose = () => {
            const sid = newTransport.sessionId;
            if (sid !== undefined && state.transports.has(sid)) {
              logger.info("HTTP transport closed", {
                code: "HTTP_SESSION_CLOSE",
                sessionId: sid,
              });
              state.transports.delete(sid);
            }
          };

          // Connect transport to server before handling request
          // SDK McpServer only supports one active transport — close first
          try {
            await server.connect(
              newTransport as Parameters<typeof server.connect>[0],
            );
          } catch {
            // Close existing connection and retry
            await server.close();
            await server.connect(
              newTransport as Parameters<typeof server.connect>[0],
            );
          }
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
  state.app.get("/mcp", (req: Request, res: Response): void => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;

    if (sessionId === undefined || !state.transports.has(sessionId)) {
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

    const httpTransport = state.transports.get(sessionId);
    if (httpTransport !== undefined) {
      void httpTransport.handleRequest(
        req as unknown as IncomingMessage,
        res as unknown as ServerResponse,
      );
    }
  });

  // DELETE /mcp - Session termination
  state.app.delete("/mcp", (req: Request, res: Response): void => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;

    if (sessionId === undefined || !state.transports.has(sessionId)) {
      res.status(400).send("Invalid or missing session ID");
      return;
    }

    logger.info("Session termination requested", {
      code: "HTTP_SESSION_DELETE",
      sessionId,
    });

    const httpTransport = state.transports.get(sessionId);
    if (httpTransport !== undefined) {
      void httpTransport.handleRequest(
        req as unknown as IncomingMessage,
        res as unknown as ServerResponse,
      );
    }
  });
}

// =============================================================================
// Legacy SSE Endpoints
// =============================================================================

/**
 * Set up Legacy SSE endpoints for backward compatibility (MCP 2024-11-05)
 */
export function setupLegacySSEEndpoints(state: HttpTransportState): void {
  if (!state.app || !state.mcpServer) return;

  const server = state.mcpServer;

  // GET /sse — Open SSE connection, returns /messages?sessionId=<id>
  state.app.get("/sse", (req: Request, res: Response): void => {
    logger.info("Legacy SSE connection requested", {
      code: "SSE_CONNECT",
    });

    const sseTransport = new SSEServerTransport(
      "/messages",
      res as unknown as ServerResponse,
    );

    void (async () => {
      try {
        // Store the transport by session ID
        state.sseTransports.set(sseTransport.sessionId, sseTransport);

        sseTransport.onclose = () => {
          logger.info("Legacy SSE transport closed", {
            code: "SSE_CLOSE",
            sessionId: sseTransport.sessionId,
          });
          state.sseTransports.delete(sseTransport.sessionId);
        };

        // Connect SSE transport to server
        // SDK McpServer only supports one active transport — close first if needed
        // Note: connect() auto-calls start() on SSE transports — do NOT call start() separately
        try {
          await server.connect(
            sseTransport as unknown as Parameters<typeof server.connect>[0],
          );
        } catch {
          // Close existing connection and retry
          await server.close();
          await server.connect(
            sseTransport as unknown as Parameters<typeof server.connect>[0],
          );
        }
      } catch (error) {
        logger.error("Error starting SSE transport", {
          code: ERROR_CODES.SERVER.TRANSPORT_ERROR.full,
          error: error instanceof Error ? error : undefined,
        });
        if (!res.headersSent) {
          res.status(500).end();
        }
      }
    })();

    // Clean up when client disconnects
    req.on("close", () => {
      state.sseTransports.delete(sseTransport.sessionId);
    });
  });

  // POST /messages?sessionId=<id> — Route messages to the correct SSE transport
  state.app.post("/messages", (req: Request, res: Response): void => {
    const sessionId =
      typeof req.query["sessionId"] === "string"
        ? req.query["sessionId"]
        : undefined;

    if (!sessionId) {
      res.status(400).json({
        jsonrpc: "2.0",
        error: { code: -32000, message: "Missing sessionId parameter" },
        id: null,
      });
      return;
    }

    const sseTransport = state.sseTransports.get(sessionId);
    if (!sseTransport) {
      res.status(404).json({
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message: "No transport found for sessionId",
        },
        id: null,
      });
      return;
    }

    void sseTransport.handlePostMessage(
      req as unknown as IncomingMessage,
      res as unknown as ServerResponse,
      req.body as unknown,
    );
  });
}
