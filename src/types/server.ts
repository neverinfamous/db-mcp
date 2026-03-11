/**
 * db-mcp — MCP Server Types
 *
 * Configuration types for the MCP server: transport, port, host,
 * database config references, and server-level options.
 */

import type { DatabaseConfig } from "./database.js";
import type { OAuthConfig } from "./auth.js";

// =============================================================================
// MCP Server Types
// =============================================================================

/**
 * Transport type for MCP communication
 */
export type TransportType = "stdio" | "http" | "sse";

/**
 * MCP Server configuration
 */
export interface McpServerConfig {
  /** Server name */
  name: string;

  /** Server version */
  version: string;

  /** Transport configuration */
  transport: TransportType;

  /** HTTP port (for http/sse transports) */
  port?: number;

  /** Host/IP to bind to (for http/sse transports, default: 0.0.0.0) */
  host?: string;

  /** Database configurations */
  databases: DatabaseConfig[];

  /** OAuth configuration */
  oauth?: OAuthConfig;

  /** Tool filtering configuration */
  toolFilter?: string;

  /**
   * Enable stateless HTTP mode (no session management, no SSE streaming).
   * Ideal for serverless deployments (Lambda, Workers, Vercel).
   * Default: false (stateful mode with session management and SSE support)
   */
  statelessHttp?: boolean;
}
