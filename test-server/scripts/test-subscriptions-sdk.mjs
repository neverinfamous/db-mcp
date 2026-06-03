import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { z } from "zod";
import assert from "assert";

async function main() {
  const env = { ...process.env, SQLITE_DATABASE: "test-server/test.db" };
  delete env.DB_ENCRYPTION_KEY;

  const transport = new StdioClientTransport({
    command: "node",
    args: ["dist/cli.js", "--transport=stdio"],
    env
  });

  const client = new Client({ name: "test-client", version: "1.0.0" }, { capabilities: {} });
  await client.connect(transport);

  console.log("Connected.");
  let notifications = [];
  
  const ResourceUpdatedNotificationSchema = z.object({ method: z.literal("notifications/resources/updated") }).passthrough();
  client.setNotificationHandler(ResourceUpdatedNotificationSchema, (notif) => {
    const uri = notif.params ? notif.params.uri : notif.uri;
    notifications.push(uri);
    console.log("Notification received:", uri);
  });

  function assertNotifications(expected, stepName) {
    try {
      assert.deepStrictEqual([...notifications].sort(), [...expected].sort());
      console.log(`✅ Passed ${stepName}`);
    } catch (err) {
      console.error(`❌ FAILED ${stepName}: Expected`, expected, `but got`, notifications);
      process.exit(1);
    }
  }

  const testSub = async (uri) => {
    try {
      await client.request({ method: "resources/subscribe", params: { uri } }, z.any());
      console.log(`✅ Subbed ${uri}: OK`);
    } catch (e) {
      console.error(`❌ Sub ${uri} failed:`, e);
      process.exit(1);
    }
  };

  const testSubFail = async (uri) => {
    try {
      await client.request({ method: "resources/subscribe", params: { uri } }, z.any());
      console.error(`❌ FAILED Sub ${uri}: SUCCESS (Should have failed)`);
      process.exit(1);
    } catch (e) {
      console.log(`✅ Sub ${uri}: Error (Expected)`);
    }
  };

  // Test A: Valid Subscriptions
  await testSub("sqlite://schema");
  await testSub("sqlite://tables");
  await testSub("sqlite://table/test_products/schema");
  await testSub("sqlite://health");

  // Test C: Invalid Subscriptions
  await testSubFail("sqlite://meta");
  await testSubFail("sqlite://help");
  await testSubFail("sqlite://invalid_uri");

  // Test B: Mutate and wait
  console.log("Mutating DB: CREATE");
  await client.request({ method: "tools/call", params: { name: "sqlite_create_table", arguments: { table: "test_live_sub", columns: [{ name: "id", type: "INTEGER", primaryKey: true }] } } }, z.any());
  await new Promise(r => setTimeout(r, 500));
  assertNotifications(["sqlite://schema", "sqlite://tables", "sqlite://table/test_products/schema"], "CREATE");
  notifications = [];

  console.log("Mutating DB: ALTER");
  await client.request({ method: "tools/call", params: { name: "sqlite_alter_table", arguments: { table: "test_products", operation: "add_column", column: "sub_test", type: "TEXT" } } }, z.any());
  await new Promise(r => setTimeout(r, 500));
  assertNotifications(["sqlite://schema", "sqlite://tables", "sqlite://table/test_products/schema"], "ALTER");
  notifications = [];

  console.log("Mutating DB: DROP");
  await client.request({ method: "tools/call", params: { name: "sqlite_drop_table", arguments: { table: "test_live_sub" } } }, z.any());
  await new Promise(r => setTimeout(r, 500));
  assertNotifications(["sqlite://schema", "sqlite://tables", "sqlite://table/test_products/schema"], "DROP");
  notifications = [];

  // Test D: Unsubscribe
  console.log("Mutating DB: UNSUBSCRIBE schema");
  await client.request({ method: "resources/unsubscribe", params: { uri: "sqlite://schema" } }, z.any());
  console.log("Unsubbed schema");
  
  await client.request({ method: "tools/call", params: { name: "sqlite_create_table", arguments: { table: "test_live_sub2", columns: [{ name: "id", type: "INTEGER", primaryKey: true }] } } }, z.any());
  await new Promise(r => setTimeout(r, 500));
  assertNotifications(["sqlite://tables", "sqlite://table/test_products/schema"], "UNSUBSCRIBE CREATE");
  notifications = [];

  // Clean up
  await client.request({ method: "tools/call", params: { name: "sqlite_drop_table", arguments: { table: "test_live_sub2" } } }, z.any());

  console.log("\n✅ All SDK subscription tests passed!");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Fatal error:", err);
  process.exit(1);
});
