/**
 * db-mcp — OAuth & Auth Types
 *
 * OAuth 2.1 configuration, scopes, token claims, and request context.
 */

// =============================================================================
// OAuth 2.1 Types
// =============================================================================

/**
 * OAuth 2.1 configuration
 */
export interface OAuthConfig {
  /** Enable OAuth authentication */
  enabled: boolean;

  /** Authorization server URL */
  authorizationServerUrl?: string;

  /** Token validation endpoint */
  tokenEndpoint?: string;

  /** JWKS URI for token verification */
  jwksUri?: string;

  /** Expected audience in tokens */
  audience?: string;

  /** Expected issuer in tokens */
  issuer?: string;

  /** Clock tolerance for token validation (seconds) */
  clockTolerance?: number;

  /** JWKS cache TTL (seconds) */
  jwksCacheTtl?: number;

  /** Paths that bypass authentication */
  publicPaths?: string[];
}

/**
 * OAuth scopes for access control
 */
export type OAuthScope =
  | "read" // Read-only access to all databases
  | "write" // Read and write access
  | "admin" // Full administrative access
  | `db:${string}` // Access to specific database
  | `table:${string}:${string}`; // Access to specific table

/**
 * Validated OAuth token claims
 */
export interface TokenClaims {
  /** Subject (user ID) */
  sub: string;

  /** Granted scopes */
  scopes: OAuthScope[];

  /** Token expiration time */
  exp: number;

  /** Token issued at time */
  iat: number;

  /** Token issuer */
  iss?: string;

  /** Token audience */
  aud?: string | string[];

  /** Additional claims */
  [key: string]: unknown;
}

/**
 * Request context with authentication info
 */
export interface RequestContext {
  /** Validated token claims (if authenticated) */
  auth?: TokenClaims;

  /** Raw access token */
  accessToken?: string;

  /** Request timestamp */
  timestamp: Date;

  /** Request ID for tracing */
  requestId: string;

  /**
   * MCP Server instance for sending progress notifications.
   * Only available when running in HTTP/SSE transport with stateful sessions.
   */
  server?: unknown;

  /**
   * Progress token from client request _meta (MCP 2025-11-25).
   * If present, the client has requested progress updates.
   */
  progressToken?: string | number;
}
