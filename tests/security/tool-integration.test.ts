/**
 * Security Integration Tests - Tool Handler Layer
 *
 * These tests verify that security utilities (validateWhereClause, sanitizeIdentifier)
 * are correctly integrated into tool handlers. Unlike the unit tests in
 * security-injection.test.ts, these tests call actual tool handlers with malicious
 * input to verify end-to-end security.
 *
 * Phase 1 of db-mcp Security Test Coverage Improvement Plan
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestAdapter, type TestAdapter } from "../utils/test-adapter.js";
import { UnsafeWhereClauseError } from "../../src/utils/index.js";

describe("Security: Tool Handler Integration", () => {
  let adapter: TestAdapter;
  let tools: Map<string, (params: unknown) => Promise<unknown>>;

  beforeEach(async () => {
    adapter = createTestAdapter();
    await adapter.connect({
      type: "sqlite",
      connectionString: ":memory:",
    });

    // Create test tables for security testing
    await adapter.executeWriteQuery(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY,
        name TEXT,
        email TEXT,
        age INTEGER,
        salary REAL
      )
    `);
    await adapter.executeWriteQuery(`
      INSERT INTO users (name, email, age, salary) VALUES
        ('Alice', 'alice@test.com', 30, 50000),
        ('Bob', 'bob@test.com', 25, 45000),
        ('Charlie', 'charlie@test.com', 35, 60000)
    `);

    // Location table for geo tests
    await adapter.executeWriteQuery(`
      CREATE TABLE locations (
        id INTEGER PRIMARY KEY,
        name TEXT,
        lat REAL,
        lon REAL
      )
    `);
    await adapter.executeWriteQuery(`
      INSERT INTO locations (name, lat, lon) VALUES
        ('NYC', 40.7128, -74.0060),
        ('LA', 34.0522, -118.2437)
    `);

    // Get tools as a map for easy access
    tools = new Map();
    const toolDefs = adapter.getToolDefinitions();
    const context = { scopes: ["read", "write", "admin"] };

    for (const tool of toolDefs) {
      tools.set(tool.name, (params) => tool.handler(params, context as never));
    }
  });

  afterEach(async () => {
    await adapter.disconnect();
  });

  // Helper to get a tool safely
  function getTool(name: string) {
    const tool = tools.get(name);
    if (!tool) {
      throw new Error(`Tool ${name} not found`);
    }
    return tool;
  }

  // Standard SQL injection payloads
  const injectionPayloads = [
    { name: "DROP injection", where: "1=1; DROP TABLE users--" },
    {
      name: "UNION injection",
      where: "1=1 UNION SELECT * FROM sqlite_master",
    },
    { name: "Comment bypass", where: "id = 1 -- AND admin = 0" },
    { name: "Block comment", where: "id = 1 /* bypass */ OR 1=1" },
    { name: "ATTACH injection", where: "1=1; ATTACH DATABASE '/tmp/x' AS x" },
    { name: "PRAGMA injection", where: "1=1; PRAGMA table_info(users)" },
  ];

  // ==========================================================================
  // Stats Tools - WHERE Clause Injection Tests
  // ==========================================================================

  describe("sqlite_stats_basic", () => {
    for (const payload of injectionPayloads) {
      it(`should reject ${payload.name}`, async () => {
        await expect(
          getTool("sqlite_stats_basic")({
            table: "users",
            column: "age",
            whereClause: payload.where,
          }),
        ).rejects.toThrow(UnsafeWhereClauseError);
      });
    }

    it("should allow legitimate WHERE clauses", async () => {
      const result = await getTool("sqlite_stats_basic")({
        table: "users",
        column: "age",
        whereClause: "age > 25",
      });
      expect(result).toHaveProperty("success", true);
    });
  });

  describe("sqlite_stats_count", () => {
    for (const payload of injectionPayloads) {
      it(`should reject ${payload.name}`, async () => {
        await expect(
          getTool("sqlite_stats_count")({
            table: "users",
            whereClause: payload.where,
          }),
        ).rejects.toThrow(UnsafeWhereClauseError);
      });
    }
  });

  describe("sqlite_stats_histogram", () => {
    for (const payload of injectionPayloads) {
      it(`should reject ${payload.name}`, async () => {
        await expect(
          getTool("sqlite_stats_histogram")({
            table: "users",
            column: "age",
            buckets: 5,
            whereClause: payload.where,
          }),
        ).rejects.toThrow(UnsafeWhereClauseError);
      });
    }
  });

  describe("sqlite_stats_outliers", () => {
    for (const payload of injectionPayloads) {
      it(`should reject ${payload.name}`, async () => {
        await expect(
          getTool("sqlite_stats_outliers")({
            table: "users",
            column: "salary",
            method: "iqr",
            whereClause: payload.where,
          }),
        ).rejects.toThrow(UnsafeWhereClauseError);
      });
    }
  });

  describe("sqlite_stats_correlation", () => {
    for (const payload of injectionPayloads) {
      it(`should reject ${payload.name}`, async () => {
        await expect(
          getTool("sqlite_stats_correlation")({
            table: "users",
            column1: "age",
            column2: "salary",
            whereClause: payload.where,
          }),
        ).rejects.toThrow(UnsafeWhereClauseError);
      });
    }
  });

  describe("sqlite_stats_percentile", () => {
    for (const payload of injectionPayloads) {
      it(`should reject ${payload.name}`, async () => {
        await expect(
          getTool("sqlite_stats_percentile")({
            table: "users",
            column: "salary",
            percentiles: [25, 50, 75], // Correct schema: array of percentiles
            whereClause: payload.where,
          }),
        ).rejects.toThrow(UnsafeWhereClauseError);
      });
    }
  });

  describe("sqlite_stats_top_n", () => {
    for (const payload of injectionPayloads) {
      it(`should reject ${payload.name}`, async () => {
        await expect(
          getTool("sqlite_stats_top_n")({
            table: "users",
            column: "salary",
            n: 5,
            whereClause: payload.where,
          }),
        ).rejects.toThrow(UnsafeWhereClauseError);
      });
    }
  });

  describe("sqlite_stats_distinct", () => {
    for (const payload of injectionPayloads) {
      it(`should reject ${payload.name}`, async () => {
        await expect(
          getTool("sqlite_stats_distinct")({
            table: "users",
            column: "name",
            whereClause: payload.where,
          }),
        ).rejects.toThrow(UnsafeWhereClauseError);
      });
    }
  });

  describe("sqlite_stats_frequency", () => {
    for (const payload of injectionPayloads) {
      it(`should reject ${payload.name}`, async () => {
        await expect(
          getTool("sqlite_stats_frequency")({
            table: "users",
            column: "name",
            whereClause: payload.where,
          }),
        ).rejects.toThrow(UnsafeWhereClauseError);
      });
    }
  });

  // ==========================================================================
  // Geo Tools - WHERE Clause Injection Tests
  // ==========================================================================

  describe("sqlite_geo_cluster", () => {
    for (const payload of injectionPayloads) {
      it(`should reject ${payload.name}`, async () => {
        await expect(
          getTool("sqlite_geo_cluster")({
            table: "locations",
            latColumn: "lat",
            lonColumn: "lon",
            whereClause: payload.where,
          }),
        ).rejects.toThrow(UnsafeWhereClauseError);
      });
    }

    it("should allow legitimate WHERE clauses", async () => {
      const result = await getTool("sqlite_geo_cluster")({
        table: "locations",
        latColumn: "lat",
        lonColumn: "lon",
        whereClause: "lat > 30",
      });
      expect(result).toHaveProperty("success", true);
    });
  });

  // ==========================================================================
  // Edge Cases and Bypass Attempts
  // ==========================================================================

  describe("bypass attempt resistance", () => {
    it("should reject case variations", async () => {
      await expect(
        getTool("sqlite_stats_basic")({
          table: "users",
          column: "age",
          whereClause: "1=1 UnIoN sElEcT * FROM sqlite_master",
        }),
      ).rejects.toThrow(UnsafeWhereClauseError);
    });

    it("should reject whitespace obfuscation", async () => {
      await expect(
        getTool("sqlite_stats_basic")({
          table: "users",
          column: "age",
          whereClause: "1=1;\t\nDROP\t\nTABLE\tusers",
        }),
      ).rejects.toThrow(UnsafeWhereClauseError);
    });

    it("should reject null byte injection", async () => {
      await expect(
        getTool("sqlite_stats_basic")({
          table: "users",
          column: "age",
          whereClause: "1=1\x00; DROP TABLE users",
        }),
      ).rejects.toThrow(); // May throw different error types
    });

    it("should allow complex but safe WHERE clauses", async () => {
      const result = await getTool("sqlite_stats_basic")({
        table: "users",
        column: "age",
        whereClause:
          "(age > 20 AND age < 40) OR (salary > 50000 AND name LIKE '%a%')",
      });
      expect(result).toHaveProperty("success", true);
    });
  });
});
