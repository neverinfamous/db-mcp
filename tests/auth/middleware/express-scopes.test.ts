/**
 * Express Scopes Middleware Unit Tests
 *
 * Tests requireScope, requireAnyScope, requireToolScope, and oauthErrorHandler.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  requireScope,
  requireAnyScope,
  requireToolScope,
  oauthErrorHandler,
} from "../../../src/auth/middleware/express-scopes.js";
import { OAuthError } from "../../../src/auth/errors.js";
import type { Request, Response, NextFunction } from "express";

// =============================================================================
// Helpers
// =============================================================================

function createMockReq(auth?: { scopes: string[] }): Partial<Request> {
  return {
    auth: auth as Request["auth"],
    requestId: "test-req-1",
  } as Partial<Request>;
}

function createMockRes(): Partial<Response> & {
  status: ReturnType<typeof vi.fn>;
  setHeader: ReturnType<typeof vi.fn>;
  json: ReturnType<typeof vi.fn>;
} {
  const res = {
    status: vi.fn().mockReturnThis(),
    setHeader: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return res;
}

// =============================================================================
// requireScope
// =============================================================================

describe("requireScope", () => {
  let next: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    next = vi.fn();
  });

  it("should return 401 when no auth is present", () => {
    const req = createMockReq();
    const res = createMockRes();
    const middleware = requireScope("read");

    middleware(req as Request, res as unknown as Response, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: "unauthorized" }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("should call next when scope is granted", () => {
    const req = createMockReq({ scopes: ["read", "write"] });
    const res = createMockRes();
    const middleware = requireScope("read");

    middleware(req as Request, res as unknown as Response, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("should allow admin scope as override", () => {
    const req = createMockReq({ scopes: ["admin"] });
    const res = createMockRes();
    const middleware = requireScope("write");

    middleware(req as Request, res as unknown as Response, next);

    expect(next).toHaveBeenCalled();
  });

  it("should allow full scope as override", () => {
    const req = createMockReq({ scopes: ["full"] });
    const res = createMockRes();
    const middleware = requireScope("admin");

    middleware(req as Request, res as unknown as Response, next);

    expect(next).toHaveBeenCalled();
  });

  it("should return 403 with WWW-Authenticate when scope is insufficient", () => {
    const req = createMockReq({ scopes: ["read"] });
    const res = createMockRes();
    const middleware = requireScope("admin");

    middleware(req as Request, res as unknown as Response, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.setHeader).toHaveBeenCalledWith(
      "WWW-Authenticate",
      expect.any(String),
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: "insufficient_scope",
        required_scope: "admin",
      }),
    );
    expect(next).not.toHaveBeenCalled();
  });
});

// =============================================================================
// requireAnyScope
// =============================================================================

describe("requireAnyScope", () => {
  let next: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    next = vi.fn();
  });

  it("should return 401 when no auth is present", () => {
    const req = createMockReq();
    const res = createMockRes();
    const middleware = requireAnyScope(["read", "write"]);

    middleware(req as Request, res as unknown as Response, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("should call next when any of the required scopes is present", () => {
    const req = createMockReq({ scopes: ["write"] });
    const res = createMockRes();
    const middleware = requireAnyScope(["read", "write"]);

    middleware(req as Request, res as unknown as Response, next);

    expect(next).toHaveBeenCalled();
  });

  it("should allow full scope as override", () => {
    const req = createMockReq({ scopes: ["full"] });
    const res = createMockRes();
    const middleware = requireAnyScope(["admin"]);

    middleware(req as Request, res as unknown as Response, next);

    expect(next).toHaveBeenCalled();
  });

  it("should allow admin scope as override", () => {
    const req = createMockReq({ scopes: ["admin"] });
    const res = createMockRes();
    const middleware = requireAnyScope(["write"]);

    middleware(req as Request, res as unknown as Response, next);

    expect(next).toHaveBeenCalled();
  });

  it("should return 403 when none of the required scopes match", () => {
    const req = createMockReq({ scopes: ["read"] });
    const res = createMockRes();
    const middleware = requireAnyScope(["admin", "write"]);

    middleware(req as Request, res as unknown as Response, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: "insufficient_scope",
        required_scopes: ["admin", "write"],
      }),
    );
    expect(next).not.toHaveBeenCalled();
  });
});

// =============================================================================
// requireToolScope
// =============================================================================

describe("requireToolScope", () => {
  let next: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    next = vi.fn();
  });

  it("should return 401 when no auth is present", () => {
    const req = createMockReq();
    const res = createMockRes();
    const middleware = requireToolScope("sqlite_read_query");

    middleware(req as Request, res as unknown as Response, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("should call next when tool access is granted", () => {
    const req = createMockReq({ scopes: ["full"] });
    const res = createMockRes();
    const middleware = requireToolScope("sqlite_read_query");

    middleware(req as Request, res as unknown as Response, next);

    expect(next).toHaveBeenCalled();
  });

  it("should return 403 when tool access is denied", () => {
    // "read" scope - read_query is not in the READ_ONLY_TOOLS set (which uses short names)
    // so it may or may not match depending on implementation
    const req = createMockReq({ scopes: ["read"] });
    const res = createMockRes();
    const middleware = requireToolScope("vacuum_database");

    middleware(req as Request, res as unknown as Response, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: "insufficient_scope",
        tool: "vacuum_database",
      }),
    );
    expect(next).not.toHaveBeenCalled();
  });
});

// =============================================================================
// oauthErrorHandler
// =============================================================================

describe("oauthErrorHandler", () => {
  let next: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    next = vi.fn();
  });

  it("should handle OAuth errors with proper status and headers", () => {
    const error = new OAuthError("bad token", "invalid_token", 401, undefined, 'Bearer error="invalid_token"');
    const req = createMockReq();
    const res = createMockRes();

    oauthErrorHandler(error, req as Request, res as unknown as Response, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.setHeader).toHaveBeenCalledWith(
      "WWW-Authenticate",
      'Bearer error="invalid_token"',
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: "invalid_token",
        error_description: "bad token",
      }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("should handle OAuth error without wwwAuthenticate", () => {
    const error = new OAuthError("server error", "server_error", 500);
    const req = createMockReq();
    const res = createMockRes();

    oauthErrorHandler(error, req as Request, res as unknown as Response, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.setHeader).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: "server_error",
      }),
    );
  });

  it("should pass non-OAuth errors to next()", () => {
    const error = new Error("generic error");
    const req = createMockReq();
    const res = createMockRes();

    oauthErrorHandler(error, req as Request, res as unknown as Response, next);

    expect(next).toHaveBeenCalledWith(error);
    expect(res.status).not.toHaveBeenCalled();
  });
});
