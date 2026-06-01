/**
 * db-mcp - Token Estimation Utility
 */

export type ContentType = "json" | "sql" | "text";

/**
 * Estimates the number of tokens in a given string based on its content type.
 * Replaces the naive Math.ceil(length / 4) heuristic which significantly
 * underestimates JSON and SQL payloads.
 *
 * @param text The string content to estimate tokens for
 * @param contentType The type of content (json, sql, or text)
 * @returns An estimated token count
 */
export function estimateTokens(
  text: string,
  contentType: ContentType = "text",
): number {
  const bytes = Buffer.byteLength(text, "utf8");
  switch (contentType) {
    case "json":
      // JSON has ~3 bytes/token due to structure characters ({, }, ", :)
      return Math.ceil(bytes / 3);
    case "sql":
      // SQL keywords compress well
      return Math.ceil(bytes / 3.5);
    case "text":
    default:
      // English prose default
      return Math.ceil(bytes / 4);
  }
}
