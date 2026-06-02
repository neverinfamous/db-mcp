import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { z } from "zod";

async function main() {
  const transport = new StdioClientTransport({
    command: "node",
    args: ["dist/cli.js", "--transport=stdio"],
    env: { ...process.env, SQLITE_DATABASE: "test-server/test.db" }
  });

  const client = new Client({ name: "test-client", version: "1.0.0" }, { capabilities: {} });
  await client.connect(transport);

  console.log("Connected.");
  let notifications = [];
  
  client.setNotificationHandler("notifications/resources/updated", (notif) => {
    notifications.push(notif.uri);
    console.log("Notification received:", notif.uri);
  });

  // Test A: Valid Subscriptions
  try { await client.request({ method: "resources/subscribe", params: { uri: "sqlite://schema" } }, z.any()); console.log("Subbed schema: OK"); } catch(e) { console.error("Sub schema failed"); }
  try { await client.request({ method: "resources/subscribe", params: { uri: "sqlite://tables" } }, z.any()); console.log("Subbed tables: OK"); } catch(e) { console.error("Sub tables failed"); }
  try { await client.request({ method: "resources/subscribe", params: { uri: "sqlite://table/test_products/schema" } }, z.any()); console.log("Subbed test_products: OK"); } catch(e) { console.error("Sub test_products failed"); }
  try { await client.request({ method: "resources/subscribe", params: { uri: "sqlite://health" } }, z.any()); console.log("Subbed health: OK"); } catch(e) { console.error("Sub health failed"); }

  // Test C: Invalid Subscriptions
  try { await client.request({ method: "resources/subscribe", params: { uri: "sqlite://meta" } }, z.any()); console.error("Sub meta: SUCCESS (Should have failed)"); } catch(e) { console.log("Sub meta: Error (Expected)"); }
  try { await client.request({ method: "resources/subscribe", params: { uri: "sqlite://help" } }, z.any()); console.error("Sub help: SUCCESS (Should have failed)"); } catch(e) { console.log("Sub help: Error (Expected)"); }
  try { await client.request({ method: "resources/subscribe", params: { uri: "sqlite://invalid_uri" } }, z.any()); console.error("Sub invalid: SUCCESS (Should have failed)"); } catch(e) { console.log("Sub invalid: Error (Expected)"); }

  // Test B: Mutate and wait
  console.log("Mutating DB...");
  await client.request({ method: "tools/call", params: { name: "sqlite_write_query", arguments: { sql: "CREATE TABLE test_live_sub (id INTEGER PRIMARY KEY);" } } }, z.any());
  
  await new Promise(r => setTimeout(r, 500));
  console.log("Notifications after CREATE:", notifications);
  notifications = [];

  await client.request({ method: "tools/call", params: { name: "sqlite_write_query", arguments: { sql: "ALTER TABLE test_products ADD COLUMN sub_test TEXT;" } } }, z.any());
  await new Promise(r => setTimeout(r, 500));
  console.log("Notifications after ALTER:", notifications);
  notifications = [];

  await client.request({ method: "tools/call", params: { name: "sqlite_write_query", arguments: { sql: "DROP TABLE test_live_sub;" } } }, z.any());
  await new Promise(r => setTimeout(r, 500));
  console.log("Notifications after DROP:", notifications);
  notifications = [];

  // Test D: Unsubscribe
  await client.request({ method: "resources/unsubscribe", params: { uri: "sqlite://schema" } }, z.any());
  console.log("Unsubbed schema");
  
  await client.request({ method: "tools/call", params: { name: "sqlite_write_query", arguments: { sql: "CREATE TABLE test_live_sub2 (id INTEGER PRIMARY KEY);" } } }, z.any());
  await new Promise(r => setTimeout(r, 500));
  console.log("Notifications after unsub and CREATE:", notifications);

  // Clean up
  await client.request({ method: "tools/call", params: { name: "sqlite_write_query", arguments: { sql: "DROP TABLE test_live_sub2;" } } }, z.any());

  process.exit(0);
}

main().catch(console.error);
