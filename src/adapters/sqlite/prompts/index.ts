/**
 * SQLite Prompt Definitions — Barrel Re-export
 *
 * MCP prompts for common database operations and analysis.
 * 10 prompts total.
 */

import type { SqliteAdapter } from "../SqliteAdapter.js";
import type { PromptDefinition } from "../../../types/index.js";
import {
  createExplainSchemaPrompt,
  createOptimizationPrompt,
  createDocumentationPrompt,
} from "./schema.js";
import {
  createQueryBuilderPrompt,
  createMigrationPrompt,
  createDebugQueryPrompt,
} from "./query.js";
import {
  createDataAnalysisPrompt,
  createSummarizeTablePrompt,
  createHybridSearchWorkflowPrompt,
  createDemoPrompt,
} from "./analysis.js";

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

// Re-export individual creators for direct access
export {
  createExplainSchemaPrompt,
  createOptimizationPrompt,
  createDocumentationPrompt,
} from "./schema.js";

export {
  createQueryBuilderPrompt,
  createMigrationPrompt,
  createDebugQueryPrompt,
} from "./query.js";

export {
  createDataAnalysisPrompt,
  createSummarizeTablePrompt,
  createHybridSearchWorkflowPrompt,
  createDemoPrompt,
} from "./analysis.js";
