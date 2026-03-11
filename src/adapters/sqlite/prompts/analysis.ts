/**
 * Analysis & Workflow Prompts
 *
 * Prompts for data analysis, table summarization, hybrid search workflow, and demos.
 */

import type { PromptDefinition } from "../../../types/index.js";

/**
 * Data analysis prompt
 */
export function createDataAnalysisPrompt(): PromptDefinition {
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
 * Summarize table prompt - Intelligent table analysis
 */
export function createSummarizeTablePrompt(): PromptDefinition {
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
export function createHybridSearchWorkflowPrompt(): PromptDefinition {
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
export function createDemoPrompt(): PromptDefinition {
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
