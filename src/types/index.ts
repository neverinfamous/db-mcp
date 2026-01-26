/**
 * db-mcp - SQLite MCP Server
 *
 * Core type definitions for the MCP server, database adapters,
 * OAuth 2.0 authentication, and tool filtering.
 */

// =============================================================================
// Database Types
// =============================================================================

/**
 * Supported database types
 *
 * Note: This MCP server only supports SQLite. Other database types are listed
 * here for type compatibility but would require separate MCP server projects.
 */
export type DatabaseType =
  | "sqlite"
  | "postgresql"
  | "mysql"
  | "mongodb"
  | "redis"
  | "sqlserver";

/**
 * Database connection configuration
 */
export interface DatabaseConfig {
  /** Database type identifier */
  type: DatabaseType;

  /** Connection string (format varies by database type) */
  connectionString?: string;

  /** Individual connection parameters (alternative to connectionString) */
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string;

  /** Additional database-specific options */
  options?: Record<string, unknown>;
}

/**
 * Database connection health status
 */
export interface HealthStatus {
  connected: boolean;
  latencyMs?: number;
  version?: string;
  details?: Record<string, unknown>;
  error?: string;
}

/**
 * Query execution result
 */
export interface QueryResult {
  /** Rows returned (for SELECT queries) */
  rows?: Record<string, unknown>[];

  /** Number of rows affected (for INSERT/UPDATE/DELETE) */
  rowsAffected?: number;

  /** Last inserted ID (for INSERT with auto-increment) */
  lastInsertId?: number | string;

  /** Query execution time in milliseconds */
  executionTimeMs?: number;

  /** Column metadata */
  columns?: ColumnInfo[];
}

/**
 * Column metadata information
 */
export interface ColumnInfo {
  name: string;
  type: string;
  nullable?: boolean;
  primaryKey?: boolean;
  defaultValue?: unknown;
}

/**
 * Table information
 */
export interface TableInfo {
  name: string;
  schema?: string;
  type: "table" | "view" | "materialized_view";
  rowCount?: number;
  columns?: ColumnInfo[];
}

/**
 * Schema information for a database
 */
export interface SchemaInfo {
  tables: TableInfo[];
  views?: TableInfo[];
  indexes?: IndexInfo[];
  constraints?: ConstraintInfo[];
}

/**
 * Index information
 */
export interface IndexInfo {
  name: string;
  tableName: string;
  columns: string[];
  unique: boolean;
  type?: string;
}

/**
 * Constraint information
 */
export interface ConstraintInfo {
  name: string;
  tableName: string;
  type: "primary_key" | "foreign_key" | "unique" | "check";
  columns: string[];
  referencedTable?: string;
  referencedColumns?: string[];
}

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

  /** Database configurations */
  databases: DatabaseConfig[];

  /** OAuth configuration */
  oauth?: OAuthConfig;

  /** Tool filtering configuration */
  toolFilter?: string;
}

// =============================================================================
// OAuth 2.0 Types
// =============================================================================

/**
 * OAuth 2.0 configuration
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
}

// =============================================================================
// Tool Filtering Types
// =============================================================================

/**
 * Tool group identifiers
 */
export type ToolGroup =
  | "core" // Basic CRUD, schema operations (8 tools)
  | "json" // JSON/JSONB operations (18 tools)
  | "text" // Text processing (12 tools)
  | "stats" // Statistical analysis (16 tools)
  | "vector" // Vector/semantic search (11 tools)
  | "admin"; // Administration (21 tools)

/**
 * Meta-group identifiers for common multi-group selections.
 * These are shortcuts that expand to multiple ToolGroups.
 */
export type MetaGroup =
  | "starter" // Core + JSON + Text (38 tools) - General development
  | "analytics" // Core + JSON + Stats (42 tools) - Data analysis
  | "search" // Core + Text + Vector (31 tools) - Search workloads
  | "minimal" // Core only (8 tools) - Bare minimum
  | "full"; // All tools enabled (86 tools)

/**
 * Tool filter rule
 */
export interface ToolFilterRule {
  /** Rule type: include or exclude */
  type: "include" | "exclude";

  /** Target: group name or tool name */
  target: string;

  /** Whether target is a group (true) or individual tool (false) */
  isGroup: boolean;
}

/**
 * Parsed tool filter configuration
 */
export interface ToolFilterConfig {
  /** Original filter string */
  raw: string;

  /** Parsed rules in order */
  rules: ToolFilterRule[];

  /** Set of enabled tool groups after applying rules */
  enabledGroups: Set<ToolGroup>;

  /** Set of explicitly excluded tool names (base names without prefix) */
  excludedTools: Set<string>;

  /** Set of explicitly included tool names (base names without prefix) */
  includedTools: Set<string>;
}

// =============================================================================
// MCP Tool Annotations (2025-11-25 spec)
// =============================================================================

/**
 * Tool annotations provide behavioral hints to clients
 * following the MCP 2025-11-25 specification.
 */
export interface ToolAnnotations {
  /** Human-readable title for the tool */
  title?: string;

  /** If true, the tool is guaranteed not to modify any state */
  readOnlyHint?: boolean;

  /** If true, multiple identical requests have the same effect as a single request */
  idempotentHint?: boolean;

  /** If true, the operation is irreversible or causes significant data loss */
  destructiveHint?: boolean;
}

// =============================================================================
// Adapter Types
// =============================================================================

/**
 * Capabilities supported by a database adapter
 */
export interface AdapterCapabilities {
  /** Supports JSON operations */
  json: boolean;

  /** Supports full-text search */
  fullTextSearch: boolean;

  /** Supports vector/embedding operations */
  vector: boolean;

  /** Supports geospatial operations */
  geospatial: boolean;

  /** Supports transactions */
  transactions: boolean;

  /** Supports prepared statements */
  preparedStatements: boolean;

  /** Supports connection pooling */
  connectionPooling: boolean;

  /** Additional capability flags */
  [key: string]: boolean;
}

/**
 * Tool definition for registration
 */
export interface ToolDefinition {
  /** Unique tool name */
  name: string;

  /** Human-readable description */
  description: string;

  /** Tool group for filtering */
  group: ToolGroup;

  /** Zod schema for input validation */
  inputSchema: unknown;

  /** Required OAuth scopes */
  requiredScopes?: OAuthScope[];

  /** MCP tool annotations (behavioral hints) */
  annotations?: ToolAnnotations;

  /** Tool handler function */
  handler: (params: unknown, context: RequestContext) => Promise<unknown>;
}

/**
 * MCP Resource Annotations (SDK 1.25+)
 * Provides metadata hints about resource content to help clients
 * manage and display resources appropriately.
 */
export interface ResourceAnnotations {
  /** Intended audience for the resource content */
  audience?: ("user" | "assistant")[];

  /** Priority hint for display ordering (0-1 range) */
  priority?: number;

  /** ISO 8601 timestamp of last modification for cache invalidation */
  lastModified?: string;
}

/**
 * Resource definition for MCP
 */
export interface ResourceDefinition {
  /** Resource URI template */
  uri: string;

  /** Human-readable name */
  name: string;

  /** Description */
  description: string;

  /** MIME type */
  mimeType?: string;

  /** MCP Resource Annotations for behavior hints */
  annotations?: ResourceAnnotations;

  /** Resource handler */
  handler: (uri: string, context: RequestContext) => Promise<unknown>;
}

/**
 * Prompt definition for MCP
 */
export interface PromptDefinition {
  /** Prompt name */
  name: string;

  /** Description */
  description: string;

  /** Argument definitions */
  arguments?: {
    name: string;
    description: string;
    required?: boolean;
  }[];

  /** Prompt handler */
  handler: (
    args: Record<string, string>,
    context: RequestContext,
  ) => Promise<unknown>;
}

// =============================================================================
// Error Types
// =============================================================================

/**
 * Base error class for db-mcp
 */
export class DbMcpError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "DbMcpError";
  }
}

/**
 * Database connection error
 */
export class ConnectionError extends DbMcpError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "CONNECTION_ERROR", details);
    this.name = "ConnectionError";
  }
}

/**
 * Query execution error
 */
export class QueryError extends DbMcpError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "QUERY_ERROR", details);
    this.name = "QueryError";
  }
}

/**
 * Authentication error
 */
export class AuthenticationError extends DbMcpError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "AUTHENTICATION_ERROR", details);
    this.name = "AuthenticationError";
  }
}

/**
 * Authorization error (insufficient permissions)
 */
export class AuthorizationError extends DbMcpError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "AUTHORIZATION_ERROR", details);
    this.name = "AuthorizationError";
  }
}

/**
 * Validation error for input parameters
 */
export class ValidationError extends DbMcpError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "VALIDATION_ERROR", details);
    this.name = "ValidationError";
  }
}
