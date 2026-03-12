/**
 * Vector Search Tool Implementations
 *
 * Similarity search and vector retrieval by ID.
 */

import type { SqliteAdapter } from "../../sqlite-adapter.js";
import type { ToolDefinition, RequestContext } from "../../../../types/index.js";
import { readOnly } from "../../../../utils/annotations.js";
import {
  validateWhereClause,
  sanitizeIdentifier,
} from "../../../../utils/index.js";
import { formatHandlerError } from "../../../../utils/errors/index.js";
import {
  VectorSearchOutputSchema,
  VectorGetOutputSchema,
} from "../../output-schemas/index.js";
import {
  VectorSearchSchema,
  VectorGetSchema,
} from "./schemas.js";
import {
  cosineSimilarity,
  euclideanDistance,
  dotProduct,
  parseVector,
} from "./helpers.js";

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
        let skipped = 0;
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
              skipped++;
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

        const response: Record<string, unknown> = {
          success: true,
          metric: input.metric,
          count: results.length,
          results,
        };

        if (skipped > 0) {
          response["skipped"] = skipped;
          response["warning"] =
            `${skipped} vector(s) skipped due to dimension mismatch or parse errors`;
        }

        return response;
      } catch (error) {
        return formatHandlerError(error);
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
        return formatHandlerError(error);
      }
    },
  };
}
