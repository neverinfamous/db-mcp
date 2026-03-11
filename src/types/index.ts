/**
 * db-mcp — Core Type Definitions
 *
 * Barrel re-export from sub-modules. All consumers continue to import
 * from 'types/index.js' — no import path changes needed.
 */

// Database types: connections, queries, schema, tables, columns, indexes
export type {
  DatabaseType,
  DatabaseConfig,
  HealthStatus,
  QueryResult,
  ColumnInfo,
  TableInfo,
  SchemaInfo,
  IndexInfo,
  ConstraintInfo,
} from "./database.js";

// MCP Server types: transport, server config
export type { TransportType, McpServerConfig } from "./server.js";

// OAuth & auth types: config, scopes, claims, request context
export type {
  OAuthConfig,
  OAuthScope,
  TokenClaims,
  RequestContext,
} from "./auth.js";

// Tool filtering types: groups, meta-groups, filter config
export type {
  ToolGroup,
  MetaGroup,
  ToolFilterRule,
  ToolFilterConfig,
} from "./filtering.js";

// Adapter types: capabilities, tools, resources, prompts, icons, annotations
export type {
  McpIcon,
  ToolAnnotations,
  AdapterCapabilities,
  ToolDefinition,
  ResourceAnnotations,
  ResourceDefinition,
  PromptDefinition,
} from "./adapter.js";

// Error classes — re-exported from utils/errors (single source of truth)
export {
  DbMcpError,
  ConnectionError,
  QueryError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
} from "../utils/errors/index.js";
