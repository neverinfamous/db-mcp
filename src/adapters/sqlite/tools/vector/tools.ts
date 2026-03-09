/**
 * Vector Search Tool Implementations
 *
 * All 11 vector tool creator functions.
 */

import type { SqliteAdapter } from "../../SqliteAdapter.js";
import type { ToolDefinition, RequestContext } from "../../../../types/index.js";
import {
  readOnly,
  write,
  idempotent,
  destructive,
} from "../../../../utils/annotations.js";
import {
  validateWhereClause,
  sanitizeIdentifier,
} from "../../../../utils/index.js";
import { formatError } from "../../../../utils/errors.js";
import {
  CreateTableOutputSchema,
  VectorStoreOutputSchema,
  VectorBatchStoreOutputSchema,
  VectorGetOutputSchema,
  VectorSearchOutputSchema,
  VectorDeleteOutputSchema,
  VectorCountOutputSchema,
  VectorStatsOutputSchema,
  VectorDimensionsOutputSchema,
  VectorNormalizeOutputSchema,
  VectorDistanceOutputSchema,
} from "../../output-schemas/index.js";
import {
  VectorStoreSchema,
  VectorSearchSchema,
  VectorCreateTableSchema,
  VectorNormalizeSchema,
  VectorDistanceSchema,
  VectorBatchStoreSchema,
  VectorDeleteSchema,
  VectorGetSchema,
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
 * Create a table for vector storage
 */
export function createVectorCreateTableTool(
  adapter: SqliteAdapter,
): ToolDefinition {
  return {
    name: "sqlite_vector_create_table",
    description:
      "Create a table optimized for vector storage with JSON vector column.",
    group: "vector",
    inputSchema: VectorCreateTableSchema,
    outputSchema: CreateTableOutputSchema,
    requiredScopes: ["write"],
    annotations: idempotent("Create Vector Table"),
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const input = VectorCreateTableSchema.parse(params);

        if (input.dimensions < 1) {
          return {
            success: false,
            error: "Dimensions must be at least 1",
          };
        }

        // Validate and quote table name
        const tableName = sanitizeIdentifier(input.tableName);

        const columns = [
          "id INTEGER PRIMARY KEY",
          "vector TEXT NOT NULL", // JSON array
          `dimensions INTEGER DEFAULT ${input.dimensions}`,
        ];

        if (input.additionalColumns.length > 0) {
          for (const col of input.additionalColumns) {
            const colName = sanitizeIdentifier(col.name);
            columns.push(`${colName} ${col.type}`);
          }
        }

        const sql = `CREATE TABLE IF NOT EXISTS ${tableName} (${columns.join(", ")})`;

        await adapter.executeQuery(sql);

        return {
          success: true,
          message: `Vector table '${input.tableName}' created with ${input.dimensions} dimensions`,
          sql,
        };
      } catch (error) {
        return formatError(error);
      }
    },
  };
}

/**
 * Store a vector
 */
export function createVectorStoreTool(
  adapter: SqliteAdapter,
): ToolDefinition {
  return {
    name: "sqlite_vector_store",
    description: "Store or update a vector in the database.",
    group: "vector",
    inputSchema: VectorStoreSchema,
    outputSchema: VectorStoreOutputSchema,
    requiredScopes: ["write"],
    annotations: write("Store Vector"),
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const input = VectorStoreSchema.parse(params);

        // Validate and quote identifiers
        const table = sanitizeIdentifier(input.table);
        const idColumn = sanitizeIdentifier(input.idColumn);
        const vectorColumn = sanitizeIdentifier(input.vectorColumn);

        const vectorJson = JSON.stringify(input.vector);
        const idValue =
          typeof input.id === "string" ? `'${input.id}'` : input.id;

        // Try update first, then insert
        const updateSql = `UPDATE ${table} SET ${vectorColumn} = '${vectorJson}' WHERE ${idColumn} = ${idValue}`;
        const updateResult = await adapter.executeWriteQuery(updateSql);

        if (updateResult.rowsAffected === 0) {
          const insertSql = `INSERT INTO ${table} (${idColumn}, ${vectorColumn}) VALUES (${idValue}, '${vectorJson}')`;
          await adapter.executeWriteQuery(insertSql);
        }

        return {
          success: true,
          id: input.id,
          dimensions: input.vector.length,
        };
      } catch (error) {
        return formatError(error);
      }
    },
  };
}

/**
 * Batch store vectors
 */
export function createVectorBatchStoreTool(
  adapter: SqliteAdapter,
): ToolDefinition {
  return {
    name: "sqlite_vector_batch_store",
    description: "Store multiple vectors in a batch operation.",
    group: "vector",
    inputSchema: VectorBatchStoreSchema,
    outputSchema: VectorBatchStoreOutputSchema,
    requiredScopes: ["write"],
    annotations: write("Batch Store Vectors"),
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const input = VectorBatchStoreSchema.parse(params);

        // Validate table exists before early-returning for empty items
        const table = sanitizeIdentifier(input.table);
        if (input.items.length === 0) {
          // Verify the table exists even with no items to avoid silent success on nonexistent tables
          const checkSql = `SELECT name FROM sqlite_master WHERE type='table' AND name='${input.table}'`;
          const checkResult = await adapter.executeReadQuery(checkSql);
          if (!checkResult.rows || checkResult.rows.length === 0) {
            return {
              success: false,
              error: `Table '${input.table}' does not exist`,
            };
          }
          return {
            success: true,
            stored: 0,
            message: "No items provided",
          };
        }

        const idColumn = sanitizeIdentifier(input.idColumn);
        const vectorColumn = sanitizeIdentifier(input.vectorColumn);

        let stored = 0;
        for (const item of input.items) {
          const vectorJson = JSON.stringify(item.vector);
          const idValue =
            typeof item.id === "string" ? `'${item.id}'` : item.id;

          const sql = `INSERT OR REPLACE INTO ${table} (${idColumn}, ${vectorColumn}) VALUES (${idValue}, '${vectorJson}')`;
          await adapter.executeWriteQuery(sql);
          stored++;
        }

        return {
          success: true,
          stored,
          dimensions: input.items[0]?.vector.length,
        };
      } catch (error) {
        return formatError(error);
      }
    },
  };
}

/**
 * Vector similarity search
 */
export function createVectorSearchTool(
  adapter: SqliteAdapter,
): ToolDefinition {
  return {
    name: "sqlite_vector_search",
    description:
      "Find similar vectors using cosine, euclidean, or dot product similarity.",
    group: "vector",
    inputSchema: VectorSearchSchema,
    outputSchema: VectorSearchOutputSchema,
    requiredScopes: ["read"],
    annotations: readOnly("Vector Search"),
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const input = VectorSearchSchema.parse(params);

        // Validate and quote identifiers
        const table = sanitizeIdentifier(input.table);
        const vectorColumn = sanitizeIdentifier(input.vectorColumn);

        // Build select clause
        // Determine if vector column should be included in final results
        const includeVectorInResults =
          !input.returnColumns ||
          input.returnColumns.length === 0 ||
          input.returnColumns.includes(input.vectorColumn);

        let selectCols = "*";
        if (input.returnColumns && input.returnColumns.length > 0) {
          const quotedCols = input.returnColumns.map((c) =>
            sanitizeIdentifier(c),
          );
          selectCols = quotedCols.join(", ");
        }

        // Always fetch vector column for similarity calculation, but may remove from results
        let sql = `SELECT ${selectCols}, ${vectorColumn} FROM ${table}`;
        if (input.whereClause) {
          validateWhereClause(input.whereClause);
          sql += ` WHERE ${input.whereClause}`;
        }

        const result = await adapter.executeReadQuery(sql);

        // Calculate similarities in JavaScript
        const queryVector = input.queryVector;
        const scored = (result.rows ?? [])
          .map((row) => {
            try {
              const storedVector = parseVector(row[input.vectorColumn]);
              let score: number;

              switch (input.metric) {
                case "euclidean":
                  // Invert so lower distance = higher score
                  score =
                    1 / (1 + euclideanDistance(queryVector, storedVector));
                  break;
                case "dot":
                  score = dotProduct(queryVector, storedVector);
                  break;
                case "cosine":
                default:
                  score = cosineSimilarity(queryVector, storedVector);
              }

              return {
                ...row,
                _similarity: Math.round(score * 10000) / 10000,
              };
            } catch {
              return null;
            }
          })
          .filter((r): r is NonNullable<typeof r> => r !== null);

        // Sort by similarity (descending) and limit
        scored.sort((a, b) => b._similarity - a._similarity);
        const limited = scored.slice(0, input.limit);

        // Apply returnColumns filtering (payload optimization)
        // If returnColumns specified, only include those columns plus _similarity
        const results = limited.map((row) => {
          // Cast row for proper indexing since it's a spread of result row + _similarity
          const rowData = row as Record<string, unknown>;
          if (input.returnColumns && input.returnColumns.length > 0) {
            // Build filtered result with only requested columns
            const filtered: Record<string, unknown> = {};
            for (const col of input.returnColumns) {
              if (col in rowData) {
                filtered[col] = rowData[col];
              }
            }
            filtered["_similarity"] = row._similarity;
            return filtered;
          }
          // No returnColumns specified: include all except vector column (for cleaner output)
          if (!includeVectorInResults) {
            return Object.fromEntries(
              Object.entries(rowData).filter(
                ([key]) => key !== input.vectorColumn,
              ),
            );
          }
          return row;
        });

        return {
          success: true,
          metric: input.metric,
          count: results.length,
          results,
        };
      } catch (error) {
        return formatError(error);
      }
    },
  };
}

/**
 * Get a vector by ID
 */
export function createVectorGetTool(
  adapter: SqliteAdapter,
): ToolDefinition {
  return {
    name: "sqlite_vector_get",
    description: "Retrieve a vector by its ID.",
    group: "vector",
    inputSchema: VectorGetSchema,
    outputSchema: VectorGetOutputSchema,
    requiredScopes: ["read"],
    annotations: readOnly("Get Vector"),
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const input = VectorGetSchema.parse(params);

        // Validate and quote identifiers
        const table = sanitizeIdentifier(input.table);
        const idColumn = sanitizeIdentifier(input.idColumn);
        // Keep vectorColumn raw for JS object access, but validate
        sanitizeIdentifier(input.vectorColumn);

        const idValue =
          typeof input.id === "string" ? `'${input.id}'` : input.id;
        const sql = `SELECT * FROM ${table} WHERE ${idColumn} = ${idValue}`;

        const result = await adapter.executeReadQuery(sql);

        if (!result.rows || result.rows.length === 0) {
          return { success: false, error: "Vector not found" };
        }

        const row = result.rows[0];
        if (!row) {
          return { success: false, error: "Vector not found" };
        }

        // Check if the vector column exists in the row data
        const rawVector = row[input.vectorColumn];
        if (rawVector === undefined || rawVector === null) {
          return {
            success: false,
            error: `Column '${input.vectorColumn}' not found or contains NULL. Available columns: ${Object.keys(row).join(", ")}`,
          };
        }
        const vectorData = parseVector(rawVector);

        return {
          success: true,
          id: input.id,
          dimensions: vectorData.length,
          vector: vectorData,
          metadata: row,
        };
      } catch (error) {
        return formatError(error);
      }
    },
  };
}

/**
 * Delete vectors by ID
 */
export function createVectorDeleteTool(
  adapter: SqliteAdapter,
): ToolDefinition {
  return {
    name: "sqlite_vector_delete",
    description: "Delete vectors by their IDs.",
    group: "vector",
    inputSchema: VectorDeleteSchema,
    outputSchema: VectorDeleteOutputSchema,
    requiredScopes: ["write"],
    annotations: destructive("Delete Vectors"),
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const input = VectorDeleteSchema.parse(params);

        // Validate and quote identifiers
        const table = sanitizeIdentifier(input.table);
        const idColumn = sanitizeIdentifier(input.idColumn);

        const idValues = input.ids
          .map((id) => (typeof id === "string" ? `'${id}'` : String(id)))
          .join(", ");

        const sql = `DELETE FROM ${table} WHERE ${idColumn} IN (${idValues})`;
        const result = await adapter.executeWriteQuery(sql);

        return {
          success: true,
          deleted: result.rowsAffected,
        };
      } catch (error) {
        return formatError(error);
      }
    },
  };
}

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
        return formatError(error);
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

        const vectors = (result.rows ?? [])
          .map((row) => {
            try {
              return parseVector(row[input.vectorColumn]);
            } catch {
              return null;
            }
          })
          .filter((v): v is number[] => v !== null);

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
        return formatError(error);
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
        return formatError(error);
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
        return Promise.resolve(formatError(error));
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

        if (input.vector1.length !== input.vector2.length) {
          return Promise.resolve({
            success: false,
            error: "Vector dimensions must match",
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
          default:
            result = 1 - cosineSimilarity(input.vector1, input.vector2);
        }

        return Promise.resolve({
          success: true,
          metric: input.metric,
          value: Math.round(result * 10000) / 10000,
        });
      } catch (error) {
        return Promise.resolve(formatError(error));
      }
    },
  };
}
