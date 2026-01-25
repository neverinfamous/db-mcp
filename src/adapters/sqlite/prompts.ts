/**
 * SQLite Prompt Definitions
 *
 * MCP prompts for common database operations and analysis.
 * 7 prompts total.
 */

import type { SqliteAdapter } from "./SqliteAdapter.js";
import type { PromptDefinition } from "../../types/index.js";

/**
 * Get all prompt definitions for the SQLite adapter
 */
export function getPromptDefinitions(
  adapter: SqliteAdapter,
): PromptDefinition[] {
  return [
    createExplainSchemaPrompt(adapter),
    createQueryBuilderPrompt(),
    createDataAnalysisPrompt(),
    createOptimizationPrompt(adapter),
    createMigrationPrompt(),
    createDebugQueryPrompt(),
    createDocumentationPrompt(adapter),
  ];
}

/**
 * Explain the database schema
 */
function createExplainSchemaPrompt(adapter: SqliteAdapter): PromptDefinition {
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
 * Help build SQL queries
 */
function createQueryBuilderPrompt(): PromptDefinition {
  return {
    name: "sqlite_query_builder",
    description: "Help construct SQL queries for common operations",
    arguments: [
      {
        name: "operation",
        description:
          "The type of query (select, insert, update, delete, join, aggregate)",
        required: true,
      },
      {
        name: "tables",
        description: "Comma-separated list of tables involved",
        required: true,
      },
      {
        name: "description",
        description: "Natural language description of what you want to achieve",
        required: true,
      },
    ],
    handler: (args: Record<string, string | undefined>) => {
      const operation = args["operation"] ?? "select";
      const tables = args["tables"] ?? "";
      const description = args["description"] ?? "";

      return Promise.resolve({
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Help me build a SQLite ${operation} query.

Tables involved: ${tables}

What I want to do: ${description}

Please provide:
1. The complete SQL query
2. Explanation of each part
3. Any potential performance considerations
4. Alternative approaches if applicable`,
            },
          },
        ],
      });
    },
  };
}

/**
 * Data analysis prompt
 */
function createDataAnalysisPrompt(): PromptDefinition {
  return {
    name: "sqlite_data_analysis",
    description: "Analyze data patterns and provide insights",
    arguments: [
      {
        name: "table",
        description: "The table to analyze",
        required: true,
      },
      {
        name: "focus",
        description:
          "What aspect to focus on (distribution, trends, outliers, correlations)",
        required: false,
      },
    ],
    handler: (args: Record<string, string | undefined>) => {
      const table = args["table"] ?? "";
      const focus = args["focus"] ?? "general";

      return Promise.resolve({
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Analyze the data in the "${table}" table with focus on: ${focus}

Please provide:
1. Summary statistics for key columns
2. Distribution analysis
3. Notable patterns or anomalies
4. Recommendations for further analysis

Use the available SQLite tools to query the data and build your analysis.`,
            },
          },
        ],
      });
    },
  };
}

/**
 * Database optimization prompt
 */
function createOptimizationPrompt(adapter: SqliteAdapter): PromptDefinition {
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
 * Migration helper prompt
 */
function createMigrationPrompt(): PromptDefinition {
  return {
    name: "sqlite_migration",
    description: "Help create database migration scripts",
    arguments: [
      {
        name: "change",
        description: "Description of the schema change needed",
        required: true,
      },
      {
        name: "reversible",
        description: "Whether the migration should be reversible (true/false)",
        required: false,
      },
    ],
    handler: (args: Record<string, string | undefined>) => {
      const change = args["change"] ?? "";
      const reversible = args["reversible"] !== "false";

      return Promise.resolve({
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Create a SQLite migration script for the following change:

${change}

Requirements:
- Reversible: ${reversible ? "Yes, include rollback" : "No rollback needed"}
- Should be safe to run on a live database
- Handle existing data appropriately

Please provide:
1. UP migration (the change)
${reversible ? "2. DOWN migration (rollback)" : ""}
3. Data migration steps if needed
4. Testing steps to verify the migration`,
            },
          },
        ],
      });
    },
  };
}

/**
 * Debug query prompt
 */
function createDebugQueryPrompt(): PromptDefinition {
  return {
    name: "sqlite_debug_query",
    description: "Help debug a SQL query that is not working as expected",
    arguments: [
      {
        name: "query",
        description: "The SQL query to debug",
        required: true,
      },
      {
        name: "error",
        description: "Error message or unexpected behavior description",
        required: false,
      },
      {
        name: "expected",
        description: "What result you expected",
        required: false,
      },
    ],
    handler: (args: Record<string, string | undefined>) => {
      const query = args["query"] ?? "";
      const error = args["error"] ?? "No specific error - unexpected results";
      const expected = args["expected"] ?? "Not specified";

      return Promise.resolve({
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Help me debug this SQLite query:

\`\`\`sql
${query}
\`\`\`

Problem: ${error}

Expected result: ${expected}

Please:
1. Identify potential issues with the query
2. Explain what the query is actually doing
3. Suggest corrections
4. Provide the fixed query`,
            },
          },
        ],
      });
    },
  };
}

/**
 * Documentation generator prompt
 */
function createDocumentationPrompt(adapter: SqliteAdapter): PromptDefinition {
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
