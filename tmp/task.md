# WASM Degradation Test

## Coverage Matrix

| Category | Test | Result | Error Message Quality |
|---|---|---|---|
| API Surface | 1.1 — Total method count | ✅ Pass | N/A |
| API Surface | 1.2 — Transactions group is empty | ✅ Pass | N/A |
| API Surface | 1.3 — Window functions absent from stats | ✅ Pass | N/A |
| API Surface | 1.4 — SpatiaLite absent from geo | ✅ Pass | N/A |
| API Surface | 1.5 — FTS5 absent from text | ✅ Pass | N/A |
| Admin | 2.1 — Backup | ✅ Pass | Included WASM limitation hint |
| Admin | 2.2 — Restore | ✅ Pass | Included WASM limitation hint |
| Admin | 2.3 — Verify Backup | ✅ Pass | Included WASM limitation hint |
| Admin | 3.1 — Create CSV Table | ✅ Pass | Included WASM limitation hint |
| Admin | 3.2 — Analyze CSV Schema | ✅ Pass | Included WASM limitation hint |
| Admin | 4.1 — Create R-Tree Table | ✅ Pass | Included WASM limitation hint |
| Core | 5.1 — FTS5 phantom table behavior | ✅ Pass | Structured error returned |
| Admin | 6.1 — dbstat WASM Fallback | ✅ Pass | Returns counts-only |
| Admin | 7.1 — PRAGMA Compile Options | ✅ Pass | FTS3 present, FTS5 absent |
| Validation | 8.1 — Zod Validation (WASM degraded tools) | ✅ Pass | Handler errors returned |
| Workflow | 9.1 — Multi-Step WASM Workflow | ✅ Pass | Clean pipeline execution |

## Findings

All 9 phases passed successfully out of the box in WASM mode. The handler errors correctly adhere to the `{success: false, error: "..."}` contract and properly hint at WASM environmental limitations rather than throwing raw MCP exceptions. FTS5, SpatiaLite, and transactions were correctly omitted from the dynamic Code Mode API wrapper.
