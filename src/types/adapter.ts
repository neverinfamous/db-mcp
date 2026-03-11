/**
 * db-mcp — Adapter Types
 *
 * Types for database adapter capabilities, tool/resource/prompt definitions,
 * MCP icons, and tool annotations.
 */

import type { ToolGroup } from "./filtering.js";
import type { OAuthScope, RequestContext } from "./auth.js";

// =============================================================================
// MCP Icons (2025-11-25 spec)
// =============================================================================

/**
 * MCP Icon Definition (MCP Spec 2025-11-25)
 *
 * Icons can be added to servers, tools, resources, and prompts for
 * visual representation in client interfaces.
 */
export interface McpIcon {
  /** Icon source — URL or data URI */
  src: string;

  /** MIME type (e.g., 'image/svg+xml', 'image/png') */
  mimeType?: string;

  /** Size descriptors (e.g., ['48x48'], ['any']) */
  sizes?: string[];

  /** Theme hint: 'light' or 'dark' */
  theme?: "light" | "dark";
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

  /** Zod schema for output validation (MCP 2025-11-25) */
  outputSchema?: unknown;

  /** Required OAuth scopes */
  requiredScopes?: OAuthScope[];

  /** MCP tool annotations (behavioral hints) */
  annotations?: ToolAnnotations;

  /** MCP icons for visual representation (MCP 2025-11-25) */
  icons?: McpIcon[];

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

  /** MCP icons for visual representation (MCP 2025-11-25) */
  icons?: McpIcon[];

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

  /** MCP icons for visual representation (MCP 2025-11-25) */
  icons?: McpIcon[];

  /** Prompt handler */
  handler: (
    args: Record<string, string>,
    context: RequestContext,
  ) => Promise<unknown>;
}
