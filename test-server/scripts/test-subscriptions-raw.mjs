import { spawn } from "child_process";
import assert from "assert";

async function main() {
  const env = { ...process.env, SQLITE_DATABASE: "test-server/test.db" };
  delete env.DB_ENCRYPTION_KEY;

  const proc = spawn("node", ["dist/cli.js", "--transport=stdio"], {
    env,
    stdio: ["pipe", "pipe", "pipe"],
  });

  proc.stderr.on("data", (chunk) =>
    console.error("SERVER STDERR:", chunk.toString()),
  );

  let buffer = "";
  let notifications = [];
  let msgId = 1;

  const send = (method, params) => {
    const id = msgId++;
    const msg = { jsonrpc: "2.0", id, method, params };
    proc.stdin.write(JSON.stringify(msg) + "\n");
    return id;
  };

  proc.stdout.on("data", (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split("\n");
    buffer = lines.pop(); // keep remainder

    for (const line of lines) {
      if (!line.trim()) continue;
      console.log("RAW STDOUT:", line);
      try {
        const msg = JSON.parse(line);
        if (msg.method === "notifications/resources/updated") {
          notifications.push(msg.params.uri);
          console.log("NOTIF:", msg.params.uri);
        } else if (msg.id) {
          console.log(
            "Response for",
            msg.id,
            msg.error ? JSON.stringify(msg.error) : "OK",
          );
        }
      } catch (e) {
        // ignore incomplete
      }
    }
  });

  // Init
  send("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "test", version: "1" },
  });
  await new Promise((r) => setTimeout(r, 1500));

  send("notifications/initialized", {});

  // Subscriptions
  send("resources/subscribe", { uri: "sqlite://schema" });
  send("resources/subscribe", { uri: "sqlite://tables" });
  send("resources/subscribe", { uri: "sqlite://table/test_products/schema" });
  send("resources/subscribe", { uri: "sqlite://health" });

  await new Promise((r) => setTimeout(r, 500));

  function assertNotifications(expected, stepName) {
    try {
      assert.deepStrictEqual([...notifications].sort(), [...expected].sort());
      console.log(`✅ Passed ${stepName}`);
    } catch (err) {
      console.error(
        `❌ FAILED ${stepName}: Expected`,
        expected,
        `but got`,
        notifications,
      );
      process.exit(1);
    }
  }

  console.log("Mutating DB: CREATE");
  send("tools/call", {
    name: "sqlite_create_table",
    arguments: {
      table: "test_live_sub",
      columns: [{ name: "id", type: "INTEGER", primaryKey: true }],
    },
  });
  await new Promise((r) => setTimeout(r, 500));
  assertNotifications(
    [
      "sqlite://schema",
      "sqlite://tables",
      "sqlite://table/test_products/schema",
    ],
    "CREATE",
  );
  notifications = [];

  console.log("Mutating DB: ALTER");
  send("tools/call", {
    name: "sqlite_alter_table",
    arguments: {
      table: "test_products",
      operation: "add_column",
      column: "sub_test",
      type: "TEXT",
    },
  });
  await new Promise((r) => setTimeout(r, 500));
  assertNotifications(
    [
      "sqlite://schema",
      "sqlite://tables",
      "sqlite://table/test_products/schema",
    ],
    "ALTER",
  );
  notifications = [];

  console.log("Mutating DB: DROP");
  send("tools/call", {
    name: "sqlite_drop_table",
    arguments: { table: "test_live_sub" },
  });
  await new Promise((r) => setTimeout(r, 500));
  assertNotifications(
    [
      "sqlite://schema",
      "sqlite://tables",
      "sqlite://table/test_products/schema",
    ],
    "DROP",
  );

  console.log("\n✅ All RAW subscription tests passed!");
  proc.kill();
  setTimeout(() => process.exit(0), 500);
}

main().catch(console.error);
