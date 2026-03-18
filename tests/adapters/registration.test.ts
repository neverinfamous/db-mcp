/**
 * Registration Module Unit Tests
 *
 * Tests tool, resource, and prompt registration via the McpServer interface.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerToolImpl, type ToolRegistrationAdapter } from "../../src/adapters/registration/tools.js";
import { registerResourceImpl, type ResourceRegistrationAdapter } from "../../src/adapters/registration/resources.js";
import { registerPromptImpl, type PromptRegistrationAdapter } from "../../src/adapters/registration/prompts.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ToolDefinition, ResourceDefinition, PromptDefinition } from "../../src/types/index.js";

// =============================================================================
// Helpers
// =============================================================================

function createMockServer() {
  return {
    registerTool: vi.fn(),
    registerResource: vi.fn(),
    registerPrompt: vi.fn(),
    server: {},
  } as unknown as McpServer & {
    registerTool: ReturnType<typeof vi.fn>;
    registerResource: ReturnType<typeof vi.fn>;
    registerPrompt: ReturnType<typeof vi.fn>;
  };
}

function createMockAdapter(): ToolRegistrationAdapter & ResourceRegistrationAdapter & PromptRegistrationAdapter {
  return {
    createContext: vi.fn().mockReturnValue({
      timestamp: new Date(),
      requestId: "test-123",
    }),
  };
}

// =============================================================================
// Tool Registration
// =============================================================================

describe("registerToolImpl", () => {
  let server: ReturnType<typeof createMockServer>;
  let adapter: ReturnType<typeof createMockAdapter>;

  beforeEach(() => {
    server = createMockServer();
    adapter = createMockAdapter();
  });

  it("should register a tool with inputSchema using partial().passthrough()", () => {
    const tool: ToolDefinition = {
      name: "sqlite_read_query",
      description: "Execute a query",
      group: "core",
      inputSchema: z.object({ sql: z.string() }),
      handler: vi.fn(),
    };

    registerToolImpl(adapter, server, tool);

    expect(server.registerTool).toHaveBeenCalledWith(
      "sqlite_read_query",
      expect.objectContaining({
        description: "Execute a query",
        inputSchema: expect.any(Object),
      }),
      expect.any(Function),
    );
  });

  it("should register a tool without inputSchema", () => {
    const tool: ToolDefinition = {
      name: "sqlite_health",
      description: "Health check",
      group: "admin",
      handler: vi.fn(),
    };

    registerToolImpl(adapter, server, tool);

    expect(server.registerTool).toHaveBeenCalledWith(
      "sqlite_health",
      expect.objectContaining({ description: "Health check" }),
      expect.any(Function),
    );

    // Should NOT have inputSchema key
    const opts = server.registerTool.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(opts.inputSchema).toBeUndefined();
  });

  it("should register a tool with outputSchema", () => {
    const tool: ToolDefinition = {
      name: "sqlite_test",
      description: "Test",
      group: "core",
      outputSchema: z.object({ success: z.boolean() }),
      handler: vi.fn(),
    };

    registerToolImpl(adapter, server, tool);

    const opts = server.registerTool.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(opts.outputSchema).toBeDefined();
  });

  it("should register a tool with annotations", () => {
    const tool: ToolDefinition = {
      name: "sqlite_test",
      description: "Test",
      group: "core",
      annotations: { title: "Test Tool", readOnlyHint: true },
      handler: vi.fn(),
    };

    registerToolImpl(adapter, server, tool);

    const opts = server.registerTool.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(opts.annotations).toEqual({ title: "Test Tool", readOnlyHint: true });
  });

  it("should register a tool with icons", () => {
    const tool: ToolDefinition = {
      name: "sqlite_test",
      description: "Test",
      group: "core",
      icons: { light: "icon.svg" },
      handler: vi.fn(),
    };

    registerToolImpl(adapter, server, tool);

    const opts = server.registerTool.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(opts.icons).toEqual({ light: "icon.svg" });
  });

  it("should return structuredContent when outputSchema is present", async () => {
    const mockResult = { success: true, data: "test" };
    const tool: ToolDefinition = {
      name: "sqlite_test",
      description: "Test",
      group: "core",
      outputSchema: z.object({ success: z.boolean() }),
      handler: vi.fn().mockResolvedValue(mockResult),
    };

    registerToolImpl(adapter, server, tool);

    const handler = server.registerTool.mock.calls[0]?.[2] as Function;
    const result = await handler({}, { _meta: {} });

    expect(result.structuredContent).toEqual(mockResult);
    expect(result.content[0].text).toBe(JSON.stringify(mockResult));
  });

  it("should return text content when no outputSchema", async () => {
    const tool: ToolDefinition = {
      name: "sqlite_test",
      description: "Test",
      group: "core",
      handler: vi.fn().mockResolvedValue({ tables: ["a"] }),
    };

    registerToolImpl(adapter, server, tool);

    const handler = server.registerTool.mock.calls[0]?.[2] as Function;
    const result = await handler({}, { _meta: {} });

    expect(result.structuredContent).toBeUndefined();
    expect(result.content[0].text).toBe(JSON.stringify({ tables: ["a"] }));
  });

  it("should return string result directly when no outputSchema", async () => {
    const tool: ToolDefinition = {
      name: "sqlite_test",
      description: "Test",
      group: "core",
      handler: vi.fn().mockResolvedValue("plain string"),
    };

    registerToolImpl(adapter, server, tool);

    const handler = server.registerTool.mock.calls[0]?.[2] as Function;
    const result = await handler({}, { _meta: {} });

    expect(result.content[0].text).toBe("plain string");
  });

  it("should return isError on handler exception", async () => {
    const tool: ToolDefinition = {
      name: "sqlite_test",
      description: "Test",
      group: "core",
      handler: vi.fn().mockRejectedValue(new Error("handler failed")),
    };

    registerToolImpl(adapter, server, tool);

    const handler = server.registerTool.mock.calls[0]?.[2] as Function;
    const result = await handler({}, { _meta: {} });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("handler failed");
  });

  it("should pass progressToken to createContext", async () => {
    const tool: ToolDefinition = {
      name: "sqlite_test",
      description: "Test",
      group: "core",
      handler: vi.fn().mockResolvedValue("ok"),
    };

    registerToolImpl(adapter, server, tool);

    const handler = server.registerTool.mock.calls[0]?.[2] as Function;
    await handler({}, { _meta: { progressToken: "tok-42" } });

    expect(adapter.createContext).toHaveBeenCalledWith(
      undefined,
      expect.anything(),
      "tok-42",
    );
  });
});

// =============================================================================
// Resource Registration
// =============================================================================

describe("registerResourceImpl", () => {
  let server: ReturnType<typeof createMockServer>;
  let adapter: ReturnType<typeof createMockAdapter>;

  beforeEach(() => {
    server = createMockServer();
    adapter = createMockAdapter();
  });

  it("should register a static (non-template) resource", () => {
    const resource: ResourceDefinition = {
      name: "schema",
      uri: "sqlite://schema",
      description: "Database schema",
      handler: vi.fn().mockResolvedValue({ tables: [] }),
    };

    registerResourceImpl(adapter, server, resource);

    expect(server.registerResource).toHaveBeenCalledWith(
      "schema",
      "sqlite://schema",
      expect.objectContaining({
        description: "Database schema",
        mimeType: "application/json",
      }),
      expect.any(Function),
    );
  });

  it("should register a template resource with {param}", () => {
    const resource: ResourceDefinition = {
      name: "table_schema",
      uri: "sqlite://table/{tableName}",
      description: "Table schema",
      handler: vi.fn().mockResolvedValue({ columns: [] }),
    };

    registerResourceImpl(adapter, server, resource);

    // Template resources get a ResourceTemplate as 2nd arg instead of string
    expect(server.registerResource).toHaveBeenCalledWith(
      "table_schema",
      expect.any(Object), // ResourceTemplate
      expect.objectContaining({ description: "Table schema" }),
      expect.any(Function),
    );
  });

  it("should use custom mimeType when provided", () => {
    const resource: ResourceDefinition = {
      name: "help",
      uri: "sqlite://help",
      description: "Help",
      mimeType: "text/markdown",
      handler: vi.fn().mockResolvedValue("# Help"),
    };

    registerResourceImpl(adapter, server, resource);

    const opts = server.registerResource.mock.calls[0]?.[2] as Record<string, unknown>;
    expect(opts.mimeType).toBe("text/markdown");
  });

  it("should include icons when provided", () => {
    const resource: ResourceDefinition = {
      name: "schema",
      uri: "sqlite://schema",
      description: "Schema",
      icons: { light: "schema.svg" },
      handler: vi.fn().mockResolvedValue({}),
    };

    registerResourceImpl(adapter, server, resource);

    const opts = server.registerResource.mock.calls[0]?.[2] as Record<string, unknown>;
    expect(opts.icons).toEqual({ light: "schema.svg" });
  });

  it("should handle handler returning string content", async () => {
    const resource: ResourceDefinition = {
      name: "help",
      uri: "sqlite://help",
      description: "Help text",
      handler: vi.fn().mockResolvedValue("plain text result"),
    };

    registerResourceImpl(adapter, server, resource);

    const handler = server.registerResource.mock.calls[0]?.[3] as Function;
    const result = await handler(new URL("sqlite://help"), {});

    expect(result.contents[0].text).toBe("plain text result");
  });

  it("should JSON.stringify handler returning object content", async () => {
    const data = { tables: ["users", "orders"] };
    const resource: ResourceDefinition = {
      name: "schema",
      uri: "sqlite://schema",
      description: "Schema",
      handler: vi.fn().mockResolvedValue(data),
    };

    registerResourceImpl(adapter, server, resource);

    const handler = server.registerResource.mock.calls[0]?.[3] as Function;
    const result = await handler(new URL("sqlite://schema"), {});

    expect(result.contents[0].text).toBe(JSON.stringify(data, null, 2));
  });
});

// =============================================================================
// Prompt Registration
// =============================================================================

describe("registerPromptImpl", () => {
  let server: ReturnType<typeof createMockServer>;
  let adapter: ReturnType<typeof createMockAdapter>;

  beforeEach(() => {
    server = createMockServer();
    adapter = createMockAdapter();
  });

  it("should register a prompt with required args (builds argsSchema)", () => {
    const prompt: PromptDefinition = {
      name: "explain_schema",
      description: "Explain a table schema",
      arguments: [
        { name: "table", description: "Table name", required: true },
      ],
      handler: vi.fn().mockResolvedValue("Explanation..."),
    };

    registerPromptImpl(adapter, server, prompt);

    expect(server.registerPrompt).toHaveBeenCalledWith(
      "explain_schema",
      expect.objectContaining({
        description: "Explain a table schema",
        argsSchema: expect.any(Object),
      }),
      expect.any(Function),
    );
  });

  it("should register a prompt without argsSchema when all args are optional", () => {
    const prompt: PromptDefinition = {
      name: "suggest_query",
      description: "Suggest a query",
      arguments: [
        { name: "context", description: "Optional context", required: false },
      ],
      handler: vi.fn().mockResolvedValue("SELECT ..."),
    };

    registerPromptImpl(adapter, server, prompt);

    const opts = server.registerPrompt.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(opts.argsSchema).toBeUndefined();
  });

  it("should register a prompt without argsSchema when no arguments", () => {
    const prompt: PromptDefinition = {
      name: "overview",
      description: "Database overview",
      handler: vi.fn().mockResolvedValue("Overview..."),
    };

    registerPromptImpl(adapter, server, prompt);

    const opts = server.registerPrompt.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(opts.argsSchema).toBeUndefined();
  });

  it("should handle handler returning array of messages", async () => {
    const messages = [
      { role: "assistant" as const, content: { type: "text" as const, text: "Hello" } },
    ];
    const prompt: PromptDefinition = {
      name: "greet",
      description: "Greet",
      handler: vi.fn().mockResolvedValue(messages),
    };

    registerPromptImpl(adapter, server, prompt);

    const handler = server.registerPrompt.mock.calls[0]?.[2] as Function;
    const result = await handler({});

    expect(result.messages).toEqual(messages);
  });

  it("should wrap string result in assistant message", async () => {
    const prompt: PromptDefinition = {
      name: "greet",
      description: "Greet",
      handler: vi.fn().mockResolvedValue("Hello world!"),
    };

    registerPromptImpl(adapter, server, prompt);

    const handler = server.registerPrompt.mock.calls[0]?.[2] as Function;
    const result = await handler({});

    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].role).toBe("assistant");
    expect(result.messages[0].content.text).toBe("Hello world!");
  });

  it("should JSON.stringify object result in assistant message", async () => {
    const data = { sql: "SELECT 1" };
    const prompt: PromptDefinition = {
      name: "suggest",
      description: "Suggest",
      handler: vi.fn().mockResolvedValue(data),
    };

    registerPromptImpl(adapter, server, prompt);

    const handler = server.registerPrompt.mock.calls[0]?.[2] as Function;
    const result = await handler({});

    expect(result.messages[0].content.text).toBe(JSON.stringify(data));
  });

  it("should include icons when provided", () => {
    const prompt: PromptDefinition = {
      name: "test",
      description: "Test",
      icons: { light: "prompt.svg" },
      handler: vi.fn().mockResolvedValue("ok"),
    };

    registerPromptImpl(adapter, server, prompt);

    const opts = server.registerPrompt.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(opts.icons).toEqual({ light: "prompt.svg" });
  });
});
