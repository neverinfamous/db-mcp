import { spawn } from "child_process";

async function main() {
  const proc = spawn("node", ["dist/cli.js", "--transport=stdio"], {
    env: { ...process.env, SQLITE_DATABASE: "test-server/test.db" },
    stdio: ["pipe", "pipe", "pipe"]
  });

  proc.stderr.on("data", (chunk) => console.error("SERVER STDERR:", chunk.toString()));

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
          console.log("Response for", msg.id, msg.error ? JSON.stringify(msg.error) : "OK");
        }
      } catch (e) {
        // ignore incomplete
      }
    }
  });

  // Init
  send("initialize", { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "test", version: "1" } });
  await new Promise(r => setTimeout(r, 1500));

  send("notifications/initialized", {});

  // Subscriptions
  send("resources/subscribe", { uri: "sqlite://schema" });
  send("resources/subscribe", { uri: "sqlite://tables" });
  send("resources/subscribe", { uri: "sqlite://table/test_products/schema" });
  send("resources/subscribe", { uri: "sqlite://health" });

  await new Promise(r => setTimeout(r, 500));

  console.log("Mutating DB: CREATE");
  send("tools/call", { name: "sqlite_execute_query", arguments: { sql: "CREATE TABLE test_live_sub (id INTEGER PRIMARY KEY);" } });
  await new Promise(r => setTimeout(r, 500));
  console.log("Notifications after CREATE:", notifications);
  notifications = [];

  console.log("Mutating DB: ALTER");
  send("tools/call", { name: "sqlite_execute_query", arguments: { sql: "ALTER TABLE test_products ADD COLUMN sub_test TEXT;" } });
  await new Promise(r => setTimeout(r, 500));
  console.log("Notifications after ALTER:", notifications);
  notifications = [];

  console.log("Mutating DB: DROP");
  send("tools/call", { name: "sqlite_execute_query", arguments: { sql: "DROP TABLE test_live_sub;" } });
  await new Promise(r => setTimeout(r, 500));
  console.log("Notifications after DROP:", notifications);

  proc.kill();
  setTimeout(() => process.exit(0), 500);
}

main().catch(console.error);
