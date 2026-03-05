/**
 * SpatiaLite Geospatial Tools for Native SQLite Adapter
 *
 * Provides true GIS capabilities via SpatiaLite extension.
 * These tools gracefully fail if SpatiaLite is not installed.
 * 7 tools total (Native-only).
 */

import { z } from "zod";
import type { ToolDefinition, RequestContext } from "../../../types/index.js";
import type { NativeSqliteAdapter } from "../NativeSqliteAdapter.js";
import { formatError } from "../../../utils/errors.js";

// SpatiaLite extension paths to try (platform-aware)
const SPATIALITE_PATHS = [
  process.env["SPATIALITE_PATH"],
  "mod_spatialite",
  "mod_spatialite.dll",
  "mod_spatialite.so",
  "/usr/lib/x86_64-linux-gnu/mod_spatialite.so",
  "/usr/local/lib/mod_spatialite.so",
  "/usr/local/lib/mod_spatialite.dylib",
].filter((p): p is string => Boolean(p));

// Track loaded state per database
const loadedDatabases = new WeakSet();

// Schemas
const LoadSpatialiteSchema = z.object({
  extensionPath: z
    .string()
    .optional()
    .describe("Custom path to mod_spatialite extension"),
  forceReload: z
    .boolean()
    .optional()
    .default(false)
    .describe("Force reload if already loaded"),
});

const CreateSpatialTableSchema = z.object({
  tableName: z.string().describe("Name of the spatial table to create"),
  geometryColumn: z
    .string()
    .optional()
    .default("geom")
    .describe("Name of the geometry column"),
  geometryType: z
    .enum([
      "POINT",
      "LINESTRING",
      "POLYGON",
      "MULTIPOINT",
      "MULTILINESTRING",
      "MULTIPOLYGON",
      "GEOMETRY",
    ])
    .optional()
    .default("POINT")
    .describe("Type of geometry to store"),
  srid: z
    .number()
    .optional()
    .default(4326)
    .describe("Spatial Reference System ID (4326 for WGS84)"),
  additionalColumns: z
    .array(
      z.object({
        name: z.string(),
        type: z.string(),
      }),
    )
    .optional()
    .default([])
    .describe("Additional non-spatial columns"),
});

const SpatialQuerySchema = z.object({
  query: z.string().describe("Spatial SQL query using SpatiaLite functions"),
  params: z
    .array(z.unknown())
    .optional()
    .default([])
    .describe("Query parameters"),
});

const SpatialAnalysisSchema = z.object({
  analysisType: z
    .enum([
      "nearest_neighbor",
      "point_in_polygon",
      "distance_matrix",
      "spatial_extent",
    ])
    .describe("Type of spatial analysis"),
  sourceTable: z.string().describe("Source table for analysis"),
  targetTable: z
    .string()
    .optional()
    .describe(
      "Target table for operations. For point_in_polygon, this should contain POLYGON geometries while sourceTable contains POINTs",
    ),
  geometryColumn: z
    .string()
    .optional()
    .default("geom")
    .describe("Geometry column name"),
  limit: z.number().optional().default(100).describe("Limit results"),
  excludeSelf: z
    .boolean()
    .optional()
    .default(true)
    .describe(
      "For nearest_neighbor: exclude self-matches when source and target tables are the same (default: true)",
    ),
  includeGeometry: z
    .boolean()
    .optional()
    .default(false)
    .describe(
      "Include full WKT geometry in results (default: false to reduce payload size)",
    ),
});

const SpatialIndexSchema = z.object({
  tableName: z.string().describe("Name of the spatial table"),
  geometryColumn: z
    .string()
    .optional()
    .default("geom")
    .describe("Geometry column name"),
  action: z
    .enum(["create", "drop", "check"])
    .optional()
    .default("create")
    .describe("Action to perform"),
});

const GeometryTransformSchema = z.object({
  operation: z
    .enum([
      "buffer",
      "intersection",
      "union",
      "difference",
      "centroid",
      "envelope",
      "simplify",
    ])
    .describe("Geometry operation to perform"),
  geometry1: z.string().describe("First geometry (WKT format)"),
  geometry2: z.string().optional().describe("Second geometry for binary ops"),
  distance: z
    .number()
    .optional()
    .default(0.001)
    .describe("Distance for buffer or simplify tolerance"),
  srid: z.number().optional().default(4326).describe("SRID for result"),
  simplifyTolerance: z
    .number()
    .optional()
    .describe(
      "For buffer operation: apply ST_Simplify to reduce vertices in output polygon. Recommended: 0.0001-0.001 for lat/lon",
    ),
});

const SpatialImportSchema = z.object({
  tableName: z.string().describe("Target table name"),
  format: z.enum(["wkt", "geojson"]).describe("Input format"),
  data: z.string().describe("Geometry data (WKT string or GeoJSON)"),
  srid: z.number().optional().default(4326).describe("SRID of input data"),
  additionalData: z
    .record(z.string(), z.unknown())
    .optional()
    .describe("Additional column values"),
});

/**
 * Get all SpatiaLite tools
 */
export function getSpatialiteTools(
  adapter: NativeSqliteAdapter,
): ToolDefinition[] {
  return [
    createLoadSpatialiteTool(adapter),
    createSpatialTableTool(adapter),
    createSpatialQueryTool(adapter),
    createSpatialAnalysisTool(adapter),
    createSpatialIndexTool(adapter),
    createGeometryTransformTool(adapter),
    createSpatialImportTool(adapter),
  ];
}

/**
 * Try to load SpatiaLite extension
 */
function tryLoadSpatialite(
  adapter: NativeSqliteAdapter,
  customPath?: string,
): { success: boolean; path?: string; error?: string } {
  const db = adapter.getDatabase();
  if (db === null) {
    return { success: false, error: "Database not connected" };
  }

  const paths = customPath
    ? [customPath, ...SPATIALITE_PATHS]
    : SPATIALITE_PATHS;

  // On Windows, SpatiaLite DLL has many dependencies (libgeos, libproj, etc.)
  // These must be in PATH for Windows to find them when loading the extension.
  // Prepend the extension directory to PATH before attempting to load.
  const envPath = process.env["SPATIALITE_PATH"];
  if (envPath && process.platform === "win32") {
    const extensionDir = envPath.replace(/[/\\][^/\\]+$/, ""); // Get directory from DLL path
    const currentPath = process.env["PATH"] ?? "";
    if (!currentPath.includes(extensionDir)) {
      process.env["PATH"] = extensionDir + ";" + currentPath;
    }
  }

  for (const path of paths) {
    try {
      db.loadExtension(path);
      // Initialize spatial metadata
      db.exec("SELECT InitSpatialMetaData(1)");
      loadedDatabases.add(db);
      return { success: true, path };
    } catch {
      // Try next path
    }
  }

  return {
    success: false,
    error:
      "SpatiaLite extension not found. Install mod_spatialite and set SPATIALITE_PATH environment variable.",
  };
}

/**
 * Check if SpatiaLite is loaded
 * Exported for health check access
 */
export function isSpatialiteLoaded(adapter: NativeSqliteAdapter): boolean {
  const db = adapter.getDatabase();
  if (db === null) return false;

  if (loadedDatabases.has(db)) return true;

  try {
    db.exec("SELECT spatialite_version()");
    // Extension is loaded but not tracked - ensure metadata tables exist
    // InitSpatialMetaData(1) safely skips if already initialized
    db.exec("SELECT InitSpatialMetaData(1)");
    loadedDatabases.add(db);
    return true;
  } catch {
    return false;
  }
}

/**
 * Ensure SpatiaLite is loaded, throw if not
 */
function ensureSpatialite(adapter: NativeSqliteAdapter): void {
  if (!isSpatialiteLoaded(adapter)) {
    const result = tryLoadSpatialite(adapter);
    if (!result.success) {
      throw new Error(result.error ?? "Failed to load SpatiaLite");
    }
  }
}

/**
 * Load SpatiaLite extension
 */
function createLoadSpatialiteTool(
  adapter: NativeSqliteAdapter,
): ToolDefinition {
  return {
    name: "sqlite_spatialite_load",
    description:
      "Load SpatiaLite extension for geospatial capabilities. Required before using other spatial tools.",
    group: "geo",
    inputSchema: LoadSpatialiteSchema,
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
          message: result.error,
          searchedPaths: SPATIALITE_PATHS,
        });
      } catch (error) {
        return Promise.resolve(formatError(error));
      }
    },
  };
}

/**
 * Create spatial table
 */
function createSpatialTableTool(adapter: NativeSqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_spatialite_create_table",
    description:
      "Create a spatial table with geometry column using SpatiaLite.",
    group: "geo",
    inputSchema: CreateSpatialTableSchema,
    requiredScopes: ["write"],
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const input = CreateSpatialTableSchema.parse(params);
        ensureSpatialite(adapter);

        // Validate table name
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.tableName)) {
          return { success: false, error: "Invalid table name" };
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
              error: `Invalid column name: ${col.name}`,
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
        return formatError(error);
      }
    },
  };
}

/**
 * Execute spatial query
 */
function createSpatialQueryTool(adapter: NativeSqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_spatialite_query",
    description:
      "Execute spatial SQL queries using SpatiaLite functions (ST_Distance, ST_Within, etc.).",
    group: "geo",
    inputSchema: SpatialQuerySchema,
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
        return formatError(error);
      }
    },
  };
}

/**
 * Spatial analysis
 */
function createSpatialAnalysisTool(
  adapter: NativeSqliteAdapter,
): ToolDefinition {
  return {
    name: "sqlite_spatialite_analyze",
    description:
      "Perform spatial analysis: nearest neighbor, point in polygon, distance matrix. For point_in_polygon, sourceTable should contain POINTs and targetTable should contain POLYGONs.",
    group: "geo",
    inputSchema: SpatialAnalysisSchema,
    requiredScopes: ["read"],
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const input = SpatialAnalysisSchema.parse(params);
        ensureSpatialite(adapter);

        // Validate names
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.sourceTable)) {
          return { success: false, error: "Invalid source table name" };
        }
        if (
          input.targetTable &&
          !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.targetTable)
        ) {
          return { success: false, error: "Invalid target table name" };
        }

        let query: string;
        switch (input.analysisType) {
          case "spatial_extent":
            query = `SELECT
              MbrMinX(Extent("${input.geometryColumn}")) as min_x,
              MbrMinY(Extent("${input.geometryColumn}")) as min_y,
              MbrMaxX(Extent("${input.geometryColumn}")) as max_x,
              MbrMaxY(Extent("${input.geometryColumn}")) as max_y,
              COUNT(*) as feature_count
            FROM "${input.sourceTable}"`;
            break;

          case "nearest_neighbor": {
            if (!input.targetTable) {
              return {
                success: false,
                error:
                  "Missing required parameter 'targetTable' for nearest neighbor analysis",
              };
            }
            // Exclude self-matches when tables are the same and excludeSelf is true
            const sameTable = input.sourceTable === input.targetTable;
            const selfFilter =
              sameTable && input.excludeSelf ? "WHERE s.id != t.id" : "";
            // Conditionally include WKT geometry based on includeGeometry param
            const geomColumns = input.includeGeometry
              ? `, AsText(s."${input.geometryColumn}") as source_geom, AsText(t."${input.geometryColumn}") as target_geom`
              : "";
            query = `SELECT
              s.id as source_id, t.id as target_id,
              ST_Distance(s."${input.geometryColumn}", t."${input.geometryColumn}") as distance${geomColumns}
            FROM "${input.sourceTable}" s, "${input.targetTable}" t
            ${selfFilter}
            ORDER BY distance LIMIT ${input.limit}`;
            break;
          }

          case "point_in_polygon": {
            if (!input.targetTable) {
              return {
                success: false,
                error:
                  "Missing required parameter 'targetTable' for point in polygon analysis",
              };
            }
            // Conditionally include WKT geometry based on includeGeometry param
            const geomCols = input.includeGeometry
              ? `, AsText(s."${input.geometryColumn}") as source_geom, AsText(t."${input.geometryColumn}") as target_geom`
              : "";
            query = `SELECT
              s.id as source_id, t.id as target_id${geomCols}
            FROM "${input.sourceTable}" s, "${input.targetTable}" t
            WHERE ST_Within(s."${input.geometryColumn}", t."${input.geometryColumn}")
            LIMIT ${input.limit}`;
            break;
          }

          case "distance_matrix": {
            const dmTarget = input.targetTable ?? input.sourceTable;
            const dmSameTable = dmTarget === input.sourceTable;
            const dmFilter = dmSameTable ? "WHERE a.id < b.id" : "";
            query = `SELECT a.id as id1, b.id as id2,
              ST_Distance(a."${input.geometryColumn}", b."${input.geometryColumn}") as distance
            FROM "${input.sourceTable}" a, "${dmTarget}" b
            ${dmFilter}
            ORDER BY distance LIMIT ${input.limit}`;
            break;
          }
        }

        const result = await adapter.executeReadQuery(query);

        return {
          success: true,
          analysisType: input.analysisType,
          rowCount: result.rows?.length ?? 0,
          results: result.rows,
        };
      } catch (error) {
        return formatError(error);
      }
    },
  };
}

/**
 * Spatial index management
 */
function createSpatialIndexTool(adapter: NativeSqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_spatialite_index",
    description:
      "Create, drop, or check spatial R-Tree index on geometry column.",
    group: "geo",
    inputSchema: SpatialIndexSchema,
    requiredScopes: ["write"],
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const input = SpatialIndexSchema.parse(params);
        ensureSpatialite(adapter);

        // Validate names
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.tableName)) {
          return { success: false, error: "Invalid table name" };
        }

        // Validate table exists before attempting index operations
        const tableCheck = await adapter.executeReadQuery(
          `SELECT name FROM sqlite_master WHERE type='table' AND name='${input.tableName}'`,
        );
        if (!tableCheck.rows || tableCheck.rows.length === 0) {
          return {
            success: false,
            error: `Table '${input.tableName}' does not exist`,
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
            const isValid =
              checkValue != null ? Object.values(checkValue)[0] === 1 : false;
            return {
              success: true,
              message: isValid
                ? "Spatial index is valid"
                : "Spatial index exists but may be invalid",
              action: "check",
              indexed: true,
              valid: isValid,
            };
          }
        }
      } catch (error) {
        return formatError(error);
      }
    },
  };
}

/**
 * Geometry transformation operations
 */
function createGeometryTransformTool(
  adapter: NativeSqliteAdapter,
): ToolDefinition {
  return {
    name: "sqlite_spatialite_transform",
    description:
      "Perform geometry operations: buffer, intersection, union, centroid, simplify.",
    group: "geo",
    inputSchema: GeometryTransformSchema,
    requiredScopes: ["read"],
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const input = GeometryTransformSchema.parse(params);
        ensureSpatialite(adapter);

        let query: string;
        switch (input.operation) {
          case "buffer": {
            const bufferGeom = `Buffer(GeomFromText('${input.geometry1}', ${input.srid}), ${input.distance})`;
            // Auto-simplify buffer output with adaptive tolerance based on buffer distance
            // Tolerance scales with distance (1% of buffer distance) for effective vertex reduction
            // Use simplifyTolerance: 0 to disable, or specify custom tolerance
            const defaultTolerance = Math.max(0.0001, input.distance * 0.01);
            const tolerance = input.simplifyTolerance ?? defaultTolerance;
            const finalGeom =
              tolerance > 0
                ? `Simplify(${bufferGeom}, ${tolerance})`
                : bufferGeom;
            query = `SELECT AsText(${finalGeom}) as result`;
            break;
          }

          case "intersection":
            if (!input.geometry2) {
              return {
                success: false,
                error: "Second geometry required for intersection",
              };
            }
            query = `SELECT AsText(Intersection(
              GeomFromText('${input.geometry1}', ${input.srid}),
              GeomFromText('${input.geometry2}', ${input.srid})
            )) as result`;
            break;

          case "union":
            if (!input.geometry2) {
              return {
                success: false,
                error: "Second geometry required for union",
              };
            }
            query = `SELECT AsText(GUnion(
              GeomFromText('${input.geometry1}', ${input.srid}),
              GeomFromText('${input.geometry2}', ${input.srid})
            )) as result`;
            break;

          case "difference":
            if (!input.geometry2) {
              return {
                success: false,
                error: "Second geometry required for difference",
              };
            }
            query = `SELECT AsText(Difference(
              GeomFromText('${input.geometry1}', ${input.srid}),
              GeomFromText('${input.geometry2}', ${input.srid})
            )) as result`;
            break;

          case "centroid":
            query = `SELECT AsText(Centroid(GeomFromText('${input.geometry1}', ${input.srid}))) as result`;
            break;

          case "envelope":
            query = `SELECT AsText(Envelope(GeomFromText('${input.geometry1}', ${input.srid}))) as result`;
            break;

          case "simplify":
            query = `SELECT AsText(Simplify(GeomFromText('${input.geometry1}', ${input.srid}), ${input.distance})) as result`;
            break;
        }

        const result = await adapter.executeReadQuery(query);
        const wktResult = result.rows?.[0]?.["result"] as string | undefined;

        // Check for null result indicating invalid geometry input
        if (wktResult === null || wktResult === undefined) {
          return {
            success: false,
            error: `Invalid geometry: '${input.geometry1}' could not be parsed as WKT`,
          };
        }

        return {
          success: true,
          operation: input.operation,
          result: wktResult,
        };
      } catch (error) {
        return formatError(error);
      }
    },
  };
}

/**
 * Import spatial data
 */
function createSpatialImportTool(adapter: NativeSqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_spatialite_import",
    description:
      "Import geometry data from WKT or GeoJSON into a spatial table.",
    group: "geo",
    inputSchema: SpatialImportSchema,
    requiredScopes: ["write"],
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const input = SpatialImportSchema.parse(params);
        ensureSpatialite(adapter);

        // Validate table name
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.tableName)) {
          return { success: false, error: "Invalid table name" };
        }

        let wkt: string;
        if (input.format === "geojson") {
          // Parse GeoJSON and convert with SRID
          try {
            // Validate JSON to ensure it's valid GeoJSON
            JSON.parse(input.data);

            // Build INSERT with additional columns (matching WKT path)
            // Use SetSRID(GeomFromGeoJSON(...), srid) to ensure SRID is set correctly
            const columns = ["geom"];
            const values = [
              `SetSRID(GeomFromGeoJSON('${input.data}'), ${input.srid})`,
            ];

            if (input.additionalData) {
              for (const [key, value] of Object.entries(input.additionalData)) {
                if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
                  return {
                    success: false,
                    error: `Invalid column name: ${key}`,
                  };
                }
                columns.push(`"${key}"`);
                values.push(
                  typeof value === "string"
                    ? `'${value.replace(/'/g, "''")}'`
                    : String(value),
                );
              }
            }

            const sql = `INSERT INTO "${input.tableName}" (${columns.join(", ")}) VALUES (${values.join(", ")})`;
            const insertResult = await adapter.executeWriteQuery(sql);
            return {
              success: true,
              message: "GeoJSON geometry imported",
              rowsAffected: insertResult.rowsAffected ?? 1,
            };
          } catch (e) {
            return {
              success: false,
              error: `Invalid GeoJSON: ${e instanceof Error ? e.message : String(e)}`,
            };
          }
        } else {
          wkt = input.data;
        }

        // Validate WKT by attempting to parse it
        const wktCheck = await adapter.executeReadQuery(
          `SELECT GeomFromText('${wkt}', ${input.srid}) as geom`,
        );
        const parsedGeom = wktCheck.rows?.[0]?.["geom"];
        if (parsedGeom === null || parsedGeom === undefined) {
          return {
            success: false,
            error: `Invalid WKT geometry: '${wkt}' could not be parsed`,
          };
        }

        // Build INSERT with additional columns
        const columns = ["geom"];
        const values = [`GeomFromText('${wkt}', ${input.srid})`];

        if (input.additionalData) {
          for (const [key, value] of Object.entries(input.additionalData)) {
            if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
              return {
                success: false,
                error: `Invalid column name: ${key}`,
              };
            }
            columns.push(`"${key}"`);
            values.push(
              typeof value === "string"
                ? `'${value.replace(/'/g, "''")}'`
                : String(value),
            );
          }
        }

        const sql = `INSERT INTO "${input.tableName}" (${columns.join(", ")}) VALUES (${values.join(", ")})`;
        const insertResult = await adapter.executeWriteQuery(sql);

        return {
          success: true,
          message: "WKT geometry imported",
          rowsAffected: insertResult.rowsAffected ?? 1,
        };
      } catch (error) {
        return formatError(error);
      }
    },
  };
}
