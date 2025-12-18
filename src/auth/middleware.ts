/**
 * db-mcp - OAuth Middleware
 * 
 * Express middleware for OAuth 2.0 authentication and authorization.
 * Extracts Bearer tokens, validates them, and enforces scope requirements.
 */

import type { Request, Response, NextFunction, RequestHandler } from 'express';
import type { TokenClaims } from './types.js';
import type { TokenValidator } from './TokenValidator.js';
import type { OAuthResourceServer } from './OAuthResourceServer.js';
import {
    TokenMissingError,
    InvalidTokenError,
    InsufficientScopeError,
    isOAuthError
} from './errors.js';
import { scopesGrantToolAccess } from './scopes.js';
import { createModuleLogger, ERROR_CODES } from '../utils/logger.js';

const logger = createModuleLogger('AUTH');

// =============================================================================
// Express Type Extensions
// =============================================================================

/**
 * Extended Express Request with auth context
 */
declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace Express {
        interface Request {
            /** Authenticated user claims */
            auth?: TokenClaims;
            /** Raw access token */
            accessToken?: string;
            /** Request ID for tracing */
            requestId?: string;
        }
    }
}

// =============================================================================
// Configuration
// =============================================================================

/**
 * Auth middleware configuration
 */
export interface AuthMiddlewareConfig {
    /** Token validator instance */
    tokenValidator: TokenValidator;

    /** Resource server instance (for WWW-Authenticate header) */
    resourceServer: OAuthResourceServer;

    /** Paths that bypass authentication (e.g., '/.well-known/*', '/health') */
    publicPaths?: string[];
}

// =============================================================================
// Token Extraction
// =============================================================================

/**
 * Extract Bearer token from Authorization header
 * 
 * @param authHeader - Authorization header value
 * @returns The token or null if not present/invalid
 */
export function extractBearerToken(authHeader: string | undefined): string | null {
    if (!authHeader) {
        return null;
    }

    // Check for Bearer scheme (case-insensitive)
    const parts = authHeader.split(' ');
    const scheme = parts[0];
    const tokenPart = parts[1];
    if (parts.length !== 2 || scheme === undefined || scheme.toLowerCase() !== 'bearer') {
        return null;
    }

    if (tokenPart === undefined) {
        return null;
    }

    const token = tokenPart.trim();
    return token.length > 0 ? token : null;
}

// =============================================================================
// Path Matching
// =============================================================================

/**
 * Check if a path matches any of the public path patterns
 * 
 * Supports:
 * - Exact matches: '/health' matches '/health'
 * - Wildcard suffix: '/api/*' matches '/api/users', '/api/posts/1'
 * - Well-known paths are always public
 */
function isPublicPath(path: string, publicPaths: string[]): boolean {
    // Well-known paths are always public (RFC requirement)
    if (path.startsWith('/.well-known/')) {
        return true;
    }

    for (const pattern of publicPaths) {
        // Exact match
        if (pattern === path) {
            return true;
        }

        // Wildcard match
        if (pattern.endsWith('/*')) {
            const prefix = pattern.slice(0, -2);
            if (path === prefix || path.startsWith(prefix + '/')) {
                return true;
            }
        }
    }

    return false;
}

// =============================================================================
// Main Authentication Middleware
// =============================================================================

/**
 * Create the main authentication middleware
 * 
 * This middleware:
 * 1. Skips authentication for public paths (e.g., /.well-known/*)
 * 2. Extracts Bearer token from Authorization header
 * 3. Validates the token using the TokenValidator
 * 4. Attaches validated claims to req.auth
 * 5. Returns 401 with WWW-Authenticate header on failure
 */
export function createAuthMiddleware(config: AuthMiddlewareConfig): RequestHandler {
    const { tokenValidator, resourceServer, publicPaths = [] } = config;

    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        // Generate request ID for tracing
        const requestId = crypto.randomUUID();
        req.requestId = requestId;

        // Check if path is public
        if (isPublicPath(req.path, publicPaths)) {
            logger.info(`Public path accessed: ${req.path}`, {
                code: 'AUTH_PUBLIC_PATH',
                requestId,
                path: req.path
            });
            next();
            return;
        }

        // Extract Bearer token
        const token = extractBearerToken(req.headers.authorization);

        if (!token) {
            const error = new TokenMissingError(resourceServer.getResourceUri());

            logger.warning(
                'No access token provided',
                { code: ERROR_CODES.AUTH.TOKEN_MISSING.full, requestId, path: req.path }
            );

            res.status(error.httpStatus);
            res.setHeader('WWW-Authenticate', error.wwwAuthenticate ?? '');
            res.json({
                error: 'unauthorized',
                error_description: error.message
            });
            return;
        }

        // Validate token
        const result = await tokenValidator.validate(token);

        if (!result.valid) {
            // Create error for logging (variable intentionally used only for type check)
            new InvalidTokenError(result.error);

            logger.warning(
                `Token validation failed: ${result.error ?? 'Unknown error'}`,
                { code: result.errorCode ?? ERROR_CODES.AUTH.TOKEN_INVALID.full, requestId, path: req.path }
            );

            res.status(401);
            res.setHeader('WWW-Authenticate', resourceServer.getWWWAuthenticateHeader(
                'invalid_token',
                result.error
            ));
            res.json({
                error: 'invalid_token',
                error_description: result.error
            });
            return;
        }

        // Attach claims to request (claims is guaranteed defined when valid is true)
        const claims = result.claims;
        if (!claims) {
            // Should not happen when valid is true, but satisfies TypeScript
            res.status(500).json({ error: 'internal_error' });
            return;
        }
        req.auth = claims;
        req.accessToken = token;

        logger.info(`Request authenticated: ${claims.sub}`, {
            code: 'AUTH_SUCCESS',
            requestId,
            sub: claims.sub,
            scopes: claims.scopes.length,
            path: req.path
        });

        next();
    };
}

// =============================================================================
// Scope Enforcement Middleware
// =============================================================================

/**
 * Middleware factory that requires a specific scope
 * 
 * @param scope - Required scope
 * @returns Express middleware
 */
export function requireScope(scope: string): RequestHandler {
    return (req: Request, res: Response, next: NextFunction): void => {
        if (!req.auth) {
            // Should not happen if auth middleware is applied first
            res.status(401).json({
                error: 'unauthorized',
                error_description: 'Authentication required'
            });
            return;
        }

        const hasScope = req.auth.scopes.includes(scope) ||
            req.auth.scopes.includes('admin'); // Admin scope grants all

        if (!hasScope) {
            const error = new InsufficientScopeError(scope, req.auth.scopes);

            logger.warning(
                `Insufficient scope: required ${scope}`,
                {
                    code: ERROR_CODES.AUTH.SCOPE_DENIED.full,
                    requestId: req.requestId,
                    requiredScope: scope,
                    providedScopes: req.auth.scopes
                }
            );

            res.status(error.httpStatus);
            res.setHeader('WWW-Authenticate', error.wwwAuthenticate ?? '');
            res.json({
                error: 'insufficient_scope',
                error_description: error.message,
                required_scope: scope
            });
            return;
        }

        next();
    };
}

/**
 * Middleware factory that requires any of the specified scopes
 * 
 * @param scopes - Array of acceptable scopes (user must have at least one)
 * @returns Express middleware
 */
export function requireAnyScope(scopes: string[]): RequestHandler {
    return (req: Request, res: Response, next: NextFunction): void => {
        if (!req.auth) {
            res.status(401).json({
                error: 'unauthorized',
                error_description: 'Authentication required'
            });
            return;
        }

        // Admin scope grants all
        if (req.auth.scopes.includes('admin')) {
            next();
            return;
        }

        const hasAnyScope = scopes.some(scope => req.auth?.scopes.includes(scope));

        if (!hasAnyScope) {
            const error = new InsufficientScopeError(scopes, req.auth.scopes);

            logger.warning(
                `Insufficient scope: required one of [${scopes.join(', ')}]`,
                {
                    code: ERROR_CODES.AUTH.SCOPE_DENIED.full,
                    requestId: req.requestId,
                    requiredScopes: scopes,
                    providedScopes: req.auth.scopes
                }
            );

            res.status(error.httpStatus);
            res.setHeader('WWW-Authenticate', error.wwwAuthenticate ?? '');
            res.json({
                error: 'insufficient_scope',
                error_description: error.message,
                required_scopes: scopes
            });
            return;
        }

        next();
    };
}

/**
 * Middleware factory that requires scope for a specific tool
 * 
 * @param toolName - Name of the tool being accessed
 * @returns Express middleware
 */
export function requireToolScope(toolName: string): RequestHandler {
    return (req: Request, res: Response, next: NextFunction): void => {
        if (!req.auth) {
            res.status(401).json({
                error: 'unauthorized',
                error_description: 'Authentication required'
            });
            return;
        }

        const hasAccess = scopesGrantToolAccess(req.auth.scopes, toolName);

        if (!hasAccess) {
            const error = new InsufficientScopeError(
                `Tool access: ${toolName}`,
                req.auth.scopes
            );

            logger.warning(
                `Insufficient scope for tool: ${toolName}`,
                {
                    code: ERROR_CODES.AUTH.SCOPE_DENIED.full,
                    requestId: req.requestId,
                    toolName,
                    providedScopes: req.auth.scopes
                }
            );

            res.status(error.httpStatus);
            res.setHeader('WWW-Authenticate', error.wwwAuthenticate ?? '');
            res.json({
                error: 'insufficient_scope',
                error_description: `Access to tool '${toolName}' denied`,
                tool: toolName
            });
            return;
        }

        next();
    };
}

// =============================================================================
// Error Handler
// =============================================================================

/**
 * Error handler middleware for OAuth errors
 * 
 * Should be added after all routes to catch OAuth-related errors
 */
export function oauthErrorHandler(
    error: Error,
    _req: Request,
    res: Response,
    next: NextFunction
): void {
    if (isOAuthError(error)) {
        res.status(error.httpStatus);

        if (error.wwwAuthenticate) {
            res.setHeader('WWW-Authenticate', error.wwwAuthenticate);
        }

        res.json({
            error: error.code,
            error_description: error.message
        });
        return;
    }

    // Pass to next error handler
    next(error);
}
