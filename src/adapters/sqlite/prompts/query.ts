/**
 * Query-focused Prompts
 *
 * Prompts for SQL query building, debugging, and migration.
 */

import type { PromptDefinition } from "../../../types/index.js";

/**
 * Help build SQL queries
 */
export function createQueryBuilderPrompt(): PromptDefinition {
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
 * Migration helper prompt
 */
export function createMigrationPrompt(): PromptDefinition {
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
export function createDebugQueryPrompt(): PromptDefinition {
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
