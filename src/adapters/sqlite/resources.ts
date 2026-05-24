/**
 * SQLite Resource Definitions
 *
 * MCP resources for schema introspection, data access, and metadata.
 * 8 resources total.
 */

import type { SqliteAdapter } from "./sqlite-adapter.js";
import type { ResourceDefinition } from "../../types/index.js";
import {
  HIGH_PRIORITY,
  MEDIUM_PRIORITY,
  LOW_PRIORITY,
  ASSISTANT_FOCUSED,
} from "../../utils/resource-annotations.js";
import { insightsManager } from "../../utils/insights-manager.js";
import { DbMcpError, ErrorCategory } from "../../utils/errors/index.js";
import {
  isSpatialiteSystemTable,
  isSpatialiteSystemView,
  isSpatialiteSystemIndex,
} from "./tools/core/tables.js";

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
    createCompileOptionsResource(adapter),
    createPragmaResource(adapter),
    createInsightsResource(),
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
      const rawSchema = await adapter.getSchema();
      const schema = {
        ...rawSchema,
        tables: (rawSchema.tables ?? []).filter(
          (t) =>
            !isSpatialiteSystemTable(t.name) &&
            !isSpatialiteSystemView(t.name) &&
            !t.name.startsWith("_mcp_"),
        ),
        indexes: (rawSchema.indexes ?? []).filter(
          (idx) =>
            !isSpatialiteSystemIndex(idx.name) &&
            !isSpatialiteSystemTable(idx.tableName) &&
            !idx.tableName.startsWith("_mcp_"),
        ),
      };
      
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
      const tables = (await adapter.listTables()).filter(
        (t) =>
          !isSpatialiteSystemTable(t.name) &&
          !isSpatialiteSystemView(t.name) &&
          !t.name.startsWith("_mcp_"),
      );
      
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
        throw new DbMcpError(
          "Invalid table URI format",
          "RESOURCE_INVALID_URI",
          ErrorCategory.VALIDATION,
        );
      }
      const tableName = decodeURIComponent(match[1]);
      try {
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
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return {
          contents: [
            {
              uri,
              mimeType: "application/json",
              text: JSON.stringify({ success: false, error: msg }, null, 2),
            },
          ],
        };
      }
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
      // Use single cached query via SchemaManager (eliminates N+1)
      const allRawIndexes = await adapter.getAllIndexes();
      
      const indexes = allRawIndexes.filter(
        (idx) =>
          !isSpatialiteSystemIndex(idx.name) &&
          !isSpatialiteSystemTable(idx.tableName) &&
          !idx.tableName.startsWith("_mcp_"),
      );

      // Group by table name for output format
      const allIndexes: Record<string, unknown[]> = {};
      for (const idx of indexes) {
        const tableName = idx.tableName;
        const arr = (allIndexes[tableName] ??= []);
        arr.push(idx);
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
      
      const views = (result.rows ?? []).filter(
        (row) =>
          !isSpatialiteSystemTable(row["name"] as string) &&
          !isSpatialiteSystemView(row["name"] as string) &&
          !(row["name"] as string).startsWith("_mcp_")
      );
      
      return {
        contents: [
          {
            uri: "sqlite://views",
            mimeType: "application/json",
            text: JSON.stringify(views, null, 2),
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
          if (pragma === "database_list") {
            meta[pragma] = (result.rows ?? []).map((r) => ({
              ...r,
              file:
                typeof r["file"] === "string" && r["file"].length > 0
                  ? "<redacted>"
                  : "",
            }));
          } else {
            meta[pragma] = result.rows?.[0] ?? null;
          }
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

/**
 * Business insights memo resource
 */
function createInsightsResource(): ResourceDefinition {
  return {
    name: "sqlite_insights",
    uri: "memo://insights",
    description:
      "Business insights memo that gets updated during database analysis",
    mimeType: "text/plain",
    annotations: HIGH_PRIORITY,
    handler: () => {
      return Promise.resolve({
        contents: [
          {
            uri: "memo://insights",
            mimeType: "text/plain",
            text: insightsManager.synthesizeMemo(),
          },
        ],
      });
    },
  };
}

/**
 * SQLite compile-time options
 */
function createCompileOptionsResource(
  adapter: SqliteAdapter,
): ResourceDefinition {
  return {
    name: "sqlite_compile_options",
    uri: "sqlite://compile_options",
    description: "SQLite compile-time build options",
    mimeType: "application/json",
    annotations: ASSISTANT_FOCUSED,
    handler: async () => {
      const result = await adapter.executeReadQuery("PRAGMA compile_options");

      const options = (result.rows ?? []).map((r) =>
        String(r["compile_options"]),
      );

      // Extract notable features to highlight
      const highlights = [];
      const notablePatterns = [
        "FTS5",
        "JSON1",
        "RTREE",
        "MATH_FUNCTIONS",
        "ENABLE_GEOPOLY",
        "ENABLE_STAT4",
        "THREADSAFE",
      ];

      for (const opt of options) {
        for (const pattern of notablePatterns) {
          if (opt.includes(pattern)) {
            highlights.push(opt);
          }
        }
      }

      return {
        contents: [
          {
            uri: "sqlite://compile_options",
            mimeType: "application/json",
            text: JSON.stringify(
              {
                options,
                count: options.length,
                highlights,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  };
}

/**
 * Curated PRAGMA configuration snapshot
 */
function createPragmaResource(adapter: SqliteAdapter): ResourceDefinition {
  return {
    name: "sqlite_pragma",
    uri: "sqlite://pragma",
    description: "Runtime PRAGMA configuration snapshot",
    mimeType: "application/json",
    annotations: ASSISTANT_FOCUSED,
    handler: async () => {
      // Group PRAGMAs by category
      const pragmaGroups = {
        storage: ["page_size", "page_count", "max_page_count", "auto_vacuum"],
        performance: [
          "cache_size",
          "mmap_size",
          "temp_store",
          "journal_mode",
          "synchronous",
        ],
        safety: ["foreign_keys", "secure_delete", "locking_mode"],
        behavior: ["wal_autocheckpoint", "busy_timeout", "encoding"],
      };

      const settings: Record<
        string,
        { value: unknown; category: string; description: string }
      > = {};
      const descriptions: Record<string, string> = {
        page_size: "Database page size in bytes",
        page_count: "Current number of pages",
        max_page_count: "Maximum allowed number of pages",
        auto_vacuum: "Auto-vacuum mode (0=none, 1=full, 2=incremental)",
        cache_size: "Suggested max number of database disk pages in memory",
        mmap_size: "Max bytes that can be memory-mapped",
        temp_store:
          "Where to store temporary tables (0=default, 1=file, 2=memory)",
        journal_mode:
          "Transaction journal mode (e.g., DELETE, TRUNCATE, PERSIST, MEMORY, WAL)",
        synchronous: "Sync disk writes (0=OFF, 1=NORMAL, 2=FULL, 3=EXTRA)",
        foreign_keys: "Foreign key constraint enforcement",
        secure_delete: "Overwrite deleted content with zeros",
        locking_mode: "Connection locking mode (NORMAL or EXCLUSIVE)",
        wal_autocheckpoint: "WAL auto-checkpoint size in pages",
        busy_timeout: "Milliseconds to wait for a lock",
        encoding: "Text encoding used by the database",
      };

      for (const [category, pragmas] of Object.entries(pragmaGroups)) {
        for (const pragma of pragmas) {
          try {
            const result = await adapter.executeReadQuery(`PRAGMA ${pragma}`);
            settings[pragma] = {
              value: result.rows?.[0]?.[pragma] ?? null,
              category,
              description: descriptions[pragma] ?? "",
            };
          } catch {
            settings[pragma] = {
              value: null,
              category,
              description: descriptions[pragma] ?? "",
            };
          }
        }
      }

      return {
        contents: [
          {
            uri: "sqlite://pragma",
            mimeType: "application/json",
            text: JSON.stringify(
              {
                settings,
                settingsCount: Object.keys(settings).length,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  };
}
