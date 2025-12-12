/**
 * db-mcp - OAuth Error Classes
 * 
 * Module-prefixed error classes for OAuth 2.0 authentication
 * and authorization failures.
 */

import { DbMcpError } from '../types/index.js';
import { ERROR_CODES } from '../utils/logger.js';

// =============================================================================
// Base OAuth Error
// =============================================================================

/**
 * Base class for OAuth-related errors
 */
export class OAuthError extends DbMcpError {
    /** HTTP status code for this error */
    readonly httpStatus: number;

    /** WWW-Authenticate header value */
    readonly wwwAuthenticate?: string | undefined;

    constructor(
        message: string,
        code: string,
        httpStatus: number,
        details?: Record<string, unknown>,
        wwwAuthenticate?: string
    ) {
        super(message, code, details);
        this.name = 'OAuthError';
        this.httpStatus = httpStatus;
        this.wwwAuthenticate = wwwAuthenticate;
    }
}

// =============================================================================
// Authentication Errors (401)
// =============================================================================

/**
 * Token is missing from the request
 */
export class TokenMissingError extends OAuthError {
    constructor(realm = 'db-mcp') {
        super(
            'No access token provided',
            ERROR_CODES.AUTH.TOKEN_MISSING.full,
            401,
            undefined,
            `Bearer realm="${realm}"`
        );
        this.name = 'TokenMissingError';
    }
}

/**
 * Token is invalid (malformed, wrong format, etc.)
 */
export class InvalidTokenError extends OAuthError {
    constructor(message = 'Invalid access token', details?: Record<string, unknown>) {
        super(
            message,
            ERROR_CODES.AUTH.TOKEN_INVALID.full,
            401,
            details,
            'Bearer error="invalid_token"'
        );
        this.name = 'InvalidTokenError';
    }
}

/**
 * Token has expired
 */
export class TokenExpiredError extends OAuthError {
    constructor(expiredAt?: Date) {
        super(
            'Access token has expired',
            ERROR_CODES.AUTH.TOKEN_EXPIRED.full,
            401,
            expiredAt ? { expiredAt: expiredAt.toISOString() } : undefined,
            'Bearer error="invalid_token", error_description="Token has expired"'
        );
        this.name = 'TokenExpiredError';
    }
}

/**
 * Token signature is invalid
 */
export class InvalidSignatureError extends OAuthError {
    constructor(message = 'Token signature verification failed') {
        super(
            message,
            ERROR_CODES.AUTH.SIGNATURE_INVALID.full,
            401,
            undefined,
            'Bearer error="invalid_token", error_description="Signature verification failed"'
        );
        this.name = 'InvalidSignatureError';
    }
}

// =============================================================================
// Authorization Errors (403)
// =============================================================================

/**
 * Token does not have required scope
 */
export class InsufficientScopeError extends OAuthError {
    constructor(requiredScope: string | string[], providedScopes?: string[]) {
        const required = Array.isArray(requiredScope) ? requiredScope : [requiredScope];
        const scopeValue = required.join(' ');

        super(
            `Insufficient scope. Required: ${scopeValue}`,
            ERROR_CODES.AUTH.SCOPE_DENIED.full,
            403,
            { requiredScope: required, providedScopes },
            `Bearer error="insufficient_scope", scope="${scopeValue}"`
        );
        this.name = 'InsufficientScopeError';
    }
}

// =============================================================================
// Server Errors (500)
// =============================================================================

/**
 * Failed to discover authorization server metadata
 */
export class AuthServerDiscoveryError extends OAuthError {
    constructor(serverUrl: string, cause?: Error) {
        super(
            `Failed to discover authorization server metadata: ${serverUrl}`,
            ERROR_CODES.AUTH.DISCOVERY_FAILED.full,
            500,
            {
                serverUrl,
                cause: cause?.message
            }
        );
        this.name = 'AuthServerDiscoveryError';
    }
}

/**
 * Failed to fetch JWKS
 */
export class JwksFetchError extends OAuthError {
    constructor(jwksUri: string, cause?: Error) {
        super(
            `Failed to fetch JWKS: ${jwksUri}`,
            ERROR_CODES.AUTH.JWKS_FETCH_FAILED.full,
            500,
            {
                jwksUri,
                cause: cause?.message
            }
        );
        this.name = 'JwksFetchError';
    }
}

/**
 * Failed to register client
 */
export class ClientRegistrationError extends OAuthError {
    constructor(message: string, details?: Record<string, unknown>) {
        super(
            message,
            ERROR_CODES.AUTH.REGISTRATION_FAILED.full,
            500,
            details
        );
        this.name = 'ClientRegistrationError';
    }
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Check if an error is an OAuth error
 */
export function isOAuthError(error: unknown): error is OAuthError {
    return error instanceof OAuthError;
}

/**
 * Get WWW-Authenticate header for an OAuth error
 */
export function getWWWAuthenticateHeader(error: OAuthError, realm = 'db-mcp'): string {
    return error.wwwAuthenticate ?? `Bearer realm="${realm}"`;
}
