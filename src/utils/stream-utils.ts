import type { ProgressContext } from "./progress-utils.js";
import { sendProgress } from "./progress-utils.js";

/** Default number of rows per streaming chunk */
export const STREAM_CHUNK_SIZE = 10;

/**
 * Stream query result rows to the client via MCP progress notifications.
 * Each chunk contains a JSON-serialized array of rows.
 *
 * @param ctx The MCP progress context
 * @param rows The full array of query result rows
 * @param chunkSize Optional custom chunk size (defaults to STREAM_CHUNK_SIZE)
 * @returns Number of chunks emitted
 */
export async function streamResultRows(
  ctx: ProgressContext,
  rows: Record<string, unknown>[],
  chunkSize: number = STREAM_CHUNK_SIZE,
): Promise<number> {
  if (rows.length === 0) {
    return 0;
  }

  const effectiveChunkSize = Math.max(1, chunkSize);
  const totalChunks = Math.ceil(rows.length / effectiveChunkSize);

  for (let i = 0; i < totalChunks; i++) {
    const start = i * effectiveChunkSize;
    const end = Math.min(start + effectiveChunkSize, rows.length);
    const chunk = rows.slice(start, end);

    // Send the chunk as the progress message payload
    await sendProgress(ctx, i + 1, totalChunks, JSON.stringify(chunk));
  }

  return totalChunks;
}
