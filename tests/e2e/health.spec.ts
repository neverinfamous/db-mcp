import { test, expect } from "@playwright/test";

test.describe("MCP HTTP Server API", () => {
  test("should return 200 OK from /health endpoint", async ({ request }) => {
    const response = await request.get("/health");
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toHaveProperty("status", "healthy");
    expect(body).toHaveProperty("timestamp");
    // Timestamp should be a valid ISO string
    expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp);
  });

  test("should accept MCP initialization request on /mcp", async ({
    request,
  }) => {
    const response = await request.post("/mcp", {
      headers: {
        Accept: "application/json, text/event-stream",
      },
      data: {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: {
            name: "playwright-test",
            version: "1.0.0",
          },
        },
      },
    });

    expect(response.status()).toBe(200);
    // Session ID should be returned in response headers
    const sessionId = response.headers()["mcp-session-id"];
    expect(sessionId).toBeDefined();
    expect(typeof sessionId).toBe("string");
    expect(sessionId!.length).toBeGreaterThan(0);
  });
});

