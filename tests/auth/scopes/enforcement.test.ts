/**
 * Scope Enforcement Unit Tests
 *
 * Tests all scope enforcement functions: tool access, database access,
 * table access, required scopes, and accessible tool/group lookups.
 *
 * Uses actual MCP tool names (both bare and sqlite_-prefixed) to match
 * the runtime registration in tool-constants.ts.
 */

import { describe, it, expect } from "vitest";
import {
  scopeGrantsToolAccess,
  scopesGrantToolAccess,
  scopeGrantsDatabaseAccess,
  scopesGrantDatabaseAccess,
  scopeGrantsTableAccess,
  scopesGrantTableAccess,
  getRequiredScopeForGroup,
  getRequiredScopeForTool,
  getAccessibleToolGroups,
  getAccessibleTools,
} from "../../../src/auth/scopes/enforcement.js";

// =============================================================================
// scopeGrantsToolAccess
// =============================================================================

describe("scopeGrantsToolAccess", () => {
  it("should grant full scope access to all tools", () => {
    expect(scopeGrantsToolAccess("full", "vacuum")).toBe(true);
    expect(scopeGrantsToolAccess("full", "sqlite_vacuum")).toBe(true);
    expect(scopeGrantsToolAccess("full", "read_query")).toBe(true);
    expect(scopeGrantsToolAccess("full", "write_query")).toBe(true);
    expect(scopeGrantsToolAccess("full", "execute_code")).toBe(true);
  });

  it("should grant admin scope access to all tools", () => {
    expect(scopeGrantsToolAccess("admin", "vacuum")).toBe(true);
    expect(scopeGrantsToolAccess("admin", "sqlite_vacuum")).toBe(true);
    expect(scopeGrantsToolAccess("admin", "read_query")).toBe(true);
    expect(scopeGrantsToolAccess("admin", "execute_code")).toBe(true);
    expect(scopeGrantsToolAccess("admin", "sqlite_execute_code")).toBe(true);
  });

  it("should grant write scope to non-admin tools", () => {
    expect(scopeGrantsToolAccess("write", "write_query")).toBe(true);
    expect(scopeGrantsToolAccess("write", "sqlite_write_query")).toBe(true);
    expect(scopeGrantsToolAccess("write", "read_query")).toBe(true);
    expect(scopeGrantsToolAccess("write", "sqlite_read_query")).toBe(true);
    expect(scopeGrantsToolAccess("write", "create_table")).toBe(true);
  });

  it("should deny write scope for admin tools (bare names)", () => {
    expect(scopeGrantsToolAccess("write", "vacuum")).toBe(false);
    expect(scopeGrantsToolAccess("write", "backup")).toBe(false);
    expect(scopeGrantsToolAccess("write", "restore")).toBe(false);
    expect(scopeGrantsToolAccess("write", "pragma_settings")).toBe(false);
    expect(scopeGrantsToolAccess("write", "execute_code")).toBe(false);
  });

  it("should deny write scope for admin tools (sqlite_-prefixed names)", () => {
    expect(scopeGrantsToolAccess("write", "sqlite_vacuum")).toBe(false);
    expect(scopeGrantsToolAccess("write", "sqlite_backup")).toBe(false);
    expect(scopeGrantsToolAccess("write", "sqlite_restore")).toBe(false);
    expect(scopeGrantsToolAccess("write", "sqlite_pragma_settings")).toBe(
      false,
    );
    expect(scopeGrantsToolAccess("write", "sqlite_execute_code")).toBe(false);
  });

  it("should deny write scope for all codemode tools", () => {
    expect(scopeGrantsToolAccess("write", "execute_code")).toBe(false);
    expect(scopeGrantsToolAccess("write", "sqlite_execute_code")).toBe(false);
  });

  it("should grant read scope only to read-only tools", () => {
    expect(scopeGrantsToolAccess("read", "read_query")).toBe(true);
    expect(scopeGrantsToolAccess("read", "sqlite_read_query")).toBe(true);
    expect(scopeGrantsToolAccess("read", "list_tables")).toBe(true);
    expect(scopeGrantsToolAccess("read", "sqlite_list_tables")).toBe(true);
    expect(scopeGrantsToolAccess("read", "describe_table")).toBe(true);
    expect(scopeGrantsToolAccess("read", "query_plan")).toBe(true);
  });

  it("should deny read scope for write tools", () => {
    expect(scopeGrantsToolAccess("read", "write_query")).toBe(false);
    expect(scopeGrantsToolAccess("read", "sqlite_write_query")).toBe(false);
    expect(scopeGrantsToolAccess("read", "create_table")).toBe(false);
    expect(scopeGrantsToolAccess("read", "sqlite_create_table")).toBe(false);
  });

  it("should deny read scope for admin tools", () => {
    expect(scopeGrantsToolAccess("read", "vacuum")).toBe(false);
    expect(scopeGrantsToolAccess("read", "sqlite_vacuum")).toBe(false);
    expect(scopeGrantsToolAccess("read", "execute_code")).toBe(false);
    expect(scopeGrantsToolAccess("read", "sqlite_execute_code")).toBe(false);
  });

  it("should deny db/table scopes (they don't affect tool access)", () => {
    expect(scopeGrantsToolAccess("db:mydb", "read_query")).toBe(false);
    expect(scopeGrantsToolAccess("table:mydb:users", "read_query")).toBe(false);
  });

  it("should deny write scope for unknown tools (fail-closed via admin default)", () => {
    // Unknown tools are not in any set, so getRequiredScopeForTool returns admin
    // and scopeGrantsToolAccess denies them for write scope via ADMIN_TOOLS check
    // Note: unknown tools fail-closed because they're not in READ_ONLY_TOOLS either
    expect(scopeGrantsToolAccess("read", "unknown_tool")).toBe(false);
  });
});

// =============================================================================
// scopesGrantToolAccess
// =============================================================================

describe("scopesGrantToolAccess", () => {
  it("should return true if any scope grants access", () => {
    expect(scopesGrantToolAccess(["read", "write"], "write_query")).toBe(true);
  });

  it("should return false if no scope grants access", () => {
    expect(scopesGrantToolAccess(["read"], "vacuum")).toBe(false);
    expect(scopesGrantToolAccess(["read"], "sqlite_vacuum")).toBe(false);
  });

  it("should return false for empty scopes", () => {
    expect(scopesGrantToolAccess([], "read_query")).toBe(false);
  });

  it("should check sqlite_-prefixed tool names", () => {
    expect(
      scopesGrantToolAccess(["write"], "sqlite_execute_code"),
    ).toBe(false);
    expect(
      scopesGrantToolAccess(["admin"], "sqlite_execute_code"),
    ).toBe(true);
  });
});

// =============================================================================
// scopeGrantsDatabaseAccess
// =============================================================================

describe("scopeGrantsDatabaseAccess", () => {
  it("should grant global scopes access to all databases", () => {
    expect(scopeGrantsDatabaseAccess("full", "mydb")).toBe(true);
    expect(scopeGrantsDatabaseAccess("admin", "mydb")).toBe(true);
    expect(scopeGrantsDatabaseAccess("write", "mydb")).toBe(true);
    expect(scopeGrantsDatabaseAccess("read", "mydb")).toBe(true);
  });

  it("should grant db-specific scope to matching database", () => {
    expect(scopeGrantsDatabaseAccess("db:mydb", "mydb")).toBe(true);
  });

  it("should deny db-specific scope for non-matching database", () => {
    expect(scopeGrantsDatabaseAccess("db:otherdb", "mydb")).toBe(false);
  });

  it("should grant table scope to the database of the table", () => {
    expect(scopeGrantsDatabaseAccess("table:mydb:users", "mydb")).toBe(true);
  });

  it("should deny table scope for non-matching database", () => {
    expect(scopeGrantsDatabaseAccess("table:otherdb:users", "mydb")).toBe(
      false,
    );
  });

  it("should deny unrecognized scopes", () => {
    expect(scopeGrantsDatabaseAccess("unknown", "mydb")).toBe(false);
  });
});

// =============================================================================
// scopesGrantDatabaseAccess
// =============================================================================

describe("scopesGrantDatabaseAccess", () => {
  it("should return true if any scope grants database access", () => {
    expect(scopesGrantDatabaseAccess(["db:mydb"], "mydb")).toBe(true);
  });

  it("should return false if no scope matches", () => {
    expect(scopesGrantDatabaseAccess(["db:other"], "mydb")).toBe(false);
  });
});

// =============================================================================
// scopeGrantsTableAccess
// =============================================================================

describe("scopeGrantsTableAccess", () => {
  it("should grant global scopes access to all tables", () => {
    expect(scopeGrantsTableAccess("full", "mydb", "users")).toBe(true);
    expect(scopeGrantsTableAccess("admin", "mydb", "users")).toBe(true);
    expect(scopeGrantsTableAccess("write", "mydb", "users")).toBe(true);
    expect(scopeGrantsTableAccess("read", "mydb", "users")).toBe(true);
  });

  it("should grant db-specific scope to all tables in that db", () => {
    expect(scopeGrantsTableAccess("db:mydb", "mydb", "users")).toBe(true);
    expect(scopeGrantsTableAccess("db:mydb", "mydb", "orders")).toBe(true);
  });

  it("should deny db-specific scope for different database", () => {
    expect(scopeGrantsTableAccess("db:otherdb", "mydb", "users")).toBe(false);
  });

  it("should grant table-specific scope for exact match", () => {
    expect(scopeGrantsTableAccess("table:mydb:users", "mydb", "users")).toBe(
      true,
    );
  });

  it("should deny table-specific scope for different table", () => {
    expect(scopeGrantsTableAccess("table:mydb:orders", "mydb", "users")).toBe(
      false,
    );
  });

  it("should deny table-specific scope for different database", () => {
    expect(scopeGrantsTableAccess("table:otherdb:users", "mydb", "users")).toBe(
      false,
    );
  });
});

// =============================================================================
// scopesGrantTableAccess
// =============================================================================

describe("scopesGrantTableAccess", () => {
  it("should return true if any scope grants table access", () => {
    expect(scopesGrantTableAccess(["table:mydb:users"], "mydb", "users")).toBe(
      true,
    );
  });

  it("should return false if no scope matches", () => {
    expect(scopesGrantTableAccess(["table:mydb:orders"], "mydb", "users")).toBe(
      false,
    );
  });
});

// =============================================================================
// getRequiredScopeForGroup / getRequiredScopeForTool
// =============================================================================

describe("getRequiredScopeForGroup", () => {
  it("should return read for read-only groups", () => {
    expect(getRequiredScopeForGroup("core")).toBe("read");
    expect(getRequiredScopeForGroup("json")).toBe("read");
    expect(getRequiredScopeForGroup("stats")).toBe("read");
    expect(getRequiredScopeForGroup("introspection")).toBe("read");
  });

  it("should return write for write groups", () => {
    expect(getRequiredScopeForGroup("migration")).toBe("write");
    expect(getRequiredScopeForGroup("transactions")).toBe("write");
  });

  it("should return admin for admin groups", () => {
    expect(getRequiredScopeForGroup("admin")).toBe("admin");
    expect(getRequiredScopeForGroup("codemode")).toBe("admin");
  });
});

describe("getRequiredScopeForTool", () => {
  it("should return admin for admin tools (bare names)", () => {
    expect(getRequiredScopeForTool("vacuum")).toBe("admin");
    expect(getRequiredScopeForTool("backup")).toBe("admin");
    expect(getRequiredScopeForTool("pragma_settings")).toBe("admin");
    expect(getRequiredScopeForTool("execute_code")).toBe("admin");
  });

  it("should return admin for admin tools (sqlite_-prefixed names)", () => {
    expect(getRequiredScopeForTool("sqlite_vacuum")).toBe("admin");
    expect(getRequiredScopeForTool("sqlite_backup")).toBe("admin");
    expect(getRequiredScopeForTool("sqlite_execute_code")).toBe("admin");
  });

  it("should return write for write tools", () => {
    expect(getRequiredScopeForTool("write_query")).toBe("write");
    expect(getRequiredScopeForTool("sqlite_write_query")).toBe("write");
    expect(getRequiredScopeForTool("create_table")).toBe("write");
    expect(getRequiredScopeForTool("sqlite_create_table")).toBe("write");
  });

  it("should return read for known read-only tools", () => {
    expect(getRequiredScopeForTool("read_query")).toBe("read");
    expect(getRequiredScopeForTool("sqlite_read_query")).toBe("read");
    expect(getRequiredScopeForTool("list_tables")).toBe("read");
    expect(getRequiredScopeForTool("sqlite_list_tables")).toBe("read");
  });

  it("should return admin as fail-closed default for unknown tools", () => {
    expect(getRequiredScopeForTool("unknown_tool")).toBe("admin");
  });
});

// =============================================================================
// getAccessibleToolGroups
// =============================================================================

describe("getAccessibleToolGroups", () => {
  it("should return all groups for full scope", () => {
    const groups = getAccessibleToolGroups(["full"]);
    expect(groups).toContain("core");
    expect(groups).toContain("admin");
    expect(groups).toContain("migration");
    expect(groups).toContain("codemode");
  });

  it("should return all groups for admin scope", () => {
    const groups = getAccessibleToolGroups(["admin"]);
    expect(groups).toContain("core");
    expect(groups).toContain("admin");
    expect(groups).toContain("codemode");
  });

  it("should return read+write groups for write scope", () => {
    const groups = getAccessibleToolGroups(["write"]);
    expect(groups).toContain("core");
    expect(groups).toContain("migration");
    expect(groups).not.toContain("admin");
    expect(groups).not.toContain("codemode");
  });

  it("should return only read groups for read scope", () => {
    const groups = getAccessibleToolGroups(["read"]);
    expect(groups).toContain("core");
    expect(groups).not.toContain("migration");
    expect(groups).not.toContain("admin");
    expect(groups).not.toContain("codemode");
  });

  it("should return empty array for no scopes", () => {
    expect(getAccessibleToolGroups([])).toEqual([]);
  });
});

// =============================================================================
// getAccessibleTools
// =============================================================================

describe("getAccessibleTools", () => {
  it("should return tools for full scope", () => {
    const tools = getAccessibleTools(["full"]);
    expect(tools.length).toBeGreaterThan(0);
  });

  it("should return only read-only tools for read scope", () => {
    const tools = getAccessibleTools(["read"]);
    // Should not contain admin-only tools
    expect(tools).not.toContain("vacuum");
    expect(tools).not.toContain("execute_code");
    expect(tools).not.toContain("backup");
  });

  it("should return empty array for no scopes", () => {
    expect(getAccessibleTools([])).toEqual([]);
  });
});

// =============================================================================
// Cross-cutting: ADMIN_TOOLS completeness
// =============================================================================

describe("ADMIN_TOOLS coverage", () => {
  it("should block all admin group tools with write scope", () => {
    // Every tool in the admin and codemode groups should be denied
    // when the client only has write scope
    const adminGroupTools = [
      "backup",
      "analyze",
      "integrity_check",
      "optimize",
      "restore",
      "verify_backup",
      "index_stats",
      "pragma_compile_options",
      "pragma_database_list",
      "pragma_optimize",
      "pragma_settings",
      "pragma_table_info",
      "append_insight",
      "generate_series",
      "create_view",
      "list_views",
      "drop_view",
      "dbstat",
      "vacuum",
      "list_virtual_tables",
      "virtual_table_info",
      "drop_virtual_table",
      "create_csv_table",
      "analyze_csv_schema",
      "create_rtree_table",
      "create_series_table",
      "attach_database",
      "detach_database",
      "vacuum_into",
      "dump",
      "reindex",
      "wal",
    ];

    for (const tool of adminGroupTools) {
      expect(
        scopeGrantsToolAccess("write", tool),
        `write scope should deny bare name: ${tool}`,
      ).toBe(false);
      expect(
        scopeGrantsToolAccess("write", `sqlite_${tool}`),
        `write scope should deny prefixed name: sqlite_${tool}`,
      ).toBe(false);
    }
  });

  it("should block execute_code with write scope (codemode group)", () => {
    expect(scopeGrantsToolAccess("write", "execute_code")).toBe(false);
    expect(scopeGrantsToolAccess("write", "sqlite_execute_code")).toBe(false);
  });
});
