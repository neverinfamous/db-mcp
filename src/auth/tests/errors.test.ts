/**
 * db-mcp - OAuth Errors Unit Tests
 *
 * Tests for OAuth-specific error classes.
 */

import { describe, it, expect } from "vitest";
import {
  OAuthError,
  TokenMissingError,
  InvalidTokenError,
  TokenExpiredError,
  InvalidSignatureError,
  InsufficientScopeError,
  AuthServerDiscoveryError,
  JwksFetchError,
  ClientRegistrationError,
  isOAuthError,
  getWWWAuthenticateHeader,
} from "../errors.js";
import { DbMcpError } from "../../utils/errors/index.js";

describe("OAuthError hierarchy", () => {
  it("should extend DbMcpError", () => {
    const error = new TokenMissingError();
    expect(error).toBeInstanceOf(OAuthError);
    expect(error).toBeInstanceOf(DbMcpError);
    expect(error).toBeInstanceOf(Error);
  });
});

describe("TokenMissingError", () => {
  it("should have 401 status", () => {
    const error = new TokenMissingError();
    expect(error.httpStatus).toBe(401);
  });

  it("should include WWW-Authenticate header", () => {
    const error = new TokenMissingError("https://db-mcp.example.com");
    expect(error.wwwAuthenticate).toContain("Bearer");
    expect(error.wwwAuthenticate).toContain("https://db-mcp.example.com");
  });

  it("should have correct name", () => {
    const error = new TokenMissingError();
    expect(error.name).toBe("TokenMissingError");
  });
});

describe("InvalidTokenError", () => {
  it("should have 401 status", () => {
    const error = new InvalidTokenError();
    expect(error.httpStatus).toBe(401);
  });

  it("should accept custom message", () => {
    const error = new InvalidTokenError("Token is malformed");
    expect(error.message).toBe("Token is malformed");
  });

  it("should include WWW-Authenticate header", () => {
    const error = new InvalidTokenError();
    expect(error.wwwAuthenticate).toContain("invalid_token");
  });
});

describe("TokenExpiredError", () => {
  it("should have 401 status", () => {
    const error = new TokenExpiredError();
    expect(error.httpStatus).toBe(401);
  });

  it("should include expiration date in details", () => {
    const expDate = new Date("2026-01-01T00:00:00Z");
    const error = new TokenExpiredError(expDate);
    expect(error.details).toHaveProperty("expiredAt");
  });
});

describe("InvalidSignatureError", () => {
  it("should have 401 status", () => {
    const error = new InvalidSignatureError();
    expect(error.httpStatus).toBe(401);
  });
});

describe("InsufficientScopeError", () => {
  it("should have 403 status", () => {
    const error = new InsufficientScopeError("admin");
    expect(error.httpStatus).toBe(403);
  });

  it("should accept string scope", () => {
    const error = new InsufficientScopeError("write");
    expect(error.message).toContain("write");
  });

  it("should accept array of scopes", () => {
    const error = new InsufficientScopeError(["read", "write"]);
    expect(error.message).toContain("read write");
  });

  it("should include WWW-Authenticate with scope", () => {
    const error = new InsufficientScopeError("admin");
    expect(error.wwwAuthenticate).toContain('scope="admin"');
  });

  it("should store required scope in details", () => {
    const error = new InsufficientScopeError(["admin"], ["read"]);
    expect(error.details?.requiredScope).toEqual(["admin"]);
    expect(error.details?.providedScopes).toEqual(["read"]);
  });
});

describe("AuthServerDiscoveryError", () => {
  it("should have 500 status", () => {
    const error = new AuthServerDiscoveryError("https://auth.example.com");
    expect(error.httpStatus).toBe(500);
  });

  it("should include server URL in message", () => {
    const error = new AuthServerDiscoveryError("https://auth.example.com");
    expect(error.message).toContain("https://auth.example.com");
  });
});

describe("JwksFetchError", () => {
  it("should have 500 status", () => {
    const error = new JwksFetchError(
      "https://auth.example.com/.well-known/jwks.json",
    );
    expect(error.httpStatus).toBe(500);
  });
});

describe("ClientRegistrationError", () => {
  it("should have 500 status", () => {
    const error = new ClientRegistrationError("Registration failed");
    expect(error.httpStatus).toBe(500);
  });
});

describe("isOAuthError", () => {
  it("should return true for OAuthError subclasses", () => {
    expect(isOAuthError(new TokenMissingError())).toBe(true);
    expect(isOAuthError(new InvalidTokenError())).toBe(true);
    expect(isOAuthError(new InsufficientScopeError("admin"))).toBe(true);
  });

  it("should return false for non-OAuthError", () => {
    expect(isOAuthError(new Error("generic"))).toBe(false);
    expect(isOAuthError("string")).toBe(false);
    expect(isOAuthError(null)).toBe(false);
  });
});

describe("getWWWAuthenticateHeader", () => {
  it("should return error WWW-Authenticate when available", () => {
    const error = new TokenMissingError();
    const header = getWWWAuthenticateHeader(error);
    expect(header).toContain("Bearer");
  });

  it("should fall back to realm when no WWW-Authenticate", () => {
    const error = new AuthServerDiscoveryError("https://auth.example.com");
    const header = getWWWAuthenticateHeader(error, "test-realm");
    expect(header).toContain("test-realm");
  });
});
