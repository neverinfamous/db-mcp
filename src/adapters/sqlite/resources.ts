/**
 * SQLite Resource Definitions
 *
 * MCP resources for schema introspection, data access, and metadata.
 * 7 resources total.
 */

import type { SqliteAdapter } from "./SqliteAdapter.js";
import type { ResourceDefinition } from "../../types/index.js";
import {
  HIGH_PRIORITY,
  MEDIUM_PRIORITY,
  LOW_PRIORITY,
} from "../../utils/resourceAnnotations.js";

/**
 * Get all resource definitions for the SQLite adapter
 */
export function getResourceDefinitions(
  adapter: SqliteAdapter,
): ResourceDefinition[] {
  return [
    createSchemaResource(adapter),
    createTablesResource(adapter),
    createTableSchemaResource(adapter),
    createIndexesResource(adapter),
    createViewsResource(adapter),
    createHealthResource(adapter),
    createMetaResource(adapter),
  ];
}

/**
 * Full database schema resource
 */
function createSchemaResource(adapter: SqliteAdapter): ResourceDefinition {
  return {
    name: "sqlite_schema",
    uri: "sqlite://schema",
    description:
      "Get the full database schema including all tables, columns, and indexes",
    mimeType: "application/json",
    annotations: HIGH_PRIORITY,
    handler: async () => {
      const schema = await adapter.getSchema();
      return {
        contents: [
          {
            uri: "sqlite://schema",
            mimeType: "application/json",
            text: JSON.stringify(schema, null, 2),
          },
        ],
      };
    },
  };
}

/**
 * List of all tables
 */
function createTablesResource(adapter: SqliteAdapter): ResourceDefinition {
  return {
    name: "sqlite_tables",
    uri: "sqlite://tables",
    description: "List all tables in the database",
    mimeType: "application/json",
    annotations: MEDIUM_PRIORITY,
    handler: async () => {
      const tables = await adapter.listTables();
      return {
        contents: [
          {
            uri: "sqlite://tables",
            mimeType: "application/json",
            text: JSON.stringify(tables, null, 2),
          },
        ],
      };
    },
  };
}

/**
 * Individual table schema (template)
 */
function createTableSchemaResource(adapter: SqliteAdapter): ResourceDefinition {
  return {
    name: "sqlite_table_schema",
    uri: "sqlite://table/{tableName}/schema",
    description: "Get the schema for a specific table",
    mimeType: "application/json",
    annotations: MEDIUM_PRIORITY,
    handler: async (uri: string) => {
      // Extract table name from URI
      const regex = /sqlite:\/\/table\/([^/]+)\/schema/;
      const match = regex.exec(uri);
      if (!match?.[1]) {
        throw new Error("Invalid table URI format");
      }
      const tableName = decodeURIComponent(match[1]);
      const tableInfo = await adapter.describeTable(tableName);
      return {
        contents: [
          {
            uri,
            mimeType: "application/json",
            text: JSON.stringify(tableInfo, null, 2),
          },
        ],
      };
    },
  };
}

/**
 * All indexes
 */
function createIndexesResource(adapter: SqliteAdapter): ResourceDefinition {
  return {
    name: "sqlite_indexes",
    uri: "sqlite://indexes",
    description: "List all indexes in the database",
    mimeType: "application/json",
    annotations: MEDIUM_PRIORITY,
    handler: async () => {
      // Get indexes for all tables
      const tables = await adapter.listTables();
      const allIndexes: Record<string, unknown[]> = {};

      for (const table of tables) {
        const indexes = await adapter.getIndexes(table.name);
        if (indexes.length > 0) {
          allIndexes[table.name] = indexes;
        }
      }

      return {
        contents: [
          {
            uri: "sqlite://indexes",
            mimeType: "application/json",
            text: JSON.stringify(allIndexes, null, 2),
          },
        ],
      };
    },
  };
}

/**
 * All views
 */
function createViewsResource(adapter: SqliteAdapter): ResourceDefinition {
  return {
    name: "sqlite_views",
    uri: "sqlite://views",
    description: "List all views in the database",
    mimeType: "application/json",
    annotations: MEDIUM_PRIORITY,
    handler: async () => {
      const result = await adapter.executeReadQuery(
        "SELECT name, sql FROM sqlite_master WHERE type = 'view' ORDER BY name",
      );
      return {
        contents: [
          {
            uri: "sqlite://views",
            mimeType: "application/json",
            text: JSON.stringify(result.rows ?? [], null, 2),
          },
        ],
      };
    },
  };
}

/**
 * Database health status
 */
function createHealthResource(adapter: SqliteAdapter): ResourceDefinition {
  return {
    name: "sqlite_health",
    uri: "sqlite://health",
    description: "Get database health and connection status",
    mimeType: "application/json",
    annotations: HIGH_PRIORITY,
    handler: async () => {
      const health = await adapter.getHealth();
      return {
        contents: [
          {
            uri: "sqlite://health",
            mimeType: "application/json",
            text: JSON.stringify(health, null, 2),
          },
        ],
      };
    },
  };
}

/**
 * Database metadata
 */
function createMetaResource(adapter: SqliteAdapter): ResourceDefinition {
  return {
    name: "sqlite_meta",
    uri: "sqlite://meta",
    description: "Get database metadata and configuration",
    mimeType: "application/json",
    annotations: LOW_PRIORITY,
    handler: async () => {
      // Get various pragma values
      const pragmas = [
        "database_list",
        "page_count",
        "page_size",
        "journal_mode",
        "synchronous",
        "foreign_keys",
        "wal_autocheckpoint",
      ];

      const meta: Record<string, unknown> = {
        adapter: adapter.getInfo(),
      };

      for (const pragma of pragmas) {
        try {
          const result = await adapter.executeReadQuery(`PRAGMA ${pragma}`);
          meta[pragma] = result.rows?.[0] ?? null;
        } catch {
          meta[pragma] = null;
        }
      }

      return {
        contents: [
          {
            uri: "sqlite://meta",
            mimeType: "application/json",
            text: JSON.stringify(meta, null, 2),
          },
        ],
      };
    },
  };
}
