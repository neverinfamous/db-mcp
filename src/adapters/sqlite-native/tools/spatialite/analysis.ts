/**
 * SpatiaLite Analysis & Import Tool Implementations
 *
 * Spatial analysis, geometry transforms, and data import tools.
 * - sqlite_spatialite_analyze
 * - sqlite_spatialite_transform
 * - sqlite_spatialite_import
 */

import type { ToolDefinition, RequestContext } from "../../../../types/index.js";
import type { NativeSqliteAdapter } from "../../native-sqlite-adapter.js";
import { formatHandlerError } from "../../../../utils/errors/index.js";
import {
  SpatialAnalysisSchema,
  GeometryTransformSchema,
  SpatialImportSchema,
  VALID_ANALYSIS_TYPES,
  VALID_FORMATS,
  VALID_OPERATIONS,
} from "./schemas.js";
import { ensureSpatialite } from "./loader.js";

/**
 * Spatial analysis
 */
export function createSpatialAnalysisTool(
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

        // Handler-level enum validation (schema uses z.string() to avoid SDK raw MCP errors)
        if (!(VALID_ANALYSIS_TYPES as readonly string[]).includes(input.analysisType)) {
          return {
            success: false,
            error: `Invalid analysisType: '${input.analysisType}'. Must be one of: ${VALID_ANALYSIS_TYPES.join(", ")}`,
            code: "VALIDATION_ERROR",
            category: "validation",
            recoverable: false,
          };
        }

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

          default:
            // Unreachable — handler-level validation above catches invalid values
            query = "SELECT 1";
        }

        const result = await adapter.executeReadQuery(query);

        return {
          success: true,
          analysisType: input.analysisType,
          rowCount: result.rows?.length ?? 0,
          results: result.rows,
        };
      } catch (error) {
        return formatHandlerError(error);
      }
    },
  };
}

/**
 * Geometry transformation operations
 */
export function createGeometryTransformTool(
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

        // Handler-level enum validation (schema uses z.string() to avoid SDK raw MCP errors)
        if (!(VALID_OPERATIONS as readonly string[]).includes(input.operation)) {
          return {
            success: false,
            error: `Invalid operation: '${input.operation}'. Must be one of: ${VALID_OPERATIONS.join(", ")}`,
            code: "VALIDATION_ERROR",
            category: "validation",
            recoverable: false,
          };
        }

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

          default:
            // Unreachable — handler-level validation above catches invalid values
            query = "SELECT 1";
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
        return formatHandlerError(error);
      }
    },
  };
}

/**
 * Import spatial data
 */
export function createSpatialImportTool(
  adapter: NativeSqliteAdapter,
): ToolDefinition {
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

        // Handler-level enum validation (schema uses z.string() to avoid SDK raw MCP errors)
        if (!(VALID_FORMATS as readonly string[]).includes(input.format)) {
          return {
            success: false,
            error: `Invalid format: '${input.format}'. Must be one of: ${VALID_FORMATS.join(", ")}`,
            code: "VALIDATION_ERROR",
            category: "validation",
            recoverable: false,
          };
        }

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
        return formatHandlerError(error);
      }
    },
  };
}
