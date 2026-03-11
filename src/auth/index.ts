/**
 * db-mcp - Auth Module Public Exports
 *
 * OAuth 2.0 authentication and authorization components.
 */

// Types
export type * from "./types.js";
export * from "./errors.js";

// Scopes
export * from "./scopes.js";

// Core classes
export {
  OAuthResourceServer,
  createOAuthResourceServer,
} from "./oauth-resource-server.js";
export {
  AuthorizationServerDiscovery,
  createAuthServerDiscovery,
} from "./authorization-server-discovery.js";
export { TokenValidator, createTokenValidator } from "./token-validator.js";

// Middleware
export {
  createAuthMiddleware,
  extractBearerToken,
  requireScope,
  requireAnyScope,
  requireToolScope,
  oauthErrorHandler,
  type AuthMiddlewareConfig,
} from "./middleware.js";
