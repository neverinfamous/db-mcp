/**
 * Middleware Unit Tests
 *
 * Tests for security headers, CORS, and rate limiting middleware functions.
 */

import { describe, it, expect } from "vitest";
import { matchesCorsOrigin } from "../../src/transports/http/middleware.js";

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
    expect(matchesCorsOrigin("https://other.com", "https://example.com")).toBe(
      false,
    );
  });

  it("should match wildcard subdomain pattern", () => {
    expect(matchesCorsOrigin("https://app.example.com", "*.example.com")).toBe(
      true,
    );
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
    expect(matchesCorsOrigin("https://notexample.com", "*.example.com")).toBe(
      false,
    );
  });
});
