/**
 * db-mcp - OAuth Protected Resource Server (RFC 9728)
 * 
 * Implements the OAuth 2.0 Protected Resource Metadata endpoint
 * as specified in RFC 9728.
 * 
 * @see https://datatracker.ietf.org/doc/html/rfc9728
 */

import type { RequestHandler } from 'express';
import type {
    ProtectedResourceMetadata,
    ResourceServerConfig
} from './types.js';
import { SUPPORTED_SCOPES } from './scopes.js';
import { createModuleLogger } from '../utils/logger.js';

const logger = createModuleLogger('AUTH');

// =============================================================================
// OAuth Resource Server
// =============================================================================

/**
 * OAuth 2.0 Protected Resource Server
 * 
 * Provides Protected Resource Metadata (RFC 9728) for MCP authorization.
 */
export class OAuthResourceServer {
    private readonly config: Required<ResourceServerConfig>;
    private metadata: ProtectedResourceMetadata | null = null;

    constructor(config: ResourceServerConfig) {
        this.config = {
            resource: config.resource,
            authorizationServers: config.authorizationServers,
            scopesSupported: config.scopesSupported.length > 0
                ? config.scopesSupported
                : [...SUPPORTED_SCOPES],
            bearerMethodsSupported: config.bearerMethodsSupported ?? ['header']
        };

        logger.info('INIT', `OAuth Resource Server initialized for: ${this.config.resource}`);
    }

    /**
     * Get the Protected Resource Metadata document
     * 
     * @returns RFC 9728 compliant metadata
     */
    getMetadata(): ProtectedResourceMetadata {
        this.metadata ??= this.buildMetadata();
        return this.metadata;
    }

    /**
     * Build the Protected Resource Metadata document
     */
    private buildMetadata(): ProtectedResourceMetadata {
        return {
            resource: this.config.resource,
            authorization_servers: this.config.authorizationServers,
            scopes_supported: this.config.scopesSupported,
            bearer_methods_supported: this.config.bearerMethodsSupported
        };
    }

    /**
     * Get Express request handler for the metadata endpoint
     * 
     * Serves: GET /.well-known/oauth-protected-resource
     */
    getMetadataHandler(): RequestHandler {
        return (_req, res) => {
            const metadata = this.getMetadata();

            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Cache-Control', 'public, max-age=3600');
            res.json(metadata);

            logger.info('METADATA_SERVED', 'Protected Resource Metadata served');
        };
    }

    /**
     * Generate WWW-Authenticate header for 401 responses
     * 
     * @param error - Error type for the header
     * @param errorDescription - Human-readable error description
     * @returns WWW-Authenticate header value
     */
    getWWWAuthenticateHeader(error?: string, errorDescription?: string): string {
        const parts = [`Bearer realm="${this.config.resource}"`];

        if (error) {
            parts.push(`error="${error}"`);
        }

        if (errorDescription) {
            parts.push(`error_description="${errorDescription}"`);
        }

        return parts.join(', ');
    }

    /**
     * Get the resource URI
     */
    getResourceUri(): string {
        return this.config.resource;
    }

    /**
     * Get the authorization servers
     */
    getAuthorizationServers(): string[] {
        return [...this.config.authorizationServers];
    }

    /**
     * Get supported scopes
     */
    getSupportedScopes(): string[] {
        return [...this.config.scopesSupported];
    }

    /**
     * Clear cached metadata (useful when configuration changes)
     */
    clearCache(): void {
        this.metadata = null;
    }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create an OAuth Resource Server instance
 */
export function createOAuthResourceServer(config: ResourceServerConfig): OAuthResourceServer {
    return new OAuthResourceServer(config);
}
