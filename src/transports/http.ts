/**
 * db-mcp - HTTP Transport
 * 
 * Streamable HTTP transport with OAuth 2.0 integration.
 * Provides a secure HTTP endpoint for MCP communication.
 */

import express, { type Express, type RequestHandler } from 'express';
import cors from 'cors';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { OAuthResourceServer } from '../auth/OAuthResourceServer.js';
import { AuthorizationServerDiscovery } from '../auth/AuthorizationServerDiscovery.js';
import { TokenValidator } from '../auth/TokenValidator.js';
import { createAuthMiddleware, oauthErrorHandler } from '../auth/middleware.js';
import { SUPPORTED_SCOPES } from '../auth/scopes.js';
import { createModuleLogger, ERROR_CODES } from '../utils/logger.js';
import type http from 'node:http';

const logger = createModuleLogger('HTTP');

// =============================================================================
// Types
// =============================================================================

/**
 * HTTP transport configuration
 */
export interface HttpTransportConfig {
    /** Port to listen on */
    port: number;

    /** Host to bind to (default: '0.0.0.0') */
    host?: string;

    /** OAuth configuration */
    oauth: {
        /** Enable OAuth authentication */
        enabled: boolean;

        /** Authorization server URL */
        authorizationServerUrl: string;

        /** Expected audience in tokens */
        audience: string;

        /** Expected issuer (defaults to authorizationServerUrl) */
        issuer?: string;

        /** JWKS URI (auto-discovered if not provided) */
        jwksUri?: string;

        /** Clock tolerance in seconds (default: 60) */
        clockTolerance?: number;

        /** Paths that bypass authentication */
        publicPaths?: string[];
    };

    /** CORS configuration */
    cors?: {
        /** Allowed origins */
        origin?: string | string[] | boolean;

        /** Allowed methods */
        methods?: string[];

        /** Allowed headers */
        allowedHeaders?: string[];

        /** Exposed headers */
        exposedHeaders?: string[];

        /** Allow credentials */
        credentials?: boolean;
    };

    /** Resource URI (defaults to http://localhost:{port}) */
    resourceUri?: string;
}

// =============================================================================
// HTTP Transport
// =============================================================================

/**
 * HTTP Transport for MCP with OAuth 2.0 integration
 */
export class HttpTransport {
    private readonly config: HttpTransportConfig;
    private app: Express | null = null;
    private server: http.Server | null = null;
    private mcpTransport: StreamableHTTPServerTransport | null = null;

    private resourceServer: OAuthResourceServer | null = null;
    private authServerDiscovery: AuthorizationServerDiscovery | null = null;
    private tokenValidator: TokenValidator | null = null;

    constructor(config: HttpTransportConfig) {
        this.config = {
            ...config,
            host: config.host ?? '0.0.0.0'
        };
    }

    /**
     * Initialize the transport
     * 
     * Sets up Express app, OAuth components, and MCP transport.
     * 
     * @returns The MCP StreamableHTTPServerTransport instance
     */
    async initialize(): Promise<StreamableHTTPServerTransport> {
        logger.info('INIT', 'Initializing HTTP transport...');

        // Create Express app
        this.app = express();

        // Configure CORS
        if (this.config.cors) {
            this.app.use(cors(this.config.cors) as RequestHandler);
        } else {
            // Default CORS for development
            this.app.use(cors({
                origin: true,
                methods: ['GET', 'POST', 'OPTIONS'],
                allowedHeaders: ['Authorization', 'Content-Type'],
                credentials: true
            }) as RequestHandler);
        }

        // Parse JSON bodies
        this.app.use(express.json());

        // Determine resource URI
        const resourceUri = this.config.resourceUri ??
            `http://localhost:${String(this.config.port)}`;

        // Set up OAuth if enabled
        if (this.config.oauth.enabled) {
            await this.setupOAuth(resourceUri);
        }

        // Health check endpoint (always public)
        this.app.get('/health', (_req, res) => {
            res.json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                oauth: this.config.oauth.enabled
            });
        });

        // Create MCP transport
        this.mcpTransport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => crypto.randomUUID()
        });

        // Set up MCP endpoint
        this.setupMcpEndpoint();

        // Error handler
        this.app.use(oauthErrorHandler);

        logger.info('INIT_COMPLETE', 'HTTP transport initialized', {
            context: {
                port: this.config.port,
                oauth: this.config.oauth.enabled,
                resourceUri
            }
        });

        return this.mcpTransport;
    }

    /**
     * Set up OAuth 2.0 components
     */
    private async setupOAuth(resourceUri: string): Promise<void> {
        logger.info('OAUTH_SETUP', 'Setting up OAuth 2.0...');

        // Create Resource Server
        this.resourceServer = new OAuthResourceServer({
            resource: resourceUri,
            authorizationServers: [this.config.oauth.authorizationServerUrl],
            scopesSupported: [...SUPPORTED_SCOPES]
        });

        // Serve Protected Resource Metadata endpoint
        this.app?.get(
            '/.well-known/oauth-protected-resource',
            this.resourceServer.getMetadataHandler()
        );

        // Discover authorization server metadata
        this.authServerDiscovery = new AuthorizationServerDiscovery({
            authServerUrl: this.config.oauth.authorizationServerUrl
        });

        try {
            const metadata = await this.authServerDiscovery.discover();

            // Create Token Validator
            this.tokenValidator = new TokenValidator({
                jwksUri: this.config.oauth.jwksUri ?? metadata.jwks_uri ?? '',
                issuer: this.config.oauth.issuer ?? metadata.issuer,
                audience: this.config.oauth.audience,
                clockTolerance: this.config.oauth.clockTolerance
            });

            logger.info('OAUTH_READY', 'OAuth 2.0 setup complete');
        } catch (error) {
            // If discovery fails, we can still start without OAuth validation
            // This allows the server to start and return proper errors to clients
            logger.warning(
                ERROR_CODES.AUTH.DISCOVERY_FAILED,
                'Authorization server discovery failed. OAuth validation disabled.',
                { error: error instanceof Error ? error : undefined }
            );

            // Create a dummy token validator that always fails
            // This ensures requests still get proper 401 responses
            if (!this.config.oauth.jwksUri) {
                logger.error(
                    ERROR_CODES.AUTH.DISCOVERY_FAILED,
                    'No JWKS URI available. Please provide oauth.jwksUri in config.',
                    {}
                );
                throw error;
            }

            this.tokenValidator = new TokenValidator({
                jwksUri: this.config.oauth.jwksUri,
                issuer: this.config.oauth.issuer ?? this.config.oauth.authorizationServerUrl,
                audience: this.config.oauth.audience,
                clockTolerance: this.config.oauth.clockTolerance
            });
        }
    }

    /**
     * Set up the MCP endpoint with authentication
     */
    private setupMcpEndpoint(): void {
        if (!this.app || !this.mcpTransport) {
            throw new Error('Transport not initialized');
        }

        // Apply auth middleware if OAuth is enabled
        if (this.config.oauth.enabled && this.tokenValidator && this.resourceServer) {
            const authMiddleware = createAuthMiddleware({
                tokenValidator: this.tokenValidator,
                resourceServer: this.resourceServer,
                publicPaths: [
                    '/health',
                    ...(this.config.oauth.publicPaths ?? [])
                ]
            });

            this.app.use(authMiddleware);
        }

        // MCP message endpoint
        // Note: We use type assertion here because Express extends IncomingMessage
        // but the SDK's type definition is stricter about the auth property
        this.app.post('/mcp', async (req, res) => {
            if (!this.mcpTransport) {
                res.status(500).json({ error: 'Transport not initialized' });
                return;
            }

            try {
                // Cast to unknown first to avoid direct type incompatibility
                await this.mcpTransport.handleRequest(
                    req as unknown as Parameters<typeof this.mcpTransport.handleRequest>[0],
                    res,
                    req.body as unknown
                );
            } catch (error) {
                logger.error(
                    ERROR_CODES.SERVER.TRANSPORT_ERROR,
                    'Error handling MCP request',
                    { error: error instanceof Error ? error : undefined }
                );

                if (!res.headersSent) {
                    res.status(500).json({
                        error: 'internal_error',
                        error_description: 'Failed to process MCP request'
                    });
                }
            }
        });

        // Handle DELETE for session cleanup (if needed by StreamableHTTP)
        this.app.delete('/mcp', async (req, res) => {
            if (!this.mcpTransport) {
                res.status(500).json({ error: 'Transport not initialized' });
                return;
            }

            try {
                await this.mcpTransport.handleRequest(
                    req as unknown as Parameters<typeof this.mcpTransport.handleRequest>[0],
                    res,
                    req.body as unknown
                );
            } catch (error) {
                logger.error(
                    ERROR_CODES.SERVER.TRANSPORT_ERROR,
                    'Error handling MCP DELETE request',
                    { error: error instanceof Error ? error : undefined }
                );

                if (!res.headersSent) {
                    res.status(500).json({
                        error: 'internal_error',
                        error_description: 'Failed to process MCP request'
                    });
                }
            }
        });
    }

    /**
     * Start listening on the configured port
     */
    async start(): Promise<void> {
        if (!this.app) {
            throw new Error('Transport not initialized. Call initialize() first.');
        }

        return new Promise((resolve, reject) => {
            try {
                this.server = this.app?.listen(this.config.port, this.config.host ?? '0.0.0.0', () => {
                    logger.info('SERVER_STARTED', `HTTP server listening on ${this.config.host ?? '0.0.0.0'}:${String(this.config.port)}`);
                    resolve();
                }) ?? null;

                this.server?.on('error', (error) => {
                    logger.error(
                        ERROR_CODES.SERVER.START_FAILED,
                        'Failed to start HTTP server',
                        { error }
                    );
                    reject(error);
                });
            } catch (error) {
                reject(error instanceof Error ? error : new Error(String(error)));
            }
        });
    }

    /**
     * Stop the server
     */
    async stop(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!this.server) {
                resolve();
                return;
            }

            this.server.close((error) => {
                if (error) {
                    logger.error(
                        ERROR_CODES.SERVER.SHUTDOWN_FAILED,
                        'Error stopping HTTP server',
                        { error }
                    );
                    reject(error);
                } else {
                    logger.info('SERVER_STOPPED', 'HTTP server stopped');
                    resolve();
                }
            });
        });
    }

    /**
     * Get the underlying Express app
     */
    getApp(): Express | null {
        return this.app;
    }

    /**
     * Get the MCP transport
     */
    getMcpTransport(): StreamableHTTPServerTransport | null {
        return this.mcpTransport;
    }

    /**
     * Get the OAuth Resource Server
     */
    getResourceServer(): OAuthResourceServer | null {
        return this.resourceServer;
    }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create an HTTP transport instance
 */
export function createHttpTransport(config: HttpTransportConfig): HttpTransport {
    return new HttpTransport(config);
}
