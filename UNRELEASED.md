## [Unreleased]

### Added

- **Initialization SQL**: Added `initializationSql?: string[]` to `SqliteConfig` for SQLite connections, enabling per-connection session setup (e.g. `PRAGMA foreign_keys = ON;`). This executes exactly once when the adapter connects, satisfying the requirement for session-level guardrails across both Native (`better-sqlite3`) and WASM (`sql.js`) backends.
- **`sqlite_transaction_status`**: New read-only tool to check whether a SQLite transaction is currently active (native backend only). Returns `{status: "active" | "none", active: boolean}`. Ported from `pg_transaction_status` for cross-server parity.

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
