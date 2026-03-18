/**
 * db-mcp - Scopes Unit Tests
 *
 * Tests for OAuth scope definitions, hierarchy, and enforcement utilities.
 */

import { describe, it, expect } from "vitest";
import {
  SCOPES,
  parseScopes,
  hasScope,
  hasAnyScope,
  hasAllScopes,
  hasAdminScope,
  hasWriteScope,
  hasReadScope,
  isValidScope,
  getScopeForToolGroup,
  getScopeDisplayName,
  scopeGrantsToolAccess,
  scopesGrantToolAccess,
  scopeGrantsDatabaseAccess,
  scopeGrantsTableAccess,
  getRequiredScopeForGroup,
  getAccessibleToolGroups,
  TOOL_GROUP_SCOPES,
} from "../scopes/index.js";

// =============================================================================
// parseScopes
// =============================================================================

describe("parseScopes", () => {
  it("should parse space-delimited scope string", () => {
    expect(parseScopes("read write admin")).toEqual(["read", "write", "admin"]);
  });

  it("should return empty array for empty string", () => {
    expect(parseScopes("")).toEqual([]);
  });

  it("should handle single scope", () => {
    expect(parseScopes("read")).toEqual(["read"]);
  });

  it("should strip extra whitespace", () => {
    expect(parseScopes("  read   write  ")).toEqual(["read", "write"]);
  });
});

// =============================================================================
// hasScope (hierarchy: full ⊃ admin ⊃ write ⊃ read)
// =============================================================================

describe("hasScope", () => {
  it("should return true for direct match", () => {
    expect(hasScope(["read", "write"], "read")).toBe(true);
  });

  it("should return false when scope not present", () => {
    expect(hasScope(["read"], "write")).toBe(false);
  });

  it("should grant all scopes when full is present", () => {
    expect(hasScope(["full"], "read")).toBe(true);
    expect(hasScope(["full"], "write")).toBe(true);
    expect(hasScope(["full"], "admin")).toBe(true);
  });

  it("should grant read and write when admin is present", () => {
    expect(hasScope(["admin"], "read")).toBe(true);
    expect(hasScope(["admin"], "write")).toBe(true);
  });

  it("should NOT grant admin when only write is present", () => {
    expect(hasScope(["write"], "admin")).toBe(false);
  });

  it("should grant read when write is present", () => {
    expect(hasScope(["write"], "read")).toBe(true);
  });

  it("should NOT grant write when only read is present", () => {
    expect(hasScope(["read"], "write")).toBe(false);
  });

  it("should return false for empty scopes", () => {
    expect(hasScope([], "read")).toBe(false);
  });
});

// =============================================================================
// hasAnyScope / hasAllScopes
// =============================================================================

describe("hasAnyScope", () => {
  it("should return true if any scope matches", () => {
    expect(hasAnyScope(["read"], ["read", "write"])).toBe(true);
  });

  it("should return false if no scopes match", () => {
    expect(hasAnyScope(["read"], ["write", "admin"])).toBe(false);
  });

  it("should handle hierarchy (full grants any)", () => {
    expect(hasAnyScope(["full"], ["admin"])).toBe(true);
  });
});

describe("hasAllScopes", () => {
  it("should return true if all scopes match", () => {
    expect(hasAllScopes(["read", "write", "admin"], ["read", "write"])).toBe(
      true,
    );
  });

  it("should return false if not all scopes match", () => {
    expect(hasAllScopes(["read"], ["read", "write"])).toBe(false);
  });

  it("should respect hierarchy for all checks", () => {
    expect(hasAllScopes(["full"], ["read", "write", "admin"])).toBe(true);
  });
});

// =============================================================================
// Legacy scope checks
// =============================================================================

describe("hasAdminScope", () => {
  it("should return true for admin", () => {
    expect(hasAdminScope(["admin"])).toBe(true);
  });

  it("should return true for full (which includes admin)", () => {
    expect(hasAdminScope(["full"])).toBe(true);
  });

  it("should return false for write/read only", () => {
    expect(hasAdminScope(["write"])).toBe(false);
    expect(hasAdminScope(["read"])).toBe(false);
  });
});

describe("hasWriteScope", () => {
  it("should return true for write", () => {
    expect(hasWriteScope(["write"])).toBe(true);
  });

  it("should return true for admin (which includes write)", () => {
    expect(hasWriteScope(["admin"])).toBe(true);
  });

  it("should return true for full", () => {
    expect(hasWriteScope(["full"])).toBe(true);
  });

  it("should return false for read only", () => {
    expect(hasWriteScope(["read"])).toBe(false);
  });
});

describe("hasReadScope", () => {
  it("should return true for read", () => {
    expect(hasReadScope(["read"])).toBe(true);
  });

  it("should return true for write (which includes read)", () => {
    expect(hasReadScope(["write"])).toBe(true);
  });

  it("should return true for full", () => {
    expect(hasReadScope(["full"])).toBe(true);
  });
});

// =============================================================================
// isValidScope
// =============================================================================

describe("isValidScope", () => {
  it("should validate base scopes", () => {
    expect(isValidScope("read")).toBe(true);
    expect(isValidScope("write")).toBe(true);
    expect(isValidScope("admin")).toBe(true);
    expect(isValidScope("full")).toBe(true);
  });

  it("should validate database patterns", () => {
    expect(isValidScope("db:mydb")).toBe(true);
  });

  it("should validate table patterns", () => {
    expect(isValidScope("table:mydb:users")).toBe(true);
  });

  it("should reject invalid scopes", () => {
    expect(isValidScope("unknown")).toBe(false);
    expect(isValidScope("database:mydb")).toBe(false);
  });
});

// =============================================================================
// TOOL_GROUP_SCOPES & getScopeForToolGroup
// =============================================================================

describe("TOOL_GROUP_SCOPES", () => {
  it("should map read-only groups to read", () => {
    expect(TOOL_GROUP_SCOPES["core"]).toBe(SCOPES.READ);
    expect(TOOL_GROUP_SCOPES["json"]).toBe(SCOPES.READ);
    expect(TOOL_GROUP_SCOPES["text"]).toBe(SCOPES.READ);
    expect(TOOL_GROUP_SCOPES["introspection"]).toBe(SCOPES.READ);
  });

  it("should map write groups to write", () => {
    expect(TOOL_GROUP_SCOPES["migration"]).toBe(SCOPES.WRITE);
  });

  it("should map admin groups to admin", () => {
    expect(TOOL_GROUP_SCOPES["admin"]).toBe(SCOPES.ADMIN);
    expect(TOOL_GROUP_SCOPES["codemode"]).toBe(SCOPES.ADMIN);
  });
});

describe("getScopeForToolGroup", () => {
  it("should return correct scope for each group", () => {
    expect(getScopeForToolGroup("core")).toBe("read");
    expect(getScopeForToolGroup("migration")).toBe("write");
    expect(getScopeForToolGroup("admin")).toBe("admin");
  });
});

// =============================================================================
// scopeGrantsToolAccess
// =============================================================================

describe("scopeGrantsToolAccess", () => {
  it("should grant full access to all tools", () => {
    expect(scopeGrantsToolAccess("full", "vacuum_database")).toBe(true);
    expect(scopeGrantsToolAccess("full", "read_query")).toBe(true);
  });

  it("should grant admin access to all tools", () => {
    expect(scopeGrantsToolAccess("admin", "vacuum_database")).toBe(true);
  });

  it("should deny admin tools for write scope", () => {
    expect(scopeGrantsToolAccess("write", "vacuum_database")).toBe(false);
  });

  it("should grant non-admin tools for write scope", () => {
    expect(scopeGrantsToolAccess("write", "write_query")).toBe(true);
  });

  it("should only grant read-only tools for read scope", () => {
    expect(scopeGrantsToolAccess("read", "read_query")).toBe(true);
    expect(scopeGrantsToolAccess("read", "write_query")).toBe(false);
  });
});

describe("scopesGrantToolAccess", () => {
  it("should check multiple scopes", () => {
    expect(scopesGrantToolAccess(["read", "write"], "write_query")).toBe(true);
    expect(scopesGrantToolAccess(["read"], "write_query")).toBe(false);
  });
});

// =============================================================================
// Database / Table scope access
// =============================================================================

describe("scopeGrantsDatabaseAccess", () => {
  it("should grant access for full scope", () => {
    expect(scopeGrantsDatabaseAccess("full", "mydb")).toBe(true);
  });

  it("should grant access for admin/write/read", () => {
    expect(scopeGrantsDatabaseAccess("admin", "mydb")).toBe(true);
    expect(scopeGrantsDatabaseAccess("write", "mydb")).toBe(true);
    expect(scopeGrantsDatabaseAccess("read", "mydb")).toBe(true);
  });

  it("should grant access for matching db: pattern", () => {
    expect(scopeGrantsDatabaseAccess("db:mydb", "mydb")).toBe(true);
  });

  it("should deny access for non-matching db: pattern", () => {
    expect(scopeGrantsDatabaseAccess("db:other", "mydb")).toBe(false);
  });
});

describe("scopeGrantsTableAccess", () => {
  it("should grant access for full scope", () => {
    expect(scopeGrantsTableAccess("full", "mydb", "users")).toBe(true);
  });

  it("should grant access via db: pattern", () => {
    expect(scopeGrantsTableAccess("db:mydb", "mydb", "users")).toBe(true);
  });

  it("should grant access via table: pattern", () => {
    expect(scopeGrantsTableAccess("table:mydb:users", "mydb", "users")).toBe(
      true,
    );
  });

  it("should deny access for non-matching table: pattern", () => {
    expect(scopeGrantsTableAccess("table:mydb:products", "mydb", "users")).toBe(
      false,
    );
  });
});

// =============================================================================
// hasDatabaseScope / hasTableScope (not in db-mcp originally — test if exported)
// =============================================================================

// Note: hasDatabaseScope/hasTableScope are from postgres-mcp pattern.
// If they were added, they would be tested here. For now these are
// covered by scopeGrantsDatabaseAccess/scopeGrantsTableAccess.

// =============================================================================
// getRequiredScopeForGroup / getAccessibleToolGroups
// =============================================================================

describe("getRequiredScopeForGroup", () => {
  it("should return read for read-only groups", () => {
    expect(getRequiredScopeForGroup("core")).toBe("read");
  });

  it("should return write for write groups", () => {
    expect(getRequiredScopeForGroup("migration")).toBe("write");
  });

  it("should return admin for admin groups", () => {
    expect(getRequiredScopeForGroup("admin")).toBe("admin");
    expect(getRequiredScopeForGroup("codemode")).toBe("admin");
  });
});

describe("getAccessibleToolGroups", () => {
  it("should return all groups for full scope", () => {
    const groups = getAccessibleToolGroups(["full"]);
    expect(groups).toContain("admin");
    expect(groups).toContain("core");
  });

  it("should return all groups for admin scope", () => {
    const groups = getAccessibleToolGroups(["admin"]);
    expect(groups).toContain("admin");
    expect(groups).toContain("migration");
    expect(groups).toContain("core");
  });

  it("should return write+read groups for write scope", () => {
    const groups = getAccessibleToolGroups(["write"]);
    expect(groups).toContain("core");
    expect(groups).toContain("migration");
    expect(groups).not.toContain("admin");
  });

  it("should return read groups for read scope", () => {
    const groups = getAccessibleToolGroups(["read"]);
    expect(groups).toContain("core");
    expect(groups).not.toContain("migration");
    expect(groups).not.toContain("admin");
  });

  it("should return empty for no scopes", () => {
    expect(getAccessibleToolGroups([])).toEqual([]);
  });
});

// =============================================================================
// getScopeDisplayName
// =============================================================================

describe("getScopeDisplayName", () => {
  it("should return display names for standard scopes", () => {
    expect(getScopeDisplayName("read")).toBe("Read Only");
    expect(getScopeDisplayName("write")).toBe("Read/Write");
    expect(getScopeDisplayName("admin")).toBe("Administrative");
    expect(getScopeDisplayName("full")).toBe("Full Access");
  });

  it("should format db: scopes", () => {
    expect(getScopeDisplayName("db:mydb")).toBe("Database: mydb");
  });

  it("should format table: scopes", () => {
    expect(getScopeDisplayName("table:mydb:users")).toBe("Table: mydb:users");
  });

  it("should return unknown scopes as-is", () => {
    expect(getScopeDisplayName("custom_scope")).toBe("custom_scope");
  });
});
