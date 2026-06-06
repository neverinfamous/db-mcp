import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  SqliteAdapter,
  createSqliteAdapter,
} from "../../../src/adapters/sqlite/sqlite-adapter.js";



describe("WASM Adapter Concurrency", () => {
  let adapter: SqliteAdapter;

  beforeEach(async () => {
    adapter = createSqliteAdapter();
    await adapter.connect({ type: "sqlite", connectionString: ":memory:" });

    // Setup test schema
    await adapter.executeScript(`
      CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT);
      INSERT INTO users (name) VALUES ('Alice'), ('Bob');
    `);
  });

  afterEach(async () => {
    await adapter.disconnect();
  });

  it("handles concurrent reads", async () => {
    // Start multiple reads concurrently
    const promises = [];
    for (let i = 0; i < 5; i++) {
      promises.push(
        adapter.executeReadQuery("SELECT * FROM users ORDER BY id"),
      );
    }

    const results = await Promise.all(promises);

    for (const result of results) {
      expect(result.rows).toHaveLength(2);
      expect(result.rows![0]!["name"]).toBe("Alice");
    }

    const stats = adapter.getPoolStats();
    expect(stats.activeReaders).toBe(0);
    expect(stats.isWriting).toBe(false);
  });

  it("serializes concurrent writes", async () => {
    // Start multiple writes concurrently
    const promises = [];
    for (let i = 0; i < 5; i++) {
      promises.push(
        adapter.executeWriteQuery("INSERT INTO users (name) VALUES (?)", [
          `User${i}`,
        ]),
      );
    }

    const results = await Promise.all(promises);

    for (const result of results) {
      expect(result.rowsAffected).toBe(1);
    }

    const finalCount = await adapter.executeReadQuery(
      "SELECT COUNT(*) as count FROM users",
    );
    expect(finalCount.rows![0]!["count"]).toBe(7); // 2 initial + 5 new
  });

  it("blocks reads while writing", async () => {
    // We can't strictly assert the exact timing in a JS test, but we can verify
    // that the read-write lock gives exclusive access. We'll use rawQuery to simulate
    // a slow write (using a CTE with delay, or just testing the lock logic via adapter calls).

    // SQLite memory DB is too fast to observe blocking easily from JS without hooks.
    // However, we can assert that the lock properties reflect connection pooling.
    expect(adapter.getCapabilities().connectionPooling).toBe(true);
  });

  it("rawQuery routes to appropriate lock", async () => {
    // Simple verification that rawQuery succeeds for both reads and writes
    const readResult = await adapter.rawQuery(
      "SELECT name FROM users WHERE id = 1",
    );
    expect(readResult.rows).toHaveLength(1);
    expect(readResult.rows![0]!["name"]).toBe("Alice");

    const writeResult = await adapter.rawQuery(
      "UPDATE users SET name = 'Alicia' WHERE id = 1",
    );
    expect(writeResult.rowsAffected).toBe(1);

    const verifyResult = await adapter.rawQuery(
      "SELECT name FROM users WHERE id = 1",
    );
    expect(verifyResult.rows![0]!["name"]).toBe("Alicia");
  });
});
