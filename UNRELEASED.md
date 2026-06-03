## [Unreleased]

### Added
- Implemented `ALLOWED_IO_ROOTS` filesystem boundary sandbox to restrict IO operations (e.g., CSV imports, backup dumps) to explicitly authorized directories.
- Added `--allowed-io-roots` CLI flag and `ALLOWED_IO_ROOTS` environment variable to configure the IO sandbox.

### Security
- **Hard Gate**: HTTP transports will now fail to start (exit code 1) if `ALLOWED_IO_ROOTS` is not explicitly provided, preventing ambient filesystem access for exposed servers.
- Stdio transport now defaults to an empty `ALLOWED_IO_ROOTS` array (NO filesystem access) if not explicitly provided, and issues a security warning about implied trust.
- Hardened all filesystem-touching tools (`sqlite_backup`, `sqlite_vacuum_into`, `sqlite_dump`, `sqlite_restore`, `sqlite_attach_database`, `sqlite_verify`, `sqlite_create_csv_virtual_table`, `sqlite_analyze_csv`) to use symlink-aware realpath resolution (`assertSafeIoPath`) preventing path traversal attacks.
