/**
 * Transport-Agnostic Auth Utilities
 *
 * Non-Express-specific auth utilities for use by any transport
 * (stdio, HTTP, WebSocket, etc.).
 *
 * Re-exports from the middleware module for discoverability.
 */

export { extractBearerToken } from "./middleware/extraction.js";
export {
  createAuthenticatedContext,
  validateAuth,
  formatOAuthError,
  type AuthenticatedContext,
} from "./middleware/core.js";
