/**
 * db-mcp - Middleware Unit Tests
 *
 * Tests for OAuth middleware utilities including token extraction,
 * transport-agnostic auth context, and error formatting.
 */

import { describe, it, expect, vi } from "vitest";
import {
  extractBearerToken,
  createAuthenticatedContext,
  validateAuth,
  formatOAuthError,
} from "../middleware/index.js";
import {
  TokenMissingError,
  InvalidTokenError,
  InsufficientScopeError,
} from "../errors.js";
import type { TokenValidator } from "../token-validator.js";

// =============================================================================
// extractBearerToken
// =============================================================================

describe("extractBearerToken", () => {
  it("should extract token from valid Bearer header", () => {
    expect(extractBearerToken("Bearer abc123")).toBe("abc123");
  });

  it("should return null for missing header", () => {
    expect(extractBearerToken(undefined)).toBeNull();
  });

  it("should return null for empty header", () => {
    expect(extractBearerToken("")).toBeNull();
  });

  it("should be case-insensitive for Bearer scheme", () => {
    expect(extractBearerToken("bearer abc123")).toBe("abc123");
    expect(extractBearerToken("BEARER abc123")).toBe("abc123");
  });

  it("should return null for non-Bearer scheme", () => {
    expect(extractBearerToken("Basic abc123")).toBeNull();
  });

  it("should return null for malformed header (no token)", () => {
    expect(extractBearerToken("Bearer")).toBeNull();
  });

  it("should return null for too many parts", () => {
    expect(extractBearerToken("Bearer abc 123")).toBeNull();
  });

  it("should return null for extra spaces in header", () => {
    expect(extractBearerToken("Bearer  abc123 ")).toBeNull();
  });
});

// =============================================================================
// createAuthenticatedContext
// =============================================================================

describe("createAuthenticatedContext", () => {
  const createMockValidator = (result: {
    valid: boolean;
    claims?: object;
    error?: string;
  }): TokenValidator =>
    ({
      validate: vi.fn().mockResolvedValue(result),
    }) as unknown as TokenValidator;

  it("should return unauthenticated when no header", async () => {
    const validator = createMockValidator({ valid: true });
    const ctx = await createAuthenticatedContext(undefined, validator);

    expect(ctx.authenticated).toBe(false);
    expect(ctx.scopes).toEqual([]);
    expect(ctx.claims).toBeUndefined();
  });

  it("should return authenticated with valid token", async () => {
    const claims = {
      sub: "user-1",
      scopes: ["read", "write"],
      exp: 9999999999,
      iat: 1000000000,
    };
    const validator = createMockValidator({ valid: true, claims });
    const ctx = await createAuthenticatedContext(
      "Bearer valid-token",
      validator,
    );

    expect(ctx.authenticated).toBe(true);
    expect(ctx.scopes).toEqual(["read", "write"]);
    expect(ctx.claims?.sub).toBe("user-1");
  });

  it("should return unauthenticated for invalid token", async () => {
    const validator = createMockValidator({
      valid: false,
      error: "Invalid signature",
    });
    const ctx = await createAuthenticatedContext("Bearer bad-token", validator);

    expect(ctx.authenticated).toBe(false);
    expect(ctx.scopes).toEqual([]);
  });
});

// =============================================================================
// validateAuth
// =============================================================================

describe("validateAuth", () => {
  const createMockValidator = (result: {
    valid: boolean;
    claims?: object;
    error?: string;
  }): TokenValidator =>
    ({
      validate: vi.fn().mockResolvedValue(result),
    }) as unknown as TokenValidator;

  it("should throw TokenMissingError when no token and required", async () => {
    const validator = createMockValidator({ valid: true });
    await expect(
      validateAuth(undefined, validator, { required: true }),
    ).rejects.toThrow(TokenMissingError);
  });

  it("should return unauthenticated when no token and not required", async () => {
    const validator = createMockValidator({ valid: true });
    const ctx = await validateAuth(undefined, validator, { required: false });

    expect(ctx.authenticated).toBe(false);
  });

  it("should throw InvalidTokenError for invalid token", async () => {
    const validator = createMockValidator({
      valid: false,
      error: "expired",
    });
    await expect(
      validateAuth("Bearer expired-token", validator),
    ).rejects.toThrow(InvalidTokenError);
  });

  it("should return authenticated context for valid token", async () => {
    const claims = {
      sub: "user-1",
      scopes: ["admin"],
      exp: 9999999999,
      iat: 1000000000,
    };
    const validator = createMockValidator({ valid: true, claims });
    const ctx = await validateAuth("Bearer good-token", validator);

    expect(ctx.authenticated).toBe(true);
    expect(ctx.scopes).toEqual(["admin"]);
  });

  it("should throw InsufficientScopeError when scope missing", async () => {
    const claims = {
      sub: "user-1",
      scopes: ["read"],
      exp: 9999999999,
      iat: 1000000000,
    };
    const validator = createMockValidator({ valid: true, claims });
    await expect(
      validateAuth("Bearer token", validator, {
        requiredScopes: ["admin"],
      }),
    ).rejects.toThrow(InsufficientScopeError);
  });

  it("should pass when required scope is satisfied by hierarchy", async () => {
    const claims = {
      sub: "user-1",
      scopes: ["full"],
      exp: 9999999999,
      iat: 1000000000,
    };
    const validator = createMockValidator({ valid: true, claims });
    const ctx = await validateAuth("Bearer token", validator, {
      requiredScopes: ["admin"],
    });

    expect(ctx.authenticated).toBe(true);
  });
});

// =============================================================================
// formatOAuthError
// =============================================================================

describe("formatOAuthError", () => {
  it("should format TokenMissingError as 401", () => {
    const result = formatOAuthError(new TokenMissingError());
    expect(result.status).toBe(401);
    expect(result.body).toHaveProperty("error", "invalid_token");
  });

  it("should format InvalidTokenError as 401", () => {
    const result = formatOAuthError(new InvalidTokenError("bad token"));
    expect(result.status).toBe(401);
    expect(result.body).toHaveProperty("error", "invalid_token");
  });

  it("should format InsufficientScopeError as 403", () => {
    const result = formatOAuthError(
      new InsufficientScopeError("admin", ["read"]),
    );
    expect(result.status).toBe(403);
    expect(result.body).toHaveProperty("error", "insufficient_scope");
  });

  it("should format unknown error as 500", () => {
    const result = formatOAuthError(new Error("unknown"));
    expect(result.status).toBe(500);
    expect(result.body).toHaveProperty("error", "server_error");
  });

  it("should include scope in InsufficientScopeError body", () => {
    const result = formatOAuthError(
      new InsufficientScopeError(["read", "write"]),
    );
    expect(result.body).toHaveProperty("scope", "read write");
  });
});
