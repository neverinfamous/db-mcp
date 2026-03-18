/**
 * Authorization Server Discovery Unit Tests
 *
 * Tests metadata discovery, caching, validation, and accessor methods.
 * Uses vi.fn() to mock global fetch.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  AuthorizationServerDiscovery,
  createAuthServerDiscovery,
} from "../../src/auth/authorization-server-discovery.js";
import { AuthServerDiscoveryError } from "../../src/auth/errors.js";

// =============================================================================
// Helpers
// =============================================================================

const AUTH_SERVER_URL = "https://auth.example.com";
const VALID_METADATA = {
  issuer: AUTH_SERVER_URL,
  token_endpoint: `${AUTH_SERVER_URL}/oauth/token`,
  jwks_uri: `${AUTH_SERVER_URL}/.well-known/jwks.json`,
  scopes_supported: ["read", "write", "admin"],
  registration_endpoint: `${AUTH_SERVER_URL}/register`,
};

function createDiscovery(overrides?: Record<string, unknown>) {
  return new AuthorizationServerDiscovery({
    authServerUrl: AUTH_SERVER_URL,
    cacheTtl: 60,
    timeout: 1000,
    ...overrides,
  });
}

// =============================================================================
// Constructor
// =============================================================================

describe("AuthorizationServerDiscovery", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("constructor", () => {
    it("should normalize trailing slashes", () => {
      const disc = new AuthorizationServerDiscovery({
        authServerUrl: "https://auth.example.com///",
      });
      expect(disc.getAuthServerUrl()).toBe("https://auth.example.com");
    });

    it("should use default cacheTtl and timeout", () => {
      const disc = new AuthorizationServerDiscovery({
        authServerUrl: AUTH_SERVER_URL,
      });
      expect(disc).toBeDefined();
    });
  });

  // ===========================================================================
  // discover
  // ===========================================================================

  describe("discover", () => {
    it("should fetch and cache metadata", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(VALID_METADATA),
        }),
      );

      const disc = createDiscovery();
      const metadata = await disc.discover();

      expect(metadata.issuer).toBe(AUTH_SERVER_URL);
      expect(metadata.token_endpoint).toContain("/oauth/token");
      expect(disc.isCacheValid()).toBe(true);
    });

    it("should return cached metadata on second call", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(VALID_METADATA),
      });
      vi.stubGlobal("fetch", mockFetch);

      const disc = createDiscovery();
      await disc.discover();
      await disc.discover();

      // fetch should only be called once
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("should throw AuthServerDiscoveryError on HTTP error", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 404,
          statusText: "Not Found",
        }),
      );

      const disc = createDiscovery();
      await expect(disc.discover()).rejects.toThrow(AuthServerDiscoveryError);
    });

    it("should throw AuthServerDiscoveryError on network error", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockRejectedValue(new Error("Network error")),
      );

      const disc = createDiscovery();
      await expect(disc.discover()).rejects.toThrow(AuthServerDiscoveryError);
    });

    it("should throw on missing issuer", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ token_endpoint: "/token" }),
        }),
      );

      const disc = createDiscovery();
      await expect(disc.discover()).rejects.toThrow(AuthServerDiscoveryError);
    });

    it("should throw on missing token_endpoint", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ issuer: AUTH_SERVER_URL }),
        }),
      );

      const disc = createDiscovery();
      await expect(disc.discover()).rejects.toThrow(AuthServerDiscoveryError);
    });

    it("should warn on issuer mismatch but not throw", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: () =>
            Promise.resolve({
              ...VALID_METADATA,
              issuer: "https://different-issuer.com",
            }),
        }),
      );

      const disc = createDiscovery();
      // Should not throw — just warns
      const metadata = await disc.discover();
      expect(metadata.issuer).toBe("https://different-issuer.com");
    });
  });

  // ===========================================================================
  // Accessor Methods
  // ===========================================================================

  describe("accessor methods", () => {
    it("getMetadata should throw before discover", () => {
      const disc = createDiscovery();
      expect(() => disc.getMetadata()).toThrow("not yet discovered");
    });

    it("getJwksUri should return jwks_uri", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(VALID_METADATA),
        }),
      );

      const disc = createDiscovery();
      await disc.discover();
      expect(disc.getJwksUri()).toContain("jwks.json");
    });

    it("getJwksUri should throw when not present", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: () =>
            Promise.resolve({
              ...VALID_METADATA,
              jwks_uri: undefined,
            }),
        }),
      );

      const disc = createDiscovery();
      await disc.discover();
      expect(() => disc.getJwksUri()).toThrow("does not provide jwks_uri");
    });

    it("getTokenEndpoint should return endpoint", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(VALID_METADATA),
        }),
      );

      const disc = createDiscovery();
      await disc.discover();
      expect(disc.getTokenEndpoint()).toContain("/oauth/token");
    });

    it("getIssuer should return issuer", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(VALID_METADATA),
        }),
      );

      const disc = createDiscovery();
      await disc.discover();
      expect(disc.getIssuer()).toBe(AUTH_SERVER_URL);
    });

    it("getRegistrationEndpoint should return endpoint", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(VALID_METADATA),
        }),
      );

      const disc = createDiscovery();
      await disc.discover();
      expect(disc.getRegistrationEndpoint()).toContain("/register");
    });

    it("getRegistrationEndpoint should return null when not present", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: () =>
            Promise.resolve({
              ...VALID_METADATA,
              registration_endpoint: undefined,
            }),
        }),
      );

      const disc = createDiscovery();
      await disc.discover();
      expect(disc.getRegistrationEndpoint()).toBeNull();
    });

    it("supportsClientRegistration should check registration endpoint", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(VALID_METADATA),
        }),
      );

      const disc = createDiscovery();
      await disc.discover();
      expect(disc.supportsClientRegistration()).toBe(true);
    });

    it("getSupportedScopes should return scopes", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(VALID_METADATA),
        }),
      );

      const disc = createDiscovery();
      await disc.discover();
      expect(disc.getSupportedScopes()).toEqual(["read", "write", "admin"]);
    });

    it("isScopeSupported should check scope list", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(VALID_METADATA),
        }),
      );

      const disc = createDiscovery();
      await disc.discover();
      expect(disc.isScopeSupported("read")).toBe(true);
      expect(disc.isScopeSupported("unknown")).toBe(false);
    });

    it("isScopeSupported should allow all when no scopes listed", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: () =>
            Promise.resolve({
              ...VALID_METADATA,
              scopes_supported: undefined,
            }),
        }),
      );

      const disc = createDiscovery();
      await disc.discover();
      expect(disc.isScopeSupported("anything")).toBe(true);
    });
  });

  // ===========================================================================
  // Cache Management
  // ===========================================================================

  describe("cache management", () => {
    it("clearCache should invalidate cache", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(VALID_METADATA),
        }),
      );

      const disc = createDiscovery();
      await disc.discover();
      expect(disc.isCacheValid()).toBe(true);

      disc.clearCache();
      expect(disc.isCacheValid()).toBe(false);
    });

    it("isCacheValid should return false before discovery", () => {
      const disc = createDiscovery();
      expect(disc.isCacheValid()).toBe(false);
    });

    it("getAuthServerUrl should return the configured URL", () => {
      const disc = createDiscovery();
      expect(disc.getAuthServerUrl()).toBe(AUTH_SERVER_URL);
    });
  });

  // ===========================================================================
  // Factory
  // ===========================================================================

  describe("createAuthServerDiscovery", () => {
    it("should create instance with default options", () => {
      const disc = createAuthServerDiscovery(AUTH_SERVER_URL);
      expect(disc).toBeInstanceOf(AuthorizationServerDiscovery);
    });

    it("should create instance with custom options", () => {
      const disc = createAuthServerDiscovery(AUTH_SERVER_URL, {
        cacheTtl: 300,
        timeout: 10000,
      });
      expect(disc).toBeInstanceOf(AuthorizationServerDiscovery);
    });
  });
});
