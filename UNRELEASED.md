## [Unreleased]

### Added

- **Initialization SQL**: Added `initializationSql?: string[]` to `SqliteConfig` for SQLite connections, enabling per-connection session setup (e.g. `PRAGMA foreign_keys = ON;`). This executes exactly once when the adapter connects, satisfying the requirement for session-level guardrails across both Native (`better-sqlite3`) and WASM (`sql.js`) backends.
- **`sqlite_transaction_status`**: New read-only tool to check whether a SQLite transaction is currently active (native backend only). Returns `{status: "active" | "none", active: boolean}`. Ported from `pg_transaction_status` for cross-server parity.
- **Audit Logging**: JSONL audit trail with async-buffered writes, log rotation (10MB, 5-file cascade), and `sqlite://audit` resource for agent access to the last 50 entries. Configurable via `--audit-log <path>`, `--audit-redact`, `--audit-reads` CLI flags or `AUDIT_LOG`, `AUDIT_REDACT`, `AUDIT_READS` environment variables. Write/admin tools are always logged; read tools optionally.
- **DDL Backup Snapshots**: Pre-mutation DDL capture for destructive operations (`sqlite_drop_table`, `sqlite_drop_index`, `sqlite_drop_view`, `sqlite_import_csv`, `sqlite_backup`). Gzip-compressed snapshots with retention policy (age + count limits). Tools: `sqlite_audit_list_backups`, `sqlite_audit_get_backup`, `sqlite_audit_cleanup`. Enabled via `--audit-backup` / `AUDIT_BACKUP`.
- **Token Burn-Rate**: Every tool response now includes `_meta.tokenEstimate` (~4 bytes/token heuristic). Code Mode responses include `metrics.tokenEstimate`. Matches postgres-mcp and mysql-mcp for cross-server parity.

### Security

- **CI/CD Hardening**: Added `--provenance` flag to `npm publish` in `publish-npm.yml` for SLSA Build L3 attestation. Added `id-token: write` permission for OIDC provenance token generation.
- **CI/CD Harmonization**:
  - Added `secrets-scanning.yml` (TruffleHog + Gitleaks on every push/PR)
  - Added `dependabot-auto-merge.yml` (auto-squash patch/minor, manual review for major)
  - Added Trivy container scan + SARIF upload to `docker-publish.yml` security-scan job
  - Added `.gitleaks.toml` and `.trivyignore` configuration files
- **Vulnerability Remediation**: Resolved Vite, Hono, path-to-regexp, fast-uri, Picomatch, and ip-address vulnerabilities via `npm update` and transitive lockfile resolutions.

### Changed

- **Dependency Updates**: Updated `typescript` to `^6.0.3` and bumped various packages including `@playwright/test`, `@types/node`, `@modelcontextprotocol/sdk`, `eslint`, `vitest`, `tsx`, and `better-sqlite3`. Updated GitHub Actions to their latest SHA-pinned versions (`docker/build-push-action`, `actions/upload-artifact`, `docker/login-action`, `github/codeql-action`, `actions/cache`).

### Fixed

- Fixed OAuth scope enforcement gap where tools were missing authorization level verification at the HTTP transport layer before being dispatched to the MCP handler.
- **Code Mode last-expression auto-return** — Bare expressions like `sqlite.help()` now correctly surface their return value from `sqlite_execute_code`. Previously, the async IIFE wrapper silently returned `undefined` for non-`return` statements. New `transformAutoReturn()` utility prepends `return` to the last expression statement, mimicking Node REPL semantics. Applied to both VM and Worker sandbox paths.
