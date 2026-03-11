/**
 * JSON Helper Utilities
 *
 * Shared helper functions for JSON path operations.
 */

/**
 * Extract a meaningful column name from a JSONPath expression.
 * Examples:
 *   $.name -> name
 *   $.user.email -> email
 *   $[0] -> item_0
 *   $[*].name -> name
 *   $.items[0].price -> price
 */
export function extractColumnNameFromPath(path: string): string {
  // Remove leading $
  const remaining = path.slice(1);

  // Find the last meaningful segment
  // Match either .key or [index]
  const segments: string[] = [];
  const regex = /\.([a-zA-Z_][a-zA-Z0-9_]*)|(\[(\d+|\*)\])/g;
  let match;
  while ((match = regex.exec(remaining)) !== null) {
    if (match[1]) {
      segments.push(match[1]);
    } else if (match[3] !== undefined) {
      segments.push(match[3] === "*" ? "items" : `item_${match[3]}`);
    }
  }

  // Use the last segment as the column name
  return segments.length > 0 ? (segments[segments.length - 1] ?? "value") : "value";
}

/**
 * Given an array of JSONPath expressions, return unique column names.
 * Duplicates get numeric suffixes (e.g., name, name_2, name_3).
 */
export function getUniqueColumnNames(paths: string[]): string[] {
  const names: string[] = [];
  const counts: Record<string, number> = {};

  for (const path of paths) {
    const baseName = extractColumnNameFromPath(path);
    if ((counts[baseName] ?? 0) === 0) {
      counts[baseName] = 1;
      names.push(baseName);
    } else {
      counts[baseName] = (counts[baseName] ?? 0) + 1;
      names.push(`${baseName}_${counts[baseName]}`);
    }
  }

  return names;
}
