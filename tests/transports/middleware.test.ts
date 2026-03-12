/**
 * Middleware Unit Tests
 *
 * Tests for security headers, CORS, and rate limiting middleware functions.
 */

import { describe, it, expect } from "vitest";
import { getClientIp, matchesCorsOrigin } from "../../src/transports/http/middleware.js";

// =============================================================================
// getClientIp
// =============================================================================

describe("getClientIp", () => {
  const makeReq = (
    headers: Record<string, string | undefined> = {},
    ip?: string,
    remoteAddress?: string,
  ) =>
    ({
      headers,
      ip,
      socket: { remoteAddress },
    }) as unknown;

  it("should return socket remoteAddress when trustProxy is false", () => {
    const req = makeReq(
      { "x-forwarded-for": "1.2.3.4" },
      undefined,
      "127.0.0.1",
    );
    expect(getClientIp(req, false)).toBe("127.0.0.1");
  });

  it("should use X-Forwarded-For leftmost IP when trustProxy is true", () => {
    const req = makeReq(
      { "x-forwarded-for": "1.2.3.4, 10.0.0.1, 172.16.0.1" },
      undefined,
      "127.0.0.1",
    );
    expect(getClientIp(req, true)).toBe("1.2.3.4");
  });

  it("should trim whitespace from X-Forwarded-For IP", () => {
    const req = makeReq(
      { "x-forwarded-for": "  1.2.3.4  , 10.0.0.1" },
      undefined,
      "127.0.0.1",
    );
    expect(getClientIp(req, true)).toBe("1.2.3.4");
  });

  it("should fall back to req.ip when X-Forwarded-For is absent and trustProxy is true", () => {
    const req = makeReq({}, "192.168.1.1", "127.0.0.1");
    expect(getClientIp(req, true)).toBe("192.168.1.1");
  });

  it("should fall back to req.ip when trustProxy is false", () => {
    const req = makeReq({}, "192.168.1.1", "127.0.0.1");
    expect(getClientIp(req, false)).toBe("192.168.1.1");
  });

  it("should fall back to remoteAddress when req.ip is undefined", () => {
    const req = makeReq({}, undefined, "10.0.0.5");
    expect(getClientIp(req, false)).toBe("10.0.0.5");
  });

  it("should return 'unknown' when all sources are undefined", () => {
    const req = makeReq({}, undefined, undefined);
    expect(getClientIp(req, false)).toBe("unknown");
  });
});

// =============================================================================
// matchesCorsOrigin
// =============================================================================

describe("matchesCorsOrigin", () => {
  it("should match wildcard pattern '*'", () => {
    expect(matchesCorsOrigin("https://anything.com", "*")).toBe(true);
  });

  it("should match exact origin", () => {
    expect(
      matchesCorsOrigin("https://example.com", "https://example.com"),
    ).toBe(true);
  });

  it("should reject non-matching exact origin", () => {
    expect(
      matchesCorsOrigin("https://other.com", "https://example.com"),
    ).toBe(false);
  });

  it("should match wildcard subdomain pattern", () => {
    expect(
      matchesCorsOrigin("https://app.example.com", "*.example.com"),
    ).toBe(true);
  });

  it("should match nested subdomain against wildcard pattern", () => {
    expect(
      matchesCorsOrigin("https://deep.app.example.com", "*.example.com"),
    ).toBe(true);
  });

  it("should not match the bare domain against wildcard subdomain pattern", () => {
    // "*.example.com" should NOT match ".example.com" (empty subdomain)
    expect(matchesCorsOrigin(".example.com", "*.example.com")).toBe(false);
  });

  it("should not match unrelated domain with same suffix", () => {
    expect(
      matchesCorsOrigin("https://notexample.com", "*.example.com"),
    ).toBe(false);
  });
});
