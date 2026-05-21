/**
 * db-mcp - Code Mode Tool Schemas
 *
 * Input validation and output schemas for Code Mode execution.
 */

import { z } from "zod";
import { ErrorResponseFields } from "../../../utils/errors/error-response-fields.js";

/**
 * Coerce string values to numbers for MCP parameter safety.
 * Returns undefined for unparseable values so `.default()` kicks in.
 */
const coerceNumber = (val: unknown): unknown =>
  typeof val === "string"
    ? Number.isNaN(Number(val))
      ? undefined
      : Number(val)
    : val;

// =============================================================================
// Input Schemas
// =============================================================================

export const ExecuteCodeSchema = z.object({
  code: z
    .string()
    .describe(
      "JavaScript code to execute. Access all SQLite tools via sqlite.* API. " +
        "Use sqlite.help() to discover groups, sqlite.<group>.help() for methods. " +
        "Example: const tables = await sqlite.core.listTables(); return tables;",
    ),
  timeout: z.preprocess(
    coerceNumber,
    z
      .number()
      .optional()
      .default(30000)
      .describe(
        "Execution timeout in milliseconds (500-30000, default: 30000)",
      ),
  ),
  readonly: z
    .boolean()
    .optional()
    .default(false)
    .describe("Restrict to read-only operations (default: false)"),
});

// =============================================================================
// Output Schemas
// =============================================================================

export const ExecuteCodeOutputSchema = z
  .object({
    success: z.boolean().describe("Whether execution completed successfully"),
    result: z.unknown().optional().describe("Return value from the code"),
    error: z.string().optional().describe("Error message if execution failed"),
    consoleOutput: z
      .array(z.string())
      .optional()
      .describe("Console output captured during execution"),
    metrics: z
      .object({
        wallTimeMs: z.number().describe("Wall clock time in milliseconds"),
        cpuTimeMs: z.number().describe("CPU time in milliseconds"),
        memoryUsedMb: z.number().describe("Memory used in MB"),
        tokenEstimate: z.number().optional().describe("Estimated token count of the result"),
      })
      .optional()
      .describe("Execution performance metrics"),
  })
  .extend(ErrorResponseFields.shape);

// Export types
export type ExecuteCodeInput = z.infer<typeof ExecuteCodeSchema>;
