/**
 * db-mcp - Token Validator Unit Tests
 *
 * Tests for JWT token validation including error handling,
 * scope parsing, and JWKS integration.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { TokenValidator, createTokenValidator } from "../token-validator.js";
import type { TokenValidatorConfig } from "../types.js";

// Mock jose to avoid real JWKS fetching
vi.mock("jose", () => ({
  createRemoteJWKSet: vi.fn(() => vi.fn()),
  jwtVerify: vi.fn(),
  errors: {
    JWTExpired: class JWTExpired extends Error {
      constructor() {
        super("JWT expired");
        this.name = "JWTExpired";
      }
    },
    JWKSNoMatchingKey: class JWKSNoMatchingKey extends Error {
      constructor() {
        super("No matching key");
        this.name = "JWKSNoMatchingKey";
      }
    },
    JWSSignatureVerificationFailed: class JWSSignatureVerificationFailed extends Error {
      constructor() {
        super("Signature failed");
        this.name = "JWSSignatureVerificationFailed";
      }
    },
    JWTClaimValidationFailed: class JWTClaimValidationFailed extends Error {
      constructor() {
        super("Claim validation failed");
        this.name = "JWTClaimValidationFailed";
      }
    },
  },
}));

describe("TokenValidator", () => {
  let config: TokenValidatorConfig;

  beforeEach(() => {
    vi.clearAllMocks();
    config = {
      jwksUri: "https://auth.example.com/.well-known/jwks.json",
      issuer: "https://auth.example.com",
      audience: "db-mcp",
    };
  });

  describe("construction", () => {
    it("should create instance with config", () => {
      const validator = new TokenValidator(config);
      expect(validator).toBeInstanceOf(TokenValidator);
    });
  });

  describe("createTokenValidator factory", () => {
    it("should create TokenValidator instance", () => {
      const validator = createTokenValidator(config);
      expect(validator).toBeInstanceOf(TokenValidator);
    });
  });

  describe("validate", () => {
    it("should validate token and return claims on success", async () => {
      const { jwtVerify } = await import("jose");
      const mockVerify = vi.mocked(jwtVerify);

      const mockPayload = {
        sub: "user-1",
        iss: "https://auth.example.com",
        aud: "db-mcp",
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
        scope: "read write",
      };

      mockVerify.mockResolvedValueOnce({
        payload: mockPayload,
        protectedHeader: { alg: "RS256" },
      } as never);

      const validator = new TokenValidator(config);
      const result = await validator.validate("valid-jwt-token");

      expect(result.valid).toBe(true);
      expect(result.claims).toBeDefined();
      expect(result.claims?.sub).toBe("user-1");
      expect(result.claims?.scopes).toEqual(["read", "write"]);
    });

    it("should return invalid for expired tokens", async () => {
      const { jwtVerify, errors } = await import("jose");
      const mockVerify = vi.mocked(jwtVerify);
      const JWTExpired = errors.JWTExpired as unknown as new () => Error;

      mockVerify.mockRejectedValueOnce(new JWTExpired());

      const validator = new TokenValidator(config);
      const result = await validator.validate("expired-token");

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should handle signature verification failure", async () => {
      const { jwtVerify, errors } = await import("jose");
      const mockVerify = vi.mocked(jwtVerify);
      const JWSSignatureVerificationFailed =
        errors.JWSSignatureVerificationFailed as unknown as new () => Error;

      mockVerify.mockRejectedValueOnce(new JWSSignatureVerificationFailed());

      const validator = new TokenValidator(config);
      const result = await validator.validate("bad-sig-token");

      expect(result.valid).toBe(false);
    });

    it("should parse scope claim as string", async () => {
      const { jwtVerify } = await import("jose");
      const mockVerify = vi.mocked(jwtVerify);

      mockVerify.mockResolvedValueOnce({
        payload: {
          sub: "user-1",
          scope: "read admin",
          exp: Math.floor(Date.now() / 1000) + 3600,
          iat: Math.floor(Date.now() / 1000),
        },
        protectedHeader: { alg: "RS256" },
      } as never);

      const validator = new TokenValidator(config);
      const result = await validator.validate("scope-token");

      expect(result.valid).toBe(true);
      expect(result.claims?.scopes).toEqual(["read", "admin"]);
    });
  });
});
