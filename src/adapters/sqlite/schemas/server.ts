/**
 * Built-in Server Tool Export Type Aliases
 */

import type { z } from "zod";
import type {
  ReadQueryOutputSchema,
  WriteQueryOutputSchema,
  CreateTableOutputSchema,
  ListTablesOutputSchema,
  DescribeTableOutputSchema,
  DropTableOutputSchema,
  GetIndexesOutputSchema,
} from "./core.js";

// =============================================================================
// Export Type Aliases
// =============================================================================

export type ReadQueryOutput = z.infer<typeof ReadQueryOutputSchema>;
export type WriteQueryOutput = z.infer<typeof WriteQueryOutputSchema>;
export type CreateTableOutput = z.infer<typeof CreateTableOutputSchema>;
export type ListTablesOutput = z.infer<typeof ListTablesOutputSchema>;
export type DescribeTableOutput = z.infer<typeof DescribeTableOutputSchema>;
export type DropTableOutput = z.infer<typeof DropTableOutputSchema>;
export type GetIndexesOutput = z.infer<typeof GetIndexesOutputSchema>;
