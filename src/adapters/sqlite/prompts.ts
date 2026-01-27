/**
 * SQLite Prompt Definitions
 *
 * MCP prompts for common database operations and analysis.
 * 10 prompts total.
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
    createSummarizeTablePrompt(),
    createHybridSearchWorkflowPrompt(),
    createDemoPrompt(),
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

/**
 * Summarize table prompt - Intelligent table analysis
 */
function createSummarizeTablePrompt(): PromptDefinition {
  return {
    name: "sqlite_summarize_table",
    description:
      "Intelligent table analysis and summary generation with key statistics",
    arguments: [
      {
        name: "table_name",
        description: "Name of the table to analyze and summarize",
        required: true,
      },
      {
        name: "analysis_depth",
        description:
          "Depth of analysis: 'basic', 'detailed', or 'comprehensive'",
        required: false,
      },
    ],
    handler: (args: Record<string, string | undefined>) => {
      const tableName = args["table_name"] ?? "unknown";
      const depth = args["analysis_depth"] ?? "basic";

      const depthGuide =
        depth === "comprehensive"
          ? `- Full statistical profiles for all columns
- Pattern detection and correlation analysis
- Data quality scoring and recommendations
- Anomaly detection and outlier analysis`
          : depth === "detailed"
            ? `- Data distributions and histograms
- NULL value counts per column
- Unique value analysis
- Top values for categorical columns`
            : `- Row counts and column types
- Sample data preview
- Basic NULL detection`;

      return Promise.resolve({
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `# Table Analysis: ${tableName}

Perform a ${depth} analysis of the '${tableName}' table.

## Analysis Workflow

### 1. Schema Analysis
First, examine the table structure:
- Use \`sqlite_describe_table\` with table: ${tableName}

### 2. Basic Statistics
\`\`\`sql
SELECT COUNT(*) as total_rows FROM ${tableName};
\`\`\`

### 3. ${depth.charAt(0).toUpperCase() + depth.slice(1)} Profile
${depthGuide}

### 4. Data Quality Assessment
- Check for NULL values in each column
- Identify potential duplicate records
- Look for outliers or unusual patterns

### 5. Summary Report
Generate a summary with:
- Table purpose (inferred from schema)
- Key statistics
- Data quality score
- Recommendations

Start by examining the schema of '${tableName}'.`,
            },
          },
        ],
      });
    },
  };
}

/**
 * Hybrid search workflow prompt - FTS5 + Vector search
 */
function createHybridSearchWorkflowPrompt(): PromptDefinition {
  return {
    name: "sqlite_hybrid_search_workflow",
    description: "Hybrid keyword + semantic search implementation workflow",
    arguments: [
      {
        name: "use_case",
        description:
          "Use case for search (e.g., 'product_search', 'document_retrieval')",
        required: true,
      },
    ],
    handler: (args: Record<string, string>) => {
      const useCase = args["use_case"] ?? "content";

      return Promise.resolve({
        messages: [
          {
            role: "user" as const,
            content: {
              type: "text" as const,
              text: `# Hybrid Search Workflow: ${useCase}

Implement a hybrid search combining FTS5 keyword search with vector/semantic search.

## 1. Schema Setup

### FTS5 Virtual Table (Keyword Search)
\`\`\`sql
CREATE VIRTUAL TABLE IF NOT EXISTS ${useCase}_fts USING fts5(
  title,
  content,
  tokenize='porter unicode61'
);
\`\`\`

### Embeddings Table (Semantic Search)
\`\`\`sql
CREATE TABLE IF NOT EXISTS ${useCase}_embeddings (
  id INTEGER PRIMARY KEY,
  source_id INTEGER NOT NULL,
  embedding BLOB NOT NULL,
  embedding_model TEXT DEFAULT 'text-embedding-3-small'
);
\`\`\`

## 2. Hybrid Search Query

### Step 1: FTS5 Keyword Search
\`\`\`sql
SELECT rowid, bm25(${useCase}_fts) as keyword_score
FROM ${useCase}_fts
WHERE ${useCase}_fts MATCH ?
ORDER BY bm25(${useCase}_fts)
LIMIT 50;
\`\`\`

### Step 2: Vector Similarity Search
Use \`sqlite_vector_search\` tool with cosine similarity.

### Step 3: Combine Results
\`\`\`sql
-- Weighted hybrid scoring
SELECT
  id,
  (0.6 * COALESCE(keyword_score, 0) + 0.4 * COALESCE(vector_score, 0)) as hybrid_score
FROM (
  SELECT id, keyword_score, NULL as vector_score FROM keyword_results
  UNION
  SELECT id, NULL, vector_score FROM vector_results
)
GROUP BY id
ORDER BY hybrid_score DESC
LIMIT 20;
\`\`\`

## 3. Optimization for ${useCase}

### Recommended Weights
- Exact keyword match: Higher weight for precision
- Semantic similarity: Higher weight for recall

### Typical configurations:
- **Product search**: 70% keyword + 30% semantic
- **Document retrieval**: 50% keyword + 50% semantic
- **Q&A/Support**: 40% keyword + 60% semantic

## 4. Next Steps

1. Create the FTS5 virtual table
2. Generate embeddings for your content
3. Implement the hybrid search function
4. Tune weights based on evaluation

Start by creating the FTS5 table for '${useCase}'.`,
            },
          },
        ],
      });
    },
  };
}

/**
 * Interactive MCP demo prompt
 */
function createDemoPrompt(): PromptDefinition {
  return {
    name: "sqlite_demo",
    description:
      "Interactive walkthrough demonstrating MCP SQLite capabilities",
    arguments: [
      {
        name: "topic",
        description: "Topic for demo scenario (e.g., 'retail sales')",
        required: true,
      },
    ],
    handler: (args: Record<string, string>) => {
      const topic = args["topic"] ?? "business analytics";

      return Promise.resolve({
        messages: [
          {
            role: "user" as const,
            content: {
              type: "text" as const,
              text: `# Interactive MCP Demo: ${topic}

You are guiding an interactive demo of the SQLite MCP Server capabilities.

## MCP Overview

**Prompts**: Pre-written templates that structure AI conversations (like this one)
**Tools**: SQL operations (read_query, write_query, create_table, etc.)
**Resources**: Living documents like \`memo://insights\` that update during analysis

## Demo Workflow

### 1. Create Business Narrative
Describe a business problem for "${topic}":
- Include a protagonist who needs data analysis
- Add an approaching deadline
- Explain why Claude is helping

### 2. Setup Data
Create 2-3 relevant tables using \`sqlite_create_table\`:
- Design appropriate schemas for ${topic}
- Insert 10-15 rows of synthetic data per table
- Say "Setting up the data..." while working

### 3. Present Query Options
After setup, present 3-4 natural language query choices:
- "Show me the top performers"
- "What are the trends over time?"
- "Identify any anomalies"

### 4. Execute & Analyze
For each user selection:
- Run the appropriate SQL query
- Explain the results
- Use \`sqlite_append_insight\` to capture findings

### 5. Capture Insights
Remind the user about \`memo://insights\`:
- Each insight is automatically added to this resource
- They can attach it to see all discoveries

### 6. Wrap Up
Summarize what was demonstrated:
- Data creation and querying
- Insight capture via resources
- The power of MCP for database workflows

---

Start with: "Hey there! I see you've chosen **${topic}**. Let's explore what we can do! 🚀"

Then begin creating the business narrative.`,
            },
          },
        ],
      });
    },
  };
}
