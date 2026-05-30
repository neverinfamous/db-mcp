## [Unreleased]

### Changed
- Rewrote `test-server/scripts/test-tool-annotations.mjs` from a basic `openWorldHint` counter into a comprehensive annotation validation suite. Now validates all 5 annotation fields (`openWorldHint`, `readOnlyHint`, `destructiveHint`, `sensitiveHint`, `idempotentHint`), checks logical consistency (e.g., no `readOnly+destructive` contradiction), enforces an exact allowlist for `openWorldHint=true` tools, and validates `title` presence.

### Fixed
- Fixed `sqlite_pragma_settings` annotation: removed incorrect `openWorldHint: true` override. PRAGMA operations are internal to the SQLite engine and don't interact with the filesystem or network.
- Fixed a bug in `.github/workflows/codeql.yml` where CodeQL severity validation failed to block deployments. The SARIF parser now correctly inherits `defaultConfiguration.level` when the finding level is omitted, and explicitly excludes the `tests/` directory from blocking production releases.
- Fixed `tsconfig.test.json` to properly include the `tests/` directory and added `npm run typecheck:tests` to the main check script so CI catches test-related type errors.
- Fixed "Invocation of non-function" CodeQL alerts in `utilities.bench.ts` and `transport-auth.bench.ts` by removing dead benchmark code referencing non-existent functions.
