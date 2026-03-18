/**
 * TokenValidator Unit Tests
 *
 * Tests JWT token validation, claims extraction, error handling,
 * cache management, and static factory methods.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as jose from "jose";
import { TokenValidator, createTokenValidator } from "../../src/auth/token-validator.js";
import { ERROR_CODES } from "../../src/utils/logger/index.js";

// =============================================================================
// TokenValidator
// =============================================================================

describe("TokenValidator", () => {
  const config = {
    jwksUri: "https://auth.example.com/.well-known/jwks.json",
    issuer: "https://auth.example.com",
    audience: "db-mcp",
  };

  let validator: TokenValidator;

  beforeEach(() => {
    validator = new TokenValidator(config);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ===========================================================================
  // Constructor
  // ===========================================================================

  describe("constructor", () => {
    it("should create an instance with required config", () => {
      expect(validator).toBeInstanceOf(TokenValidator);
    });

    it("should accept custom clockTolerance and cacheTtl", () => {
      const custom = new TokenValidator({
        ...config,
        clockTolerance: 30,
        jwksCacheTtl: 1800,
      });
      expect(custom).toBeInstanceOf(TokenValidator);
    });
  });

  // ===========================================================================
  // validate
  // ===========================================================================

  describe("validate", () => {
    it("should return valid result for a good token", async () => {
      const mockPayload = {
        sub: "user-123",
        scope: "read write",
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
        iss: config.issuer,
        aud: config.audience,
      };

      vi.spyOn(jose, "jwtVerify").mockResolvedValueOnce({
        payload: mockPayload,
        protectedHeader: { alg: "RS256" },
      } as unknown as jose.JWTVerifyResult);

      vi.spyOn(jose, "createRemoteJWKSet").mockReturnValueOnce(
        (() => {}) as unknown as ReturnType<typeof jose.createRemoteJWKSet>,
      );

      const result = await validator.validate("valid.jwt.token");

      expect(result.valid).toBe(true);
      expect(result.claims?.sub).toBe("user-123");
      expect(result.claims?.scopes).toEqual(["read", "write"]);
    });

    it("should handle expired token", async () => {
      vi.spyOn(jose, "createRemoteJWKSet").mockReturnValueOnce(
        (() => {}) as unknown as ReturnType<typeof jose.createRemoteJWKSet>,
      );

      const expiredError = new jose.errors.JWTExpired("Token expired");
      vi.spyOn(jose, "jwtVerify").mockRejectedValueOnce(expiredError);

      const result = await validator.validate("expired.jwt.token");

      expect(result.valid).toBe(false);
      expect(result.error).toBe("Token has expired");
      expect(result.errorCode).toBe(ERROR_CODES.AUTH.TOKEN_EXPIRED.full);
    });

    it("should handle claim validation failure", async () => {
      vi.spyOn(jose, "createRemoteJWKSet").mockReturnValueOnce(
        (() => {}) as unknown as ReturnType<typeof jose.createRemoteJWKSet>,
      );

      const claimError = new jose.errors.JWTClaimValidationFailed(
        "audience mismatch",
      );
      vi.spyOn(jose, "jwtVerify").mockRejectedValueOnce(claimError);

      const result = await validator.validate("bad-claims.jwt.token");

      expect(result.valid).toBe(false);
      expect(result.error).toContain("Token claim validation failed");
      expect(result.errorCode).toBe(ERROR_CODES.AUTH.TOKEN_INVALID.full);
    });

    it("should handle signature verification failure", async () => {
      vi.spyOn(jose, "createRemoteJWKSet").mockReturnValueOnce(
        (() => {}) as unknown as ReturnType<typeof jose.createRemoteJWKSet>,
      );

      const sigError = new jose.errors.JWSSignatureVerificationFailed(
        "bad signature",
      );
      vi.spyOn(jose, "jwtVerify").mockRejectedValueOnce(sigError);

      const result = await validator.validate("bad-sig.jwt.token");

      expect(result.valid).toBe(false);
      expect(result.error).toBe("Token signature verification failed");
      expect(result.errorCode).toBe(ERROR_CODES.AUTH.SIGNATURE_INVALID.full);
    });

    it("should handle no matching JWKS key", async () => {
      vi.spyOn(jose, "createRemoteJWKSet").mockReturnValueOnce(
        (() => {}) as unknown as ReturnType<typeof jose.createRemoteJWKSet>,
      );

      const noKeyError = new jose.errors.JWKSNoMatchingKey();
      vi.spyOn(jose, "jwtVerify").mockRejectedValueOnce(noKeyError);

      const result = await validator.validate("no-key.jwt.token");

      expect(result.valid).toBe(false);
      expect(result.error).toBe("No matching key found in JWKS");
      expect(result.errorCode).toBe(ERROR_CODES.AUTH.TOKEN_INVALID.full);
    });

    it("should handle generic errors", async () => {
      vi.spyOn(jose, "createRemoteJWKSet").mockReturnValueOnce(
        (() => {}) as unknown as ReturnType<typeof jose.createRemoteJWKSet>,
      );

      vi.spyOn(jose, "jwtVerify").mockRejectedValueOnce(
        new Error("unexpected error"),
      );

      const result = await validator.validate("bad.jwt.token");

      expect(result.valid).toBe(false);
      expect(result.error).toContain("unexpected error");
      expect(result.errorCode).toBe(ERROR_CODES.AUTH.TOKEN_INVALID.full);
    });

    it("should extract scopes from 'scopes' array claim", async () => {
      vi.spyOn(jose, "createRemoteJWKSet").mockReturnValueOnce(
        (() => {}) as unknown as ReturnType<typeof jose.createRemoteJWKSet>,
      );

      const payload = {
        sub: "user-1",
        scopes: ["read", "write", "admin"],
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      };

      vi.spyOn(jose, "jwtVerify").mockResolvedValueOnce({
        payload,
        protectedHeader: { alg: "RS256" },
      } as unknown as jose.JWTVerifyResult);

      const result = await validator.validate("array-scopes.jwt.token");

      expect(result.valid).toBe(true);
      expect(result.claims?.scopes).toEqual(["read", "write", "admin"]);
    });

    it("should extract scopes from 'scope' array claim", async () => {
      vi.spyOn(jose, "createRemoteJWKSet").mockReturnValueOnce(
        (() => {}) as unknown as ReturnType<typeof jose.createRemoteJWKSet>,
      );

      const payload = {
        sub: "user-1",
        scope: ["read", "full"],
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      };

      vi.spyOn(jose, "jwtVerify").mockResolvedValueOnce({
        payload,
        protectedHeader: { alg: "RS256" },
      } as unknown as jose.JWTVerifyResult);

      const result = await validator.validate("scope-array.jwt.token");

      expect(result.valid).toBe(true);
      expect(result.claims?.scopes).toEqual(["read", "full"]);
    });

    it("should default missing claims gracefully", async () => {
      vi.spyOn(jose, "createRemoteJWKSet").mockReturnValueOnce(
        (() => {}) as unknown as ReturnType<typeof jose.createRemoteJWKSet>,
      );

      const payload = {}; // no sub, exp, iat

      vi.spyOn(jose, "jwtVerify").mockResolvedValueOnce({
        payload,
        protectedHeader: { alg: "RS256" },
      } as unknown as jose.JWTVerifyResult);

      const result = await validator.validate("minimal.jwt.token");

      expect(result.valid).toBe(true);
      expect(result.claims?.sub).toBe("unknown");
      expect(result.claims?.exp).toBe(0);
      expect(result.claims?.iat).toBe(0);
      expect(result.claims?.scopes).toEqual([]);
    });
  });

  // ===========================================================================
  // Cache Management
  // ===========================================================================

  describe("clearCache", () => {
    it("should clear cache without throwing", () => {
      expect(() => validator.clearCache()).not.toThrow();
    });
  });

  // ===========================================================================
  // toOAuthError (static)
  // ===========================================================================

  describe("toOAuthError", () => {
    it("should return TokenExpiredError for expired token code", () => {
      const error = TokenValidator.toOAuthError({
        valid: false,
        error: "Token has expired",
        errorCode: ERROR_CODES.AUTH.TOKEN_EXPIRED.full,
      });
      expect(error.name).toBe("TokenExpiredError");
    });

    it("should return InvalidSignatureError for signature code", () => {
      const error = TokenValidator.toOAuthError({
        valid: false,
        error: "Bad sig",
        errorCode: ERROR_CODES.AUTH.SIGNATURE_INVALID.full,
      });
      expect(error.name).toBe("InvalidSignatureError");
    });

    it("should return InvalidTokenError for other codes", () => {
      const error = TokenValidator.toOAuthError({
        valid: false,
        error: "unknown",
        errorCode: ERROR_CODES.AUTH.TOKEN_INVALID.full,
      });
      expect(error.name).toBe("InvalidTokenError");
    });

    it("should return InvalidTokenError when no errorCode", () => {
      const error = TokenValidator.toOAuthError({
        valid: false,
        error: "generic",
      });
      expect(error.name).toBe("InvalidTokenError");
    });
  });

  // ===========================================================================
  // createTokenValidator (factory)
  // ===========================================================================

  describe("createTokenValidator", () => {
    it("should create a TokenValidator instance", () => {
      const tv = createTokenValidator(config);
      expect(tv).toBeInstanceOf(TokenValidator);
    });
  });
});
