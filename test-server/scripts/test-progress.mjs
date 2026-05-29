import { spawn } from "child_process";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectDir = resolve(__dirname, "../..");

const proc = spawn(
  "node",
  ["dist/cli.js", "--sqlite", "./test-server/test.db", "--log-level", "error"],
  {
    cwd: projectDir,
    stdio: ["pipe", "pipe", "pipe"],
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
        console.log(
          `[PROGRESS] Step ${msg.params.progress} of ${msg.params.total || "?"}`,
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

  const code = `
    function sleepMs(ms) {
      const start = Date.now();
      while (Date.now() - start < ms) {}
    }
    if (typeof sqlite.reportProgress === 'function') {
      for (let i = 1; i <= 3; i++) {
        await sqlite.reportProgress(i, 3, "Step " + i);
        sleepMs(100);
      }
      return "Success";
    }
    throw new Error("Missing reportProgress");
  `;

  console.log("\nCalling sqlite_execute_code with a progress loop...");

  const response = await rpc("tools/call", {
    name: "sqlite_execute_code",
    arguments: { code },
    _meta: { progressToken: "test-token" },
  });

  if (response.error) {
    console.error("FAIL: Tool returned error:", response.error);
    process.exitCode = 1;
  } else {
    console.log("\nTool finished successfully!");

    if (progressEvents.length === 3) {
      console.log(`PASS: Received exactly 3 progress notifications!`);
    } else {
      console.error(
        `FAIL: Expected 3 progress notifications, got ${progressEvents.length}`,
      );
      process.exitCode = 1;
    }
  }

  proc.kill();
}

main().catch((err) => {
  console.error("Script failed:", err);
  proc.kill();
  process.exitCode = 1;
});
