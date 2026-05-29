import type { Request, Response } from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  ERROR_CODES,
  createModuleLogger,
} from "../../../utils/logger/index.js";
import type { HttpTransportState } from "../types.js";
import { JSONRPC_SERVER_ERROR } from "../types.js";
import { asIncoming, asServerResponse } from "../type-adapters.js";
import { DbMcpError } from "../../../utils/errors/base.js";
import { ErrorCategory } from "../../../utils/errors/categories.js";

const logger = createModuleLogger("HTTP");

/**
 * Set up stateless mode endpoints (serverless-compatible)
 */
export async function setupStatelessEndpoints(
  state: HttpTransportState,
): Promise<void> {
  if (!state.app || !state.mcpServer) {
    throw new DbMcpError(
      "Transport or server not initialized",
      ERROR_CODES.SERVER.TRANSPORT_ERROR.full,
      ErrorCategory.INTERNAL,
    );
  }

  state.statelessTransport = new StreamableHTTPServerTransport({
    enableJsonResponse: true,
  });

  state.statelessTransport.onclose ??= () => {
    logger.debug("Stateless transport closed", {
      code: "HTTP_STATELESS_CLOSE",
    });
  };

  await state.mcpServer.connect(
    state.statelessTransport as Parameters<typeof state.mcpServer.connect>[0],
  );
  logger.info("Stateless transport connected", { code: "HTTP_STATELESS" });

  state.app.post("/mcp", (req: Request, res: Response): void => {
    if (!state.statelessTransport) {
      res.status(500).json({ error: "Transport not initialized" });
      return;
    }

    void state.statelessTransport.handleRequest(
      asIncoming(req),
      asServerResponse(res),
      req.body as unknown,
    );
  });

  state.app.get("/mcp", (_req: Request, res: Response): void => {
    res.status(405).json({
      jsonrpc: "2.0",
      error: {
        code: JSONRPC_SERVER_ERROR,
        message: "SSE streaming not available in stateless mode",
      },
      id: null,
    });
  });

  state.app.delete("/mcp", (_req: Request, res: Response): void => {
    res.status(204).end();
  });
}
