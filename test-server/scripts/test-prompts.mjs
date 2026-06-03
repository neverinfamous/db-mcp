import { spawn } from "child_process";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectDir = resolve(__dirname, "../..");

const cleanEnv = { ...process.env };
delete cleanEnv.DB_ENCRYPTION_KEY;

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

proc.stdout.on("data", (chunk) => {
  buffer += chunk.toString();
  const lines = buffer.split("\n");
  buffer = lines.pop(); // keep incomplete
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const msg = JSON.parse(trimmed);
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
    }, 20000);
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
  // Initialize
  await rpc("initialize", {
    protocolVersion: "2025-03-26",
    capabilities: {},
    clientInfo: { name: "test-prompts", version: "1.0" },
  });
  await delay(500);
  notify("notifications/initialized");
  await delay(1000);

  // List prompts
  const listResp = await rpc("prompts/list", {});
  const prompts = listResp.result?.prompts ?? [];
  console.log(`\n=== PROMPTS LIST: ${prompts.length} prompts ===`);
  for (const p of prompts) {
    const args = (p.arguments || [])
      .map((a) => `${a.name}${a.required ? "*" : ""}`)
      .join(", ");
    console.log(`  ${p.name}(${args})`);
  }

  const testCases = [
    // No-argument prompts
    { name: "sqlite_explain_schema", args: {}, expect: "" },
    { name: "sqlite_optimization", args: {}, expect: "" },
    { name: "sqlite_documentation", args: {}, expect: "" },

    // Required-argument prompts
    {
      name: "sqlite_query_builder",
      args: {
        operation: "SELECT",
        tables: "users",
        description: "find active",
      },
      expect: "",
    },
    {
      name: "sqlite_data_analysis",
      args: { table: "users" },
      expect: "",
    },
    {
      name: "sqlite_migration",
      args: { change: "add desc" },
      expect: "",
    },
    {
      name: "sqlite_debug_query",
      args: { query: "SELECT * FROM test" },
      expect: "",
    },
    {
      name: "sqlite_summarize_table",
      args: { table_name: "users" },
      expect: "",
    },
    {
      name: "sqlite_hybrid_search_workflow",
      args: { use_case: "product_search" },
      expect: "",
    },
    {
      name: "sqlite_demo",
      args: { topic: "sales" },
      expect: "",
    },

    // Optional-argument prompts
    {
      name: "sqlite_data_analysis",
      args: { table: "users", focus: "growth" },
      expect: "",
    },
    {
      name: "sqlite_migration",
      args: { change: "add id", reversible: "true" },
      expect: "",
    },
  ];

  console.log(`\n=== TESTING ${testCases.length} PROMPT CALLS ===\n`);
  let pass = 0,
    fail = 0;

  for (const tc of testCases) {
    const argsStr = Object.keys(tc.args).length
      ? JSON.stringify(tc.args)
      : "(none)";
    try {
      const resp = await rpc("prompts/get", {
        name: tc.name,
        arguments: tc.args,
      });
      if (resp.error) {
        console.log(
          `FAIL ${tc.name}(${argsStr}): MCP error: ${JSON.stringify(resp.error)}`,
        );
        fail++;
        continue;
      }
      const messages = resp.result?.messages;
      const checks = [];
      if (!Array.isArray(messages)) checks.push("messages not array");
      else if (messages.length < 1) checks.push("messages empty");
      else {
        const m = messages[0];
        if (m.role !== "user") checks.push(`role=${m.role}`);
        if (!m.content) checks.push("no content");
        else {
          const c = m.content;
          if (c.type !== "text") checks.push(`type=${c.type}`);
          if (!c.text || c.text.length === 0) checks.push("text empty");
          else if (
            tc.expect &&
            !c.text.toLowerCase().includes(tc.expect.toLowerCase())
          ) {
            checks.push(`missing '${tc.expect}' (len=${c.text.length})`);
          }
        }
      }
      if (checks.length === 0) {
        const textLen = messages?.[0]?.content?.text?.length ?? 0;
        console.log(
          `PASS ${tc.name}(${argsStr}) — msgs:${messages.length}, textLen:${textLen}`,
        );
        pass++;
      } else {
        console.log(`FAIL ${tc.name}(${argsStr}): ${checks.join("; ")}`);
        fail++;
      }
    } catch (err) {
      console.log(`FAIL ${tc.name}(${argsStr}): ${err.message}`);
      fail++;
    }
  }

  // Error handling tests
  try {
    const resp = await rpc("prompts/get", {
      name: "nonexistent-prompt",
      arguments: {},
    });
    if (resp.error) {
      console.log(
        `PASS nonexistent-prompt: MCP error (code=${resp.error.code})`,
      );
      pass++;
    } else {
      console.log(`FAIL nonexistent-prompt: expected error`);
      fail++;
    }
  } catch (err) {
    console.log(`FAIL nonexistent-prompt: ${err.message}`);
    fail++;
  }

  try {
    const resp = await rpc("prompts/get", {
      name: "sqlite_query_builder",
      arguments: {},
    });
    if (resp.error) {
      console.log(`PASS sqlite_query_builder(no args): error returned`);
    } else {
      console.log(`PASS sqlite_query_builder(no args): handled gracefully`);
    }
    pass++;
  } catch (err) {
    console.log(`FAIL sqlite_query_builder(no args): ${err.message}`);
    fail++;
  }

  console.log(
    `\n=== RESULTS: ${pass} pass, ${fail} fail (${pass + fail} total) ===`,
  );
  proc.kill();
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
