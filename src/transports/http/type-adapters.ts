/**
 * HTTP Transport Type Adapters
 *
 * Centralizes the Express ↔ Node.js HTTP type casts needed because
 * Express v5 Request/Response types don't extend http.IncomingMessage /
 * http.ServerResponse at the type level (they do at runtime).
 */

import type { Request, Response } from "express";
import type { IncomingMessage, ServerResponse } from "node:http";

/**
 * Cast Express Request to Node.js IncomingMessage.
 * Safe at runtime — Express Request extends IncomingMessage.
 */
export function asIncoming(req: Request): IncomingMessage {
  return req as unknown as IncomingMessage;
}

/**
 * Cast Express Response to Node.js ServerResponse.
 * Safe at runtime — Express Response extends ServerResponse.
 */
export function asServerResponse(res: Response): ServerResponse {
  return res as unknown as ServerResponse;
}
