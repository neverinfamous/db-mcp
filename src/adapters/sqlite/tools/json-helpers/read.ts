/**
 * JSON Read Tools
 *
 * Read-only JSON operations: select, query, validate path, analyze schema.
 */

import type { SqliteAdapter } from "../../sqlite-adapter.js";
import type { ToolDefinition, RequestContext } from "../../../../types/index.js";
import { readOnly } from "../../../../utils/annotations.js";
import { sanitizeIdentifier, validateWhereClause } from "../../../../utils/index.js";
import { formatHandlerError, ValidationError } from "../../../../utils/errors/index.js";
import {
  JsonSelectSchema,
  JsonQuerySchema,
  JsonValidatePathSchema,
  AnalyzeJsonSchemaSchema,
} from "../../types.js";
import {
  JsonSelectOutputSchema,
  JsonQueryOutputSchema,
  JsonValidatePathOutputSchema,
  AnalyzeJsonSchemaOutputSchema,
} from "../../output-schemas/index.js";
import { getUniqueColumnNames } from "./helpers.js";

/**
 * Select and extract JSON data
 */
export function createJsonSelectTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_json_select",
    description: "Select rows and optionally extract specific JSON paths.",
    group: "json",
    inputSchema: JsonSelectSchema,
    outputSchema: JsonSelectOutputSchema,
    requiredScopes: ["read"],
    annotations: readOnly("JSON Select"),
    handler: async (params: unknown, _context: RequestContext) => {
      let input;
      try {
        input = JsonSelectSchema.parse(params);
      } catch (error) {
        return formatHandlerError(error);
      }

      try {
        // Validate names
        sanitizeIdentifier(input.table);
        sanitizeIdentifier(input.column);

        let selectClause: string;
        if (input.paths && input.paths.length > 0) {
          // Extract specific paths with meaningful column names
          const columnNames = getUniqueColumnNames(input.paths);
          const extracts = input.paths.map((path, i) => {
            if (!path.startsWith("$")) {
              throw new ValidationError(`JSON path must start with $: ${path}`);
            }
            return `json_extract("${input.column}", '${path}') as "${columnNames[i]}"`;
          });
          selectClause = extracts.join(", ");
        } else {
          // Wrap with json() to ensure JSONB binary data is returned as readable text
          // This handles both text JSON (no-op) and JSONB (converts to text)
          selectClause = `json("${input.column}") as "${input.column}"`;
        }

        let sql = `SELECT ${selectClause} FROM "${input.table}"`;
        if (input.whereClause) {
          validateWhereClause(input.whereClause);
          sql += ` WHERE ${input.whereClause}`;
        }

        const result = await adapter.executeReadQuery(sql);

        return {
          success: true,
          rowCount: result.rows?.length ?? 0,
          rows: result.rows,
        };
      } catch (error) {
        return formatHandlerError(error);
      }
    },
  };
}

/**
 * Query JSON with path-based filtering
 */
export function createJsonQueryTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_json_query",
    description: "Query JSON data with path-based filters and projections.",
    group: "json",
    inputSchema: JsonQuerySchema,
    outputSchema: JsonQueryOutputSchema,
    requiredScopes: ["read"],
    annotations: readOnly("JSON Query"),
    handler: async (params: unknown, _context: RequestContext) => {
      let input;
      try {
        input = JsonQuerySchema.parse(params);
      } catch (error) {
        return formatHandlerError(error);
      }

      try {
        // Validate names
        sanitizeIdentifier(input.table);
        sanitizeIdentifier(input.column);

        // Build select clause with meaningful column names
        let selectClause: string;
        if (input.selectPaths && input.selectPaths.length > 0) {
          const columnNames = getUniqueColumnNames(input.selectPaths);
          const extracts = input.selectPaths.map((path, i) => {
            if (!path.startsWith("$")) {
              throw new ValidationError(`JSON path must start with $: ${path}`);
            }
            return `json_extract("${input.column}", '${path}') as "${columnNames[i]}"`;
          });
          selectClause = extracts.join(", ");
        } else {
          selectClause = `"${input.column}"`;
        }

        // Build where clause from filters
        const conditions: string[] = [];
        if (input.filterPaths) {
          for (const [path, value] of Object.entries(input.filterPaths)) {
            if (!path.startsWith("$")) {
              throw new ValidationError(`JSON path must start with $: ${path}`);
            }
            const valueStr =
              typeof value === "string"
                ? `'${value.replace(/'/g, "''")}'`
                : JSON.stringify(value);
            conditions.push(
              `json_extract("${input.column}", '${path}') = ${valueStr}`,
            );
          }
        }

        let sql = `SELECT ${selectClause} FROM "${input.table}"`;
        if (conditions.length > 0) {
          sql += ` WHERE ${conditions.join(" AND ")}`;
        }
        sql += ` LIMIT ${input.limit ?? 100}`;

        const result = await adapter.executeReadQuery(sql);

        return {
          success: true,
          rowCount: result.rows?.length ?? 0,
          rows: result.rows,
        };
      } catch (error) {
        return formatHandlerError(error);
      }
    },
  };
}

/**
 * Validate a JSON path syntax
 */
export function createJsonValidatePathTool(): ToolDefinition {
  return {
    name: "sqlite_json_validate_path",
    description: "Validate a JSON path syntax without executing a query.",
    group: "json",
    inputSchema: JsonValidatePathSchema,
    outputSchema: JsonValidatePathOutputSchema,
    requiredScopes: ["read"],
    annotations: readOnly("Validate JSON Path"),
    handler: (params: unknown, _context: RequestContext) => {
      let input;
      try {
        input = JsonValidatePathSchema.parse(params);
      } catch (error) {
        return Promise.resolve(formatHandlerError(error));
      }

      const path = input.path;
      const issues: string[] = [];

      // Basic validation rules
      if (!path.startsWith("$")) {
        issues.push("Path must start with $");
      }

      // Check for valid path syntax
      const validPattern = /^\$(\.[a-zA-Z_][a-zA-Z0-9_]*|\[\d+\]|\[\*\])*$/;
      if (!validPattern.test(path)) {
        issues.push("Invalid path syntax. Use $.key, $[0], or $[*] patterns");
      }

      return Promise.resolve({
        success: issues.length === 0,
        path,
        valid: issues.length === 0,
        issues: issues.length > 0 ? issues : undefined,
      });
    },
  };
}

/**
 * Analyze JSON schema from column data
 */
export function createAnalyzeJsonSchemaTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_json_analyze_schema",
    description:
      "Analyze JSON data in a column to infer its schema (types, nullability, counts).",
    group: "json",
    inputSchema: AnalyzeJsonSchemaSchema,
    outputSchema: AnalyzeJsonSchemaOutputSchema,
    requiredScopes: ["read"],
    annotations: readOnly("Analyze JSON Schema"),
    handler: async (params: unknown, _context: RequestContext) => {
      let input;
      try {
        input = AnalyzeJsonSchemaSchema.parse(params);
      } catch (error) {
        return formatHandlerError(error);
      }

      try {
        // Validate names
        sanitizeIdentifier(input.table);
        sanitizeIdentifier(input.column);

        // Sample rows - wrap column with json() to handle both text JSON and JSONB binary data
        const sql = `SELECT json("${input.column}") as json_data FROM "${input.table}" LIMIT ${input.sampleSize}`;
        const result = await adapter.executeReadQuery(sql);

        // Infer schema
        const properties: Record<
          string,
          { type: string; nullable: boolean; count: number; itemType?: string }
        > = {};
        let nullCount = 0;
        let errorCount = 0;

        for (const row of result.rows ?? []) {
          const jsonData = row["json_data"];
          if (jsonData === null || jsonData === undefined) {
            nullCount++;
            continue;
          }

          try {
            const parsed: unknown =
              typeof jsonData === "string" ? JSON.parse(jsonData) : jsonData;

            if (
              typeof parsed === "object" &&
              parsed !== null &&
              !Array.isArray(parsed)
            ) {
              for (const [key, value] of Object.entries(
                parsed as Record<string, unknown>,
              )) {
                properties[key] ??= {
                  type: "unknown",
                  nullable: false,
                  count: 0,
                };
                properties[key].count++;

                // Determine type
                let valueType: string;
                if (value === null) {
                  valueType = "null";
                  properties[key].nullable = true;
                } else if (Array.isArray(value)) {
                  valueType = "array";
                  if (value.length > 0) {
                    properties[key].itemType = typeof value[0];
                  }
                } else {
                  valueType = typeof value;
                }

                // Set or merge type
                if (properties[key].type === "unknown") {
                  properties[key].type = valueType;
                } else if (
                  properties[key].type !== valueType &&
                  valueType !== "null"
                ) {
                  properties[key].type = "mixed";
                }
              }
            }
          } catch {
            errorCount++;
          }
        }

        const sampleSize = result.rows?.length ?? 0;

        // Mark missing properties as nullable
        for (const prop of Object.values(properties)) {
          if (prop.count < sampleSize - nullCount - errorCount) {
            prop.nullable = true;
          }
        }

        return {
          success: true,
          schema: {
            type: "object",
            properties,
            sampleSize,
            nullCount,
            errorCount,
          },
        };
      } catch (error) {
        return formatHandlerError(error);
      }
    },
  };
}
