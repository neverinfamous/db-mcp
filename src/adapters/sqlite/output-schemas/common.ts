/**
 * Common Building Blocks for Output Schemas
 */

import { z } from "zod";

/**
 * Generic row record for query results - allows any string keys with unknown values
 */
export const RowRecordSchema = z.record(z.string(), z.unknown());
