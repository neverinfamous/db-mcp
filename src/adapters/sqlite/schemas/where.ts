import { z } from "zod";

export const WhereConditionSchema = z.object({
  column: z.string(),
  operator: z.enum([
    "=",
    "!=",
    ">",
    ">=",
    "<",
    "<=",
    "LIKE",
    "IN",
    "IS",
    "IS NOT",
    "NOT LIKE",
  ]),
  value: z.unknown(),
});

export type WhereCondition = z.infer<typeof WhereConditionSchema>;
