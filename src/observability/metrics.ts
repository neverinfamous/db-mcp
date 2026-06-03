/**
 * db-mcp — Observability Metrics
 *
 * In-memory streaming metrics aggregator for tools and resources.
 * Uses a zero-dependency circular buffer to estimate latency percentiles
 * (p50, p95, p99) without memory bloat.
 */

import type { SystemDb } from "./system-db.js";
import { logger } from "../utils/logger/index.js";

const MAX_SAMPLES = 1000;

export interface MetricSummary {
  calls: number;
  errors: number;
  tokens: number;
  p50: number;
  p95: number;
  p99: number;
}

export interface ResourceMetricSummary {
  reads: number;
}

class ToolMetric {
  public calls = 0;
  public errors = 0;
  public tokens = 0;

  // Circular buffer for latency samples
  private samples: number[] = new Array<number>(MAX_SAMPLES).fill(0);
  private sampleIndex = 0;
  private sampleCount = 0;

  record(durationMs: number, success: boolean, tokens = 0): void {
    this.calls++;
    if (!success) this.errors++;
    this.tokens += tokens;

    this.samples[this.sampleIndex] = durationMs;
    this.sampleIndex = (this.sampleIndex + 1) % MAX_SAMPLES;
    if (this.sampleCount < MAX_SAMPLES) {
      this.sampleCount++;
    }
  }

  getSummary(): MetricSummary {
    if (this.sampleCount === 0) {
      return {
        calls: this.calls,
        errors: this.errors,
        tokens: this.tokens,
        p50: 0,
        p95: 0,
        p99: 0,
      };
    }

    // Sort active samples to calculate percentiles
    const activeSamples = this.samples
      .slice(0, this.sampleCount)
      .sort((a, b) => a - b);

    return {
      calls: this.calls,
      errors: this.errors,
      tokens: this.tokens,
      p50: this.getPercentile(activeSamples, 0.5),
      p95: this.getPercentile(activeSamples, 0.95),
      p99: this.getPercentile(activeSamples, 0.99),
    };
  }

  private getPercentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    const idx = (sorted.length - 1) * p;
    const base = Math.floor(idx);
    const rest = idx - base;
    const v0 = sorted[base] ?? 0;
    const v1 = sorted[base + 1];

    if (v1 !== undefined) {
      return Math.round(v0 + rest * (v1 - v0));
    } else {
      return v0;
    }
  }
}

class ResourceMetric {
  public reads = 0;

  record(): void {
    this.reads++;
  }

  getSummary(): ResourceMetricSummary {
    return { reads: this.reads };
  }
}

export class MetricsRegistry {
  private tools = new Map<string, ToolMetric>();
  private resources = new Map<string, ResourceMetric>();
  private systemDb: SystemDb | null = null;
  private flushTimer: ReturnType<typeof setInterval> | null = null;

  setSystemDb(systemDb: SystemDb): void {
    this.systemDb = systemDb;
    this.loadHistorical();
    this.startFlushTimer();
  }

  private loadHistorical(): void {
    if (!this.systemDb) return;
    try {
      const db = this.systemDb.getDb();
      // Load latest snapshots for each tool to initialize counters
      const rows = db
        .prepare(
          `
        SELECT tool, MAX(calls) as max_calls, MAX(errors) as max_errors, MAX(tokens) as max_tokens
        FROM metrics_snapshots
        GROUP BY tool
      `,
        )
        .all() as {
        tool: string;
        max_calls: number;
        max_errors: number;
        max_tokens: number;
      }[];

      for (const row of rows) {
        const metric = new ToolMetric();
        metric.calls = row.max_calls;
        metric.errors = row.max_errors;
        metric.tokens = row.max_tokens;
        this.tools.set(row.tool, metric);
      }
      logger.info(`Loaded historical metrics for ${rows.length} tools`, {
        module: "METRICS",
      });
    } catch (err) {
      logger.warning("Failed to load historical metrics", {
        module: "METRICS",
        error: err instanceof Error ? err : new Error(String(err)),
      });
    }
  }

  private startFlushTimer(): void {
    if (this.flushTimer) clearInterval(this.flushTimer);
    // Flush metrics every 5 minutes
    this.flushTimer = setInterval(
      () => {
        this.flushToDb();
      },
      5 * 60 * 1000,
    );
    this.flushTimer.unref();
  }

  private flushToDb(): void {
    if (!this.systemDb) return;
    try {
      const db = this.systemDb.getDb();
      const stmt = db.prepare(`
        INSERT INTO metrics_snapshots (timestamp, tool, calls, errors, p50, p95, p99, tokens)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const timestamp = new Date().toISOString();
      const transaction = db.transaction(() => {
        for (const [name, metric] of this.tools.entries()) {
          const summary = metric.getSummary();
          stmt.run(
            timestamp,
            name,
            summary.calls,
            summary.errors,
            summary.p50,
            summary.p95,
            summary.p99,
            summary.tokens,
          );
        }
      });
      transaction();
    } catch (err) {
      logger.warning("Failed to flush metrics to db", {
        module: "METRICS",
        error: err instanceof Error ? err : new Error(String(err)),
      });
    }
  }

  close(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    this.flushToDb();
  }

  recordToolCall(
    toolName: string,
    durationMs: number,
    success: boolean,
    tokens = 0,
  ): void {
    let metric = this.tools.get(toolName);
    if (!metric) {
      metric = new ToolMetric();
      this.tools.set(toolName, metric);
    }
    metric.record(durationMs, success, tokens);
  }

  recordResourceRead(uri: string): void {
    let metric = this.resources.get(uri);
    if (!metric) {
      metric = new ResourceMetric();
      this.resources.set(uri, metric);
    }
    metric.record();
  }

  getSummary(): Record<string, unknown> {
    const toolsSummary: Record<string, MetricSummary> = {};
    for (const [name, metric] of this.tools.entries()) {
      toolsSummary[name] = metric.getSummary();
    }

    const resourcesSummary: Record<string, ResourceMetricSummary> = {};
    for (const [uri, metric] of this.resources.entries()) {
      resourcesSummary[uri] = metric.getSummary();
    }

    return {
      tools: toolsSummary,
      resources: resourcesSummary,
      timestamp: new Date().toISOString(),
    };
  }

  toPrometheus(): string {
    const lines: string[] = [];

    // Tools
    lines.push("# HELP db_mcp_tool_calls_total Total tool calls");
    lines.push("# TYPE db_mcp_tool_calls_total counter");
    lines.push("# HELP db_mcp_tool_errors_total Total tool errors");
    lines.push("# TYPE db_mcp_tool_errors_total counter");
    lines.push("# HELP db_mcp_tool_tokens_total Total tokens estimated");
    lines.push("# TYPE db_mcp_tool_tokens_total counter");
    lines.push("# HELP db_mcp_tool_latency_ms_p50 P50 Latency (ms)");
    lines.push("# TYPE db_mcp_tool_latency_ms_p50 gauge");
    lines.push("# HELP db_mcp_tool_latency_ms_p95 P95 Latency (ms)");
    lines.push("# TYPE db_mcp_tool_latency_ms_p95 gauge");
    lines.push("# HELP db_mcp_tool_latency_ms_p99 P99 Latency (ms)");
    lines.push("# TYPE db_mcp_tool_latency_ms_p99 gauge");

    for (const [name, metric] of this.tools.entries()) {
      const summary = metric.getSummary();
      const labels = `{tool="${name}"}`;
      lines.push(`db_mcp_tool_calls_total${labels} ${summary.calls}`);
      lines.push(`db_mcp_tool_errors_total${labels} ${summary.errors}`);
      lines.push(`db_mcp_tool_tokens_total${labels} ${summary.tokens}`);
      lines.push(`db_mcp_tool_latency_ms_p50${labels} ${summary.p50}`);
      lines.push(`db_mcp_tool_latency_ms_p95${labels} ${summary.p95}`);
      lines.push(`db_mcp_tool_latency_ms_p99${labels} ${summary.p99}`);
    }

    // Resources
    lines.push("# HELP db_mcp_resource_reads_total Total resource reads");
    lines.push("# TYPE db_mcp_resource_reads_total counter");

    for (const [uri, metric] of this.resources.entries()) {
      const summary = metric.getSummary();
      const labels = `{resource="${uri}"}`;
      lines.push(`db_mcp_resource_reads_total${labels} ${summary.reads}`);
    }

    return lines.join("\n") + "\n";
  }
}

// Global singleton
export const metrics = new MetricsRegistry();
