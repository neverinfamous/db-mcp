## [Unreleased]

### Security
- **CI/CD Hardening**: Added `--provenance` flag to `npm publish` in `publish-npm.yml` for SLSA Build L3 attestation. Added `id-token: write` permission for OIDC provenance token generation.
- **CI/CD Harmonization**:
  - Added `secrets-scanning.yml` (TruffleHog + Gitleaks on every push/PR)
  - Added `dependabot-auto-merge.yml` (auto-squash patch/minor, manual review for major)
  - Added Trivy container scan + SARIF upload to `docker-publish.yml` security-scan job
  - Added `.gitleaks.toml` and `.trivyignore` configuration files

### Fixed
- **Code Mode last-expression auto-return** — Bare expressions like `sqlite.help()` now correctly surface their return value from `sqlite_execute_code`. Previously, the async IIFE wrapper silently returned `undefined` for non-`return` statements. New `transformAutoReturn()` utility prepends `return` to the last expression statement, mimicking Node REPL semantics. Applied to both VM and Worker sandbox paths.
