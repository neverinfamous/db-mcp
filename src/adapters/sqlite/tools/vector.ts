/**
 * SQLite Vector Search Tools
 *
 * Vector similarity search and embedding operations.
 * Uses JSON arrays for vector storage (no external extensions needed).
 * 11 tools total.
 */

import { z } from "zod";
import type { SqliteAdapter } from "../SqliteAdapter.js";
import type { ToolDefinition, RequestContext } from "../../../types/index.js";
import {
  readOnly,
  write,
  idempotent,
  destructive,
} from "../../../utils/annotations.js";
import {
  validateWhereClause,
  sanitizeIdentifier,
} from "../../../utils/index.js";
import {
  CreateTableOutputSchema,
  WriteQueryOutputSchema,
  VectorSearchOutputSchema,
  ReadQueryOutputSchema,
} from "../output-schemas.js";

// Vector schemas
const VectorStoreSchema = z.object({
  table: z.string().describe("Table name"),
  idColumn: z.string().describe("ID column name"),
  vectorColumn: z.string().describe("Column to store vector (as JSON)"),
  id: z.union([z.string(), z.number()]).describe("Row identifier"),
  vector: z.array(z.number()).describe("Vector as array of numbers"),
});

const VectorSearchSchema = z.object({
  table: z.string().describe("Table name"),
  vectorColumn: z.string().describe("Vector column name"),
  queryVector: z.array(z.number()).describe("Query vector"),
  metric: z.enum(["cosine", "euclidean", "dot"]).optional().default("cosine"),
  limit: z.number().optional().default(10),
  whereClause: z.string().optional(),
  returnColumns: z.array(z.string()).optional().describe("Columns to return"),
});

const VectorCreateTableSchema = z.object({
  tableName: z.string().describe("Table name"),
  dimensions: z.number().describe("Vector dimensions"),
  additionalColumns: z
    .array(
      z.object({
        name: z.string(),
        type: z.string(),
      }),
    )
    .optional(),
});

const VectorNormalizeSchema = z.object({
  vector: z.array(z.number()).describe("Vector to normalize"),
});

const VectorDistanceSchema = z.object({
  vector1: z.array(z.number()).describe("First vector"),
  vector2: z.array(z.number()).describe("Second vector"),
  metric: z.enum(["cosine", "euclidean", "dot"]).optional().default("cosine"),
});

const VectorBatchStoreSchema = z.object({
  table: z.string().describe("Table name"),
  idColumn: z.string().describe("ID column name"),
  vectorColumn: z.string().describe("Vector column name"),
  items: z
    .array(
      z.object({
        id: z.union([z.string(), z.number()]),
        vector: z.array(z.number()),
      }),
    )
    .describe("Items to store"),
});

const VectorDeleteSchema = z.object({
  table: z.string().describe("Table name"),
  idColumn: z.string().describe("ID column name"),
  ids: z.array(z.union([z.string(), z.number()])).describe("IDs to delete"),
});

const VectorGetSchema = z.object({
  table: z.string().describe("Table name"),
  idColumn: z.string().describe("ID column name"),
  vectorColumn: z.string().describe("Vector column name"),
  id: z.union([z.string(), z.number()]).describe("Row identifier"),
});

const VectorCountSchema = z.object({
  table: z.string().describe("Table name"),
  dimensions: z.number().optional().describe("Filter by dimension count"),
});

const VectorStatsSchema = z.object({
  table: z.string().describe("Table name"),
  vectorColumn: z.string().describe("Vector column name"),
  sampleSize: z.number().optional().default(100),
});

const VectorDimensionsSchema = z.object({
  table: z.string().describe("Table name"),
  vectorColumn: z.string().describe("Vector column name"),
});

/**
 * Get all vector tools
 */
export function getVectorTools(adapter: SqliteAdapter): ToolDefinition[] {
  return [
    createVectorCreateTableTool(adapter),
    createVectorStoreTool(adapter),
    createVectorBatchStoreTool(adapter),
    createVectorSearchTool(adapter),
    createVectorGetTool(adapter),
    createVectorDeleteTool(adapter),
    createVectorCountTool(adapter),
    createVectorStatsTool(adapter),
    createVectorDimensionsTool(adapter),
    createVectorNormalizeTool(),
    createVectorDistanceTool(),
  ];
}

// Helper functions for vector operations
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) throw new Error("Vector dimensions must match");
  let dotProd = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    const aVal = a[i] ?? 0;
    const bVal = b[i] ?? 0;
    dotProd += aVal * bVal;
    normA += aVal * aVal;
    normB += bVal * bVal;
  }
  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  return magnitude === 0 ? 0 : dotProd / magnitude;
}

function euclideanDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) throw new Error("Vector dimensions must match");
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const aVal = a[i] ?? 0;
    const bVal = b[i] ?? 0;
    const diff = aVal - bVal;
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

function dotProduct(a: number[], b: number[]): number {
  if (a.length !== b.length) throw new Error("Vector dimensions must match");
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += (a[i] ?? 0) * (b[i] ?? 0);
  }
  return sum;
}

function normalizeVector(v: number[]): number[] {
  const norm = Math.sqrt(v.reduce((sum, x) => sum + x * x, 0));
  if (norm === 0) return v;
  return v.map((x) => x / norm);
}

function parseVector(value: unknown): number[] {
  if (Array.isArray(value)) {
    return value.map(Number);
  }
  if (typeof value === "string") {
    try {
      const parsed: unknown = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.map(Number);
      }
    } catch {
      // Not valid JSON
    }
  }
  throw new Error("Invalid vector format");
}

/**
 * Create a table for vector storage
 */
function createVectorCreateTableTool(adapter: SqliteAdapter): ToolDefinition {
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
      const input = VectorCreateTableSchema.parse(params);

      // Validate and quote table name
      const tableName = sanitizeIdentifier(input.tableName);

      const columns = [
        "id INTEGER PRIMARY KEY",
        "vector TEXT NOT NULL", // JSON array
        `dimensions INTEGER DEFAULT ${input.dimensions}`,
      ];

      if (input.additionalColumns) {
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
    },
  };
}

/**
 * Store a vector
 */
function createVectorStoreTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_vector_store",
    description: "Store or update a vector in the database.",
    group: "vector",
    inputSchema: VectorStoreSchema,
    outputSchema: WriteQueryOutputSchema,
    requiredScopes: ["write"],
    annotations: write("Store Vector"),
    handler: async (params: unknown, _context: RequestContext) => {
      const input = VectorStoreSchema.parse(params);

      // Validate and quote identifiers
      const table = sanitizeIdentifier(input.table);
      const idColumn = sanitizeIdentifier(input.idColumn);
      const vectorColumn = sanitizeIdentifier(input.vectorColumn);

      const vectorJson = JSON.stringify(input.vector);
      const idValue = typeof input.id === "string" ? `'${input.id}'` : input.id;

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
    },
  };
}

/**
 * Batch store vectors
 */
function createVectorBatchStoreTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_vector_batch_store",
    description: "Store multiple vectors in a batch operation.",
    group: "vector",
    inputSchema: VectorBatchStoreSchema,
    outputSchema: WriteQueryOutputSchema,
    requiredScopes: ["write"],
    annotations: write("Batch Store Vectors"),
    handler: async (params: unknown, _context: RequestContext) => {
      const input = VectorBatchStoreSchema.parse(params);

      // Validate and quote identifiers
      const table = sanitizeIdentifier(input.table);
      const idColumn = sanitizeIdentifier(input.idColumn);
      const vectorColumn = sanitizeIdentifier(input.vectorColumn);

      let stored = 0;
      for (const item of input.items) {
        const vectorJson = JSON.stringify(item.vector);
        const idValue = typeof item.id === "string" ? `'${item.id}'` : item.id;

        const sql = `INSERT OR REPLACE INTO ${table} (${idColumn}, ${vectorColumn}) VALUES (${idValue}, '${vectorJson}')`;
        await adapter.executeWriteQuery(sql);
        stored++;
      }

      return {
        success: true,
        stored,
        dimensions: input.items[0]?.vector.length,
      };
    },
  };
}

/**
 * Vector similarity search
 */
function createVectorSearchTool(adapter: SqliteAdapter): ToolDefinition {
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
      const input = VectorSearchSchema.parse(params);

      // Validate and quote identifiers
      const table = sanitizeIdentifier(input.table);
      const vectorColumn = sanitizeIdentifier(input.vectorColumn);

      // Build select clause
      let selectCols = "*";
      if (input.returnColumns && input.returnColumns.length > 0) {
        const quotedCols = input.returnColumns.map((c) =>
          sanitizeIdentifier(c),
        );
        selectCols = quotedCols.join(", ");
      }

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
                score = 1 / (1 + euclideanDistance(queryVector, storedVector));
                break;
              case "dot":
                score = dotProduct(queryVector, storedVector);
                break;
              case "cosine":
              default:
                score = cosineSimilarity(queryVector, storedVector);
            }

            return { ...row, _similarity: Math.round(score * 10000) / 10000 };
          } catch {
            return { ...row, _similarity: -1 };
          }
        })
        .filter((r) => r._similarity >= 0);

      // Sort by similarity (descending) and limit
      scored.sort((a, b) => b._similarity - a._similarity);
      const limited = scored.slice(0, input.limit);

      return {
        success: true,
        metric: input.metric,
        count: limited.length,
        results: limited,
      };
    },
  };
}

/**
 * Get a vector by ID
 */
function createVectorGetTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_vector_get",
    description: "Retrieve a vector by its ID.",
    group: "vector",
    inputSchema: VectorGetSchema,
    outputSchema: ReadQueryOutputSchema,
    requiredScopes: ["read"],
    annotations: readOnly("Get Vector"),
    handler: async (params: unknown, _context: RequestContext) => {
      const input = VectorGetSchema.parse(params);

      // Validate and quote identifiers
      const table = sanitizeIdentifier(input.table);
      const idColumn = sanitizeIdentifier(input.idColumn);
      // Keep vectorColumn raw for JS object access, but validate
      sanitizeIdentifier(input.vectorColumn);

      const idValue = typeof input.id === "string" ? `'${input.id}'` : input.id;
      const sql = `SELECT * FROM ${table} WHERE ${idColumn} = ${idValue}`;

      const result = await adapter.executeReadQuery(sql);

      if (!result.rows || result.rows.length === 0) {
        return { success: false, error: "Vector not found" };
      }

      const row = result.rows[0];
      if (!row) {
        return { success: false, error: "Vector not found" };
      }
      const vectorData = parseVector(row[input.vectorColumn]);

      return {
        success: true,
        id: input.id,
        dimensions: vectorData.length,
        vector: vectorData,
        metadata: row,
      };
    },
  };
}

/**
 * Delete vectors by ID
 */
function createVectorDeleteTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_vector_delete",
    description: "Delete vectors by their IDs.",
    group: "vector",
    inputSchema: VectorDeleteSchema,
    outputSchema: WriteQueryOutputSchema,
    requiredScopes: ["write"],
    annotations: destructive("Delete Vectors"),
    handler: async (params: unknown, _context: RequestContext) => {
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
    },
  };
}

/**
 * Count vectors
 */
function createVectorCountTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_vector_count",
    description: "Count vectors in a table.",
    group: "vector",
    inputSchema: VectorCountSchema,
    outputSchema: ReadQueryOutputSchema,
    requiredScopes: ["read"],
    annotations: readOnly("Count Vectors"),
    handler: async (params: unknown, _context: RequestContext) => {
      const input = VectorCountSchema.parse(params);

      // Validate and quote table name
      const table = sanitizeIdentifier(input.table);

      const sql = `SELECT COUNT(*) as count FROM ${table}`;
      const result = await adapter.executeReadQuery(sql);

      return {
        success: true,
        count: result.rows?.[0]?.["count"] ?? 0,
      };
    },
  };
}

/**
 * Vector statistics
 */
function createVectorStatsTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_vector_stats",
    description: "Get statistics about vectors in a table.",
    group: "vector",
    inputSchema: VectorStatsSchema,
    outputSchema: ReadQueryOutputSchema,
    requiredScopes: ["read"],
    annotations: readOnly("Vector Stats"),
    handler: async (params: unknown, _context: RequestContext) => {
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
    },
  };
}

/**
 * Get vector dimensions
 */
function createVectorDimensionsTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_vector_dimensions",
    description: "Get the dimensions of vectors in a table.",
    group: "vector",
    inputSchema: VectorDimensionsSchema,
    outputSchema: ReadQueryOutputSchema,
    requiredScopes: ["read"],
    annotations: readOnly("Vector Dimensions"),
    handler: async (params: unknown, _context: RequestContext) => {
      const input = VectorDimensionsSchema.parse(params);

      // Validate and quote identifiers
      const table = sanitizeIdentifier(input.table);
      const vectorColumn = sanitizeIdentifier(input.vectorColumn);

      const sql = `SELECT ${vectorColumn} FROM ${table} LIMIT 1`;
      const result = await adapter.executeReadQuery(sql);

      if (!result.rows || result.rows.length === 0) {
        return { success: true, dimensions: null, message: "No vectors found" };
      }

      const firstRow = result.rows[0];
      if (!firstRow) {
        return { success: true, dimensions: null, message: "No vectors found" };
      }
      const vector = parseVector(firstRow[input.vectorColumn]);

      return {
        success: true,
        dimensions: vector.length,
      };
    },
  };
}

/**
 * Normalize a vector
 */
function createVectorNormalizeTool(): ToolDefinition {
  return {
    name: "sqlite_vector_normalize",
    description: "Normalize a vector to unit length.",
    group: "vector",
    inputSchema: VectorNormalizeSchema,
    outputSchema: ReadQueryOutputSchema,
    requiredScopes: ["read"],
    annotations: readOnly("Normalize Vector"),
    handler: (params: unknown, _context: RequestContext) => {
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
    },
  };
}

/**
 * Calculate distance between two vectors
 */
function createVectorDistanceTool(): ToolDefinition {
  return {
    name: "sqlite_vector_distance",
    description: "Calculate distance or similarity between two vectors.",
    group: "vector",
    inputSchema: VectorDistanceSchema,
    outputSchema: ReadQueryOutputSchema,
    requiredScopes: ["read"],
    annotations: readOnly("Vector Distance"),
    handler: (params: unknown, _context: RequestContext) => {
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
          result = cosineSimilarity(input.vector1, input.vector2);
      }

      return Promise.resolve({
        success: true,
        metric: input.metric,
        value: Math.round(result * 10000) / 10000,
      });
    },
  };
}
