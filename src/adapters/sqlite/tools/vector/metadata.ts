/**
 * Vector Metadata Tool Implementations
 *
 * Count, stats, dimensions, normalize, and distance tools.
 */

import type { SqliteAdapter } from "../../sqlite-adapter.js";
import type { ToolDefinition, RequestContext } from "../../../../types/index.js";
import { readOnly } from "../../../../utils/annotations.js";
import { sanitizeIdentifier } from "../../../../utils/index.js";
import { formatHandlerError } from "../../../../utils/errors/index.js";
import {
  VectorCountOutputSchema,
  VectorStatsOutputSchema,
  VectorDimensionsOutputSchema,
  VectorNormalizeOutputSchema,
  VectorDistanceOutputSchema,
} from "../../output-schemas/index.js";
import {
  VectorNormalizeSchema,
  VectorDistanceSchema,
  VectorCountSchema,
  VectorStatsSchema,
  VectorDimensionsSchema,
} from "./schemas.js";
import {
  cosineSimilarity,
  euclideanDistance,
  dotProduct,
  normalizeVector,
  parseVector,
} from "./helpers.js";

/**
 * Count vectors
 */
export function createVectorCountTool(
  adapter: SqliteAdapter,
): ToolDefinition {
  return {
    name: "sqlite_vector_count",
    description: "Count vectors in a table.",
    group: "vector",
    inputSchema: VectorCountSchema,
    outputSchema: VectorCountOutputSchema,
    requiredScopes: ["read"],
    annotations: readOnly("Count Vectors"),
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const input = VectorCountSchema.parse(params);

        // Validate and quote table name
        const table = sanitizeIdentifier(input.table);

        let sql = `SELECT COUNT(*) as count FROM ${table}`;
        if (input.dimensions !== undefined) {
          sql += ` WHERE dimensions = ${input.dimensions}`;
        }
        const result = await adapter.executeReadQuery(sql);

        return {
          success: true,
          count: result.rows?.[0]?.["count"] ?? 0,
        };
      } catch (error) {
        return formatHandlerError(error);
      }
    },
  };
}

/**
 * Vector statistics
 */
export function createVectorStatsTool(
  adapter: SqliteAdapter,
): ToolDefinition {
  return {
    name: "sqlite_vector_stats",
    description: "Get statistics about vectors in a table.",
    group: "vector",
    inputSchema: VectorStatsSchema,
    outputSchema: VectorStatsOutputSchema,
    requiredScopes: ["read"],
    annotations: readOnly("Vector Stats"),
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const input = VectorStatsSchema.parse(params);

        // Validate and quote identifiers
        const table = sanitizeIdentifier(input.table);
        const vectorColumn = sanitizeIdentifier(input.vectorColumn);

        // Get sample of vectors
        const sql = `SELECT ${vectorColumn} FROM ${table} LIMIT ${input.sampleSize}`;
        const result = await adapter.executeReadQuery(sql);

        const vectors: number[][] = [];
        const rows = result.rows ?? [];
        
        for (let i = 0; i < rows.length; i++) {
          if (i > 0 && i % 500 === 0) {
            await new Promise((resolve) => setTimeout(resolve, 0));
          }
          
          try {
            const row = rows[i];
            if (row) {
              vectors.push(parseVector(row[input.vectorColumn]));
            }
          } catch {
            // Skip invalid vectors
          }
        }

        if (vectors.length === 0) {
          return {
            success: true,
            count: 0,
            message: "No valid vectors found",
          };
        }

        const firstVector = vectors[0];
        if (!firstVector) {
          return {
            success: true,
            count: 0,
            message: "No valid vectors found",
          };
        }

        const dimensions = firstVector.length;
        const magnitudes = vectors.map((v) =>
          Math.sqrt(v.reduce((s, x) => s + x * x, 0)),
        );

        return {
          success: true,
          sampleSize: vectors.length,
          dimensions,
          magnitudeStats: {
            min: Math.min(...magnitudes),
            max: Math.max(...magnitudes),
            avg: magnitudes.reduce((s, m) => s + m, 0) / magnitudes.length,
          },
        };
      } catch (error) {
        return formatHandlerError(error);
      }
    },
  };
}

/**
 * Get vector dimensions
 */
export function createVectorDimensionsTool(
  adapter: SqliteAdapter,
): ToolDefinition {
  return {
    name: "sqlite_vector_dimensions",
    description: "Get the dimensions of vectors in a table.",
    group: "vector",
    inputSchema: VectorDimensionsSchema,
    outputSchema: VectorDimensionsOutputSchema,
    requiredScopes: ["read"],
    annotations: readOnly("Vector Dimensions"),
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const input = VectorDimensionsSchema.parse(params);

        // Validate and quote identifiers
        const table = sanitizeIdentifier(input.table);
        const vectorColumn = sanitizeIdentifier(input.vectorColumn);

        const sql = `SELECT ${vectorColumn} FROM ${table} LIMIT 1`;
        const result = await adapter.executeReadQuery(sql);

        if (!result.rows || result.rows.length === 0) {
          return {
            success: true,
            dimensions: null,
            message: "No vectors found",
          };
        }

        const firstRow = result.rows[0];
        if (!firstRow) {
          return {
            success: true,
            dimensions: null,
            message: "No vectors found",
          };
        }
        const vector = parseVector(firstRow[input.vectorColumn]);

        return {
          success: true,
          dimensions: vector.length,
        };
      } catch (error) {
        return formatHandlerError(error);
      }
    },
  };
}

/**
 * Normalize a vector
 */
export function createVectorNormalizeTool(): ToolDefinition {
  return {
    name: "sqlite_vector_normalize",
    description: "Normalize a vector to unit length.",
    group: "vector",
    inputSchema: VectorNormalizeSchema,
    outputSchema: VectorNormalizeOutputSchema,
    requiredScopes: ["read"],
    annotations: readOnly("Normalize Vector"),
    handler: (params: unknown, _context: RequestContext) => {
      try {
        const input = VectorNormalizeSchema.parse(params);

        if (input.vector.length === 0) {
          return Promise.resolve({
            success: false,
            error: "vector is required and must be a non-empty array of numbers",
          });
        }

        const normalized = normalizeVector(input.vector);

        return Promise.resolve({
          success: true,
          original: input.vector,
          normalized,
          originalMagnitude: Math.sqrt(
            input.vector.reduce((s, x) => s + x * x, 0),
          ),
        });
      } catch (error) {
        return Promise.resolve(formatHandlerError(error));
      }
    },
  };
}

/**
 * Calculate distance between two vectors
 */
export function createVectorDistanceTool(): ToolDefinition {
  return {
    name: "sqlite_vector_distance",
    description: "Calculate distance or similarity between two vectors.",
    group: "vector",
    inputSchema: VectorDistanceSchema,
    outputSchema: VectorDistanceOutputSchema,
    requiredScopes: ["read"],
    annotations: readOnly("Vector Distance"),
    handler: (params: unknown, _context: RequestContext) => {
      try {
        const input = VectorDistanceSchema.parse(params);

        if (input.vector1.length === 0 || input.vector2.length === 0) {
          return Promise.resolve({
            success: false,
            error: "vector1 and vector2 are required and must be non-empty arrays of numbers",
          });
        }

        if (input.vector1.length !== input.vector2.length) {
          return Promise.resolve({
            success: false,
            error: "Vector dimensions must match",
            code: "DIMENSION_MISMATCH",
          });
        }

        let result: number;
        switch (input.metric) {
          case "euclidean":
            result = euclideanDistance(input.vector1, input.vector2);
            break;
          case "dot":
            result = dotProduct(input.vector1, input.vector2);
            break;
          case "cosine":
            result = 1 - cosineSimilarity(input.vector1, input.vector2);
            break;
          default:
            return Promise.resolve({
              success: false,
              error: `Invalid metric '${input.metric}'. Valid values: cosine, euclidean, dot`,
            });
        }

        return Promise.resolve({
          success: true,
          metric: input.metric,
          value: Math.round(result * 10000) / 10000,
        });
      } catch (error) {
        return Promise.resolve(formatHandlerError(error));
      }
    },
  };
}
