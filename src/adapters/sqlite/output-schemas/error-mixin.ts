/**
 * Error Fields Mixin
 *
 * Shared Zod schema for enriched error fields returned by formatHandlerErrorResponse().
 * Merge into any output schema: `MySchema.merge(ErrorFieldsMixin)`.
 */

import { z } from "zod";

export const ErrorFieldsMixin = z.object({
  error: z.string().optional(),
  code: z.string().optional(),
  category: z.string().optional(),
  suggestion: z.string().optional(),
  recoverable: z.boolean().optional(),
  details: z.record(z.string(), z.unknown()).optional(),
});
