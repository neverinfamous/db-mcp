import { BASE_SCOPES, SCOPES, SCOPE_PATTERNS } from "./constants.js";

/**
 * Check if a scope is valid (matches known patterns)
 */
export function isValidScope(scope: string): boolean {
  // Check base scopes
  if ((BASE_SCOPES as readonly string[]).includes(scope)) {
    return true;
  }

  // Check database pattern
  if (SCOPE_PATTERNS.DATABASE.test(scope)) {
    return true;
  }

  // Check table pattern
  if (SCOPE_PATTERNS.TABLE.test(scope)) {
    return true;
  }

  return false;
}

/**
 * Check if granted scopes include the required scope.
 * Respects the scope hierarchy: full ⊃ admin ⊃ write ⊃ read
 */
export function hasScope(
  grantedScopes: string[],
  requiredScope: string,
): boolean {
  // Full scope grants everything
  if (grantedScopes.includes(SCOPES.FULL)) {
    return true;
  }

  // Direct match
  if (grantedScopes.includes(requiredScope)) {
    return true;
  }

  // Admin scope includes write and read
  if (requiredScope === SCOPES.READ || requiredScope === SCOPES.WRITE) {
    if (grantedScopes.includes(SCOPES.ADMIN)) {
      return true;
    }
  }

  // Write scope includes read
  if (requiredScope === SCOPES.READ) {
    if (grantedScopes.includes(SCOPES.WRITE)) {
      return true;
    }
  }

  return false;
}

/**
 * Check if granted scopes include any of the required scopes
 */
export function hasAnyScope(
  grantedScopes: string[],
  requiredScopes: string[],
): boolean {
  return requiredScopes.some((scope) => hasScope(grantedScopes, scope));
}

/**
 * Check if granted scopes include all of the required scopes
 */
export function hasAllScopes(
  grantedScopes: string[],
  requiredScopes: string[],
): boolean {
  return requiredScopes.every((scope) => hasScope(grantedScopes, scope));
}

/**
 * Check if scopes include admin access
 */
export function hasAdminScope(scopes: string[]): boolean {
  return scopes.includes("admin") || scopes.includes("full");
}

/**
 * Check if scopes include write access
 */
export function hasWriteScope(scopes: string[]): boolean {
  return scopes.includes("write") || hasAdminScope(scopes);
}

/**
 * Check if scopes include read access
 */
export function hasReadScope(scopes: string[]): boolean {
  return scopes.includes("read") || hasWriteScope(scopes);
}
