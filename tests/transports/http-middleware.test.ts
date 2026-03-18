/**
 * HTTP Middleware Unit Tests
 *
 * Tests security headers, CORS configuration, rate limiting,
 * getClientIp extraction, and matchesCorsOrigin.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import {
  getClientIp,
  matchesCorsOrigin,
  setupSecurityHeaders,
  setupCors,
  setupRateLimiting,
} from "../../src/transports/http/middleware.js";
import type { HttpTransportState } from "../../src/transports/http/types.js";
import type { Request, Response } from "express";

// =============================================================================
// Helpers
// =============================================================================

function createMockState(
  configOverrides: Record<string, unknown> = {},
): HttpTransportState {
  const middlewares: Function[] = [];
  return {
    app: {
      use: vi.fn((...args: unknown[]) => {
        const fn = args[args.length - 1];
        if (typeof fn === "function") middlewares.push(fn as Function);
      }),
      _middlewares: middlewares,
    } as unknown as HttpTransportState["app"],
    config: {
      corsOrigins: ["*"],
      trustProxy: false,
      enableHSTS: false,
      ...configOverrides,
    } as HttpTransportState["config"],
    rateLimitMap: new Map(),
  } as unknown as HttpTransportState;
}

function createMockReq(overrides: Record<string, unknown> = {}) {
  return {
    headers: {},
    method: "GET",
    path: "/api/tools",
    ip: "127.0.0.1",
    socket: { remoteAddress: "127.0.0.1" },
    ...overrides,
  } as unknown as Request;
}

function createMockRes() {
  return {
    setHeader: vi.fn().mockReturnThis(),
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    end: vi.fn().mockReturnThis(),
  } as unknown as Response & {
    setHeader: ReturnType<typeof vi.fn>;
    status: ReturnType<typeof vi.fn>;
    json: ReturnType<typeof vi.fn>;
    end: ReturnType<typeof vi.fn>;
  };
}

// =============================================================================
// getClientIp
// =============================================================================

describe("getClientIp", () => {
  it("should return req.ip when trustProxy is false", () => {
    const req = createMockReq({ ip: "10.0.0.1" });
    expect(getClientIp(req, false)).toBe("10.0.0.1");
  });

  it("should return X-Forwarded-For first IP when trustProxy is true", () => {
    const req = createMockReq({
      headers: { "x-forwarded-for": "203.0.113.50, 70.41.3.18" },
    });
    expect(getClientIp(req, true)).toBe("203.0.113.50");
  });

  it("should fall back to req.ip when X-Forwarded-For is missing", () => {
    const req = createMockReq({ ip: "10.0.0.2" });
    expect(getClientIp(req, true)).toBe("10.0.0.2");
  });

  it("should fall back to remoteAddress when ip is null", () => {
    const req = createMockReq({
      ip: undefined,
      socket: { remoteAddress: "192.168.1.1" },
    });
    expect(getClientIp(req, false)).toBe("192.168.1.1");
  });

  it("should return 'unknown' when no IP is available", () => {
    const req = createMockReq({
      ip: undefined,
      socket: { remoteAddress: undefined },
    });
    expect(getClientIp(req, false)).toBe("unknown");
  });
});

// =============================================================================
// matchesCorsOrigin
// =============================================================================

describe("matchesCorsOrigin", () => {
  it("should match wildcard", () => {
    expect(matchesCorsOrigin("https://example.com", "*")).toBe(true);
  });

  it("should match exact origin", () => {
    expect(
      matchesCorsOrigin("https://example.com", "https://example.com"),
    ).toBe(true);
  });

  it("should not match different origin", () => {
    expect(matchesCorsOrigin("https://other.com", "https://example.com")).toBe(
      false,
    );
  });

  it("should match wildcard subdomain", () => {
    expect(matchesCorsOrigin("https://app.example.com", "*.example.com")).toBe(
      true,
    );
  });

  it("should not match root domain for wildcard subdomain", () => {
    expect(matchesCorsOrigin("https://example.com", "*.example.com")).toBe(
      false,
    );
  });
});

// =============================================================================
// setupSecurityHeaders
// =============================================================================

describe("setupSecurityHeaders", () => {
  it("should set security headers on response", () => {
    const state = createMockState();
    setupSecurityHeaders(state);

    const middleware = (state.app as any)._middlewares[0];
    const res = createMockRes();
    const next = vi.fn();

    middleware(createMockReq(), res, next);

    expect(res.setHeader).toHaveBeenCalledWith(
      "X-Content-Type-Options",
      "nosniff",
    );
    expect(res.setHeader).toHaveBeenCalledWith("X-Frame-Options", "DENY");
    expect(res.setHeader).toHaveBeenCalledWith(
      "Content-Security-Policy",
      expect.stringContaining("default-src"),
    );
    expect(next).toHaveBeenCalled();
  });

  it("should not set HSTS when not enabled", () => {
    const state = createMockState({ enableHSTS: false });
    setupSecurityHeaders(state);

    const middleware = (state.app as any)._middlewares[0];
    const res = createMockRes();
    middleware(createMockReq(), res, vi.fn());

    expect(res.setHeader).not.toHaveBeenCalledWith(
      "Strict-Transport-Security",
      expect.any(String),
    );
  });

  it("should set HSTS when enabled", () => {
    const state = createMockState({ enableHSTS: true });
    setupSecurityHeaders(state);

    const middleware = (state.app as any)._middlewares[0];
    const res = createMockRes();
    middleware(createMockReq(), res, vi.fn());

    expect(res.setHeader).toHaveBeenCalledWith(
      "Strict-Transport-Security",
      expect.stringContaining("max-age"),
    );
  });

  it("should not throw when app is null", () => {
    const state = { config: {} } as unknown as HttpTransportState;
    state.app = null as any;
    expect(() => setupSecurityHeaders(state)).not.toThrow();
  });
});

// =============================================================================
// setupCors
// =============================================================================

describe("setupCors", () => {
  it("should set wildcard CORS for wildcard config", () => {
    const state = createMockState({ corsOrigins: ["*"] });
    setupCors(state);

    const middleware = (state.app as any)._middlewares[0];
    const req = createMockReq({ headers: { origin: "https://any.com" } });
    const res = createMockRes();
    middleware(req, res, vi.fn());

    expect(res.setHeader).toHaveBeenCalledWith(
      "Access-Control-Allow-Origin",
      "*",
    );
  });

  it("should set specific origin when matched", () => {
    const state = createMockState({ corsOrigins: ["https://example.com"] });
    setupCors(state);

    const middleware = (state.app as any)._middlewares[0];
    const req = createMockReq({ headers: { origin: "https://example.com" } });
    const res = createMockRes();
    middleware(req, res, vi.fn());

    expect(res.setHeader).toHaveBeenCalledWith(
      "Access-Control-Allow-Origin",
      "https://example.com",
    );
    expect(res.setHeader).toHaveBeenCalledWith("Vary", "Origin");
  });

  it("should respond 204 to OPTIONS preflight", () => {
    const state = createMockState({ corsOrigins: ["*"] });
    setupCors(state);

    const middleware = (state.app as any)._middlewares[0];
    const req = createMockReq({
      method: "OPTIONS",
      headers: { origin: "https://any.com" },
    });
    const res = createMockRes();
    const next = vi.fn();
    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.end).toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it("should not throw when app is null", () => {
    const state = { config: {} } as unknown as HttpTransportState;
    state.app = null as any;
    expect(() => setupCors(state)).not.toThrow();
  });
});

// =============================================================================
// setupRateLimiting
// =============================================================================

describe("setupRateLimiting", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should allow requests under the limit", () => {
    const state = createMockState();
    setupRateLimiting(state);

    const middleware = (state.app as any)._middlewares[0];
    const req = createMockReq();
    const res = createMockRes();
    const next = vi.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalled();

    // Clean up timer
    if (state.rateLimitCleanupTimer) clearInterval(state.rateLimitCleanupTimer);
  });

  it("should bypass rate limit for /health path", () => {
    const state = createMockState();
    setupRateLimiting(state);

    const middleware = (state.app as any)._middlewares[0];
    const req = createMockReq({ path: "/health" });
    const res = createMockRes();
    const next = vi.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalled();

    if (state.rateLimitCleanupTimer) clearInterval(state.rateLimitCleanupTimer);
  });

  it("should not throw when app is null", () => {
    const state = { config: {} } as unknown as HttpTransportState;
    state.app = null as any;
    state.rateLimitMap = new Map();
    expect(() => setupRateLimiting(state)).not.toThrow();
  });
});
