/**
 * Shared E2E Test Helpers
 *
 * Common utilities for Playwright payload contract tests.
 * Creates MCP SDK clients and parses tool responses.
 */

import { expect } from "@playwright/test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import type { TestInfo } from "@playwright/test";

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
