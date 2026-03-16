/**
 * Shared E2E Test Helpers
 *
 * Common utilities for Playwright payload contract tests.
 * Creates MCP SDK clients and parses tool responses.
 * Provides managed server lifecycle for dedicated-port tests.
 */

import { expect } from "@playwright/test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import type { TestInfo } from "@playwright/test";
import { type ChildProcess, spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

/**
 * Create an MCP SDK client connected via Legacy SSE transport.
 */
export async function createClient(baseURL: string): Promise<Client> {
  const transport = new SSEClientTransport(new URL(`${baseURL}/sse`));
  const client = new Client(
    { name: "playwright-payload-test", version: "1.0.0" },
    { capabilities: {} },
  );
  await client.connect(transport);
  return client;
}

/**
 * Resolve the baseURL from Playwright test info.
 */
export function getBaseURL(testInfo: TestInfo): string {
  return testInfo.project.use.baseURL as string;
}

/**
 * Call a tool and JSON-parse the first text content block.
 * Returns the parsed payload object.
 */
export async function callToolAndParse(
  client: Client,
  name: string,
  args: Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
  const response = await client.callTool({ name, arguments: args });
  const text = (response.content as { type: string; text: string }[])[0]
    .text;
  return JSON.parse(text) as Record<string, unknown>;
}

/**
 * Assert that a tool response has success: true.
 * Includes the full error payload in the assertion message on failure.
 */
export function expectSuccess(payload: Record<string, unknown>): void {
  const msg = payload.success === false
    ? `Tool error: ${JSON.stringify(payload, null, 2)}`
    : "";
  expect(payload.success, msg).toBe(true);
}

/**
 * Assert that a tool response is a structured handler error.
 * Must have success: false and an error message.
 * Must NOT be a raw MCP error (isError: true with no success field).
 */
export function expectHandlerError(payload: Record<string, unknown>): void {
  expect(payload.success, `Expected handler error, got: ${JSON.stringify(payload, null, 2)}`).toBe(false);
  expect(typeof payload.error, `Missing error message: ${JSON.stringify(payload, null, 2)}`).toBe("string");
}

/**
 * Call a tool and return the raw MCP response (for tests that need isError check).
 */
export async function callToolRaw(
  client: Client,
  name: string,
  args: Record<string, unknown> = {},
): Promise<{ isError?: boolean; content: { type: string; text: string }[] }> {
  const response = await client.callTool({ name, arguments: args });
  return response as { isError?: boolean; content: { type: string; text: string }[] };
}

// =============================================================================
// Server Process Management
// =============================================================================

interface ManagedServer {
  process: ChildProcess;
  port: number;
}

const managedServers = new Map<number, ManagedServer>();

/**
 * Start a db-mcp server as a child process with custom CLI args.
 * Waits for /health to become reachable before returning.
 *
 * @param port - Port to start the server on
 * @param args - Additional CLI args (e.g., ['--stateless', '--auth-token', 'secret'])
 * @param dbSuffix - Database file suffix to avoid collisions (default: port number)
 */
export async function startServer(
  port: number,
  args: string[] = [],
  dbSuffix?: string,
): Promise<void> {
  const suffix = dbSuffix ?? String(port);
  const serverProcess = spawn(
    "node",
    [
      "dist/cli.js",
      "--transport",
      "http",
      "--port",
      String(port),
      "--sqlite",
      `./test-e2e-${suffix}.db`,
      "--tool-filter",
      "starter",
      ...args,
    ],
    {
      cwd: process.cwd(),
      stdio: "pipe",
      env: {
        ...process.env,
        MCP_RATE_LIMIT_MAX: args.some((a) => a === "--rate-limit-max")
          ? undefined
          : "10000",
      },
    },
  );

  managedServers.set(port, { process: serverProcess, port });

  const maxAttempts = 30;
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(`http://localhost:${port}/health`);
      if (res.ok) return;
    } catch {
      // Server not ready yet
    }
    await delay(500);
  }
  throw new Error(`Server on port ${port} did not start within timeout`);
}

/**
 * Stop a managed server by port number.
 */
export function stopServer(port: number): void {
  const server = managedServers.get(port);
  if (server) {
    server.process.kill("SIGTERM");
    managedServers.delete(port);
  }
}
