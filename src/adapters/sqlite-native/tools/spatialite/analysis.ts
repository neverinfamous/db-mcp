/**
 * SpatiaLite Analysis & Import Tool Implementations
 *
 * Spatial analysis, geometry transforms, and data import tools.
 * - sqlite_spatialite_analyze
 * - sqlite_spatialite_transform
 * - sqlite_spatialite_import
 */

import type {
  ToolDefinition,
  RequestContext,
} from "../../../../types/index.js";
import type { NativeSqliteAdapter } from "../../native-sqlite-adapter.js";
import { formatHandlerError } from "../../../../utils/errors/index.js";
import { readOnly, writeFs } from "../../../../utils/annotations.js";
import {
  validateIdentifier,
  sanitizeIdentifier,
} from "../../../../utils/index.js";
import {
  SpatialAnalysisSchema,
  GeometryTransformSchema,
  SpatialImportSchema,
  VALID_ANALYSIS_TYPES,
  VALID_FORMATS,
  VALID_OPERATIONS,
} from "./schemas.js";
import { ensureSpatialite } from "./loader.js";
import {
  SpatialiteAnalyzeOutputSchema,
  SpatialiteTransformOutputSchema,
  SpatialiteImportOutputSchema,
} from "../../../sqlite/schemas/index.js";

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
    outputSchema: SpatialiteAnalyzeOutputSchema,
    requiredScopes: ["read"],
    annotations: readOnly("SpatiaLite Analyze"),
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const input = SpatialAnalysisSchema.parse(params);
        ensureSpatialite(adapter);

        // Handler-level enum validation (schema uses z.string() to avoid SDK raw MCP errors)
        if (
          !(VALID_ANALYSIS_TYPES as readonly string[]).includes(
            input.analysisType,
          )
        ) {
          return {
            success: false,
            error: `Invalid analysisType: '${input.analysisType}'. Must be one of: ${VALID_ANALYSIS_TYPES.join(", ")}`,
            code: "VALIDATION_ERROR",
            category: "validation",
            recoverable: false,
          };
        }

        // Use canonical identifier validation (CWE-89 remediation)
        try {
          validateIdentifier(input.sourceTable);
        } catch {
          return {
            success: false,
            error: `Invalid source table name: '${input.sourceTable}'`,
            code: "VALIDATION_ERROR",
            category: "validation" as const,
            recoverable: false,
          };
        }
        if (input.targetTable) {
          try {
            validateIdentifier(input.targetTable);
          } catch {
            return {
              success: false,
              error: `Invalid target table name: '${input.targetTable}'`,
              code: "VALIDATION_ERROR",
              category: "validation" as const,
              recoverable: false,
            };
          }
        }
        // Validate geometry column name
        try {
          validateIdentifier(input.geometryColumn);
        } catch {
          return {
            success: false,
            error: `Invalid geometry column name: '${input.geometryColumn}'`,
            code: "VALIDATION_ERROR",
            category: "validation" as const,
            recoverable: false,
          };
        }

        let query: string;
        switch (input.analysisType) {
          case "spatial_extent": {
            const geomCol = sanitizeIdentifier(input.geometryColumn);
            const srcTable = sanitizeIdentifier(input.sourceTable);
            query = `SELECT
              MbrMinX(Extent(${geomCol})) as min_x,
              MbrMinY(Extent(${geomCol})) as min_y,
              MbrMaxX(Extent(${geomCol})) as max_x,
              MbrMaxY(Extent(${geomCol})) as max_y,
              COUNT(*) as feature_count
            FROM ${srcTable}`;
            break;
          }

          case "nearest_neighbor": {
            if (!input.targetTable) {
              return {
                success: false,
                error:
                  "Missing required parameter 'targetTable' for nearest neighbor analysis",
                code: "VALIDATION_ERROR",
                category: "validation" as const,
                recoverable: false,
              };
            }
            const geomCol = sanitizeIdentifier(input.geometryColumn);
            const srcTable = sanitizeIdentifier(input.sourceTable);
            const tgtTable = sanitizeIdentifier(input.targetTable);
            // Exclude self-matches when tables are the same and excludeSelf is true
            const sameTable = input.sourceTable === input.targetTable;
            const selfFilter =
              sameTable && input.excludeSelf ? "WHERE s.id != t.id" : "";
            // Conditionally include WKT geometry based on includeGeometry param
            const geomColumns = input.includeGeometry
              ? `, AsText(s.${geomCol}) as source_geom, AsText(t.${geomCol}) as target_geom`
              : "";
            query = `SELECT
              s.id as source_id, t.id as target_id,
              ST_Distance(s.${geomCol}, t.${geomCol}) as distance${geomColumns}
            FROM ${srcTable} s, ${tgtTable} t
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
                code: "VALIDATION_ERROR",
                category: "validation" as const,
                recoverable: false,
              };
            }
            const geomCol = sanitizeIdentifier(input.geometryColumn);
            const srcTable = sanitizeIdentifier(input.sourceTable);
            const tgtTable = sanitizeIdentifier(input.targetTable);
            // Conditionally include WKT geometry based on includeGeometry param
            const geomCols = input.includeGeometry
              ? `, AsText(s.${geomCol}) as source_geom, AsText(t.${geomCol}) as target_geom`
              : "";
            query = `SELECT
              s.id as source_id, t.id as target_id${geomCols}
            FROM ${srcTable} s, ${tgtTable} t
            WHERE ST_Within(s.${geomCol}, t.${geomCol})
            LIMIT ${input.limit}`;
            break;
          }

          case "distance_matrix": {
            const dmTarget = input.targetTable ?? input.sourceTable;
            const dmSameTable = dmTarget === input.sourceTable;
            const dmFilter = dmSameTable ? "WHERE a.id < b.id" : "";
            const geomCol = sanitizeIdentifier(input.geometryColumn);
            const srcTable = sanitizeIdentifier(input.sourceTable);
            const dmTgtTable = sanitizeIdentifier(dmTarget);
            query = `SELECT a.id as id1, b.id as id2,
              ST_Distance(a.${geomCol}, b.${geomCol}) as distance
            FROM ${srcTable} a, ${dmTgtTable} b
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
    outputSchema: SpatialiteTransformOutputSchema,
    requiredScopes: ["read"],
    annotations: readOnly("SpatiaLite Transform"),
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const input = GeometryTransformSchema.parse(params);
        ensureSpatialite(adapter);

        // Handler-level enum validation (schema uses z.string() to avoid SDK raw MCP errors)
        if (
          !(VALID_OPERATIONS as readonly string[]).includes(input.operation)
        ) {
          return {
            success: false,
            error: `Invalid operation: '${input.operation}'. Must be one of: ${VALID_OPERATIONS.join(", ")}`,
            code: "VALIDATION_ERROR",
            category: "validation",
            recoverable: false,
          };
        }

        // M-1b: Use parameterized queries for WKT geometry strings (CWE-89 remediation)
        let query: string;
        let queryParams: unknown[] = [];
        switch (input.operation) {
          case "buffer": {
            const bufferGeom = `Buffer(GeomFromText(?, ?), ?)`;
            // Auto-simplify buffer output with adaptive tolerance based on buffer distance
            // Tolerance scales with distance (1% of buffer distance) for effective vertex reduction
            // Use simplifyTolerance: 0 to disable, or specify custom tolerance
            const defaultTolerance = Math.max(0.0001, input.distance * 0.01);
            const tolerance = input.simplifyTolerance ?? defaultTolerance;
            const finalGeom =
              tolerance > 0
                ? `Simplify(${bufferGeom}, ${String(tolerance)})`
                : bufferGeom;
            query = `SELECT AsText(${finalGeom}) as result`;
            queryParams = [input.geometry1, input.srid, input.distance];
            break;
          }

          case "intersection":
            if (!input.geometry2) {
              return {
                success: false,
                error: "Second geometry required for intersection",
                code: "VALIDATION_ERROR",
                category: "validation" as const,
                recoverable: false,
              };
            }
            query = `SELECT AsText(Intersection(
              GeomFromText(?, ?),
              GeomFromText(?, ?)
            )) as result`;
            queryParams = [input.geometry1, input.srid, input.geometry2, input.srid];
            break;

          case "union":
            if (!input.geometry2) {
              return {
                success: false,
                error: "Second geometry required for union",
                code: "VALIDATION_ERROR",
                category: "validation" as const,
                recoverable: false,
              };
            }
            query = `SELECT AsText(GUnion(
              GeomFromText(?, ?),
              GeomFromText(?, ?)
            )) as result`;
            queryParams = [input.geometry1, input.srid, input.geometry2, input.srid];
            break;

          case "difference":
            if (!input.geometry2) {
              return {
                success: false,
                error: "Second geometry required for difference",
                code: "VALIDATION_ERROR",
                category: "validation" as const,
                recoverable: false,
              };
            }
            query = `SELECT AsText(Difference(
              GeomFromText(?, ?),
              GeomFromText(?, ?)
            )) as result`;
            queryParams = [input.geometry1, input.srid, input.geometry2, input.srid];
            break;

          case "centroid":
            query = `SELECT AsText(Centroid(GeomFromText(?, ?))) as result`;
            queryParams = [input.geometry1, input.srid];
            break;

          case "envelope":
            query = `SELECT AsText(Envelope(GeomFromText(?, ?))) as result`;
            queryParams = [input.geometry1, input.srid];
            break;

          case "simplify":
            query = `SELECT AsText(Simplify(GeomFromText(?, ?), ?)) as result`;
            queryParams = [input.geometry1, input.srid, input.distance];
            break;

          default:
            // Unreachable — handler-level validation above catches invalid values
            query = "SELECT 1";
        }

        const result = await adapter.executeReadQuery(query, queryParams);
        const wktResult = result.rows?.[0]?.["result"] as string | undefined;

        // Check for null result indicating invalid geometry input
        if (wktResult === null || wktResult === undefined) {
          return {
            success: false,
            error: `Invalid geometry: '${input.geometry1}' could not be parsed as WKT`,
            code: "VALIDATION_ERROR",
            category: "validation" as const,
            recoverable: false,
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
    outputSchema: SpatialiteImportOutputSchema,
    requiredScopes: ["write"],
    annotations: writeFs("SpatiaLite Import"),
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

        // Use canonical identifier validation (CWE-89 remediation)
        try {
          validateIdentifier(input.tableName);
        } catch {
          return {
            success: false,
            error: `Invalid table name: '${input.tableName}'`,
            code: "VALIDATION_ERROR",
            category: "validation" as const,
            recoverable: false,
          };
        }

        // M-1b: Use parameterized queries for all user data (CWE-89 remediation)
        let wkt: string;
        if (input.format === "geojson") {
          // Parse GeoJSON and convert with SRID
          try {
            // Validate JSON to ensure it's valid GeoJSON
            JSON.parse(input.data);

            // Validate GeoJSON by attempting to parse it in SQLite
            const geojsonCheck = await adapter.executeReadQuery(
              `SELECT GeomFromGeoJSON(?) as geom`,
              [input.data],
            );
            const parsedGeom = geojsonCheck.rows?.[0]?.["geom"];
            if (parsedGeom === null || parsedGeom === undefined) {
              return {
                success: false,
                error: `Invalid GeoJSON geometry: could not be parsed by SpatiaLite (must be a valid Geometry object)`,
                code: "VALIDATION_ERROR",
                category: "validation" as const,
                recoverable: false,
              };
            }

            // Build INSERT with parameterized values
            // Use SetSRID(GeomFromGeoJSON(...), srid) to ensure SRID is set correctly
            const columns = ["geom"];
            const placeholders = [`SetSRID(GeomFromGeoJSON(?), ?)`];
            const insertParams: unknown[] = [input.data, input.srid];

            if (input.additionalData) {
              for (const [key, value] of Object.entries(input.additionalData)) {
                if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
                  return {
                    success: false,
                    error: `Invalid column name: '${key}'`,
                    code: "VALIDATION_ERROR",
                    category: "validation" as const,
                    recoverable: false,
                  };
                }
                columns.push(sanitizeIdentifier(key));
                placeholders.push("?");
                insertParams.push(value);
              }
            }

            const sql = `INSERT INTO ${sanitizeIdentifier(input.tableName)} (${columns.join(", ")}) VALUES (${placeholders.join(", ")})`;
            const insertResult = await adapter.executeWriteQuery(
              sql,
              insertParams,
            );
            return {
              success: true,
              message: "GeoJSON geometry imported",
              rowsAffected: insertResult.rowsAffected ?? 1,
            };
          } catch (e) {
            return {
              success: false,
              error: `Invalid GeoJSON: ${e instanceof Error ? e.message : String(e)}`,
              code: "VALIDATION_ERROR",
              category: "validation" as const,
              recoverable: false,
            };
          }
        } else {
          wkt = input.data;
        }

        // Validate WKT by attempting to parse it
        const wktCheck = await adapter.executeReadQuery(
          `SELECT GeomFromText(?, ?) as geom`,
          [wkt, input.srid],
        );
        const parsedGeom = wktCheck.rows?.[0]?.["geom"];
        if (parsedGeom === null || parsedGeom === undefined) {
          return {
            success: false,
            error: `Invalid WKT geometry: '${wkt}' could not be parsed`,
            code: "VALIDATION_ERROR",
            category: "validation" as const,
            recoverable: false,
          };
        }

        // Build INSERT with parameterized values
        const columns = ["geom"];
        const placeholders = [`GeomFromText(?, ?)`];
        const insertParams: unknown[] = [wkt, input.srid];

        if (input.additionalData) {
          for (const [key, value] of Object.entries(input.additionalData)) {
            if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
              return {
                success: false,
                error: `Invalid column name: '${key}'`,
                code: "VALIDATION_ERROR",
                category: "validation" as const,
                recoverable: false,
              };
            }
            columns.push(sanitizeIdentifier(key));
            placeholders.push("?");
            insertParams.push(value);
          }
        }

        const sql = `INSERT INTO ${sanitizeIdentifier(input.tableName)} (${columns.join(", ")}) VALUES (${placeholders.join(", ")})`;
        const insertResult = await adapter.executeWriteQuery(
          sql,
          insertParams,
        );

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
