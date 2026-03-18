/**
 * db-mcp - Authorization Server Discovery Unit Tests
 *
 * Tests for RFC 8414 metadata discovery including
 * caching, error handling, and delegation methods.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  AuthorizationServerDiscovery,
  createAuthServerDiscovery,
} from "../authorization-server-discovery.js";

// Track fetch calls for assertions
const mockFetch = vi.fn();

describe("AuthorizationServerDiscovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // @ts-expect-error - mock global fetch
    globalThis.fetch = mockFetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const validMetadata = {
    issuer: "https://auth.example.com",
    authorization_endpoint: "https://auth.example.com/authorize",
    token_endpoint: "https://auth.example.com/token",
    jwks_uri: "https://auth.example.com/.well-known/jwks.json",
    response_types_supported: ["code"],
    scopes_supported: ["read", "write", "admin"],
  };

  describe("construction", () => {
    it("should create instance with config object", () => {
      const discovery = new AuthorizationServerDiscovery({
        authServerUrl: "https://auth.example.com",
      });
      expect(discovery).toBeInstanceOf(AuthorizationServerDiscovery);
    });
  });

  describe("createAuthServerDiscovery factory", () => {
    it("should create AuthorizationServerDiscovery instance", () => {
      // Factory takes a plain string, not a config object
      const discovery = createAuthServerDiscovery("https://auth.example.com");
      expect(discovery).toBeInstanceOf(AuthorizationServerDiscovery);
    });
  });

  describe("discover()", () => {
    it("should fetch and return metadata", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(validMetadata),
      });

      const discovery = new AuthorizationServerDiscovery({
        authServerUrl: "https://auth.example.com",
      });
      const metadata = await discovery.discover();

      expect(metadata).toBeDefined();
      expect(metadata.issuer).toBe("https://auth.example.com");
      expect(metadata.jwks_uri).toBe(
        "https://auth.example.com/.well-known/jwks.json",
      );
    });

    it("should cache metadata on subsequent calls", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(validMetadata),
      });

      const discovery = new AuthorizationServerDiscovery({
        authServerUrl: "https://auth.example.com",
      });
      await discovery.discover();
      await discovery.discover();

      // Should only fetch once
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("should throw on fetch failure", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
      });

      const discovery = new AuthorizationServerDiscovery({
        authServerUrl: "https://auth.example.com",
      });

      await expect(discovery.discover()).rejects.toThrow();
    });

    it("should throw on network error", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const discovery = new AuthorizationServerDiscovery({
        authServerUrl: "https://auth.example.com",
      });

      await expect(discovery.discover()).rejects.toThrow();
    });
  });

  describe("getJwksUri()", () => {
    it("should return JWKS URI after discover()", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(validMetadata),
      });

      const discovery = new AuthorizationServerDiscovery({
        authServerUrl: "https://auth.example.com",
      });

      // Must call discover() first — getJwksUri is synchronous
      await discovery.discover();
      const jwksUri = discovery.getJwksUri();

      expect(jwksUri).toBe("https://auth.example.com/.well-known/jwks.json");
    });

    it("should throw if discover() not called", () => {
      const discovery = new AuthorizationServerDiscovery({
        authServerUrl: "https://auth.example.com",
      });

      expect(() => discovery.getJwksUri()).toThrow(/not yet discovered/);
    });
  });

  describe("getTokenEndpoint()", () => {
    it("should return token endpoint after discover()", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(validMetadata),
      });

      const discovery = new AuthorizationServerDiscovery({
        authServerUrl: "https://auth.example.com",
      });

      // Must call discover() first — getTokenEndpoint is synchronous
      await discovery.discover();
      const endpoint = discovery.getTokenEndpoint();

      expect(endpoint).toBe("https://auth.example.com/token");
    });
  });
});
