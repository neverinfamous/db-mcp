/**
 * Scope Enforcement Unit Tests
 *
 * Tests all scope enforcement functions: tool access, database access,
 * table access, required scopes, and accessible tool/group lookups.
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
    expect(scopeGrantsToolAccess("full", "vacuum_database")).toBe(true);
    expect(scopeGrantsToolAccess("full", "read_query")).toBe(true);
    expect(scopeGrantsToolAccess("full", "write_query")).toBe(true);
  });

  it("should grant admin scope access to all tools", () => {
    expect(scopeGrantsToolAccess("admin", "vacuum_database")).toBe(true);
    expect(scopeGrantsToolAccess("admin", "read_query")).toBe(true);
  });

  it("should grant write scope to non-admin tools", () => {
    expect(scopeGrantsToolAccess("write", "write_query")).toBe(true);
    expect(scopeGrantsToolAccess("write", "read_query")).toBe(true);
  });

  it("should deny write scope for admin tools", () => {
    expect(scopeGrantsToolAccess("write", "vacuum_database")).toBe(false);
    expect(scopeGrantsToolAccess("write", "pragma_set")).toBe(false);
  });

  it("should grant read scope only to read-only tools", () => {
    expect(scopeGrantsToolAccess("read", "read_query")).toBe(true);
    expect(scopeGrantsToolAccess("read", "list_tables")).toBe(true);
  });

  it("should deny read scope for write tools", () => {
    expect(scopeGrantsToolAccess("read", "write_query")).toBe(false);
    expect(scopeGrantsToolAccess("read", "create_table")).toBe(false);
  });

  it("should deny read scope for admin tools", () => {
    expect(scopeGrantsToolAccess("read", "vacuum_database")).toBe(false);
  });

  it("should deny db/table scopes (they don't affect tool access)", () => {
    expect(scopeGrantsToolAccess("db:mydb", "read_query")).toBe(false);
    expect(scopeGrantsToolAccess("table:mydb:users", "read_query")).toBe(false);
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
    expect(scopesGrantToolAccess(["read"], "vacuum_database")).toBe(false);
  });

  it("should return false for empty scopes", () => {
    expect(scopesGrantToolAccess([], "read_query")).toBe(false);
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
  });

  it("should return admin for admin groups", () => {
    expect(getRequiredScopeForGroup("admin")).toBe("admin");
    expect(getRequiredScopeForGroup("codemode")).toBe("admin");
  });
});

describe("getRequiredScopeForTool", () => {
  it("should return admin for admin tools", () => {
    expect(getRequiredScopeForTool("vacuum_database")).toBe("admin");
    expect(getRequiredScopeForTool("pragma_set")).toBe("admin");
  });

  it("should return write for write tools", () => {
    expect(getRequiredScopeForTool("write_query")).toBe("write");
    expect(getRequiredScopeForTool("create_table")).toBe("write");
  });

  it("should return read for all other tools", () => {
    expect(getRequiredScopeForTool("read_query")).toBe("read");
    expect(getRequiredScopeForTool("unknown_tool")).toBe("read");
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
  });

  it("should return all groups for admin scope", () => {
    const groups = getAccessibleToolGroups(["admin"]);
    expect(groups).toContain("core");
    expect(groups).toContain("admin");
  });

  it("should return read+write groups for write scope", () => {
    const groups = getAccessibleToolGroups(["write"]);
    expect(groups).toContain("core");
    expect(groups).toContain("migration");
    expect(groups).not.toContain("admin");
  });

  it("should return only read groups for read scope", () => {
    const groups = getAccessibleToolGroups(["read"]);
    expect(groups).toContain("core");
    expect(groups).not.toContain("migration");
    expect(groups).not.toContain("admin");
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
    // Should not contain write-only or admin-only tools
    expect(tools).not.toContain("vacuum_database");
  });

  it("should return empty array for no scopes", () => {
    expect(getAccessibleTools([])).toEqual([]);
  });
});
