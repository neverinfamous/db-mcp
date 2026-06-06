/**
 * Tool Annotations Presets
 *
 * Reusable annotation configurations for common tool behavior patterns.
 * Used by all tool definition files for consistency.
 *
 * Follows MCP 2025-11-25 specification.
 */

import type { ToolAnnotations } from "../types/index.js";
import type { ToolAnnotations as SDKToolAnnotations } from "@modelcontextprotocol/sdk/types.js";

// =============================================================================
// Base Annotation Presets
// =============================================================================

/** Read-only query tools (SELECT, schema retrieval, metadata) */
export const READ_ONLY: ToolAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  openWorldHint: false,
  sensitiveHint: false,
};

/** Standard write tools (INSERT, UPDATE, CREATE) */
export const WRITE: ToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: false,
  openWorldHint: false,
  sensitiveHint: false,
};

/** Destructive tools (DELETE, DROP, TRUNCATE) */
export const DESTRUCTIVE: ToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: true,
  openWorldHint: false,
  sensitiveHint: false,
};

/** Idempotent tools (CREATE IF NOT EXISTS, upserts) */
export const IDEMPOTENT: ToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
  sensitiveHint: false,
};

/** Admin/maintenance tools (VACUUM, ANALYZE, PRAGMA) */
export const ADMIN: ToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: true,
  openWorldHint: false,
  sensitiveHint: true, // System maintenance may expose internal db structures
};

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Create annotations with a custom title
 */
export function withTitle(
  title: string,
  base: ToolAnnotations = READ_ONLY,
): ToolAnnotations {
  return { title, ...base };
}

/**
 * Create read-only annotations with title
 */
export function readOnly(title: string): ToolAnnotations {
  return { title, ...READ_ONLY };
}

/**
 * Create write annotations with title
 */
export function write(title: string): ToolAnnotations {
  return { title, ...WRITE };
}

/**
 * Create destructive annotations with title
 */
export function destructive(title: string): ToolAnnotations {
  return { title, ...DESTRUCTIVE };
}

/**
 * Create idempotent annotations with title
 */
export function idempotent(title: string): ToolAnnotations {
  return { title, ...IDEMPOTENT };
}

/**
 * Create admin annotations with title
 */
export function admin(title: string): ToolAnnotations {
  return { title, ...ADMIN };
}

/** Admin tools that interact with the filesystem (ATTACH, VACUUM INTO, DUMP) */
export const ADMIN_FS: ToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: true,
  openWorldHint: true,
  sensitiveHint: true,
};

/** Write tools that interact with the filesystem (SpatiaLite Import) */
export const WRITE_FS: ToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: false,
  openWorldHint: true,
  sensitiveHint: true,
};

/**
 * Create admin-filesystem annotations with title
 */
export function adminFs(title: string): ToolAnnotations {
  return { title, ...ADMIN_FS };
}

/**
 * Create write-filesystem annotations with title
 */
export function writeFs(title: string): ToolAnnotations {
  return { title, ...WRITE_FS };
}

/** Code Mode tools (can invoke any tool group internally) */
export const CODEMODE: ToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: false,
  openWorldHint: true,
  sensitiveHint: true,
};

/**
 * Create codemode annotations with title
 */
export function codemode(title: string): ToolAnnotations {
  return { title, ...CODEMODE };
}

/**
 * Casts internal annotations to the SDK annotations type.
 * This bypasses TypeScript excess property checks when registering tools directly
 * via the SDK (which lacks our custom sensitiveHint annotation), while preserving
 * the data at runtime for clients that do support it.
 */
export function toSDK(annotations: ToolAnnotations): SDKToolAnnotations {
  return annotations;
}
