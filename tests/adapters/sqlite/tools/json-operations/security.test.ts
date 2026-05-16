/**
 * JSON Security Scan Tool Tests (Mock-based)
 *
 * Tests: sqlite_json_security_scan
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createJsonSecurityScanTool } from "../../../../../src/adapters/sqlite/tools/json-operations/security.js";

const ctx = { timestamp: new Date(), requestId: "test" };

function createMockAdapter() {
  return {
    executeReadQuery: vi.fn(),
    executeWriteQuery: vi.fn(),
  } as any;
}

// =============================================================================
// sqlite_json_security_scan
// =============================================================================

describe("createJsonSecurityScanTool", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should return low risk for clean data", async () => {
    const adapter = createMockAdapter();
    adapter.executeReadQuery.mockResolvedValue({
      rows: [
        { json_data: '{"name": "Alice", "age": 30}' },
        { json_data: '{"name": "Bob", "age": 25}' },
      ],
    });
    const tool = createJsonSecurityScanTool(adapter);
    const result = (await tool.handler(
      { table: "users", column: "data" },
      ctx,
    )) as any;
    expect(result.success).toBe(true);
    expect(result.riskLevel).toBe("low");
    expect(result.scannedRows).toBe(2);
    expect(result.issues).toBeUndefined();
  });

  it("should detect sensitive key names", async () => {
    const adapter = createMockAdapter();
    adapter.executeReadQuery.mockResolvedValue({
      rows: [
        { json_data: '{"password": "secret123", "name": "Alice"}' },
        { json_data: '{"password": "pass456", "token": "abc"}' },
      ],
    });
    const tool = createJsonSecurityScanTool(adapter);
    const result = (await tool.handler(
      { table: "users", column: "data" },
      ctx,
    )) as any;
    expect(result.success).toBe(true);
    expect(result.riskLevel).not.toBe("low");
    expect(result.issues).toBeDefined();

    const passwordIssue = result.issues.find(
      (i: any) => i.type === "sensitive_key" && i.key === "password",
    );
    expect(passwordIssue).toBeDefined();
    expect(passwordIssue.count).toBe(2);

    const tokenIssue = result.issues.find(
      (i: any) => i.type === "sensitive_key" && i.key === "token",
    );
    expect(tokenIssue).toBeDefined();
    expect(tokenIssue.count).toBe(1);
  });

  it("should detect sensitive keys case-insensitively", async () => {
    const adapter = createMockAdapter();
    adapter.executeReadQuery.mockResolvedValue({
      rows: [
        { json_data: '{"API_KEY": "abc123", "SSN": "111-22-3333"}' },
      ],
    });
    const tool = createJsonSecurityScanTool(adapter);
    const result = (await tool.handler(
      { table: "users", column: "data" },
      ctx,
    )) as any;
    expect(result.success).toBe(true);
    expect(result.issues).toBeDefined();
    expect(result.issues.length).toBeGreaterThanOrEqual(2);

    const apiKeyIssue = result.issues.find(
      (i: any) => i.type === "sensitive_key" && i.key === "API_KEY",
    );
    expect(apiKeyIssue).toBeDefined();

    const ssnIssue = result.issues.find(
      (i: any) => i.type === "sensitive_key" && i.key === "SSN",
    );
    expect(ssnIssue).toBeDefined();
  });

  it("should detect SQL injection patterns in values", async () => {
    const adapter = createMockAdapter();
    adapter.executeReadQuery.mockResolvedValue({
      rows: [
        {
          json_data:
            '{"query": "SELECT * FROM users WHERE id = 1; DROP TABLE users"}',
        },
      ],
    });
    const tool = createJsonSecurityScanTool(adapter);
    const result = (await tool.handler(
      { table: "data", column: "payload" },
      ctx,
    )) as any;
    expect(result.success).toBe(true);
    expect(result.issues).toBeDefined();

    const sqlIssue = result.issues.find(
      (i: any) => i.type === "sql_injection_pattern",
    );
    expect(sqlIssue).toBeDefined();
    expect(sqlIssue.key).toBe("query");
  });

  it("should detect XSS patterns in values", async () => {
    const adapter = createMockAdapter();
    adapter.executeReadQuery.mockResolvedValue({
      rows: [
        {
          json_data: '{"bio": "<script>alert(\\"xss\\")</script>"}',
        },
      ],
    });
    const tool = createJsonSecurityScanTool(adapter);
    const result = (await tool.handler(
      { table: "profiles", column: "data" },
      ctx,
    )) as any;
    expect(result.success).toBe(true);
    expect(result.issues).toBeDefined();

    const xssIssue = result.issues.find(
      (i: any) => i.type === "xss_pattern",
    );
    expect(xssIssue).toBeDefined();
    expect(xssIssue.key).toBe("bio");
  });

  it("should calculate risk levels correctly", async () => {
    const adapter = createMockAdapter();
    // 3+ issues → "high"
    adapter.executeReadQuery.mockResolvedValue({
      rows: [
        {
          json_data: JSON.stringify({
            password: "secret",
            token: "abc",
            ssn: "111-22-3333",
            query: "SELECT * FROM users",
          }),
        },
      ],
    });
    const tool = createJsonSecurityScanTool(adapter);
    const result = (await tool.handler(
      { table: "data", column: "doc" },
      ctx,
    )) as any;
    expect(result.success).toBe(true);
    expect(result.riskLevel).toBe("high");
    expect(result.issues.length).toBeGreaterThanOrEqual(3);
  });

  it("should return medium risk for 1-2 issues", async () => {
    const adapter = createMockAdapter();
    adapter.executeReadQuery.mockResolvedValue({
      rows: [{ json_data: '{"password": "secret", "name": "Alice"}' }],
    });
    const tool = createJsonSecurityScanTool(adapter);
    const result = (await tool.handler(
      { table: "users", column: "data" },
      ctx,
    )) as any;
    expect(result.success).toBe(true);
    expect(result.riskLevel).toBe("medium");
  });

  it("should handle empty table gracefully", async () => {
    const adapter = createMockAdapter();
    adapter.executeReadQuery.mockResolvedValue({ rows: [] });
    const tool = createJsonSecurityScanTool(adapter);
    const result = (await tool.handler(
      { table: "empty_table", column: "data" },
      ctx,
    )) as any;
    expect(result.success).toBe(true);
    expect(result.scannedRows).toBe(0);
    expect(result.riskLevel).toBe("low");
    expect(result.issues).toBeUndefined();
  });

  it("should skip NULL json_data rows", async () => {
    const adapter = createMockAdapter();
    adapter.executeReadQuery.mockResolvedValue({
      rows: [
        { json_data: null },
        { json_data: '{"name": "clean"}' },
      ],
    });
    const tool = createJsonSecurityScanTool(adapter);
    const result = (await tool.handler(
      { table: "data", column: "doc" },
      ctx,
    )) as any;
    expect(result.success).toBe(true);
    expect(result.scannedRows).toBe(2);
    expect(result.riskLevel).toBe("low");
  });

  it("should skip invalid JSON without crashing", async () => {
    const adapter = createMockAdapter();
    adapter.executeReadQuery.mockResolvedValue({
      rows: [
        { json_data: "not valid json" },
        { json_data: '{"name": "valid"}' },
      ],
    });
    const tool = createJsonSecurityScanTool(adapter);
    const result = (await tool.handler(
      { table: "data", column: "doc" },
      ctx,
    )) as any;
    expect(result.success).toBe(true);
    // Should not crash — unparseable rows are skipped
    expect(result.riskLevel).toBe("low");
  });

  it("should skip non-object JSON (arrays)", async () => {
    const adapter = createMockAdapter();
    adapter.executeReadQuery.mockResolvedValue({
      rows: [
        { json_data: '["password", "token"]' },
        { json_data: "42" },
        { json_data: '"just a string"' },
      ],
    });
    const tool = createJsonSecurityScanTool(adapter);
    const result = (await tool.handler(
      { table: "data", column: "doc" },
      ctx,
    )) as any;
    expect(result.success).toBe(true);
    // Arrays/primitives have no key-value pairs to scan
    expect(result.riskLevel).toBe("low");
  });

  it("should pass whereClause to the SQL query", async () => {
    const adapter = createMockAdapter();
    adapter.executeReadQuery.mockResolvedValue({ rows: [] });
    const tool = createJsonSecurityScanTool(adapter);
    await tool.handler(
      { table: "users", column: "data", whereClause: "active = 1" },
      ctx,
    );
    expect(adapter.executeReadQuery).toHaveBeenCalledWith(
      expect.stringContaining("active = 1"),
    );
  });

  it("should respect sampleSize parameter", async () => {
    const adapter = createMockAdapter();
    adapter.executeReadQuery.mockResolvedValue({ rows: [] });
    const tool = createJsonSecurityScanTool(adapter);
    await tool.handler(
      { table: "users", column: "data", sampleSize: 50 },
      ctx,
    );
    expect(adapter.executeReadQuery).toHaveBeenCalledWith(
      expect.stringContaining("LIMIT 50"),
    );
  });

  it("should return success: false on query error", async () => {
    const adapter = createMockAdapter();
    adapter.executeReadQuery.mockRejectedValue(new Error("table not found"));
    const tool = createJsonSecurityScanTool(adapter);
    const result = (await tool.handler(
      { table: "missing", column: "data" },
      ctx,
    )) as any;
    expect(result.success).toBe(false);
  });

  it("should return success: false on missing required params", async () => {
    const adapter = createMockAdapter();
    const tool = createJsonSecurityScanTool(adapter);
    const result = (await tool.handler({}, ctx)) as any;
    expect(result.success).toBe(false);
  });

  it("should only scan string values for injection/XSS", async () => {
    const adapter = createMockAdapter();
    // Numeric and boolean values should not be scanned for patterns
    adapter.executeReadQuery.mockResolvedValue({
      rows: [
        {
          json_data: JSON.stringify({
            count: 42,
            active: true,
            tags: ["safe"],
            nested: { key: "value" },
          }),
        },
      ],
    });
    const tool = createJsonSecurityScanTool(adapter);
    const result = (await tool.handler(
      { table: "data", column: "doc" },
      ctx,
    )) as any;
    expect(result.success).toBe(true);
    expect(result.riskLevel).toBe("low");
  });

  it("should detect multiple issue types in the same row", async () => {
    const adapter = createMockAdapter();
    adapter.executeReadQuery.mockResolvedValue({
      rows: [
        {
          json_data: JSON.stringify({
            password: "secret",
            bio: '<script>alert("xss")</script>',
            input: "SELECT * FROM admin WHERE 1=1",
          }),
        },
      ],
    });
    const tool = createJsonSecurityScanTool(adapter);
    const result = (await tool.handler(
      { table: "data", column: "doc" },
      ctx,
    )) as any;
    expect(result.success).toBe(true);
    expect(result.riskLevel).toBe("high");

    const types = result.issues.map((i: any) => i.type);
    expect(types).toContain("sensitive_key");
    expect(types).toContain("xss_pattern");
    expect(types).toContain("sql_injection_pattern");
  });
});
