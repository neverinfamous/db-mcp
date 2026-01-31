/**
 * Test Adapter Factory
 *
 * Provides a centralized adapter factory for tests.
 * Uses NativeSqliteAdapter (better-sqlite3) for full feature support including:
 * - FTS5 full-text search
 * - Window functions
 * - JSON/JSONB support
 * - All SQLite extensions
 */

import { NativeSqliteAdapter } from "../../src/adapters/sqlite-native/NativeSqliteAdapter.js";
import type { SqliteAdapter as SqliteAdapterType } from "../../src/adapters/sqlite/SqliteAdapter.js";

/**
 * Create a test adapter instance using NativeSqliteAdapter.
 * This provides full SQLite functionality including FTS5.
 */
export function createTestAdapter(): SqliteAdapterType {
  return new NativeSqliteAdapter() as unknown as SqliteAdapterType;
}

/**
 * Type alias for the adapter interface used in tests.
 */
export type TestAdapter = SqliteAdapterType;
