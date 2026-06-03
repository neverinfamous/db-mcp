import { describe, it, expect, beforeEach } from "vitest";
import { MetricsRegistry } from "../metrics.js";

describe("MetricsRegistry", () => {
  let metrics: MetricsRegistry;

  beforeEach(() => {
    metrics = new MetricsRegistry();
  });

  it("should record tool calls and calculate percentiles correctly", () => {
    // Record 100 samples from 1 to 100 ms
    for (let i = 1; i <= 100; i++) {
      metrics.recordToolCall("test_tool", i, true, 10);
    }

    const summary = metrics.getSummary() as any;
    const toolSummary = summary.tools["test_tool"];

    expect(toolSummary).toBeDefined();
    expect(toolSummary.calls).toBe(100);
    expect(toolSummary.errors).toBe(0);
    expect(toolSummary.tokens).toBe(1000);

    // Percentiles for 1..100
    // p50 ~ 50, p95 ~ 95, p99 ~ 99
    expect(toolSummary.p50).toBeGreaterThanOrEqual(49);
    expect(toolSummary.p50).toBeLessThanOrEqual(51);

    expect(toolSummary.p95).toBeGreaterThanOrEqual(94);
    expect(toolSummary.p95).toBeLessThanOrEqual(96);

    expect(toolSummary.p99).toBeGreaterThanOrEqual(98);
    expect(toolSummary.p99).toBeLessThanOrEqual(100);
  });

  it("should format to prometheus exposition format", () => {
    metrics.recordToolCall("query", 50, true, 20);
    metrics.recordToolCall("query", 150, false, 20);
    metrics.recordResourceRead("sqlite://schema");

    const prom = metrics.toPrometheus();

    expect(prom).toContain('db_mcp_tool_calls_total{tool="query"} 2');
    expect(prom).toContain('db_mcp_tool_errors_total{tool="query"} 1');
    expect(prom).toContain('db_mcp_tool_tokens_total{tool="query"} 40');
    expect(prom).toContain(
      'db_mcp_resource_reads_total{resource="sqlite://schema"} 1',
    );
  });
});
