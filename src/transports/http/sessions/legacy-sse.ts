/* eslint-disable @typescript-eslint/no-deprecated -- Intentional: SSEServerTransport provides backward compatibility for MCP 2024-11-05 clients */
import type { Request, Response } from "express";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { ERROR_CODES, createModuleLogger } from "../../../utils/logger/index.js";
import type { HttpTransportState } from "../types.js";
import { JSONRPC_SERVER_ERROR } from "../types.js";
import { asIncoming, asServerResponse } from "../type-adapters.js";
import { Mutex } from "./mutex.js";
import { verifySessionOwner } from "./stateful.js";

const logger = createModuleLogger("HTTP");
const connectionMutex = new Mutex();

/**
 * Set up Legacy SSE endpoints for backward compatibility (MCP 2024-11-05)
 */
export function setupLegacySSEEndpoints(state: HttpTransportState): void {
  if (!state.app || !state.mcpServer) return;

  const server = state.mcpServer;

  state.app.get("/sse", (req: Request, res: Response): void => {
    logger.info("Legacy SSE connection requested", {
      code: "SSE_CONNECT",
    });

    const sseTransport = new SSEServerTransport(
      "/messages",
      asServerResponse(res),
    );

    void (async () => {
      try {
        state.sseTransports.set(sseTransport.sessionId, sseTransport);
        // H-2: Bind SSE session to the authenticated identity
        state.sessionOwners.set(sseTransport.sessionId, req.auth?.sub);

        sseTransport.onclose = () => {
          logger.info("Legacy SSE transport closed", {
            code: "SSE_CLOSE",
            sessionId: sseTransport.sessionId,
          });
          state.sseTransports.delete(sseTransport.sessionId);
          state.sessionOwners.delete(sseTransport.sessionId);
        };

        const origSend = sseTransport.send.bind(sseTransport);
        sseTransport.send = async (message) => {
          // H-1: Only log the session ID at debug level. Previously logged
          // JSON.stringify(message).substring(0, 1000) which bypassed the
          // logger's credential redaction and could leak query results.
          logger.debug("SSE SEND", {
            sessionId: sseTransport.sessionId,
          });
          return origSend(message);
        };

        await connectionMutex.acquire().then(async (release) => {
          try {
            if (server.server.transport) {
              const oldTransport = server.server.transport;
              logger.info("Captured oldTransport", {
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
                logger.info("server.close() succeeded");
              } catch (closeErr) {
                logger.error("server.close() failed or timed out", {
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
                  "Manually invoking oldTransport.onclose() to clear Protocol state",
                );
                oldTransport.onclose();
              }

              delete oldTransport.onclose;
            }

            logger.info("Attempting server.connect(sseTransport)");
            await server.connect(sseTransport);
            logger.info("server.connect succeeded");
          } finally {
            release();
          }
        });
      } catch (error: unknown) {
        logger.error("Error starting SSE transport", {
          code: ERROR_CODES.SERVER.TRANSPORT_ERROR.full,
          error: error instanceof Error ? error : undefined,
        });
        if (!res.headersSent) {
          res.status(500).end();
        }
      }
    })();

    req.on("close", () => {
      state.sseTransports.delete(sseTransport.sessionId);
      state.sessionOwners.delete(sseTransport.sessionId);
    });
  });

  state.app.post("/messages", (req: Request, res: Response): void => {
    const sessionId =
      typeof req.query["sessionId"] === "string"
        ? req.query["sessionId"]
        : undefined;

    if (!sessionId) {
      res.status(400).json({
        jsonrpc: "2.0",
        error: {
          code: JSONRPC_SERVER_ERROR,
          message: "Missing sessionId parameter",
        },
        id: null,
      });
      return;
    }

    const sseTransport = state.sseTransports.get(sessionId);
    if (!sseTransport) {
      res.status(404).json({
        jsonrpc: "2.0",
        error: {
          code: JSONRPC_SERVER_ERROR,
          message: "No transport found for sessionId",
        },
        id: null,
      });
      return;
    }

    // H-2: Verify session ownership for legacy SSE /messages
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

    void sseTransport
      .handlePostMessage(
        asIncoming(req),
        asServerResponse(res),
        req.body as unknown,
      )
      .then(() => {
        logger.info("handlePostMessage completed", { sessionId });
      })
      .catch((e: unknown) => {
        logger.error("handlePostMessage error", {
          error: e instanceof Error ? e : new Error(String(e)),
        });
      });
  });
}
