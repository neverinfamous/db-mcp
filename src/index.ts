/**
 * db-mcp - SQLite MCP Server
 *
 * Main entry point and public API exports.
 */

// Core server
export {
  DbMcpServer,
  createServer,
  DEFAULT_CONFIG,
} from "./server/McpServer.js";

// Types
export type {
  // Database types
  DatabaseType,
  DatabaseConfig,
  HealthStatus,
  QueryResult,
  ColumnInfo,
  TableInfo,
  SchemaInfo,
  IndexInfo,
  ConstraintInfo,

  // MCP types
  TransportType,
  McpServerConfig,

  // OAuth types
  OAuthConfig,
  OAuthScope,
  TokenClaims,
  RequestContext,

  // Tool filtering types
  ToolGroup,
  ToolFilterRule,
  ToolFilterConfig,

  // Adapter types
  AdapterCapabilities,
  ToolDefinition,
  ResourceDefinition,
  PromptDefinition,
} from "./types/index.js";

// Error classes
export {
  DbMcpError,
  ConnectionError,
  QueryError,
  AuthenticationError,
  AuthorizationError,
  ValidationError,
} from "./types/index.js";

// Base adapter class
export { DatabaseAdapter } from "./adapters/DatabaseAdapter.js";

// Tool filtering utilities
export {
  TOOL_GROUPS,
  META_GROUPS,
  ALL_TOOL_GROUPS,
  parseToolFilter,
  isToolEnabled,
  filterTools,
  getToolFilterFromEnv,
  getFilterSummary,
} from "./filtering/ToolFilter.js";

// Version info
export const VERSION = "0.1.0";
export const NAME = "db-mcp";
