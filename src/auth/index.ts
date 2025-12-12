/**
 * db-mcp - Auth Module Public Exports
 * 
 * OAuth 2.0 authentication and authorization components.
 */

// Types
export type * from './types.js';
export * from './errors.js';

// Scopes
export * from './scopes.js';

// Core classes
export { OAuthResourceServer, createOAuthResourceServer } from './OAuthResourceServer.js';
export { AuthorizationServerDiscovery, createAuthServerDiscovery } from './AuthorizationServerDiscovery.js';
export { TokenValidator, createTokenValidator } from './TokenValidator.js';

// Middleware
export {
    createAuthMiddleware,
    extractBearerToken,
    requireScope,
    requireAnyScope,
    requireToolScope,
    oauthErrorHandler,
    type AuthMiddlewareConfig
} from './middleware.js';
