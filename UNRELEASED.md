## [Unreleased]

### Added

- **Documentation:** Created [GitHub Wiki](https://github.com/neverinfamous/db-mcp/wiki) with 11 pages covering Quick Start, Tool Filtering, Code Mode, Tool Reference, HTTP Transport, SQLite Extensions, Resources & Prompts, OAuth & Security, Audit Trail, and Troubleshooting
- **CI/CD:** Added Docker smoke test jobs to `docker-publish.yml` and `lint-and-test.yml` that verify stdio, HTTP, and native SQLite backends start successfully on both amd64 and arm64 runners before images are pushed
- **CI/CD:** Refactored `docker-publish.yml` from monolithic QEMU-emulated build to per-platform native runner matrix (`ubuntu-24.04` + `ubuntu-24.04-arm`), matching the fleet standard used by `postgres-mcp` and `mysql-mcp`
- **Tests:** Added `build-externals.test.ts` invariant test ensuring every `tsup.config.ts` external entry has a corresponding production dependency

### Fixed

- **Docker:** Fixed fatal startup crash in Docker image caused by missing `acorn` dependency ([#149](https://github.com/neverinfamous/db-mcp/issues/149)). The package was externalized in the build config but not listed in `dependencies`, causing it to be pruned from the production `node_modules`
- **Docker:** Fixed ARM64 `better-sqlite3` native addon crash (`Could not locate the bindings file`) by switching from QEMU-emulated cross-compilation to native ARM64 runners. Added explicit `npm rebuild better-sqlite3` in Dockerfile for defense-in-depth
