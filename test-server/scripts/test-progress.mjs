import { spawn } from "child_process";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectDir = resolve(__dirname, "../..");

const cleanEnv = { ...process.env };
delete cleanEnv.DB_ENCRYPTION_KEY;
cleanEnv.ALLOWED_IO_ROOTS = projectDir;

const proc = spawn(
  "node",
  [
    "dist/cli.js",
    "--sqlite-native",
    "./test-server/test.db",
    "--log-level",
    "error",
  ],
  {
    cwd: projectDir,
    stdio: ["pipe", "pipe", "pipe"],
    env: cleanEnv,
  },
);

let buffer = "";
const pending = new Map(); // id -> resolve
const progressEvents = [];

proc.stdout.on("data", (chunk) => {
  buffer += chunk.toString();
  const lines = buffer.split("\n");
  buffer = lines.pop(); // keep incomplete
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const msg = JSON.parse(trimmed);

      // Handle notifications
      if (msg.method === "notifications/progress") {
        const isStream = msg.params.progressToken === "test-token-sqlite_read_query";
        const prefix = isStream ? "[STREAM] Chunk" : "[PROGRESS] Step";
        console.log(
          `${prefix} ${msg.params.progress} of ${msg.params.total || "?"}`,
        );
        progressEvents.push(msg.params);
      }

      // Handle RPC responses
      if (msg.id && pending.has(msg.id)) {
        pending.get(msg.id)(msg);
        pending.delete(msg.id);
      }
    } catch {}
  }
});

proc.stderr.on("data", () => {});

let nextId = 1;
function rpc(method, params = {}) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`Timeout: ${method}`));
    }, 10000);
    pending.set(id, (msg) => {
      clearTimeout(timer);
      resolve(msg);
    });
    proc.stdin.write(
      JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n",
    );
  });
}

function notify(method, params = {}) {
  proc.stdin.write(JSON.stringify({ jsonrpc: "2.0", method, params }) + "\n");
}

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

async function runTest(toolName, args, expectedMinEvents = 1) {
  console.log(`\nTesting tool: ${toolName}...`);
  progressEvents.length = 0; // Reset array

  const response = await rpc("tools/call", {
    name: toolName,
    arguments: args,
    _meta: { progressToken: `test-token-${toolName}` },
  });

  if (response.error) {
    console.error(`  FAIL: Tool returned error:`, response.error);
    return false;
  }

  if (response.result?.isError) {
    console.error(`  FAIL: Tool returned business error:`, response.result);
    return false;
  }

  if (progressEvents.length >= expectedMinEvents) {
    if (toolName === "sqlite_read_query") {
      console.log(
        `  PASS: Received ${progressEvents.length} streaming chunks via progress notifications!`,
      );
    } else {
      console.log(
        `  PASS: Received ${progressEvents.length} progress notifications!`,
      );
    }
    return true;
  } else {
    console.error(
      `  FAIL: Expected at least ${expectedMinEvents} progress notifications, got ${progressEvents.length}`,
    );
    return false;
  }
}

async function main() {
  console.log("Initializing MCP Server...");
  await rpc("initialize", {
    protocolVersion: "2025-03-26",
    capabilities: {},
    clientInfo: { name: "test-progress", version: "1.0" },
  });
  await delay(500);
  notify("notifications/initialized");
  await delay(1000);

  // Initialize migrations so apply doesn't fail
  await rpc("tools/call", { name: "sqlite_migration_init", arguments: {} });

  const code = `
    function sleepMs(ms) {
      const start = Date.now();
      while (Date.now() - start < ms) {}
    }
    if (typeof sqlite.reportProgress === 'function') {
      for (let i = 1; i <= 5; i++) {
        await sqlite.reportProgress(i, 5, "Step " + i);
        sleepMs(100);
      }
      return "Success";
    }
    throw new Error("Missing reportProgress");
  `;

  const ts = Date.now();

  const tests = [
    { name: "sqlite_vacuum", args: {} },
    { name: "sqlite_backup", args: { targetPath: "./test-server/backup.db" } },
    { name: "sqlite_restore", args: { sourcePath: "./test-server/backup.db" } },
    { name: "sqlite_dump", args: { outputPath: "./test-server/dump.sql" } },
    { name: "sqlite_optimize", args: { analyze: true, reindex: true } },
    {
      name: "sqlite_migration_apply",
      args: {
        version: "test-" + ts,
        sql: "CREATE TABLE test_prog_" + ts + " (id INTEGER);",
      },
    },
    { name: "sqlite_execute_code", args: { code }, minEvents: 5 },
    {
      name: "sqlite_read_query",
      args: { query: "SELECT * FROM test_measurements", stream: true, chunkSize: 10 },
      minEvents: 5,
    },
  ];

  let passed = true;

  for (const t of tests) {
    const success = await runTest(t.name, t.args, t.minEvents || 1);
    if (!success) passed = false;
  }

  // Cleanup
  import("fs").then((fs) => {
    try {
      fs.unlinkSync(resolve(projectDir, "test-server", "vacuum.db"));
    } catch {}
    try {
      fs.unlinkSync(resolve(projectDir, "test-server", "backup.db"));
    } catch {}
    try {
      fs.unlinkSync(resolve(projectDir, "test-server", "dump.sql"));
    } catch {}
  });

  proc.kill();
  if (!passed) {
    process.exitCode = 1;
  } else {
    console.log(
      "\nAll 8 tools successfully tested for progress notifications and chunk streaming!",
    );
  }
}

main().catch((err) => {
  console.error("Script failed:", err);
  proc.kill();
  process.exitCode = 1;
});
