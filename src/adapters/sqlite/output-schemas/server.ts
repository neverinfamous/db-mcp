/**
 * Built-in Server Tool Output Schemas (3 tools) + Export Type Aliases
 */

import { z } from "zod";
import type {
import { ErrorResponseFields } from "../../../utils/errors/error-response-fields.js";
  ReadQueryOutputSchema,
  WriteQueryOutputSchema,
  CreateTableOutputSchema,
  ListTablesOutputSchema,
  DescribeTableOutputSchema,
  DropTableOutputSchema,
  GetIndexesOutputSchema,
} from "./core.js";

/**
 * server_info output
 */
export const ServerInfoOutputSchema = z.object({
  name: z.string(),
  version: z.string(),
  transport: z.string(),
  adapters: z.array(
    z.object({
      id: z.string(),
      type: z.string(),
      name: z.string(),
    }),
  ),
  toolCount: z.number(),
  toolFilter: z.string().optional(),
}).extend(ErrorResponseFields.shape);

/**
 * server_health output
 */
export const ServerHealthOutputSchema = z.object({
  status: z.enum(["healthy", "degraded", "unhealthy"]),
  adapters: z.array(
    z.object({
      id: z.string(),
      connected: z.boolean(),
      latencyMs: z.number().optional(),
      error: z.string().optional(),
    }),
  ),
  uptime: z.number().optional(),
}).extend(ErrorResponseFields.shape);

/**
 * list_adapters output
 */
export const ListAdaptersOutputSchema = z.object({
  count: z.number(),
  adapters: z.array(
    z.object({
      id: z.string(),
      type: z.string(),
      name: z.string(),
      database: z.string().optional(),
      connected: z.boolean(),
    }),
  ),
}).extend(ErrorResponseFields.shape);

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
