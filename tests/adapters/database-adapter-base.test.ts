import { describe, it, expect, vi, beforeEach } from "vitest";

// We need to test the abstract DatabaseAdapter behavior, which provides default implementations
// for registerTool, registerResource, registerPrompt and ensureConnected.
import { DatabaseAdapter } from "../../src/adapters/database-adapter.js";
import { ConnectionError } from "../../src/utils/errors/index.js";
import type {
  DatabaseConfig,
  HealthStatus,
  QueryResult,
  SchemaInfo,
  TableInfo,
  AdapterCapabilities,
  ToolDefinition,
  ResourceDefinition,
  PromptDefinition,
  ToolGroup,
  RequestContext,
} from "../../src/types/index.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// We mock the implementations that the base class uses so we can observe calls
vi.mock("../../src/adapters/registration/index.js", () => ({
  registerToolImpl: vi.fn(),
  registerResourceImpl: vi.fn(),
  registerPromptImpl: vi.fn(),
}));

import {
  registerToolImpl,
  registerResourceImpl,
  registerPromptImpl,
} from "../../src/adapters/registration/index.js";

// Mock ToolFilter to track what gets filtered
vi.mock("../../src/filtering/tool-filter.js", () => ({
  isToolEnabled: vi.fn((tool: ToolDefinition) => {
    // Simple mock: enabled unless group is 'disabled_group'
    return tool.group !== ("disabled_group" as any);
  }),
}));

/**
 * Minimal concrete implementation of DatabaseAdapter to test base class behavior.
 */
class MinimalDatabaseAdapter extends DatabaseAdapter {
  type = "sqlite" as const;
  name = "Minimal Adapter";
  version = "1.0.0";

  public setConnected(status: boolean) {
    this.connected = status;
  }

  // Implementation required by abstract class
  connect = vi.fn<[DatabaseConfig], Promise<void>>();
  disconnect = vi.fn<[], Promise<void>>();
  getHealth = vi.fn<[], Promise<HealthStatus>>();
  executeReadQuery = vi.fn<[string, unknown[]?], Promise<QueryResult>>();
  executeWriteQuery = vi.fn<
    [string, unknown[]?, boolean?],
    Promise<QueryResult>
  >();
  executeQuery = vi.fn<[string, unknown[]?], Promise<QueryResult>>();
  getSchema = vi.fn<[], Promise<SchemaInfo>>();
  listTables = vi.fn<[], Promise<TableInfo[]>>();
  describeTable = vi.fn<[string], Promise<TableInfo>>();
  listSchemas = vi.fn<[], Promise<string[]>>();
  getCapabilities = vi.fn<[], AdapterCapabilities>(
    () => ({}) as AdapterCapabilities,
  );
  getSupportedToolGroups = vi.fn<[], ToolGroup[]>(() => []);

  getToolDefinitions = vi.fn<[], ToolDefinition[]>(() => []);
  getResourceDefinitions = vi.fn<[], ResourceDefinition[]>(() => []);
  getPromptDefinitions = vi.fn<[], PromptDefinition[]>(() => []);

  // Expose protected methods for testing
  public testEnsureConnected() {
    this.ensureConnected();
  }
}

describe("DatabaseAdapter Base Class", () => {
  let adapter: MinimalDatabaseAdapter;
  let mockServer: McpServer;

  beforeEach(() => {
    adapter = new MinimalDatabaseAdapter();
    mockServer = {} as McpServer;
    vi.clearAllMocks();
  });

  describe("Connection State", () => {
    it("should initialize with connected = false", () => {
      expect(adapter.isConnected()).toBe(false);
    });

    it("should throw ConnectionError when not connected", () => {
      expect(() => adapter.testEnsureConnected()).toThrow(ConnectionError);
      expect(() => adapter.testEnsureConnected()).toThrow(
        "Not connected to database",
      );
    });

    it("should not throw when connected", () => {
      adapter.setConnected(true);
      expect(() => adapter.testEnsureConnected()).not.toThrow();
    });
  });

  describe("createContext", () => {
    it("should generate a valid RequestContext with a UUID", () => {
      const context = adapter.createContext();

      expect(context.requestId).toBeDefined();
      expect(typeof context.requestId).toBe("string");
      expect(context.requestId.length).toBeGreaterThan(0);
      expect(context.timestamp).toBeInstanceOf(Date);
      expect(context.server).toBeUndefined();
      expect(context.progressToken).toBeUndefined();
    });

    it("should use provided requestId, server, and progressToken", () => {
      const mockServerInstance = {};
      const context = adapter.createContext(
        "req-123",
        mockServerInstance,
        "prog-456",
      );

      expect(context.requestId).toBe("req-123");
      expect(context.server).toBe(mockServerInstance);
      expect(context.progressToken).toBe("prog-456");
    });
  });

  describe("getInfo", () => {
    it("should return adapter metadata including capabilities", () => {
      adapter.setConnected(true);
      adapter.getCapabilities.mockReturnValue({ mockCapability: true } as any);
      adapter.getSupportedToolGroups.mockReturnValue(["core", "stats"]);

      const info = adapter.getInfo();

      expect(info.type).toBe("sqlite");
      expect(info.name).toBe("Minimal Adapter");
      expect(info.version).toBe("1.0.0");
      expect(info.connected).toBe(true);
      expect(info.capabilities).toEqual({ mockCapability: true });
      expect(info.toolGroups).toEqual(["core", "stats"]);
    });
  });

  describe("Registration Methods", () => {
    it("should filter tools dynamically and pass them to registerToolImpl", () => {
      const enabledTool: ToolDefinition = {
        name: "enabled_tool",
        description: "",
        group: "core",
        handler: vi.fn(),
      };
      const disabledTool: ToolDefinition = {
        name: "disabled_tool",
        description: "",
        group: "disabled_group" as any,
        handler: vi.fn(),
      };

      adapter.getToolDefinitions.mockReturnValue([enabledTool, disabledTool]);

      adapter.registerTools(mockServer, { enabledGroups: ["core"] });

      // Should filter out the disabled tool and only call register for the enabled one
      expect(registerToolImpl).toHaveBeenCalledTimes(1);
      expect(registerToolImpl).toHaveBeenCalledWith(
        adapter,
        mockServer,
        enabledTool,
      );
    });

    it("should pass resources to registerResourceImpl", () => {
      const resource1: ResourceDefinition = {
        uri: "sqlite://test",
        name: "Test",
        description: "",
        handler: vi.fn(),
      };
      adapter.getResourceDefinitions.mockReturnValue([resource1]);

      adapter.registerResources(mockServer);

      expect(registerResourceImpl).toHaveBeenCalledTimes(1);
      expect(registerResourceImpl).toHaveBeenCalledWith(
        adapter,
        mockServer,
        resource1,
      );
    });

    it("should pass prompts to registerPromptImpl", () => {
      const prompt1: PromptDefinition = {
        name: "test_prompt",
        description: "",
        messages: vi.fn(),
      };
      adapter.getPromptDefinitions.mockReturnValue([prompt1]);

      adapter.registerPrompts(mockServer);

      expect(registerPromptImpl).toHaveBeenCalledTimes(1);
      expect(registerPromptImpl).toHaveBeenCalledWith(
        adapter,
        mockServer,
        prompt1,
      );
    });
  });
});
