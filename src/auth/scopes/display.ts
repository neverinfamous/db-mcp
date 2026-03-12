import { SCOPES } from "./constants.js";

/**
 * Get human-readable display name for a scope
 */
export function getScopeDisplayName(scope: string): string {
  switch (scope) {
    case SCOPES.READ:
      return "Read Only";
    case SCOPES.WRITE:
      return "Read/Write";
    case SCOPES.ADMIN:
      return "Administrative";
    case SCOPES.FULL:
      return "Full Access";
    default:
      if (scope.startsWith("db:")) {
        return `Database: ${scope.slice(3)}`;
      }
      if (scope.startsWith("table:")) {
        return `Table: ${scope.slice(6)}`;
      }
      return scope;
  }
}
