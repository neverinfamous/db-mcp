import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  toolNameToMethodName,
  createSqliteApi,
} from "../../src/codemode/api.js";
import type { ToolDefinition } from "../../src/types/index.js";

describe("codemode api", () => {
  describe("toolNameToMethodName", () => {
    it("should remove sqlite_ prefix and convert to camelCase", () => {
      expect(toolNameToMethodName("sqlite_read_query", "core")).toBe(
        "readQuery",
      );
      expect(toolNameToMethodName("sqlite_json_extract", "json")).toBe(
        "extract",
      );
    });

    it("should handle groups where prefix is kept", () => {
      // Admin group keeps its prefix according to KEEP_PREFIX_GROUPS
      expect(toolNameToMethodName("sqlite_backup", "admin")).toBe("backup");
      expect(toolNameToMethodName("sqlite_transaction_begin", "admin")).toBe(
        "transactionBegin",
      );
    });

    it("should handle groups with custom prefixes", () => {
      // Depending on POSITIONAL_PARAM_MAP and KEEP_PREFIX_GROUPS, stats might keep its prefix
      expect(toolNameToMethodName("sqlite_stats_basic", "stats")).toBe(
        "statsBasic",
      );
      // 'vector' might drop 'vector_' or keep it
      expect(toolNameToMethodName("sqlite_vector_search", "vector")).toBe(
        "search",
      );
    });
  });

  describe("SqliteApi", () => {
    const mockCoreTool: ToolDefinition = {
      name: "sqlite_read_query",
      description: "Read query",
      group: "core",
      handler: vi.fn().mockResolvedValue({ result: "core_success" }),
    };

    const mockStatsTool: ToolDefinition = {
      name: "sqlite_stats_basic",
      description: "Basic stats",
      group: "stats",
      handler: vi.fn().mockResolvedValue({ result: "stats_success" }),
    };

    const mockAdminTool: ToolDefinition = {
      name: "sqlite_backup",
      description: "Backup database",
      group: "admin",
      handler: vi.fn().mockResolvedValue({ result: "admin_success" }),
    };

    const mockCodemodeTool: ToolDefinition = {
      name: "sqlite_execute_code",
      description: "Should be skipped",
      group: "codemode",
      handler: vi.fn(),
    };

    it("should filter out codemode tools and group others correctly", () => {
      const api = createSqliteApi([
        mockCoreTool,
        mockStatsTool,
        mockAdminTool,
        mockCodemodeTool,
      ]);

      const groups = api.getGroups();
      expect(groups).toContain("core");
      expect(groups).toContain("stats");
      expect(groups).toContain("admin");
      expect(groups).not.toContain("codemode");
    });

    it("should create method wrappers that call the underlying handler", async () => {
      const api = createSqliteApi([mockCoreTool]);

      // Call the method
      const result = await api.core.readQuery({ sql: "SELECT 1" });

      expect(result).toEqual({ result: "core_success" });
      expect(mockCoreTool.handler).toHaveBeenCalledWith(
        { sql: "SELECT 1" },
        expect.objectContaining({
          timestamp: expect.any(Date),
          requestId: expect.any(String),
        }),
      );
    });

    it("should provide a help() method for each group", async () => {
      const api = createSqliteApi([mockCoreTool]);
      const helpResult = await api.core.help();

      expect(helpResult.group).toBe("core");
      expect(helpResult.methods).toContain("readQuery");
      // Alias 'query' might also be present if defined in METHOD_ALIASES
    });

    it("should generate sandbox bindings with top-level aliases", async () => {
      const api = createSqliteApi([mockCoreTool]);
      const bindings = api.createSandboxBindings();

      expect(bindings.core).toBeDefined();
      expect(bindings.readQuery).toBeDefined();
      expect(typeof bindings.help).toBe("function");

      const topLevelHelp = await (bindings.help as Function)();
      expect(topLevelHelp.groups).toContain("core");
      expect(topLevelHelp.totalMethods).toBeGreaterThan(0);
    });
  });

  describe("API Method Parameter Normalization", () => {
    // We are testing normalizeParams implicitly through the generated method
    const mockTool: ToolDefinition = {
      name: "sqlite_read_query", // readQuery maps to ['sql', 'params'] or ['query', 'params']
      description: "Read query",
      group: "core",
      handler: vi.fn().mockResolvedValue({}),
    };

    beforeEach(() => {
      (mockTool.handler as any).mockClear();
    });

    it("should normalize single string positional argument", async () => {
      const api = createSqliteApi([mockTool]);
      await api.core.readQuery("SELECT 1");

      expect(mockTool.handler).toHaveBeenCalledWith(
        // The fallback maps the string strictly based on POSITIONAL_PARAM_MAP["readQuery"]
        // Let's assert that it builds the expected object based on the mapped key (e.g. query)
        expect.objectContaining({ query: "SELECT 1" }),
        expect.any(Object),
      );
    });

    it("should merge trailing options object for named parameters", async () => {
      const api = createSqliteApi([mockTool]);
      // If POSITIONAL_PARAM_MAP["readQuery"] is just "query", positional arguments beyond the first
      // are ignored unless they are a trailing options object.
      await api.core.readQuery("SELECT * FROM users WHERE id = ?", {
        params: [1],
      });

      expect(mockTool.handler).toHaveBeenCalledWith(
        expect.objectContaining({
          query: "SELECT * FROM users WHERE id = ?",
          params: [1],
        }),
        expect.any(Object),
      );
    });

    it("should pass through object arguments unchanged", async () => {
      const api = createSqliteApi([mockTool]);
      const arg = { sql: "SELECT 1", params: [] };
      await api.core.readQuery(arg);

      expect(mockTool.handler).toHaveBeenCalledWith(arg, expect.any(Object));
    });
  });
});
