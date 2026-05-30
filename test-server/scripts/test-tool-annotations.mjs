/**
 * Integration Test: Tool Annotations
 *
 * Comprehensive validation of MCP tool annotations across all db-mcp tools.
 * Validates annotation presence, field coverage, logical consistency,
 * and correctness of behavioral hints.
 *
 * Checks:
 *   1. Tool count matches expected total
 *   2. All tools have an annotations object
 *   3. All tools have explicit openWorldHint
 *   4. openWorldHint=true matches an exact allowlist (FS/code tools only)
 *   5. All tools have explicit readOnlyHint
 *   6. All tools have explicit destructiveHint
 *   7. No tools have readOnlyHint=true AND destructiveHint=true (contradiction)
 *   8. All tools have explicit sensitiveHint or are audit/built-in
 *   9. All tools have a title string
 *  10. Read-only tools ideally have idempotentHint=true (advisory)
 *
 * Usage:
 *   npm run build
 *   node test-server/scripts/test-tool-annotations.mjs
 */

import { spawn } from "child_process";

// =============================================================================
// Configuration
// =============================================================================

const projectDir = "C:\\Users\\chris\\Desktop\\db-mcp";

/** Expected total tool count: 171 inventory (166 group + 5 audit) + 4 built-in */
const EXPECTED_TOOL_COUNT = 175;

/**
 * Tools registered directly via SDK's registerTool() cannot carry sensitiveHint
 * because the SDK's ToolAnnotations type doesn't include it. Only our custom
 * ToolDefinition type supports sensitiveHint.
 */
const SDK_REGISTERED_TOOLS = new Set([
  // Built-in tools (src/server/registration/built-in-tools.ts)
  "server_info",
  "server_health",
  "list_adapters",
  // Audit tools (src/server/registration/audit-tools.ts)
  "sqlite_audit_list_backups",
  "sqlite_audit_get_backup",
  "sqlite_audit_cleanup",
  "sqlite_audit_diff_backup",
  "sqlite_audit_restore_backup",
]);

/**
 * Exact allowlist of tools that legitimately need openWorldHint=true.
 * These tools interact with the filesystem or execute arbitrary code
 * that can reach the filesystem.
 */
const OPEN_WORLD_ALLOWLIST = new Set([
  // Admin FS tools — read/write files on the filesystem
  "sqlite_create_csv_table", // Reads CSV file from filesystem
  "sqlite_analyze_csv_schema", // Reads CSV file from filesystem
  "sqlite_backup", // Writes database file to filesystem
  "sqlite_restore", // Reads backup file from filesystem
  "sqlite_verify_backup", // Reads backup file for integrity check
  "sqlite_attach_database", // Opens external DB file from filesystem
  "sqlite_vacuum_into", // Writes compacted copy to filesystem
  "sqlite_dump", // Writes SQL text dump to filesystem
  // Code Mode — can invoke any tool including FS tools
  "sqlite_execute_code", // Sandboxed JS execution with full API access
  // SpatiaLite — imports data from external files
  "sqlite_spatialite_import", // Imports geometry from WKT/GeoJSON file
]);

// =============================================================================
// Result Tracking
// =============================================================================

const results = [];
const warnings = [];

function pass(label, detail) {
  results.push({ status: "pass", label, detail });
}

function fail(label, detail) {
  results.push({ status: "fail", label, detail });
}

function warn(label, detail) {
  warnings.push({ label, detail });
}

// =============================================================================
// Validation Logic
// =============================================================================

function validateAnnotations(tools) {
  console.log(`Total tools: ${tools.length}\n`);

  // ── 1. Tool count ──
  if (tools.length === EXPECTED_TOOL_COUNT) {
    pass("Tool count", `${tools.length} (expected ${EXPECTED_TOOL_COUNT})`);
  } else {
    fail("Tool count", `${tools.length} (expected ${EXPECTED_TOOL_COUNT})`);
  }

  // ── Collect per-field stats ──
  const stats = {
    hasAnnotations: 0,
    hasOpenWorldHint: 0,
    hasReadOnlyHint: 0,
    hasDestructiveHint: 0,
    hasSensitiveHint: 0,
    hasIdempotentHint: 0,
    hasTitle: 0,
    openWorldTrue: [],
    openWorldFalse: 0,
    readOnlyTrue: [],
    destructiveTrue: [],
    sensitiveTrue: [],
    contradictions: [], // readOnly + destructive
    missingAnnotations: [],
    missingOpenWorld: [],
    missingReadOnly: [],
    missingDestructive: [],
    missingSensitive: [],
    missingTitle: [],
    readOnlyMissingIdempotent: [],
  };

  for (const tool of tools) {
    const a = tool.annotations;

    if (!a) {
      stats.missingAnnotations.push(tool.name);
      continue;
    }

    stats.hasAnnotations++;

    // openWorldHint
    if (typeof a.openWorldHint === "boolean") {
      stats.hasOpenWorldHint++;
      if (a.openWorldHint) {
        stats.openWorldTrue.push(tool.name);
      } else {
        stats.openWorldFalse++;
      }
    } else {
      stats.missingOpenWorld.push(tool.name);
    }

    // readOnlyHint
    if (typeof a.readOnlyHint === "boolean") {
      stats.hasReadOnlyHint++;
      if (a.readOnlyHint) {
        stats.readOnlyTrue.push(tool.name);
      }
    } else {
      stats.missingReadOnly.push(tool.name);
    }

    // destructiveHint
    if (typeof a.destructiveHint === "boolean") {
      stats.hasDestructiveHint++;
      if (a.destructiveHint) {
        stats.destructiveTrue.push(tool.name);
      }
    } else {
      stats.missingDestructive.push(tool.name);
    }

    // sensitiveHint
    if (typeof a.sensitiveHint === "boolean") {
      stats.hasSensitiveHint++;
      if (a.sensitiveHint) {
        stats.sensitiveTrue.push(tool.name);
      }
    } else {
      stats.missingSensitive.push(tool.name);
    }

    // idempotentHint
    if (typeof a.idempotentHint === "boolean") {
      stats.hasIdempotentHint++;
    }

    // title — check both tool.title (SDK top-level) and annotations.title (helper pattern)
    const topTitle = typeof tool.title === "string" && tool.title.length > 0;
    const annotTitle = typeof a.title === "string" && a.title.length > 0;
    if (topTitle || annotTitle) {
      stats.hasTitle++;
    } else {
      stats.missingTitle.push(tool.name);
    }

    // Contradiction check: readOnly + destructive
    if (a.readOnlyHint === true && a.destructiveHint === true) {
      stats.contradictions.push(tool.name);
    }

    // Advisory: read-only tools should have idempotentHint=true
    if (a.readOnlyHint === true && a.idempotentHint !== true) {
      stats.readOnlyMissingIdempotent.push(tool.name);
    }
  }

  // ── 2. All tools have annotations ──
  if (stats.hasAnnotations === tools.length) {
    pass(
      "All tools have annotations",
      `${stats.hasAnnotations}/${tools.length}`,
    );
  } else {
    fail(
      "All tools have annotations",
      `${stats.hasAnnotations}/${tools.length} — missing: ${stats.missingAnnotations.join(", ")}`,
    );
  }

  // ── 3. All tools have explicit openWorldHint ──
  if (stats.missingOpenWorld.length === 0) {
    pass("openWorldHint coverage", `${stats.hasOpenWorldHint}/${tools.length}`);
  } else {
    fail(
      "openWorldHint coverage",
      `missing on: ${stats.missingOpenWorld.join(", ")}`,
    );
  }

  // ── 4. openWorldHint=true matches exact allowlist ──
  const actualSet = new Set(stats.openWorldTrue);
  const unexpected = stats.openWorldTrue.filter(
    (name) => !OPEN_WORLD_ALLOWLIST.has(name),
  );
  const missing = [...OPEN_WORLD_ALLOWLIST].filter(
    (name) => !actualSet.has(name),
  );

  if (unexpected.length === 0 && missing.length === 0) {
    pass(
      "openWorldHint allowlist",
      `${stats.openWorldTrue.length} tools match (${stats.openWorldFalse} local)`,
    );
  } else {
    const parts = [];
    if (unexpected.length > 0) {
      parts.push(`unexpected true: ${unexpected.join(", ")}`);
    }
    if (missing.length > 0) {
      parts.push(`expected true but false/missing: ${missing.join(", ")}`);
    }
    fail("openWorldHint allowlist", parts.join(" | "));
  }

  // ── 5. All tools have explicit readOnlyHint ──
  if (stats.missingReadOnly.length === 0) {
    pass("readOnlyHint coverage", `${stats.hasReadOnlyHint}/${tools.length}`);
  } else {
    fail(
      "readOnlyHint coverage",
      `missing on: ${stats.missingReadOnly.join(", ")}`,
    );
  }

  // ── 6. All tools have explicit destructiveHint ──
  if (stats.missingDestructive.length === 0) {
    pass(
      "destructiveHint coverage",
      `${stats.hasDestructiveHint}/${tools.length}`,
    );
  } else {
    fail(
      "destructiveHint coverage",
      `missing on: ${stats.missingDestructive.join(", ")}`,
    );
  }

  // ── 7. No readOnly+destructive contradictions ──
  if (stats.contradictions.length === 0) {
    pass("No readOnly+destructive contradictions", "0 violations");
  } else {
    fail(
      "No readOnly+destructive contradictions",
      `contradictions: ${stats.contradictions.join(", ")}`,
    );
  }

  // ── 8. sensitiveHint coverage ──
  // SDK-registered tools (built-in + audit) can't carry sensitiveHint because
  // the SDK's ToolAnnotations type doesn't include it. Only flag non-SDK tools.
  const sensitiveMissingNonSdk = stats.missingSensitive.filter(
    (name) => !SDK_REGISTERED_TOOLS.has(name),
  );
  if (sensitiveMissingNonSdk.length === 0) {
    pass(
      "sensitiveHint coverage",
      `${stats.hasSensitiveHint}/${tools.length} (${stats.missingSensitive.length} SDK-registered excluded)`,
    );
  } else {
    fail(
      "sensitiveHint coverage",
      `missing on non-SDK tools: ${sensitiveMissingNonSdk.join(", ")}`,
    );
  }
  if (stats.missingSensitive.length > 0) {
    warn(
      "sensitiveHint missing on SDK-registered tools",
      `${stats.missingSensitive.join(", ")} (SDK ToolAnnotations type lacks sensitiveHint)`,
    );
  }

  // ── 9. All tools have a title ──
  if (stats.missingTitle.length === 0) {
    pass("title coverage", `${stats.hasTitle}/${tools.length}`);
  } else {
    fail("title coverage", `missing on: ${stats.missingTitle.join(", ")}`);
  }

  // ── 10. Advisory: read-only tools should have idempotentHint=true ──
  if (stats.readOnlyMissingIdempotent.length > 0) {
    warn(
      "Read-only tools missing idempotentHint=true",
      stats.readOnlyMissingIdempotent.join(", "),
    );
  }

  // ── Summary ──
  console.log("┌──────────────────────────────────────────────────────────┐");
  console.log("│                  ANNOTATION AUDIT RESULTS               │");
  console.log("├──────────────────────────────────────────────────────────┤");

  const hasFailure = results.some((r) => r.status === "fail");

  for (const r of results) {
    const icon = r.status === "pass" ? "✅" : "❌";
    console.log(`│ ${icon} ${r.label}`);
    console.log(`│    ${r.detail}`);
  }

  if (warnings.length > 0) {
    console.log("├──────────────────────────────────────────────────────────┤");
    console.log("│ ⚠️  ADVISORY WARNINGS (non-blocking)                    │");
    for (const w of warnings) {
      console.log(`│ ⚠️  ${w.label}`);
      console.log(`│    ${w.detail}`);
    }
  }

  console.log("├──────────────────────────────────────────────────────────┤");
  console.log("│ FIELD COVERAGE SUMMARY                                  │");
  console.log(
    `│   openWorldHint:   ${pct(stats.hasOpenWorldHint, tools.length)}`,
  );
  console.log(
    `│   readOnlyHint:    ${pct(stats.hasReadOnlyHint, tools.length)}`,
  );
  console.log(
    `│   destructiveHint: ${pct(stats.hasDestructiveHint, tools.length)}`,
  );
  console.log(
    `│   sensitiveHint:   ${pct(stats.hasSensitiveHint, tools.length)}`,
  );
  console.log(
    `│   idempotentHint:  ${pct(stats.hasIdempotentHint, tools.length)} (optional)`,
  );
  console.log(`│   title:           ${pct(stats.hasTitle, tools.length)}`);
  console.log("├──────────────────────────────────────────────────────────┤");
  console.log(
    `│ BREAKDOWN: readOnlyHint=true: ${stats.readOnlyTrue.length} | destructiveHint=true: ${stats.destructiveTrue.length} | sensitiveHint=true: ${stats.sensitiveTrue.length}`,
  );
  console.log(
    `│ BREAKDOWN: openWorldHint=true: ${stats.openWorldTrue.length} (${stats.openWorldTrue.join(", ")})`,
  );
  console.log("├──────────────────────────────────────────────────────────┤");

  const verdict = hasFailure ? "❌ FAIL" : "✅ PASS";
  console.log(`│ VERDICT: ${verdict}`);
  console.log("└──────────────────────────────────────────────────────────┘");

  return hasFailure ? 1 : 0;
}

function pct(count, total) {
  const p = total > 0 ? ((count / total) * 100).toFixed(1) : "0.0";
  return `${count}/${total} (${p}%)`;
}

// =============================================================================
// Server Communication (JSON-RPC over stdio)
// =============================================================================

const proc = spawn(
  "node",
  [
    "dist/cli.js",
    "--instruction-level",
    "essential",
    "--sqlite-native",
    "./test-server/test.db",
    "--tool-filter",
    "+all",
    "--audit-log",
    "stderr",
    "--audit-backup",
  ],
  {
    cwd: projectDir,
    stdio: ["pipe", "pipe", "pipe"],
  },
);

let buffer = "";
let finished = false;

proc.stdout.on("data", (chunk) => {
  buffer += chunk.toString();

  const lines = buffer.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const msg = JSON.parse(trimmed);
      if (msg.id === 1) {
        // Initialize response — skip
      } else if (msg.id === 2) {
        // tools/list response
        const tools = msg.result?.tools || [];
        const exitCode = validateAnnotations(tools);

        finished = true;
        proc.kill();
        process.exit(exitCode);
      }
    } catch {
      // Not complete JSON yet
    }
  }
});

proc.stderr.on("data", () => {});

// Send initialize
proc.stdin.write(
  JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2025-03-26",
      capabilities: {},
      clientInfo: { name: "test", version: "1.0" },
    },
  }) + "\n",
);

// Wait, then send initialized + tools/list
setTimeout(() => {
  proc.stdin.write(
    JSON.stringify({
      jsonrpc: "2.0",
      method: "notifications/initialized",
    }) + "\n",
  );

  setTimeout(() => {
    proc.stdin.write(
      JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/list",
        params: {},
      }) + "\n",
    );
  }, 500);
}, 1500);

setTimeout(() => {
  if (!finished) {
    console.log("Timeout — killing process");
    proc.kill();
    process.exit(1);
  }
}, 15000);
