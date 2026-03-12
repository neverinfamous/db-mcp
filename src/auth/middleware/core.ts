import type { TokenClaims } from "../types.js";
import type { TokenValidator } from "../token-validator.js";
import {
  TokenMissingError,
  InvalidTokenError,
  InsufficientScopeError,
} from "../errors.js";
import { hasScope as checkScope } from "../scopes/index.js";
import { extractBearerToken } from "./extraction.js";

export interface AuthenticatedContext {
  /** Whether request is authenticated */
  authenticated: boolean;

  /** Token claims (if authenticated) */
  claims?: TokenClaims;

  /** Token scopes (convenience) */
  scopes: string[];
}

export async function createAuthenticatedContext(
  authHeader: string | undefined,
  tokenValidator: TokenValidator,
): Promise<AuthenticatedContext> {
  const token = extractBearerToken(authHeader);

  if (!token) {
    return { authenticated: false, scopes: [] };
  }

  const result = await tokenValidator.validate(token);

  if (!result.valid || !result.claims) {
    return { authenticated: false, scopes: [] };
  }

  return {
    authenticated: true,
    claims: result.claims,
    scopes: result.claims.scopes,
  };
}

export async function validateAuth(
  authHeader: string | undefined,
  tokenValidator: TokenValidator,
  options: { required?: boolean; requiredScopes?: string[] } = {},
): Promise<AuthenticatedContext> {
  const { required = true, requiredScopes } = options;
  const token = extractBearerToken(authHeader);

  if (!token) {
    if (required) {
      throw new TokenMissingError();
    }
    return { authenticated: false, scopes: [] };
  }

  const result = await tokenValidator.validate(token);

  if (!result.valid || !result.claims) {
    throw new InvalidTokenError(result.error ?? "Invalid token");
  }

  const context: AuthenticatedContext = {
    authenticated: true,
    claims: result.claims,
    scopes: result.claims.scopes,
  };

  if (requiredScopes && requiredScopes.length > 0) {
    const hasRequired = requiredScopes.some((scope) =>
      checkScope(context.scopes, scope),
    );
    if (!hasRequired) {
      throw new InsufficientScopeError(requiredScopes, context.scopes);
    }
  }

  return context;
}

export function formatOAuthError(error: unknown): {
  status: number;
  body: object;
} {
  if (error instanceof TokenMissingError) {
    return {
      status: 401,
      body: {
        error: "invalid_token",
        error_description: error.message,
      },
    };
  }

  if (error instanceof InvalidTokenError) {
    return {
      status: 401,
      body: {
        error: "invalid_token",
        error_description: error.message,
      },
    };
  }

  if (error instanceof InsufficientScopeError) {
    const required = error.details?.["requiredScope"] as string[] | undefined;
    return {
      status: 403,
      body: {
        error: "insufficient_scope",
        error_description: error.message,
        scope: required ? required.join(" ") : undefined,
      },
    };
  }

  return {
    status: 500,
    body: {
      error: "server_error",
      error_description: "Internal server error",
    },
  };
}
