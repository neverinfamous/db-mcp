/* eslint-disable @typescript-eslint/no-deprecated -- Intentional: SSEServerTransport provides backward compatibility for MCP 2024-11-05 clients */
/**
 * HTTP Transport Types
 *
 * Shared interfaces and constants for the HTTP transport module.
 */

import type { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { OAuthResourceServer } from "../../auth/oauth-resource-server.js";
import type { AuthorizationServerDiscovery } from "../../auth/authorization-server-discovery.js";
import type { TokenValidator } from "../../auth/token-validator.js";
import type http from "node:http";
import type { Express } from "express";

// =============================================================================
// Rate Limiting
// =============================================================================

export interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export const DEFAULT_RATE_LIMIT_WINDOW_MS = 60_000;
export const DEFAULT_RATE_LIMIT_MAX = 100;
export const DEFAULT_MAX_BODY_BYTES = 1_048_576; // 1 MB
export const DEFAULT_HSTS_MAX_AGE = 31_536_000; // 1 year

/** HTTP request timeout (ms) — prevents slowloris-style DoS */
export const HTTP_REQUEST_TIMEOUT_MS = 120_000;
/** Keep-alive timeout (ms) — slightly above common LB idle timeout */
export const HTTP_KEEP_ALIVE_TIMEOUT_MS = 65_000;
/** Headers timeout (ms) — must be > keepAliveTimeout per Node.js docs */
export const HTTP_HEADERS_TIMEOUT_MS = 66_000;

// =============================================================================
// Configuration
// =============================================================================

/**
 * HTTP transport configuration
 */
export interface HttpTransportConfig {
  /** Port to listen on */
  port: number;

  /** Host to bind to (default: '0.0.0.0') */
  host?: string;

  /**
   * Enable stateless HTTP mode (no session management, no SSE streaming).
   * Ideal for serverless deployments (Lambda, Workers, Vercel).
   * Default: false (stateful mode with session management and SSE support)
   */
  stateless?: boolean;

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

  /**
   * Allowed CORS origins. Defaults to ["*"] (all origins).
   * Supports wildcard subdomains (e.g., "*.example.com" matches "app.example.com").
   * Set to specific origins for production deployments.
   */
  corsOrigins?: string[];

  /** Maximum request body size in bytes (default: 1 MB) */
  maxBodyBytes?: number;

  /**
   * Trust proxy headers for client IP extraction (default: false).
   * When enabled, uses the leftmost IP from X-Forwarded-For for rate limiting.
   * Only enable when running behind a trusted reverse proxy.
   */
  trustProxy?: boolean;

  /**
   * Enable HTTP Strict Transport Security header (default: false).
   * Should only be enabled when running behind HTTPS.
   */
  enableHSTS?: boolean;

  /**
   * HSTS max-age in seconds (default: 31536000 = 1 year).
   * Only used when enableHSTS is true.
   */
  hstsMaxAge?: number;

  /** Resource URI (defaults to http://localhost:{port}) */
  resourceUri?: string;
}

// =============================================================================
// Internal State
// =============================================================================

/**
 * Internal state shared across HTTP transport modules.
 * Passed to setup functions so they can access and modify transport state.
 */
export interface HttpTransportState {
  readonly config: HttpTransportConfig;
  app: Express | null;
  httpServer: http.Server | null;

  // Streamable HTTP session storage (stateful mode)
  transports: Map<string, StreamableHTTPServerTransport>;

  // Legacy SSE session storage
  sseTransports: Map<string, SSEServerTransport>;

  // Single transport for stateless mode
  statelessTransport: StreamableHTTPServerTransport | null;

  // OAuth components
  resourceServer: OAuthResourceServer | null;
  authServerDiscovery: AuthorizationServerDiscovery | null;
  tokenValidator: TokenValidator | null;

  // Reference to the MCP server for stateful connections
  mcpServer: McpServer | null;

  // Rate limiting state
  rateLimitMap: Map<string, RateLimitEntry>;
  rateLimitCleanupTimer: ReturnType<typeof setInterval> | null;
}
