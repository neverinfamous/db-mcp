## [Unreleased]

### Changed

- **Dependency Updates**: `@types/sql.js` 1.4.9 → 1.4.10, `jose` 6.2.1 → 6.2.2

### Fixed

- **E2E**: CSV payload test now reads `payload.error` (not `payload.message`) for extension-unavailable skip detection, fixing CI failures on Linux where the Windows-only CSV extension is absent
