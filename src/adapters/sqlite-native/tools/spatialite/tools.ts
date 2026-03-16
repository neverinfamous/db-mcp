/**
 * SpatiaLite Core Tool Implementations
 *
 * Core SpatiaLite tool creator functions:
 * - sqlite_spatialite_load
 * - sqlite_spatialite_create_table
 * - sqlite_spatialite_query
 * - sqlite_spatialite_index
 *
 * Analysis, transform, and import tools are in analysis.ts.
 */

import type { ToolDefinition, RequestContext } from "../../../../types/index.js";
import type { NativeSqliteAdapter } from "../../native-sqlite-adapter.js";
import { formatHandlerError } from "../../../../utils/errors/index.js";
import {
  LoadSpatialiteSchema,
  CreateSpatialTableSchema,
  SpatialQuerySchema,
  SpatialIndexSchema,
  VALID_INDEX_ACTIONS,
} from "./schemas.js";
import {
  tryLoadSpatialite,
  isSpatialiteLoaded,
  ensureSpatialite,
  SPATIALITE_PATHS,
} from "./loader.js";
import {
  SpatialiteLoadOutputSchema,
  SpatialiteCreateTableOutputSchema,
  SpatialiteQueryOutputSchema,
  SpatialiteIndexOutputSchema,
} from "../../../sqlite/output-schemas/index.js";

/**
 * Load SpatiaLite extension
 */
export function createLoadSpatialiteTool(
  adapter: NativeSqliteAdapter,
): ToolDefinition {
  return {
    name: "sqlite_spatialite_load",
    description:
      "Load SpatiaLite extension for geospatial capabilities. Required before using other spatial tools.",
    group: "geo",
    inputSchema: LoadSpatialiteSchema,
    outputSchema: SpatialiteLoadOutputSchema,
    requiredScopes: ["admin"],
    handler: (_params: unknown, _context: RequestContext) => {
      try {
        const input = LoadSpatialiteSchema.parse(_params);

        if (!input.forceReload && isSpatialiteLoaded(adapter)) {
          return Promise.resolve({
            success: true,
            message: "SpatiaLite already loaded",
            alreadyLoaded: true,
          });
        }

        const result = tryLoadSpatialite(adapter, input.extensionPath);

        if (result.success) {
          return Promise.resolve({
            success: true,
            message: "SpatiaLite loaded successfully",
            extensionPath: result.path,
          });
        }

        return Promise.resolve({
          success: false,
          error: result.error,
          code: "SPATIALITE_LOAD_FAILED",
          category: "internal" as const,
          recoverable: false,
          searchedPaths: SPATIALITE_PATHS,
        });
      } catch (error) {
        return Promise.resolve(formatHandlerError(error));
      }
    },
  };
}

/**
 * Create spatial table
 */
export function createSpatialTableTool(
  adapter: NativeSqliteAdapter,
): ToolDefinition {
  return {
    name: "sqlite_spatialite_create_table",
    description:
      "Create a spatial table with geometry column using SpatiaLite.",
    group: "geo",
    inputSchema: CreateSpatialTableSchema,
    outputSchema: SpatialiteCreateTableOutputSchema,
    requiredScopes: ["write"],
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const input = CreateSpatialTableSchema.parse(params);
        ensureSpatialite(adapter);

        // Validate table name
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.tableName)) {
          return {
            success: false,
            error: `Invalid table name: '${input.tableName}'`,
            code: "VALIDATION_ERROR",
            category: "validation" as const,
            recoverable: false,
          };
        }

        // Check if table already exists
        const existsCheck = await adapter.executeReadQuery(
          `SELECT name FROM sqlite_master WHERE type='table' AND name='${input.tableName}'`,
        );
        const alreadyExists =
          existsCheck.rows != null && existsCheck.rows.length > 0;

        if (alreadyExists) {
          return {
            success: true,
            message: `Spatial table '${input.tableName}' already exists`,
            alreadyExists: true,
            tableName: input.tableName,
          };
        }

        // Build column definitions
        const columns = ["id INTEGER PRIMARY KEY AUTOINCREMENT"];
        for (const col of input.additionalColumns) {
          if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(col.name)) {
            return {
              success: false,
              error: `Invalid column name: '${col.name}'`,
              code: "VALIDATION_ERROR",
              category: "validation" as const,
              recoverable: false,
            };
          }
          columns.push(`"${col.name}" ${col.type}`);
        }

        // Create base table
        await adapter.executeWriteQuery(
          `CREATE TABLE "${input.tableName}" (${columns.join(", ")})`,
        );

        // Add geometry column using SpatiaLite
        // NOTE: AddGeometryColumn is a SELECT function, must use executeReadQuery
        const addResult = await adapter.executeReadQuery(
          `SELECT AddGeometryColumn('${input.tableName}', '${input.geometryColumn}', ${input.srid}, '${input.geometryType}', 'XY')`,
        );

        // Verify the geometry column was created
        const verifyResult = await adapter.executeReadQuery(
          `SELECT name FROM pragma_table_info('${input.tableName}') WHERE name = '${input.geometryColumn}'`,
        );
        if (!verifyResult.rows || verifyResult.rows.length === 0) {
          return {
            success: false,
            error: `Failed to create geometry column '${input.geometryColumn}'. AddGeometryColumn returned: ${JSON.stringify(addResult.rows)}`,
            code: "SPATIALITE_CREATE_FAILED",
            category: "internal" as const,
            recoverable: false,
          };
        }

        return {
          success: true,
          message: `Spatial table '${input.tableName}' created`,
          tableName: input.tableName,
          geometryColumn: input.geometryColumn,
          geometryType: input.geometryType,
          srid: input.srid,
        };
      } catch (error) {
        return formatHandlerError(error);
      }
    },
  };
}

/**
 * Execute spatial query
 */
export function createSpatialQueryTool(
  adapter: NativeSqliteAdapter,
): ToolDefinition {
  return {
    name: "sqlite_spatialite_query",
    description:
      "Execute spatial SQL queries using SpatiaLite functions (ST_Distance, ST_Within, etc.).",
    group: "geo",
    inputSchema: SpatialQuerySchema,
    outputSchema: SpatialiteQueryOutputSchema,
    requiredScopes: ["read"],
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const input = SpatialQuerySchema.parse(params);
        ensureSpatialite(adapter);

        const result = await adapter.executeReadQuery(input.query);

        return {
          success: true,
          rowCount: result.rows?.length ?? 0,
          rows: result.rows,
        };
      } catch (error) {
        const msg =
          error instanceof Error ? error.message : String(error);
        if (msg.includes("does not return data")) {
          return {
            success: false,
            error:
              "This tool only supports SELECT queries. Use sqlite_write_query for INSERT/UPDATE/DELETE statements.",
            code: "QUERY_NOT_SELECT",
            category: "validation" as const,
            recoverable: false,
          };
        }
        return formatHandlerError(error);
      }
    },
  };
}


/**
 * Spatial index management
 */
export function createSpatialIndexTool(
  adapter: NativeSqliteAdapter,
): ToolDefinition {
  return {
    name: "sqlite_spatialite_index",
    description:
      "Create, drop, or check spatial R-Tree index on geometry column.",
    group: "geo",
    inputSchema: SpatialIndexSchema,
    outputSchema: SpatialiteIndexOutputSchema,
    requiredScopes: ["write"],
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const input = SpatialIndexSchema.parse(params);
        ensureSpatialite(adapter);

        // Validate names
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.tableName)) {
          return {
            success: false,
            error: `Invalid table name: '${input.tableName}'`,
            code: "VALIDATION_ERROR",
            category: "validation" as const,
            recoverable: false,
          };
        }

        // Handler-level enum validation (schema uses z.string() to avoid silent coercion)
        if (!(VALID_INDEX_ACTIONS as readonly string[]).includes(input.action)) {
          return {
            success: false,
            error: `Invalid action: '${input.action}'. Must be one of: ${VALID_INDEX_ACTIONS.join(", ")}`,
            code: "VALIDATION_ERROR",
            category: "validation",
            recoverable: false,
          };
        }

        // Validate table exists before attempting index operations
        const tableCheck = await adapter.executeReadQuery(
          `SELECT name FROM sqlite_master WHERE type='table' AND name='${input.tableName}'`,
        );
        if (!tableCheck.rows || tableCheck.rows.length === 0) {
          return {
            success: false,
            error: `Table '${input.tableName}' does not exist`,
            code: "TABLE_NOT_FOUND",
            category: "resource" as const,
            suggestion: "Table not found. Run sqlite_list_tables to see available tables.",
            recoverable: false,
          };
        }

        // Helper: check if spatial index exists for this table/column
        const indexExists = async (): Promise<boolean> => {
          const idxCheck = await adapter.executeReadQuery(
            `SELECT name FROM sqlite_master WHERE type='table' AND name='idx_${input.tableName}_${input.geometryColumn}'`,
          );
          return (idxCheck.rows?.length ?? 0) > 0;
        };

        switch (input.action) {
          case "create": {
            if (await indexExists()) {
              return {
                success: true,
                message: `Spatial index already exists on ${input.tableName}.${input.geometryColumn}`,
                alreadyExists: true,
                action: "create",
              };
            }
            // NOTE: CreateSpatialIndex is a SELECT function, must use executeReadQuery
            await adapter.executeReadQuery(
              `SELECT CreateSpatialIndex('${input.tableName}', '${input.geometryColumn}')`,
            );
            return {
              success: true,
              message: `Spatial index created on ${input.tableName}.${input.geometryColumn}`,
              action: "create",
            };
          }

          case "drop": {
            if (!(await indexExists())) {
              return {
                success: true,
                message: `No spatial index exists on ${input.tableName}.${input.geometryColumn}`,
                alreadyDropped: true,
                action: "drop",
              };
            }
            // NOTE: DisableSpatialIndex is a SELECT function, must use executeReadQuery
            await adapter.executeReadQuery(
              `SELECT DisableSpatialIndex('${input.tableName}', '${input.geometryColumn}')`,
            );
            return {
              success: true,
              message: `Spatial index dropped from ${input.tableName}.${input.geometryColumn}`,
              action: "drop",
            };
          }

          case "check": {
            const hasIndex = await indexExists();
            if (!hasIndex) {
              return {
                success: true,
                message: "No spatial index found",
                action: "check",
                indexed: false,
              };
            }
            const checkResult = await adapter.executeReadQuery(
              `SELECT CheckSpatialIndex('${input.tableName}', '${input.geometryColumn}')`,
            );
            const checkValue = checkResult.rows?.[0];
            const rawResult =
              checkValue != null ? Object.values(checkValue)[0] : null;

            // CheckSpatialIndex returns: 1 = valid, 0 = invalid, null = inconclusive
            // null is common in SpatiaLite 5.x and means the check couldn't be performed
            if (rawResult === 1) {
              return {
                success: true,
                message: "Spatial index is valid",
                action: "check",
                indexed: true,
                valid: true,
              };
            } else if (rawResult === 0) {
              return {
                success: true,
                message:
                  "Spatial index exists but is invalid (rebuild recommended)",
                action: "check",
                indexed: true,
                valid: false,
              };
            } else {
              return {
                success: true,
                message:
                  "Spatial index exists (validation inconclusive — common in SpatiaLite 5.x)",
                action: "check",
                indexed: true,
                valid: null,
              };
            }
          }

          default:
            return {
              success: false,
              error: `Invalid action: '${input.action}'. Must be one of: ${VALID_INDEX_ACTIONS.join(", ")}`,
              code: "VALIDATION_ERROR",
              category: "validation" as const,
              recoverable: false,
            };
        }
      } catch (error) {
        return formatHandlerError(error);
      }
    },
  };
}

