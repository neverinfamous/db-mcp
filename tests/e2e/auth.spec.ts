/**
 * E2E Tests: Bearer Token Authentication
 *
 * Tests the --auth-token middleware. Runs against the `auth` Playwright
 * project (port 3002 with --auth-token test-secret).
 */

import { test, expect } from "@playwright/test";

const AUTH_TOKEN = "test-secret";

test.describe("Bearer Token Authentication", () => {
  test("should allow /health without token (exempt)", async ({ baseURL }) => {
    const response = await fetch(`${baseURL}/health`);
    expect(response.status).toBe(200);

    const body = (await response.json()) as Record<string, unknown>;
    expect(body).toHaveProperty("status", "healthy");
  });

  test("should allow / root endpoint without token (exempt)", async ({
    baseURL,
  }) => {
    const response = await fetch(`${baseURL}/`);
    expect(response.status).toBe(200);

    const body = (await response.json()) as Record<string, unknown>;
    expect(body).toHaveProperty("name", "db-mcp");
  });

  test("should return 401 without Authorization header", async ({
    baseURL,
  }) => {
    const response = await fetch(`${baseURL}/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-03-26",
          capabilities: {},
          clientInfo: { name: "test", version: "1.0" },
        },
      }),
    });

    expect(response.status).toBe(401);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body).toHaveProperty("error", "unauthorized");
    expect(body).toHaveProperty("error_description");

    // Must include WWW-Authenticate header per RFC 6750
    const wwwAuth = response.headers.get("www-authenticate");
    expect(wwwAuth).toBeTruthy();
    expect(wwwAuth).toContain("Bearer");
  });

  test("should return 401 with wrong token", async ({ baseURL }) => {
    const response = await fetch(`${baseURL}/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        Authorization: "Bearer wrong-token",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-03-26",
          capabilities: {},
          clientInfo: { name: "test", version: "1.0" },
        },
      }),
    });

    expect(response.status).toBe(401);

    // Must include invalid_token error in WWW-Authenticate
    const wwwAuth = response.headers.get("www-authenticate");
    expect(wwwAuth).toContain("invalid_token");
  });

  test("should succeed with correct Bearer token", async ({ baseURL }) => {
    const response = await fetch(`${baseURL}/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        Authorization: `Bearer ${AUTH_TOKEN}`,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-03-26",
          capabilities: {},
          clientInfo: { name: "test", version: "1.0" },
        },
      }),
    });

    expect(response.status).toBe(200);
  });

  test("should reject GET /sse without token", async ({ baseURL }) => {
    const response = await fetch(`${baseURL}/sse`);
    expect(response.status).toBe(401);
  });
});
