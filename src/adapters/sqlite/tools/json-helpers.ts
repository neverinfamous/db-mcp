/**
 * SQLite JSON Helper Tools
 *
 * High-level JSON operations for common patterns:
 * insert, update, select, query, validate path, merge, analyze schema, create collection.
 * 8 tools total.
 */

import type { SqliteAdapter } from "../SqliteAdapter.js";
import type { ToolDefinition, RequestContext } from "../../../types/index.js";
import { readOnly, write } from "../../../utils/annotations.js";
import { sanitizeIdentifier } from "../../../utils/index.js";
import {
  JsonInsertSchema,
  JsonUpdateSchema,
  JsonSelectSchema,
  JsonQuerySchema,
  JsonValidatePathSchema,
  JsonMergeSchema,
  AnalyzeJsonSchemaSchema,
  CreateJsonCollectionSchema,
} from "../types.js";
import {
  JsonInsertOutputSchema,
  JsonUpdateOutputSchema,
  JsonSelectOutputSchema,
  JsonQueryOutputSchema,
  JsonValidatePathOutputSchema,
  JsonMergeOutputSchema,
  AnalyzeJsonSchemaOutputSchema,
  CreateJsonCollectionOutputSchema,
} from "../output-schemas.js";
import { normalizeJson } from "../json-utils.js";

/**
 * Extract a meaningful column name from a JSONPath expression.
 * Examples:
 *   $.name -> name
 *   $.user.email -> email
 *   $[0] -> item_0
 *   $[*].name -> name
 *   $.items[0].price -> price
 */
function extractColumnNameFromPath(path: string): string {
  // Remove leading $
  const remaining = path.slice(1);

  // Find the last meaningful segment
  // Match either .key or [index]
  const segments: string[] = [];
  const regex = /\.([a-zA-Z_][a-zA-Z0-9_]*)|\[(\d+|\*)\]/g;
  let match;
  while ((match = regex.exec(remaining)) !== null) {
    if (match[1]) {
      // Property access: .name
      segments.push(match[1]);
    } else if (match[2]) {
      // Array index or wildcard: [0] or [*]
      segments.push(match[2] === "*" ? "items" : `item_${match[2]}`);
    }
  }

  // Return the last segment, or fallback to "value"
  const lastSegment = segments[segments.length - 1];
  return lastSegment ?? "value";
}

/**
 * Given an array of JSONPath expressions, return unique column names.
 * Duplicates get numeric suffixes (e.g., name, name_2, name_3).
 */
function getUniqueColumnNames(paths: string[]): string[] {
  const names: string[] = [];
  const counts: Record<string, number> = {};

  for (const path of paths) {
    const baseName = extractColumnNameFromPath(path);
    if ((counts[baseName] ?? 0) === 0) {
      counts[baseName] = 1;
      names.push(baseName);
    } else {
      counts[baseName] = (counts[baseName] ?? 0) + 1;
      names.push(`${baseName}_${counts[baseName]}`);
    }
  }

  return names;
}

/**
 * Get all JSON helper tools
 */
export function getJsonHelperTools(adapter: SqliteAdapter): ToolDefinition[] {
  return [
    createJsonInsertTool(adapter),
    createJsonUpdateTool(adapter),
    createJsonSelectTool(adapter),
    createJsonQueryTool(adapter),
    createJsonValidatePathTool(),
    createJsonMergeTool(adapter),
    createAnalyzeJsonSchemaTool(adapter),
    createJsonCollectionTool(adapter),
  ];
}

/**
 * Insert JSON data with auto-normalization
 */
function createJsonInsertTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_json_insert",
    description:
      "Insert a row with JSON data. Automatically normalizes JSON for consistent storage.",
    group: "json",
    inputSchema: JsonInsertSchema,
    outputSchema: JsonInsertOutputSchema,
    requiredScopes: ["write"],
    annotations: write("JSON Insert"),
    handler: async (params: unknown, _context: RequestContext) => {
      const input = JsonInsertSchema.parse(params);

      // Normalize JSON data for consistent storage
      const rawJson =
        typeof input.data === "string"
          ? input.data
          : JSON.stringify(input.data);

      const { normalized: jsonStr } = normalizeJson(rawJson);

      // Build column list
      const columns = [input.column];
      const placeholders = ["?"];
      const values: unknown[] = [jsonStr];

      if (input.additionalColumns) {
        for (const [col, val] of Object.entries(input.additionalColumns)) {
          // Validate column name
          sanitizeIdentifier(col);
          columns.push(col);
          placeholders.push("?");
          values.push(typeof val === "object" ? JSON.stringify(val) : val);
        }
      }

      // Validate table name
      sanitizeIdentifier(input.table);

      const sql = `INSERT INTO "${input.table}" (${columns.map((c) => `"${c}"`).join(", ")}) VALUES (${placeholders.join(", ")})`;

      const result = await adapter.executeWriteQuery(sql, values);

      return {
        success: true,
        message: `Inserted row into ${input.table}`,
        rowsAffected: result.rowsAffected,
      };
    },
  };
}

/**
 * Update JSON value at a specific path
 */
function createJsonUpdateTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_json_update",
    description: "Update a value at a specific JSON path using json_set().",
    group: "json",
    inputSchema: JsonUpdateSchema,
    outputSchema: JsonUpdateOutputSchema,
    requiredScopes: ["write"],
    annotations: write("JSON Update"),
    handler: async (params: unknown, _context: RequestContext) => {
      const input = JsonUpdateSchema.parse(params);

      // Validate table and column names
      sanitizeIdentifier(input.table);
      sanitizeIdentifier(input.column);

      // Validate JSON path format
      if (!input.path.startsWith("$")) {
        throw new Error("JSON path must start with $");
      }

      const valueStr =
        typeof input.value === "string"
          ? `'${input.value.replace(/'/g, "''")}'`
          : JSON.stringify(input.value);

      const sql = `UPDATE "${input.table}" SET "${input.column}" = json_set("${input.column}", '${input.path}', json(${valueStr})) WHERE ${input.whereClause}`;

      const result = await adapter.executeWriteQuery(sql);

      return {
        success: true,
        message: `Updated ${input.path} in ${input.table}.${input.column}`,
        rowsAffected: result.rowsAffected,
      };
    },
  };
}

/**
 * Select and extract JSON data
 */
function createJsonSelectTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_json_select",
    description: "Select rows and optionally extract specific JSON paths.",
    group: "json",
    inputSchema: JsonSelectSchema,
    outputSchema: JsonSelectOutputSchema,
    requiredScopes: ["read"],
    annotations: readOnly("JSON Select"),
    handler: async (params: unknown, _context: RequestContext) => {
      const input = JsonSelectSchema.parse(params);

      // Validate names
      sanitizeIdentifier(input.table);
      sanitizeIdentifier(input.column);

      let selectClause: string;
      if (input.paths && input.paths.length > 0) {
        // Extract specific paths with meaningful column names
        const columnNames = getUniqueColumnNames(input.paths);
        const extracts = input.paths.map((path, i) => {
          if (!path.startsWith("$")) {
            throw new Error(`JSON path must start with $: ${path}`);
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
        sql += ` WHERE ${input.whereClause}`;
      }

      const result = await adapter.executeReadQuery(sql);

      return {
        success: true,
        rowCount: result.rows?.length ?? 0,
        rows: result.rows,
      };
    },
  };
}

/**
 * Query JSON with path-based filtering
 */
function createJsonQueryTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_json_query",
    description: "Query JSON data with path-based filters and projections.",
    group: "json",
    inputSchema: JsonQuerySchema,
    outputSchema: JsonQueryOutputSchema,
    requiredScopes: ["read"],
    annotations: readOnly("JSON Query"),
    handler: async (params: unknown, _context: RequestContext) => {
      const input = JsonQuerySchema.parse(params);

      // Validate names
      sanitizeIdentifier(input.table);
      sanitizeIdentifier(input.column);

      // Build select clause with meaningful column names
      let selectClause: string;
      if (input.selectPaths && input.selectPaths.length > 0) {
        const columnNames = getUniqueColumnNames(input.selectPaths);
        const extracts = input.selectPaths.map((path, i) => {
          if (!path.startsWith("$")) {
            throw new Error(`JSON path must start with $: ${path}`);
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
            throw new Error(`JSON path must start with $: ${path}`);
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
    },
  };
}

/**
 * Validate a JSON path syntax
 */
function createJsonValidatePathTool(): ToolDefinition {
  return {
    name: "sqlite_json_validate_path",
    description: "Validate a JSON path syntax without executing a query.",
    group: "json",
    inputSchema: JsonValidatePathSchema,
    outputSchema: JsonValidatePathOutputSchema,
    requiredScopes: ["read"],
    annotations: readOnly("Validate JSON Path"),
    handler: (params: unknown, _context: RequestContext) => {
      const input = JsonValidatePathSchema.parse(params);

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
 * Merge JSON objects
 */
function createJsonMergeTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_json_merge",
    description:
      "Merge JSON object into existing JSON column using json_patch().",
    group: "json",
    inputSchema: JsonMergeSchema,
    outputSchema: JsonMergeOutputSchema,
    requiredScopes: ["write"],
    annotations: write("JSON Merge"),
    handler: async (params: unknown, _context: RequestContext) => {
      const input = JsonMergeSchema.parse(params);

      // Validate names
      sanitizeIdentifier(input.table);
      sanitizeIdentifier(input.column);

      const mergeJson = JSON.stringify(input.mergeData);

      // Use json_patch for merging (shallow merge)
      const sql = `UPDATE "${input.table}" SET "${input.column}" = json_patch("${input.column}", '${mergeJson.replace(/'/g, "''")}') WHERE ${input.whereClause}`;

      const result = await adapter.executeWriteQuery(sql);

      return {
        success: true,
        message: `Merged JSON into ${input.table}.${input.column}`,
        rowsAffected: result.rowsAffected,
      };
    },
  };
}

/**
 * Analyze JSON schema from column data
 */
function createAnalyzeJsonSchemaTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_analyze_json_schema",
    description:
      "Analyze JSON data in a column to infer its schema (types, nullability, counts).",
    group: "json",
    inputSchema: AnalyzeJsonSchemaSchema,
    outputSchema: AnalyzeJsonSchemaOutputSchema,
    requiredScopes: ["read"],
    annotations: readOnly("Analyze JSON Schema"),
    handler: async (params: unknown, _context: RequestContext) => {
      const input = AnalyzeJsonSchemaSchema.parse(params);

      // Validate names
      sanitizeIdentifier(input.table);
      sanitizeIdentifier(input.column);

      // Sample rows
      const sql = `SELECT "${input.column}" as json_data FROM "${input.table}" LIMIT ${input.sampleSize}`;
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
    },
  };
}

/**
 * Create a JSON document collection table
 */
function createJsonCollectionTool(adapter: SqliteAdapter): ToolDefinition {
  return {
    name: "sqlite_create_json_collection",
    description:
      "Create an optimized JSON document collection table with ID, data column, optional timestamps, and JSON path indexes.",
    group: "json",
    inputSchema: CreateJsonCollectionSchema,
    outputSchema: CreateJsonCollectionOutputSchema,
    requiredScopes: ["write"],
    annotations: write("Create JSON Collection"),
    handler: async (params: unknown, _context: RequestContext) => {
      const input = CreateJsonCollectionSchema.parse(params);

      // Validate table name
      sanitizeIdentifier(input.tableName);

      const idCol = input.idColumn ?? "id";
      const dataCol = input.dataColumn ?? "data";
      const sqls: string[] = [];

      // Build CREATE TABLE
      const columns = [
        `"${idCol}" TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16))))`,
        // Use json_type() IS NOT NULL instead of json_valid() to support both text JSON and JSONB
        `"${dataCol}" TEXT NOT NULL CHECK(json_type("${dataCol}") IS NOT NULL)`,
      ];

      if (input.timestamps) {
        columns.push(`created_at TEXT DEFAULT (datetime('now'))`);
        columns.push(`updated_at TEXT DEFAULT (datetime('now'))`);
      }

      const createSql = `CREATE TABLE IF NOT EXISTS "${input.tableName}" (\n  ${columns.join(",\n  ")}\n)`;
      sqls.push(createSql);

      // Execute CREATE TABLE
      await adapter.executeWriteQuery(createSql);

      // Create indexes
      let indexCount = 0;
      if (input.indexes) {
        for (const idx of input.indexes) {
          if (!idx.path.startsWith("$")) {
            throw new Error(`JSON path must start with $: ${idx.path}`);
          }
          const indexName =
            idx.name ??
            `idx_${input.tableName}_${idx.path.replace(/[$.[\]]/g, "_")}`;
          const indexSql = `CREATE INDEX IF NOT EXISTS "${indexName}" ON "${input.tableName}"(json_extract("${dataCol}", '${idx.path}'))`;
          sqls.push(indexSql);
          await adapter.executeWriteQuery(indexSql);
          indexCount++;
        }
      }

      return {
        success: true,
        message: `Created collection '${input.tableName}'${indexCount > 0 ? ` with ${indexCount} index(es)` : ""}`,
        sql: sqls,
        indexCount,
      };
    },
  };
}
