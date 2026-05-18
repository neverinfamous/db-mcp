/**
 * Code Mode Output Schemas
 */

import { z } from "zod";
import { ErrorFieldsMixin } from "./error-mixin.js";

/**
 * sqlite_execute_code output
 */
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
      })
      .optional()
      .describe("Execution performance metrics"),
  })
  .extend(ErrorFieldsMixin.shape);
