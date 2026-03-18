/**
 * Schema-focused Prompts
 *
 * Prompts for database schema explanation, optimization, and documentation.
 */

import type { SqliteAdapter } from "../sqlite-adapter.js";
import type { PromptDefinition } from "../../../types/index.js";

/**
 * Explain the database schema
 */
export function createExplainSchemaPrompt(
  adapter: SqliteAdapter,
): PromptDefinition {
  return {
    name: "sqlite_explain_schema",
    description:
      "Explain the structure and relationships in this SQLite database",
    arguments: [],
    handler: async () => {
      const schema = await adapter.getSchema();
      const tables = await adapter.listTables();

      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Please analyze and explain this SQLite database schema:

Tables: ${tables.map((t: { name: string }) => t.name).join(", ")}

Full Schema:
${JSON.stringify(schema, null, 2)}

Please explain:
1. What is the purpose of each table?
2. What are the relationships between tables?
3. What are the key fields and their purposes?
4. Any observations about the data model design?`,
            },
          },
        ],
      };
    },
  };
}

/**
 * Database optimization prompt
 */
export function createOptimizationPrompt(
  adapter: SqliteAdapter,
): PromptDefinition {
  return {
    name: "sqlite_optimization",
    description: "Analyze and suggest database optimizations",
    arguments: [],
    handler: async () => {
      const schema = await adapter.getSchema();
      const tables = await adapter.listTables();

      // Get indexes for context
      const indexInfo: Record<string, unknown> = {};
      for (const table of tables) {
        indexInfo[table.name] = await adapter.getIndexes(table.name);
      }

      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Analyze this SQLite database for optimization opportunities:

Schema: ${JSON.stringify(schema, null, 2)}

Current Indexes: ${JSON.stringify(indexInfo, null, 2)}

Please analyze and suggest:
1. Missing indexes that could improve query performance
2. Table design optimizations
3. Query patterns that might benefit from denormalization
4. Storage optimizations (VACUUM, etc.)
5. Any anti-patterns detected`,
            },
          },
        ],
      };
    },
  };
}

/**
 * Documentation generator prompt
 */
export function createDocumentationPrompt(
  adapter: SqliteAdapter,
): PromptDefinition {
  return {
    name: "sqlite_documentation",
    description: "Generate documentation for the database schema",
    arguments: [
      {
        name: "format",
        description: "Output format (markdown, json, html)",
        required: false,
      },
    ],
    handler: async (args: Record<string, string | undefined>) => {
      const format = args["format"] ?? "markdown";
      const schema = await adapter.getSchema();

      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Generate comprehensive documentation for this SQLite database schema in ${format} format:

${JSON.stringify(schema, null, 2)}

Include:
1. Overview of the database purpose
2. Entity Relationship description
3. Table-by-table documentation with column descriptions
4. Common query examples
5. Important relationships and constraints`,
            },
          },
        ],
      };
    },
  };
}
