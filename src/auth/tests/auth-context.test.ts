/**
 * db-mcp - Auth Context Unit Tests
 *
 * Tests for AsyncLocalStorage-based per-request auth context.
 */

import { describe, it, expect } from "vitest";
import { runWithAuthContext, getAuthContext } from "../auth-context.js";
import type { AuthenticatedContext } from "../middleware/index.js";

describe("getAuthContext", () => {
  it("should return undefined outside any context", () => {
    expect(getAuthContext()).toBeUndefined();
  });
});

describe("runWithAuthContext", () => {
  it("should provide context inside callback", () => {
    const context: AuthenticatedContext = {
      authenticated: true,
      claims: {
        sub: "user-123",
        scopes: ["read", "write"],
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      },
      scopes: ["read", "write"],
    };

    const result = runWithAuthContext(context, () => {
      const ctx = getAuthContext();
      expect(ctx).toBeDefined();
      expect(ctx?.authenticated).toBe(true);
      expect(ctx?.claims?.sub).toBe("user-123");
      expect(ctx?.scopes).toEqual(["read", "write"]);
      return "done";
    });

    expect(result).toBe("done");
  });

  it("should return undefined after context exits", () => {
    const context: AuthenticatedContext = {
      authenticated: true,
      scopes: ["read"],
    };

    runWithAuthContext(context, () => {
      // Context is available here
      expect(getAuthContext()).toBeDefined();
    });

    // Context is gone after callback returns
    expect(getAuthContext()).toBeUndefined();
  });

  it("should support async callbacks", async () => {
    const context: AuthenticatedContext = {
      authenticated: true,
      scopes: ["admin"],
    };

    const promise = runWithAuthContext(context, async () => {
      // Simulate async work
      await new Promise((resolve) => setTimeout(resolve, 10));
      const ctx = getAuthContext();
      expect(ctx?.scopes).toEqual(["admin"]);
      return 42;
    });

    expect(await promise).toBe(42);
  });

  it("should isolate contexts between nested calls", () => {
    const outerCtx: AuthenticatedContext = {
      authenticated: true,
      scopes: ["read"],
    };

    const innerCtx: AuthenticatedContext = {
      authenticated: true,
      scopes: ["admin"],
    };

    runWithAuthContext(outerCtx, () => {
      expect(getAuthContext()?.scopes).toEqual(["read"]);

      runWithAuthContext(innerCtx, () => {
        // Inner context overrides outer
        expect(getAuthContext()?.scopes).toEqual(["admin"]);
      });

      // Outer context restored
      expect(getAuthContext()?.scopes).toEqual(["read"]);
    });
  });
});
