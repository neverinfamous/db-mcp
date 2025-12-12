/**
 * db-mcp - Token Validator
 * 
 * JWT access token validation using JWKS for signature verification.
 * Supports RSA and EC algorithms commonly used with OAuth 2.0.
 */

import * as jose from 'jose';
import type {
    TokenValidationResult,
    TokenClaims,
    TokenValidatorConfig
} from './types.js';
import {
    InvalidTokenError,
    TokenExpiredError,
    InvalidSignatureError,
    JwksFetchError
} from './errors.js';
import { parseScopes } from './scopes.js';
import { createModuleLogger, ERROR_CODES } from '../utils/logger.js';

const logger = createModuleLogger('AUTH');

// =============================================================================
// Token Validator
// =============================================================================

/**
 * JWT Token Validator
 * 
 * Validates OAuth 2.0 access tokens using JWKS for signature verification.
 */
export class TokenValidator {
    /** Resolved configuration with all defaults applied */
    private readonly jwksUri: string;
    private readonly issuer: string;
    private readonly audience: string;
    private readonly clockTolerance: number;
    private readonly jwksCacheTtl: number;

    private jwks: jose.JWTVerifyGetKey | null = null;
    private jwksExpiry = 0;

    constructor(config: TokenValidatorConfig) {
        this.jwksUri = config.jwksUri;
        this.issuer = config.issuer;
        this.audience = config.audience;
        this.clockTolerance = config.clockTolerance ?? 60;
        this.jwksCacheTtl = config.jwksCacheTtl ?? 3600;

        logger.info('INIT', `Token Validator initialized for issuer: ${this.issuer}`);
    }

    /**
     * Validate an access token
     * 
     * @param token - The JWT access token
     * @returns Validation result with claims or error
     */
    async validate(token: string): Promise<TokenValidationResult> {
        try {
            // Get or refresh JWKS
            const jwks = this.getJwks();

            // Verify the token
            const { payload } = await jose.jwtVerify(token, jwks, {
                issuer: this.issuer,
                audience: this.audience,
                clockTolerance: this.clockTolerance
            });

            // Extract and normalize claims
            const claims = this.extractClaims(payload);

            logger.info('TOKEN_VALID', `Token validated for subject: ${claims.sub}`, {
                context: {
                    sub: claims.sub,
                    scopes: claims.scopes.length,
                    exp: new Date(claims.exp * 1000).toISOString()
                }
            });

            return {
                valid: true,
                claims
            };
        } catch (error) {
            return this.handleValidationError(error);
        }
    }

    /**
     * Get or refresh the JWKS
     */
    private getJwks(): jose.JWTVerifyGetKey {
        // Check if JWKS is cached and valid
        if (this.jwks && Date.now() < this.jwksExpiry) {
            return this.jwks;
        }

        logger.info('JWKS_FETCH', `Fetching JWKS from: ${this.jwksUri}`);

        try {
            // Create JWKS remote key set
            this.jwks = jose.createRemoteJWKSet(new URL(this.jwksUri), {
                cooldownDuration: 30000,  // 30 seconds between retries
                cacheMaxAge: this.jwksCacheTtl * 1000
            });

            this.jwksExpiry = Date.now() + (this.jwksCacheTtl * 1000);

            logger.info('JWKS_CACHED', `JWKS cached for ${String(this.jwksCacheTtl)}s`);

            return this.jwks;
        } catch (error) {
            const cause = error instanceof Error ? error : new Error(String(error));

            logger.error(
                ERROR_CODES.AUTH.JWKS_FETCH_FAILED,
                `Failed to fetch JWKS: ${this.jwksUri}`,
                { error: cause }
            );

            throw new JwksFetchError(this.jwksUri, cause);
        }
    }

    /**
     * Extract and normalize token claims
     */
    private extractClaims(payload: jose.JWTPayload): TokenClaims {
        // Get scopes from 'scope' claim (space-delimited) or 'scopes' claim (array)
        let scopes: string[] = [];

        if (typeof payload['scope'] === 'string') {
            scopes = parseScopes(payload['scope']);
        } else if (Array.isArray(payload['scopes'])) {
            scopes = payload['scopes'].filter((s): s is string => typeof s === 'string');
        } else if (Array.isArray(payload['scope'])) {
            scopes = payload['scope'].filter((s): s is string => typeof s === 'string');
        }

        return {
            sub: payload.sub ?? 'unknown',
            scopes,
            exp: payload.exp ?? 0,
            iat: payload.iat ?? 0,
            iss: payload.iss,
            aud: payload.aud,
            nbf: payload.nbf ?? undefined,
            jti: payload.jti,
            client_id: payload['client_id'] as string | undefined,
            // Include all other claims
            ...payload
        };
    }

    /**
     * Handle validation errors and convert to TokenValidationResult
     */
    private handleValidationError(error: unknown): TokenValidationResult {
        // Handle jose-specific errors
        if (error instanceof jose.errors.JWTExpired) {
            logger.warning(
                ERROR_CODES.AUTH.TOKEN_EXPIRED,
                'Token has expired',
                { error: error as Error }
            );

            return {
                valid: false,
                error: 'Token has expired',
                errorCode: ERROR_CODES.AUTH.TOKEN_EXPIRED.full
            };
        }

        if (error instanceof jose.errors.JWTClaimValidationFailed) {
            logger.warning(
                ERROR_CODES.AUTH.TOKEN_INVALID,
                `Token claim validation failed: ${error.message}`,
                { error }
            );

            return {
                valid: false,
                error: `Token claim validation failed: ${error.message}`,
                errorCode: ERROR_CODES.AUTH.TOKEN_INVALID.full
            };
        }

        if (error instanceof jose.errors.JWSSignatureVerificationFailed) {
            logger.warning(
                ERROR_CODES.AUTH.SIGNATURE_INVALID,
                'Token signature verification failed',
                { error }
            );

            return {
                valid: false,
                error: 'Token signature verification failed',
                errorCode: ERROR_CODES.AUTH.SIGNATURE_INVALID.full
            };
        }

        if (error instanceof jose.errors.JWKSNoMatchingKey) {
            logger.warning(
                ERROR_CODES.AUTH.TOKEN_INVALID,
                'No matching key found in JWKS',
                { error }
            );

            return {
                valid: false,
                error: 'No matching key found in JWKS',
                errorCode: ERROR_CODES.AUTH.TOKEN_INVALID.full
            };
        }

        // Handle other errors
        const message = error instanceof Error ? error.message : String(error);

        logger.error(
            ERROR_CODES.AUTH.TOKEN_INVALID,
            `Token validation failed: ${message}`,
            { error: error instanceof Error ? error : undefined }
        );

        return {
            valid: false,
            error: `Token validation failed: ${message}`,
            errorCode: ERROR_CODES.AUTH.TOKEN_INVALID.full
        };
    }

    /**
     * Refresh the JWKS cache
     */
    refreshJwks(): void {
        this.jwks = null;
        this.jwksExpiry = 0;
        this.getJwks();
        logger.info('JWKS_REFRESHED', 'JWKS cache refreshed');
    }

    /**
     * Clear the JWKS cache
     */
    clearCache(): void {
        this.jwks = null;
        this.jwksExpiry = 0;
        logger.info('CACHE_CLEARED', 'Token validator cache cleared');
    }

    /**
     * Convert a validation error to the appropriate OAuth error class
     */
    static toOAuthError(result: TokenValidationResult): InvalidTokenError | TokenExpiredError | InvalidSignatureError {
        if (result.errorCode === ERROR_CODES.AUTH.TOKEN_EXPIRED.full) {
            return new TokenExpiredError();
        }

        if (result.errorCode === ERROR_CODES.AUTH.SIGNATURE_INVALID.full) {
            return new InvalidSignatureError();
        }

        return new InvalidTokenError(result.error);
    }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a Token Validator instance
 */
export function createTokenValidator(config: TokenValidatorConfig): TokenValidator {
    return new TokenValidator(config);
}
