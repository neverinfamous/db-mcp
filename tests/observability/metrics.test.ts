import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { MetricsRegistry } from "../../src/observability/metrics.js";
import { SystemDb } from "../../src/observability/system-db.js";

describe("Observability & Metrics", () => {
  let metrics: MetricsRegistry;
  let systemDb: SystemDb;

  beforeEach(async () => {
    metrics = new MetricsRegistry();
    systemDb = new SystemDb({ dbPath: ":memory:" });
    await systemDb.init();
  });

  afterEach(() => {
    metrics.close();
    systemDb.close();
  });

  describe("MetricsRegistry Core", () => {
    it("should correctly aggregate tool call metrics (calls, errors, tokens)", () => {
      metrics.recordToolCall("sqlite_test_tool", 100, true, 50);
      metrics.recordToolCall("sqlite_test_tool", 200, false, 20); // error
      metrics.recordToolCall("sqlite_test_tool", 150, true, 10);
      
      const summary = metrics.getSummary();
      const toolMetrics = (summary.tools as any)["sqlite_test_tool"];
      
      expect(toolMetrics).toBeDefined();
      expect(toolMetrics.calls).toBe(3);
      expect(toolMetrics.errors).toBe(1);
      expect(toolMetrics.tokens).toBe(80);
    });

    it("should correctly estimate latency percentiles (p50, p95, p99)", () => {
      // Record 100 samples from 1 to 100 ms
      for (let i = 1; i <= 100; i++) {
        metrics.recordToolCall("latency_tool", i, true, 0);
      }
      
      const summary = metrics.getSummary();
      const toolMetrics = (summary.tools as any)["latency_tool"];
      
      expect(toolMetrics.p50).toBe(51); // Midpoint
      // Due to array indexing and rounding (idx = 99 * 0.95 = 94.05) -> val is ~95
      expect(toolMetrics.p95).toBeGreaterThanOrEqual(95);
      expect(toolMetrics.p99).toBeGreaterThanOrEqual(99);
    });

    it("should correctly record resource reads", () => {
      metrics.recordResourceRead("sqlite://schema");
      metrics.recordResourceRead("sqlite://schema");
      metrics.recordResourceRead("sqlite://health");
      
      const summary = metrics.getSummary();
      const schemaMetrics = (summary.resources as any)["sqlite://schema"];
      const healthMetrics = (summary.resources as any)["sqlite://health"];
      
      expect(schemaMetrics.reads).toBe(2);
      expect(healthMetrics.reads).toBe(1);
    });
  });

  describe("Prometheus Export", () => {
    it("should generate valid Prometheus exposition format", () => {
      metrics.recordToolCall("sqlite_test_tool", 150, true, 10);
      metrics.recordResourceRead("sqlite://schema");
      
      const promOutput = metrics.toPrometheus();
      
      // Check Tool metrics
      expect(promOutput).toContain('db_mcp_tool_calls_total{tool="sqlite_test_tool"} 1');
      expect(promOutput).toContain('db_mcp_tool_errors_total{tool="sqlite_test_tool"} 0');
      expect(promOutput).toContain('db_mcp_tool_latency_ms_p50{tool="sqlite_test_tool"} 150');
      
      // Check Resource metrics
      expect(promOutput).toContain('db_mcp_resource_reads_total{resource="sqlite://schema"} 1');
    });
  });

  describe("SystemDb Persistence", () => {
    it("should flush metrics snapshots to the SystemDb", () => {
      metrics.setSystemDb(systemDb); // Wires it up
      
      // Record some data
      metrics.recordToolCall("persisted_tool", 100, true, 50);
      
      // Force flush
      (metrics as any).flushToDb();
      
      const db = systemDb.getDb();
      const rows = db.prepare("SELECT * FROM metrics_snapshots WHERE tool = ?").all("persisted_tool") as any[];
      
      expect(rows.length).toBe(1);
      expect(rows[0].calls).toBe(1);
      expect(rows[0].tokens).toBe(50);
      expect(rows[0].p50).toBe(100);
    });

    it("should restore historical counters upon initialization", () => {
      // Pre-seed the database
      const db = systemDb.getDb();
      db.prepare(`
        INSERT INTO metrics_snapshots (timestamp, tool, calls, errors, p50, p95, p99, tokens)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(new Date().toISOString(), "historical_tool", 50, 5, 100, 200, 300, 1000);
      
      // Init a new metrics registry with this DB
      const newMetrics = new MetricsRegistry();
      newMetrics.setSystemDb(systemDb);
      
      const summary = newMetrics.getSummary();
      const toolMetrics = (summary.tools as any)["historical_tool"];
      
      expect(toolMetrics).toBeDefined();
      expect(toolMetrics.calls).toBe(50);
      expect(toolMetrics.errors).toBe(5);
      expect(toolMetrics.tokens).toBe(1000);
      
      newMetrics.close();
    });
  });
});
