/**
 * db-mcp - OAuth Resource Server Unit Tests
 *
 * Tests for OAuthResourceServer RFC 9728 compliance including
 * metadata generation, scope validation, and configuration.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  OAuthResourceServer,
  createOAuthResourceServer,
} from "../oauth-resource-server.js";
import type { ResourceServerConfig } from "../types.js";

describe("OAuthResourceServer", () => {
  let config: ResourceServerConfig;
  let server: OAuthResourceServer;

  beforeEach(() => {
    config = {
      resource: "https://db-mcp.example.com",
      authorizationServers: ["https://auth.example.com"],
      scopesSupported: ["read", "write", "admin"],
    };
    server = new OAuthResourceServer(config);
  });

  describe("Construction", () => {
    it("should create server with config", () => {
      expect(server).toBeInstanceOf(OAuthResourceServer);
    });

    it("should set default bearer methods when not provided", () => {
      const metadata = server.getMetadata();
      expect(metadata.bearer_methods_supported).toEqual(["header"]);
    });

    it("should use provided bearer methods", () => {
      const customServer = new OAuthResourceServer({
        ...config,
        bearerMethodsSupported: ["header", "body"],
      });
      const metadata = customServer.getMetadata();
      expect(metadata.bearer_methods_supported).toEqual(["header", "body"]);
    });
  });

  describe("getMetadata()", () => {
    it("should return RFC 9728 compliant structure", () => {
      const metadata = server.getMetadata();

      expect(metadata).toHaveProperty("resource");
      expect(metadata).toHaveProperty("authorization_servers");
      expect(metadata).toHaveProperty("scopes_supported");
      expect(metadata).toHaveProperty("bearer_methods_supported");
      expect(metadata).toHaveProperty("resource_documentation");
      expect(metadata).toHaveProperty("resource_signing_alg_values_supported");
    });

    it("should include correct resource identifier", () => {
      const metadata = server.getMetadata();
      expect(metadata.resource).toBe("https://db-mcp.example.com");
    });

    it("should include authorization servers", () => {
      const metadata = server.getMetadata();
      expect(metadata.authorization_servers).toEqual([
        "https://auth.example.com",
      ]);
    });

    it("should include supported scopes", () => {
      const metadata = server.getMetadata();
      expect(metadata.scopes_supported).toEqual(["read", "write", "admin"]);
    });

    it("should generate documentation URL", () => {
      const metadata = server.getMetadata();
      expect(metadata.resource_documentation).toBe(
        "https://db-mcp.example.com/docs",
      );
    });

    it("should include signing algorithms", () => {
      const metadata = server.getMetadata();
      expect(metadata.resource_signing_alg_values_supported).toContain("RS256");
      expect(metadata.resource_signing_alg_values_supported).toContain("ES256");
    });

    it("should cache metadata", () => {
      const first = server.getMetadata();
      const second = server.getMetadata();
      expect(first).toBe(second); // Same reference (cached)
    });
  });

  describe("getWellKnownPath()", () => {
    it("should return correct well-known path", () => {
      expect(server.getWellKnownPath()).toBe(
        "/.well-known/oauth-protected-resource",
      );
    });
  });

  describe("isScopeSupported()", () => {
    it("should return true for explicitly supported scopes", () => {
      expect(server.isScopeSupported("read")).toBe(true);
      expect(server.isScopeSupported("write")).toBe(true);
      expect(server.isScopeSupported("admin")).toBe(true);
    });

    it("should return true for full scope", () => {
      expect(server.isScopeSupported("full")).toBe(true);
    });

    it("should return false for unsupported scopes", () => {
      expect(server.isScopeSupported("delete")).toBe(false);
      expect(server.isScopeSupported("unknown")).toBe(false);
    });

    it("should accept db: prefixed scopes", () => {
      expect(server.isScopeSupported("db:mydb")).toBe(true);
      expect(server.isScopeSupported("db:test-db")).toBe(true);
    });

    it("should accept table: prefixed scopes", () => {
      expect(server.isScopeSupported("table:mydb:users")).toBe(true);
    });

    it("should reject invalid scope patterns", () => {
      expect(server.isScopeSupported("database:mydb")).toBe(false);
      expect(server.isScopeSupported("TB:users")).toBe(false);
    });
  });

  describe("getResourceUri()", () => {
    it("should return resource identifier", () => {
      expect(server.getResourceUri()).toBe("https://db-mcp.example.com");
    });
  });

  describe("getSupportedScopes()", () => {
    it("should return copy of scopes array", () => {
      const scopes = server.getSupportedScopes();
      expect(scopes).toEqual(["read", "write", "admin"]);

      // Verify it's a copy
      scopes.push("modified");
      expect(server.getSupportedScopes()).toEqual(["read", "write", "admin"]);
    });
  });

  describe("getAuthorizationServers()", () => {
    it("should return copy of authorization servers", () => {
      const servers = server.getAuthorizationServers();
      expect(servers).toEqual(["https://auth.example.com"]);

      // Verify it's a copy
      servers.push("https://auth2.example.com");
      expect(server.getAuthorizationServers()).toEqual([
        "https://auth.example.com",
      ]);
    });

    it("should support multiple authorization servers", () => {
      const multiServer = new OAuthResourceServer({
        ...config,
        authorizationServers: [
          "https://auth1.example.com",
          "https://auth2.example.com",
        ],
      });

      expect(multiServer.getAuthorizationServers()).toEqual([
        "https://auth1.example.com",
        "https://auth2.example.com",
      ]);
    });
  });

  describe("getWWWAuthenticateHeader()", () => {
    it("should return Bearer header with realm", () => {
      const header = server.getWWWAuthenticateHeader();
      expect(header).toContain("Bearer");
      expect(header).toContain("https://db-mcp.example.com");
    });

    it("should include error when provided", () => {
      const header = server.getWWWAuthenticateHeader("invalid_token");
      expect(header).toContain('error="invalid_token"');
    });

    it("should include error description when provided", () => {
      const header = server.getWWWAuthenticateHeader(
        "invalid_token",
        "Token expired",
      );
      expect(header).toContain('error_description="Token expired"');
    });
  });

  describe("clearCache()", () => {
    it("should clear cached metadata", () => {
      const first = server.getMetadata();
      server.clearCache();
      const second = server.getMetadata();
      // After cache clear, should be a new object
      expect(first).not.toBe(second);
      // But with same content
      expect(first).toEqual(second);
    });
  });
});

describe("createOAuthResourceServer()", () => {
  it("should create OAuthResourceServer instance", () => {
    const server = createOAuthResourceServer({
      resource: "https://test.example.com",
      authorizationServers: ["https://auth.example.com"],
      scopesSupported: ["read"],
    });

    expect(server).toBeInstanceOf(OAuthResourceServer);
  });

  it("should pass config to server", () => {
    const server = createOAuthResourceServer({
      resource: "https://custom.example.com",
      authorizationServers: ["https://auth.example.com"],
      scopesSupported: ["custom-scope"],
    });

    expect(server.getResourceUri()).toBe("https://custom.example.com");
    expect(server.getSupportedScopes()).toContain("custom-scope");
  });
});
