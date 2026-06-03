import { randomUUID } from "node:crypto";
import type { Request, Response } from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import {
  ERROR_CODES,
  createModuleLogger,
} from "../../../utils/logger/index.js";
import type { HttpTransportState } from "../types.js";
import {
  JSONRPC_SERVER_ERROR,
  JSONRPC_INTERNAL_ERROR,
  SESSION_TIMEOUT_MS,
  SESSION_SWEEP_INTERVAL_MS,
  SESSION_ABSOLUTE_TTL_MS,
} from "../types.js";
import { asIncoming, asServerResponse } from "../type-adapters.js";
import { DbMcpError } from "../../../utils/errors/base.js";
import { ErrorCategory } from "../../../utils/errors/categories.js";
import { Mutex } from "./mutex.js";

const logger = createModuleLogger("HTTP");
const connectionMutex = new Mutex();

/**
 * H-2: Verify that the requesting client owns the target session.
 * When auth is disabled (owner is undefined), verification is skipped.
 * Returns true if access is allowed, false if denied.
 */
export function verifySessionOwner(
  state: HttpTransportState,
  sessionId: string,
  reqAuthSub: string | undefined,
): boolean {
  const owner = state.sessionOwners.get(sessionId);
  // If the session has an owner, the requester must match the owner
  if (owner !== undefined && owner !== reqAuthSub) {
    return false;
  }
  return true;
}

/**
 * H-3: Validate session ID format to prevent hash-collision or memory DoS
 */
function isValidSessionId(id: string | undefined): id is string {
  if (!id) return false;
  // UUIDv4 format: 36 chars, hex and hyphens
  if (id.length !== 36) return false;
  return /^[0-9a-fA-F-]{36}$/.test(id);
}

/**
 * Helper to update session activity timestamp
 */
export function touchSession(state: HttpTransportState, sessionId: string): void {
  state.sessionLastActivity.set(sessionId, Date.now());
}

/**
 * Set up stateful mode endpoints with session management and SSE
 */
export function setupStatefulEndpoints(
  state: HttpTransportState,
): ReturnType<typeof setInterval> {
  if (!state.app || !state.mcpServer) {
    throw new DbMcpError(
      "Transport or server not initialized",
      ERROR_CODES.SERVER.TRANSPORT_ERROR.full,
      ErrorCategory.INTERNAL,
    );
  }

  const server = state.mcpServer;

  // Session timeout sweep interval
  const sessionSweepTimer = setInterval(() => {
    const now = Date.now();
    for (const [sid, lastActivity] of state.sessionLastActivity) {
      const idleMs = now - lastActivity;
      if (idleMs <= SESSION_TIMEOUT_MS) continue;
      if ((state.sessionLocks.get(sid) ?? 0) > 0) continue; // Skip if locked (in-flight request)

      // Expire idle Streamable HTTP sessions
      if (state.transports.has(sid)) {
        logger.info("Expiring idle HTTP session", {
          code: "HTTP_SESSION_EXPIRE",
          sessionId: sid,
          idleMinutes: Math.round(idleMs / 60_000),
        });
        const t = state.transports.get(sid);
        if (t) {
          void t.close(); // the onclose handler will clean up maps
        }
      }

      // Expire idle Legacy SSE sessions
      if (state.sseTransports.has(sid)) {
        logger.info("Expiring idle SSE session", {
          code: "SSE_SESSION_EXPIRE",
          sessionId: sid,
          idleMinutes: Math.round(idleMs / 60_000),
        });
        const t = state.sseTransports.get(sid);
        if (t) {
          void t.close(); // the onclose handler will clean up maps
        }
      }
    }
  }, SESSION_SWEEP_INTERVAL_MS);
  sessionSweepTimer.unref();

  state.app.post("/mcp", (req: Request, res: Response): void => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;

    if (sessionId !== undefined && !isValidSessionId(sessionId)) {
      res.status(400).json({
        jsonrpc: "2.0",
        error: {
          code: JSONRPC_SERVER_ERROR,
          message: "Bad Request: Invalid session ID format",
        },
        id: null,
      });
      return;
    }

    if (sessionId && state.sseTransports.has(sessionId)) {
      res.status(400).json({
        jsonrpc: "2.0",
        error: {
          code: JSONRPC_SERVER_ERROR,
          message:
            "Bad Request: Session exists but uses a different transport protocol",
        },
        id: null,
      });
      return;
    }

    const isNewSessionRequest = (body: unknown): boolean => {
      if (isInitializeRequest(body)) {
        return true;
      }
      if (Array.isArray(body) && body.length > 0) {
        return isInitializeRequest(body[0]);
      }
      return false;
    };

    void (async () => {
      try {
        let httpTransport: StreamableHTTPServerTransport | undefined;
        const existingTransport = sessionId
          ? state.transports.get(sessionId)
          : undefined;

        if (typeof sessionId === "string" && existingTransport !== undefined) {
          // H-2: Verify the requesting client owns this session
          if (!verifySessionOwner(state, sessionId, req.auth?.sub)) {
            res.status(403).json({
              jsonrpc: "2.0",
              error: {
                code: JSONRPC_SERVER_ERROR,
                message: "Forbidden: session belongs to a different client",
              },
              id: null,
            });
            return;
          }

          // Enforce Absolute TTL
          const createdAt = state.sessionCreatedAt.get(sessionId) ?? Date.now();
          if (Date.now() - createdAt > SESSION_ABSOLUTE_TTL_MS) {
            res.status(401).json({
              jsonrpc: "2.0",
              error: {
                code: JSONRPC_SERVER_ERROR,
                message: "Unauthorized: Session absolute TTL expired",
              },
              id: null,
            });
            return;
          }

          touchSession(state, sessionId);
          httpTransport = existingTransport;
        } else if (sessionId === undefined && isNewSessionRequest(req.body)) {
          const maxSessions = state.config.maxSessions ?? 1000;
          if (
            state.transports.size + state.sseTransports.size >=
            maxSessions
          ) {
            res.status(429).json({
              jsonrpc: "2.0",
              error: {
                code: JSONRPC_SERVER_ERROR,
                message:
                  "Too Many Requests: Maximum number of concurrent sessions reached",
              },
              id: null,
            });
            return;
          }

          const newTransport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => randomUUID(),
            onsessioninitialized: (sid: string) => {
              logger.info("HTTP session initialized", {
                code: "HTTP_SESSION_INIT",
                sessionId: sid,
              });
              state.transports.set(sid, newTransport);
              touchSession(state, sid);
              state.sessionCreatedAt.set(sid, Date.now());
              // H-2: Bind session to the authenticated identity that created it
              state.sessionOwners.set(sid, req.auth?.sub);
            },
          });

          newTransport.onclose = () => {
            const sid = newTransport.sessionId;
            if (sid !== undefined && state.transports.has(sid)) {
              logger.info("HTTP transport closed", {
                code: "HTTP_SESSION_CLOSE",
                sessionId: sid,
              });
              state.transports.delete(sid);
              state.sessionOwners.delete(sid);
              state.sessionLastActivity.delete(sid);
              state.sessionCreatedAt.delete(sid);
              state.sessionLocks.delete(sid);

              // Clean up subscriptions
              if ("subscriptionManager" in server) {
                (
                  server as unknown as {
                    subscriptionManager: {
                      unsubscribeSession: (id: string) => void;
                    };
                  }
                ).subscriptionManager.unsubscribeSession(sid);
              }
            }
          };

          await connectionMutex.acquire().then(async (release) => {
            try {
              if (server.server.transport) {
                const oldTransport = server.server.transport;
                logger.info("Captured oldTransport in /mcp", {
                  hasOldTransport: oldTransport !== undefined,
                  hasOnclose: oldTransport.onclose !== undefined,
                });

                try {
                  await Promise.race([
                    server.close(),
                    new Promise((_, reject) =>
                      setTimeout(
                        () => reject(new Error("server.close timeout")),
                        2000,
                      ),
                    ),
                  ]);
                  logger.info("server.close() succeeded in /mcp");
                } catch (closeErr) {
                  logger.error("server.close() failed or timed out in /mcp", {
                    error:
                      closeErr instanceof Error
                        ? closeErr
                        : new Error(String(closeErr)),
                  });
                }

                if (
                  server.server.transport === oldTransport &&
                  oldTransport.onclose !== undefined
                ) {
                  logger.info(
                    "Manually invoking oldTransport.onclose() to clear Protocol state in /mcp",
                  );
                  oldTransport.onclose();
                }

                delete oldTransport.onclose;
              }

              logger.info("Attempting server.connect(newTransport)");
              await server.connect(
                newTransport as Parameters<typeof server.connect>[0],
              );
              logger.info("server.connect succeeded in /mcp");
            } finally {
              release();
            }
          });
          
          const activeSid = newTransport.sessionId;
          try {
            if (activeSid) {
              const count = state.sessionLocks.get(activeSid) ?? 0;
              state.sessionLocks.set(activeSid, count + 1);
            }
            await newTransport.handleRequest(
              asIncoming(req),
              asServerResponse(res),
              req.body as unknown,
            );
          } finally {
            if (activeSid) {
              const count = state.sessionLocks.get(activeSid) ?? 0;
              if (count > 1) {
                state.sessionLocks.set(activeSid, count - 1);
              } else {
                state.sessionLocks.delete(activeSid);
              }
              touchSession(state, activeSid);
            }
          }
          return;
        } else {
          res.status(400).json({
            jsonrpc: "2.0",
            error: {
              code: JSONRPC_SERVER_ERROR,
              message: "Bad Request: No valid session ID provided",
            },
            id: null,
          });
          return;
        }

        if (httpTransport !== undefined) {
          const activeSid = sessionId;
          try {
            if (activeSid) {
              const count = state.sessionLocks.get(activeSid) ?? 0;
              state.sessionLocks.set(activeSid, count + 1);
            }
            await httpTransport.handleRequest(
              asIncoming(req),
              asServerResponse(res),
              req.body as unknown,
            );
          } finally {
            if (activeSid) {
              const count = state.sessionLocks.get(activeSid) ?? 0;
              if (count > 1) {
                state.sessionLocks.set(activeSid, count - 1);
              } else {
                state.sessionLocks.delete(activeSid);
              }
              touchSession(state, activeSid);
            }
          }
        }
      } catch (error: unknown) {
        logger.error("Error handling MCP request", {
          code: ERROR_CODES.SERVER.TRANSPORT_ERROR.full,
          error: error instanceof Error ? error : undefined,
        });
        if (!res.headersSent) {
          res.status(500).json({
            jsonrpc: "2.0",
            error: {
              code: JSONRPC_INTERNAL_ERROR,
              message: "Internal server error",
            },
            id: null,
          });
        }
      }
    })();
  });

  state.app.get("/mcp", (req: Request, res: Response): void => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;

    if (sessionId === undefined || !isValidSessionId(sessionId)) {
      res.status(400).send("Invalid or missing session ID");
      return;
    }

    const httpTransport = state.transports.get(sessionId);
    if (httpTransport === undefined) {
      res.status(400).send("Invalid or missing session ID");
      return;
    }

    // H-2: Verify session ownership
    if (!verifySessionOwner(state, sessionId, req.auth?.sub)) {
      res.status(403).send("Forbidden: session belongs to a different client");
      return;
    }

    // Enforce Absolute TTL
    const createdAt = state.sessionCreatedAt.get(sessionId) ?? Date.now();
    if (Date.now() - createdAt > SESSION_ABSOLUTE_TTL_MS) {
      res.status(401).send("Unauthorized: Session absolute TTL expired");
      return;
    }

    touchSession(state, sessionId);

    const lastEventId = req.headers["last-event-id"];
    if (lastEventId !== undefined) {
      logger.debug("Client reconnecting with Last-Event-ID", {
        code: "HTTP_SSE_RECONNECT",
        sessionId,
        lastEventId,
      });
    }

    if (httpTransport !== undefined) {
      void (async () => {
        try {
          const count = state.sessionLocks.get(sessionId) ?? 0;
          state.sessionLocks.set(sessionId, count + 1);
          await httpTransport.handleRequest(asIncoming(req), asServerResponse(res));
        } finally {
          const count = state.sessionLocks.get(sessionId) ?? 0;
          if (count > 1) {
            state.sessionLocks.set(sessionId, count - 1);
          } else {
            state.sessionLocks.delete(sessionId);
          }
          touchSession(state, sessionId);
        }
      })();
    }
  });

  state.app.delete("/mcp", (req: Request, res: Response): void => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;

    if (sessionId === undefined || !isValidSessionId(sessionId)) {
      res.status(400).send("Invalid or missing session ID");
      return;
    }

    const httpTransport = state.transports.get(sessionId);
    if (httpTransport === undefined) {
      res.status(400).send("Invalid or missing session ID");
      return;
    }

    // H-2: Verify session ownership
    if (!verifySessionOwner(state, sessionId, req.auth?.sub)) {
      res.status(403).send("Forbidden: session belongs to a different client");
      return;
    }

    logger.info("Session termination requested", {
      code: "HTTP_SESSION_DELETE",
      sessionId,
    });

    if (httpTransport !== undefined) {
      void (async () => {
        try {
          const count = state.sessionLocks.get(sessionId) ?? 0;
          state.sessionLocks.set(sessionId, count + 1);
          await httpTransport.handleRequest(asIncoming(req), asServerResponse(res));
        } finally {
          const count = state.sessionLocks.get(sessionId) ?? 0;
          if (count > 1) {
            state.sessionLocks.set(sessionId, count - 1);
          } else {
            state.sessionLocks.delete(sessionId);
          }
          touchSession(state, sessionId);
        }
      })();
    }
  });

  return sessionSweepTimer;
}
