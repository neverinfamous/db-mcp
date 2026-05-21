# db-mcp Help — Transactions (8 tools, Native only)

## Atomic Execution (preferred for simple cases)

```javascript
sqlite_transaction_execute({
  statements: ["UPDATE a SET x=1", "UPDATE b SET y=2"],
});
```

## Manual Transaction Control

```javascript
sqlite_transaction_begin({ mode: "immediate" }); // or "deferred", "exclusive"
sqlite_transaction_savepoint({ name: "checkpoint" });
sqlite_transaction_rollback_to({ name: "checkpoint" });
sqlite_transaction_release({ name: "checkpoint" });
sqlite_transaction_commit();
sqlite_transaction_rollback();
```

## Transaction State (read-only)

```javascript
sqlite_transaction_status(); // → { status: "active" | "none", active: true/false }
```

## ⚠️ Gotchas

- Transaction tools are **Native only** — WASM adapter does not support transactions
- Use `sqlite_transaction_execute` for simple multi-statement operations; manual `begin`/`commit` for complex flows with savepoints
- `sqlite_transaction_status` is read-only and requires only `read` scope; all other transaction tools require `write` scope
