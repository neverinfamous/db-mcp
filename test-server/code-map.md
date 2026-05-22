# db-mcp Code Map

> **Agent-optimized navigation reference.** Read this before searching the codebase. Covers directory layout, handler→tool mapping, type/schema locations, error hierarchy, and key constants.
>
> Last updated: May 22, 2026

---

## Directory Tree

```
src/
├── cli.ts                          # CLI entry point (arg parsing, transport selection)
├── index.ts                        # Barrel re-export for library consumers
├── version.ts                      # SSoT version constant (reads package.json)
│
├── server/
│   └── mcp-server.ts               # McpServer setup, adapter registration, tool/resource/prompt wiring
│
├── types/                          # Core TypeScript types (barrel: types/index.ts)
│   ├── adapter.ts                  # ToolDefinition, ResourceDefinition, PromptDefinition, AdapterCapabilities
│   ├── auth.ts                     # OAuthConfig, OAuthScope, TokenClaims, RequestContext
│   ├── database.ts                 # DatabaseConfig, QueryResult, ColumnInfo, TableInfo, SchemaInfo, IndexInfo
│   ├── filtering.ts                # ToolGroup, MetaGroup, ToolFilterRule, ToolFilterConfig
│   ├── server.ts                   # TransportType, McpServerConfig (incl. authToken, oauth)
│   └── index.ts                    # Barrel — also re-exports error classes from utils/errors
│
├── constants/
│   ├── server-instructions.ts      # Generated: slim INSTRUCTIONS constant (~680 chars) + HELP_CONTENT map (per-group help)
│   └── server-instructions/        # Source .md files for each help resource
│       ├── overview.md             # Root help content (sqlite://help)
│       ├── gotchas.md              # Common gotchas and critical usage patterns
│       ├── admin.md                # Admin group help
│       ├── geo.md                  # Geo group help
│       ├── introspection.md        # Introspection group help
│       ├── json.md                 # JSON group help
│       ├── migration.md            # Migration group help
│       ├── stats.md                # Stats group help
│       ├── text.md                 # Text group help
│       └── vector.md              # Vector group help
│
├── filtering/
│   ├── tool-constants.ts           # TOOL_GROUPS arrays, META_GROUPS shortcuts, group→tools map
│   └── tool-filter.ts              # ToolFilter class — parse/apply --tool-filter expressions
│
├── utils/
│   ├── annotations.ts              # MCP tool annotation helpers (readOnly, destructive hints)
│   ├── icons.ts                    # MCP icon definitions per tool group
│   ├── identifiers.ts              # SQL identifier validation/sanitization (table names, columns)
│   ├── insights-manager.ts         # memo://insights resource accumulator
│   ├── progress-utils.ts           # MCP progress notification helpers
│   ├── resource-annotations.ts     # MCP resource annotation helpers
│   ├── where-clause.ts             # WHERE clause builder/validator
│   ├── validate-path.ts            # Path traversal validation (shared by attach_database, vacuum_into, dump)
│   ├── index.ts                    # Barrel re-export
│   ├── errors/                     # Error class hierarchy (see § Error Classes below)
│   │   ├── base.ts                 # DbMcpError (abstract base) — auto-refines generic codes via suggestions
│   │   ├── categories.ts           # ErrorCategory enum + ErrorResponse interface
│   │   ├── classes.ts              # 8 concrete error subclasses
│   │   ├── error-response-fields.ts # ErrorResponseFields mixin (SSoT, re-exported from format.ts)
│   │   ├── format.ts               # formatHandlerError() — structured {success:false} builder
│   │   ├── suggestions.ts          # Error suggestion helpers (typo hints, table/column suggestions)
│   │   └── index.ts                # Barrel
│   └── logger/
│       ├── logger.ts               # Logger class (structured JSON, severity filtering)
│       ├── module-logger.ts        # createModuleLogger() factory
│       ├── error-codes.ts          # Module-prefixed error code constants
│       ├── types.ts                # LogLevel, LogEntry types
│       └── index.ts                # Barrel
│
├── auth/                           # OAuth 2.1 implementation
│   ├── auth-context.ts             # Auth context utilities
│   ├── middleware/                  # Express-style OAuth middleware (split from middleware.ts)
│   │   └── index.ts
│   ├── token-validator.ts          # JWT/JWKS token validation
│   ├── scopes/                     # Scope parsing, enforcement (split from scopes.ts)
│   │   └── index.ts
│   ├── scope-map.ts                # Tool→scope mapping
│   ├── oauth-resource-server.ts    # RFC 9728 /.well-known/oauth-protected-resource
│   ├── authorization-server-discovery.ts  # RFC 8414 auth server metadata discovery
│   ├── transport-agnostic.ts       # Non-Express auth re-exports for transport portability
│   ├── errors.ts                   # OAuth-specific error classes
│   └── types.ts                    # OAuth TypeScript types
│
├── audit/                          # Audit logging subsystem
│   ├── types.ts                    # AuditEntry, AuditConfig, BackupConfig, SnapshotMetadata types
│   ├── logger.ts                   # AuditLogger — async-buffered JSONL writer with rotation
│   ├── interceptor.ts              # createAuditInterceptor() — wraps tool handlers with around(), reads OAuth identity from AsyncLocalStorage
│   ├── backup-manager.ts           # BackupManager — pre-mutation DDL snapshots (gzip)
│   └── index.ts                    # Barrel
│
├── transports/
│   └── http/
│       ├── transport.ts            # HTTP/SSE transport (Streamable HTTP + legacy SSE)
│       ├── session.ts              # Session management (stateful + stateless modes)
│       ├── middleware.ts            # Security headers, rate limiting, CORS, body parsing, DNS rebinding guard
│       ├── oauth.ts                # OAuth 2.1 integration + simple bearer auth middleware
│       ├── type-adapters.ts        # Hono→Express type bridges
│       ├── types.ts                # HTTP transport types
│       └── index.ts                # Barrel
│
├── codemode/                       # Code Mode sandbox (secure JS execution)
│   ├── sandbox.ts                  # SandboxPool lifecycle manager
│   ├── sandbox-factory.ts          # Sandbox creation factory
│   ├── auto-return.ts              # Last-expression auto-return transform (IIFE helper)
│   ├── worker-sandbox.ts           # Worker thread sandbox (MessagePort RPC bridge)
│   ├── worker-script.ts            # Worker thread entry point (runs inside vm)
│   ├── api.ts                      # sqlite.* API bridge (exposes tools to sandbox)
│   ├── api-constants.ts            # API bridge constants and JSON-RPC codes
│   ├── security.ts                 # Code validation (blocked patterns, injection prevention)
│   ├── types.ts                    # Sandbox TypeScript types
│   └── index.ts                    # Barrel
│
├── adapters/
│   ├── database-adapter.ts         # Abstract DatabaseAdapter base class
│   ├── query-validation.ts         # Shared query validation (SELECT vs write detection)
│   ├── sqlite-helpers.ts           # Shared SQLite helper utilities
│   │
│   ├── sqlite/                     # ── WASM adapter (sql.js) ──
│   │   ├── sqlite-adapter.ts       # SqliteAdapter class (extends DatabaseAdapter)
│   │   ├── query-executor.ts       # WASM query execution
│   │   ├── schema-manager.ts       # Schema cache + metadata (TTL-based)
│   │   ├── json-utils.ts           # JSON column detection and normalization
│   │   ├── types.ts                # WASM-specific Zod schemas + TS types
│   │   ├── resources.ts            # 10 data MCP resources (schema, tables, indexes, compile_options, etc.)
│   │   ├── index.ts                # Barrel
│   │   ├── output-schemas/         # Zod outputSchema definitions per group (see § below)
│   │   ├── prompts/                # 10 MCP prompts (see § below)
│   │   └── tools/                  # Tool handler files (see § Handler Map below)
│   │       ├── column-validation.ts  # validateColumnExists() + validateTableExists() — used by geo, stats, text, FTS, window
│   │       └── ...                   # Group subdirectories below
│   │
│   └── sqlite-native/              # ── Native adapter (better-sqlite3) ──
│       ├── native-sqlite-adapter.ts     # NativeSqliteAdapter class (extends DatabaseAdapter)
│       ├── native-query-executor.ts     # Native query execution
│       ├── extensions.ts               # Extension loader (CSV, SpatiaLite) — uses findProjectRoot()
│       ├── transaction-methods.ts      # Transaction state management
│       ├── registration/               # Extracted tool/resource registration logic
│       │   └── index.ts
│       ├── index.ts                    # Barrel
│       └── tools/                      # Native-only tool handlers (see § below)
```

---

## Handler → Tool Mapping

Each file below registers tools with `group` labels. Native-only tools are marked.

### WASM Handlers (`src/adapters/sqlite/tools/`)

| Group             | Handler File(s)                           | Tools | Key Exports                                                                                                                   |
| ----------------- | ----------------------------------------- | ----- | ----------------------------------------------------------------------------------------------------------------------------- |
| **codemode**      | `codemode.ts`                             | 1     | `sqlite_execute_code`                                                                                                         |
| **core**          | `core/queries.ts`                         | 2     | `sqlite_read_query`, `sqlite_write_query`                                                                                     |
|                   | `core/convenience.ts`                     | 5     | `sqlite_upsert`, `sqlite_batch_insert`, `sqlite_count`, `sqlite_exists`, `sqlite_truncate`                                    |
|                   | `core/tables.ts`                          | 4     | `sqlite_create_table`, `sqlite_list_tables`, `sqlite_describe_table`, `sqlite_drop_table`                                     |
|                   | `core/indexes.ts`                         | 3     | `sqlite_get_indexes`, `sqlite_create_index`, `sqlite_drop_index`                                                              |
|                   | `core/triggers.ts`                        | 3     | `sqlite_list_triggers`, `sqlite_create_trigger`, `sqlite_drop_trigger`                                                        |
|                   | `core/alter-table.ts`                     | 1     | `sqlite_alter_table`                                                                                                          |
|                   | `core/constraints.ts`                     | 1     | `sqlite_list_constraints`                                                                                                     |
|                   | `core/datetime.ts`                        | 2     | `sqlite_date_add`, `sqlite_date_diff`                                                                                         |
| **json**          | `json-operations/crud.ts`                 | 7     | `sqlite_json_valid`, `sqlite_json_extract`, `sqlite_json_set`, `sqlite_json_remove`, `sqlite_json_type`, `sqlite_json_array_length`, `sqlite_json_array_append` |
|                   | `json-operations/query.ts`                | 4     | `sqlite_json_keys`, `sqlite_json_each`, `sqlite_json_group_array`, `sqlite_json_group_object`                                 |
|                   | `json-operations/transform.ts`            | 4     | `sqlite_json_pretty`, `sqlite_jsonb_convert`, `sqlite_json_storage_info`, `sqlite_json_normalize_column`                      |
|                   | `json-operations/security.ts`             | 1     | `sqlite_json_security_scan`                                                                                                   |
|                   | `json-operations/diff.ts`                 | 1     | `sqlite_json_diff`                                                                                                            |
|                   | `json-helpers/read.ts`                    | 4     | `sqlite_json_select`, `sqlite_json_query`, `sqlite_json_validate_path`, `sqlite_json_analyze_schema`                          |
|                   | `json-helpers/write.ts`                   | 4     | `sqlite_json_insert`, `sqlite_json_update`, `sqlite_json_merge`, `sqlite_create_json_collection`                              |
| **text**          | `text/regex.ts`                           | 2     | `sqlite_regex_extract`, `sqlite_regex_match`                                                                                  |
|                   | `text/formatting.ts`                      | 6     | `sqlite_text_split`, `sqlite_text_concat`, `sqlite_text_replace`, `sqlite_text_trim`, `sqlite_text_case`, `sqlite_text_substring` |
|                   | `text/search.ts`                          | 3     | `sqlite_fuzzy_match`, `sqlite_phonetic_match`, `sqlite_advanced_search`                                                       |
|                   | `text/validate.ts`                        | 2     | `sqlite_text_normalize`, `sqlite_text_validate`                                                                               |
|                   | `text/sentiment.ts`                       | 1     | `sqlite_text_sentiment`                                                                                                       |
| **text** (FTS5)   | `fts.ts`                                  | 5     | `sqlite_fts_create`, `sqlite_fts_search`, `sqlite_fts_rebuild`, `sqlite_fts_match_info`, `sqlite_fts_headline`                |
| **stats**         | `stats/basic.ts`                          | 8     | `sqlite_stats_basic`, `sqlite_stats_count`, `sqlite_stats_group_by`, `sqlite_stats_histogram`, `sqlite_stats_percentile`, `sqlite_stats_correlation`, `sqlite_stats_top_n`, `sqlite_stats_sample` |
|                   | `stats/advanced.ts`                       | 6     | `sqlite_stats_distinct`, `sqlite_stats_summary`, `sqlite_stats_frequency`, `sqlite_stats_outliers`, `sqlite_stats_regression`, `sqlite_stats_hypothesis` |
|                   | `stats/anomaly-detection.ts`              | 2     | `sqlite_stats_detect_anomalies`, `sqlite_stats_detect_bloat`                                                                  |
|                   | `stats/schema-risks.ts`                   | 1     | `sqlite_stats_detect_schema_risks`                                                                                            |
| **vector**        | `vector/storage.ts`                       | 4     | `sqlite_vector_create_table`, `sqlite_vector_store`, `sqlite_vector_batch_store`, `sqlite_vector_delete`                      |
|                   | `vector/search.ts`                        | 2     | `sqlite_vector_search`, `sqlite_vector_get`                                                                                   |
|                   | `vector/metadata.ts`                      | 5     | `sqlite_vector_count`, `sqlite_vector_stats`, `sqlite_vector_dimensions`, `sqlite_vector_normalize`, `sqlite_vector_distance` |
| **geo**           | `geo.ts`                                  | 4     | `sqlite_geo_distance`, `sqlite_geo_nearby`, `sqlite_geo_bounding_box`, `sqlite_geo_cluster`                                   |
| **admin**         | `admin/backup/create.ts`                  | 2     | `sqlite_backup`, `sqlite_vacuum_into`                                                                                         |
|                   | `admin/backup/restore.ts`                 | 1     | `sqlite_restore`                                                                                                              |
|                   | `admin/backup/analyze.ts`                 | 1     | `sqlite_analyze`                                                                                                              |
|                   | `admin/backup/integrity.ts`               | 1     | `sqlite_integrity_check`                                                                                                      |
|                   | `admin/backup/optimize.ts`                | 1     | `sqlite_optimize`                                                                                                             |
|                   | `admin/verify.ts`                         | 2     | `sqlite_verify_backup`, `sqlite_index_stats`                                                                                  |
|                   | `admin/pragma.ts`                         | 8     | `sqlite_pragma_compile_options`, `sqlite_pragma_database_list`, `sqlite_pragma_optimize`, `sqlite_pragma_settings`, `sqlite_pragma_table_info`, `sqlite_append_insight`, `sqlite_attach_database`, `sqlite_detach_database` |
|                   | `virtual/views.ts`                        | 3     | `sqlite_create_view`, `sqlite_list_views`, `sqlite_drop_view`                                                                 |
|                   | `virtual/vtable.ts`                       | 5     | `sqlite_list_virtual_tables`, `sqlite_virtual_table_info`, `sqlite_drop_virtual_table`, `sqlite_create_csv_table`, `sqlite_analyze_csv_schema` |
|                   | `virtual/extensions.ts`                   | 2     | `sqlite_create_rtree_table`, `sqlite_create_series_table`                                                                     |
|                   | `virtual/analysis.ts`                     | 3     | `sqlite_generate_series`, `sqlite_dbstat`, `sqlite_vacuum`                                                                    |
|                   | `admin/reindex.ts`                        | 1     | `sqlite_reindex`                                                                                                              |
|                   | `admin/wal.ts`                            | 1     | `sqlite_wal`                                                                                                                  |
| **introspection** | `introspection/graph/tools.ts`            | 3     | `sqlite_dependency_graph`, `sqlite_topological_sort`, `sqlite_cascade_simulator`                                              |
|                   | `introspection/analysis/constraints.ts`   | 1     | `sqlite_constraint_analysis`                                                                                                  |
|                   | `introspection/analysis/risks.ts`         | 1     | `sqlite_migration_risks`                                                                                                      |
|                   | `introspection/analysis/snapshot.ts`      | 1     | `sqlite_schema_snapshot`                                                                                                      |
|                   | `introspection/analysis/diff.ts`          | 1     | `sqlite_schema_diff`                                                                                                          |
|                   | `introspection/diagnostics/storage.ts`    | 1     | `sqlite_storage_analysis`                                                                                                     |
|                   | `introspection/diagnostics/indexes.ts`    | 1     | `sqlite_index_audit`                                                                                                          |
|                   | `introspection/diagnostics/query-plan.ts` | 1     | `sqlite_query_plan`                                                                                                           |
| **migration**     | `migration/tracking/init.ts`              | 1     | `sqlite_migration_init`                                                                                                       |
|                   | `migration/tracking/record.ts`            | 1     | `sqlite_migration_record`                                                                                                     |
|                   | `migration/tracking/apply.ts`             | 1     | `sqlite_migration_apply`                                                                                                      |
|                   | `migration/tracking/rollback.ts`          | 1     | `sqlite_migration_rollback`                                                                                                   |
|                   | `migration/tracking/history.ts`           | 1     | `sqlite_migration_history`                                                                                                    |
|                   | `migration/tracking/status.ts`            | 1     | `sqlite_migration_status`                                                                                                     |

### Native-Only Handlers (`src/adapters/sqlite-native/tools/`)

| Group                | Handler File             | Tools | Notes                                                                                                                                                 |
| -------------------- | ------------------------ | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **stats** (window)   | `window.ts`              | 6     | `sqlite_window_row_number`, `sqlite_window_rank`, `sqlite_window_lag_lead`, `sqlite_window_running_total`, `sqlite_window_moving_avg`, `sqlite_window_ntile` |
| **transactions**     | `transactions.ts`        | 8     | `sqlite_transaction_begin`, `sqlite_transaction_status`, `sqlite_transaction_commit`, `sqlite_transaction_rollback`, `sqlite_transaction_savepoint`, `sqlite_transaction_release`, `sqlite_transaction_rollback_to`, `sqlite_transaction_execute` |
| **geo** (SpatiaLite) | `spatialite/tools.ts`    | 4     | `sqlite_spatialite_load`, `sqlite_spatialite_create_table`, `sqlite_spatialite_query`, `sqlite_spatialite_index`                                      |
|                      | `spatialite/analysis.ts` | 3     | `sqlite_spatialite_analyze`, `sqlite_spatialite_transform`, `sqlite_spatialite_import`                                                                |

### Utility Files (no tools, shared helpers)

Files that provide shared logic but do **not** register tools:

| File                             | Purpose                                                                                                                                                                    |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `core/tables.ts`                 | Also exports `isSpatialiteSystemTable()`, `isSpatialiteSystemView()`, `isSpatialiteSystemIndex()` — used by core + introspection tools for `excludeSystemTables` filtering |
| `column-validation.ts`           | `validateColumnExists()`, `validateTableExists()` — used by geo, stats, text, FTS, window                                                                                  |
| `json-operations/helpers.ts`     | JSON path/value normalization                                                                                                                                              |
| `json-helpers/helpers.ts`        | JSON helper utilities                                                                                                                                                      |
| `text/helpers.ts`                | Text processing shared logic                                                                                                                                               |
| `stats/helpers.ts`               | Stats calculation utilities                                                                                                                                                |
| `stats/inference.ts`             | Statistical type inference engine                                                                                                                                          |
| `stats/math-helpers.ts`          | Math utility functions (median, std dev)                                                                                                                                   |
| `vector/helpers.ts`              | Vector math utilities                                                                                                                                                      |
| `vector/schemas.ts`              | Zod schemas for vector tools                                                                                                                                               |
| `vector/tools.ts`                | Vector tool registration barrel                                                                                                                                            |
| `admin/helpers.ts`               | Admin tool shared utilities                                                                                                                                                |
| `migration/schemas.ts`           | Zod input schemas for migration tools (re-exports output schemas from `output-schemas/migration.ts`)                                                                       |
| `virtual/helpers.ts`             | Virtual table helper utilities                                                                                                                                             |
| `introspection/graph/helpers.ts` | FK graph traversal helpers                                                                                                                                                 |
| `spatialite/schemas.ts` (native) | Zod schemas for SpatiaLite tools                                                                                                                                           |
| `spatialite/loader.ts` (native)  | SpatiaLite extension loader + path resolution                                                                                                                              |

---

## Output Schemas (`src/adapters/sqlite/output-schemas/`)

Zod schemas that define the `outputSchema` for MCP tool responses. All output schemas are centralized here with named exports — **zero inline definitions** remain across all tool groups.

| File               | Groups Covered                                                                                                                                                                                 |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `common.ts`        | Shared base schemas (e.g., success/error shape)                                                                                                                                                |
| `error-mixin.ts`   | `ErrorFieldsMixin` — 6 optional error fields merged into all output schemas                                                                                                                    |
| `core.ts`          | Core group output schemas                                                                                                                                                                      |
| `json.ts`          | JSON group output schemas                                                                                                                                                                      |
| `text.ts`          | Text group output schemas (incl. `TextConcatOutputSchema`, `TextTrimOutputSchema`, `TextCaseOutputSchema`, `TextSubstringOutputSchema`, `AdvancedSearchOutputSchema`)                          |
| `fts.ts`           | FTS5 output schemas                                                                                                                                                                            |
| `stats.ts`         | Stats group output schemas (incl. `StatsHypothesisOutputSchema`)                                                                                                                               |
| `vector.ts`        | Vector group output schemas                                                                                                                                                                    |
| `admin.ts`         | Admin group output schemas (incl. `AppendInsightOutputSchema`, `DbstatOutputSchema`)                                                                                                           |
| `geo.ts`           | Geo group output schemas                                                                                                                                                                       |
| `introspection.ts` | Introspection group output schemas (10 schemas: DependencyGraph, TopologicalSort, CascadeSimulator, SchemaSnapshotShape, SchemaSnapshot, SchemaDiff, ConstraintAnalysis, MigrationRisks, StorageAnalysis, IndexAudit, QueryPlan) |
| `migration.ts`     | Migration group output schemas (7 schemas: MigrationInit, MigrationRecord, MigrationApply, MigrationRollback, MigrationHistory, MigrationStatus + MigrationRecordEntry)                        |
| `virtual.ts`       | Virtual table output schemas (7 schemas: ListVirtualTables, VirtualTableInfo, DropVirtualTable, CreateCsvTable, AnalyzeCsvSchema, CreateRtreeTable, CreateSeriesTable)                         |
| `native.ts`        | Native-only output schemas (transactions — 8 schemas, window functions — 6 schemas)                                                                                                            |
| `spatialite.ts`    | SpatiaLite output schemas (7 tools — native only)                                                                                                                                              |
| `server.ts`        | Type aliases for core output schemas (built-in tools use `content` pattern, not `structuredContent`)                                                                                           |
| `index.ts`         | Barrel re-export                                                                                                                                                                               |

---

## Prompts (`src/adapters/sqlite/prompts/`)

| File          | Prompts                                                                       |
| ------------- | ----------------------------------------------------------------------------- |
| `analysis.ts` | `sqlite_data_analysis`, `sqlite_summarize_table`, `sqlite_demo`               |
| `query.ts`    | `sqlite_query_builder`, `sqlite_debug_query`, `sqlite_hybrid_search_workflow` |
| `schema.ts`   | `sqlite_explain_schema`, `sqlite_documentation`, `sqlite_migration`           |
| `index.ts`    | Barrel + `sqlite_optimization`                                                |

Prompts with required arguments expose typed `argsSchema` via `prompts/list`. All-optional and zero-arg prompts correctly omit `argsSchema`.

---

## Error Class Hierarchy

All errors extend `DbMcpError` (defined in `src/utils/errors/base.ts`). Every tool returns structured `{success: false, error, code, category, suggestion, recoverable}` via `formatHandlerError()` — never raw MCP exceptions.

The `DbMcpError` constructor auto-refines generic codes (`DB_QUERY_FAILED`, `DB_WRITE_FAILED`, `QUERY_ERROR`, `RESOURCE_ERROR`, `UNKNOWN_ERROR`) to more specific codes (e.g., `TABLE_NOT_FOUND`, `COLUMN_NOT_FOUND`, `VIEW_NOT_FOUND`, `FILE_NOT_FOUND`, `MALFORMED_JSON`, `TRANSACTION_CONFLICT`) when the error message matches a suggestion pattern.

```
DbMcpError (base.ts)
├── ValidationError              code: VALIDATION_ERROR      category: validation
├── ConnectionError              code: CONNECTION_ERROR       category: connection      recoverable: true
├── QueryError                   code: QUERY_ERROR            category: query            accepts: sql option
├── PermissionError              code: PERMISSION_ERROR       category: permission
├── ResourceNotFoundError        code: RESOURCE_NOT_FOUND     category: resource         accepts: resourceType, resourceName
├── ConfigurationError           code: CONFIG_ERROR           category: config
├── InternalError                code: INTERNAL_ERROR         category: internal
├── AuthenticationError          code: AUTHENTICATION_ERROR   category: authentication
├── AuthorizationError           code: AUTHORIZATION_ERROR    category: authorization
├── TransactionError             code: TRANSACTION_ERROR      category: query            recoverable: true
└── ExtensionNotAvailableError   code: EXTENSION_MISSING      category: config           accepts: extensionName
```

**Usage pattern** — all tool handlers:

```typescript
import { ValidationError } from "../../utils/errors/index.js";
import { formatHandlerError } from "../../utils/errors/index.js";

// Throw typed errors:
throw new ValidationError("Table name required", "TABLE_NAME_REQUIRED", {
  suggestion: "Provide a valid table name",
});

// Catch at handler boundary:
catch (error) {
  return formatHandlerError(error);
}
```

**Error suggestions** — `src/utils/errors/suggestions.ts` provides:

- `suggestTableName(input, existingTables)` — fuzzy-matches typos
- `suggestColumnName(input, existingColumns)` — fuzzy-matches columns
- `suggestToolName(input)` — suggests similar tool names
- Pattern-based refinement: `TABLE_NOT_FOUND`, `COLUMN_NOT_FOUND`, `VIEW_NOT_FOUND`, `FILE_NOT_FOUND`, `MALFORMED_JSON`, `TRANSACTION_CONFLICT`, `DUPLICATE_MIGRATION`, `DUPLICATE_VERSION`, `ALREADY_ROLLED_BACK`, `DIMENSION_MISMATCH`, `VECTOR_NOT_FOUND`

---

## Key Constants & Config

| What                               | Where                                  | Notes                                                                                                         |
| ---------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Server instructions (agent prompt) | `src/constants/server-instructions.ts` | Generated: slim `INSTRUCTIONS` (~680 chars) + `HELP_CONTENT` map. Source: `server-instructions/*.md`          |
| Tool group arrays                  | `src/filtering/tool-constants.ts`      | `TOOL_GROUPS` map, `META_GROUPS` shortcuts                                                                    |
| Tool filter logic                  | `src/filtering/tool-filter.ts`         | `ToolFilter` class                                                                                            |
| JSON-RPC constants                 | `src/codemode/api-constants.ts`        | Error codes, method names for sandbox RPC                                                                     |
| Logger error codes                 | `src/utils/logger/error-codes.ts`      | Module-prefixed codes (`DB_`, `AUTH_`, etc.)                                                                  |
| Version SSoT                       | `src/version.ts`                       | Reads from `package.json` at runtime. Both adapters `import { VERSION }` — **never hardcode version strings** |

---

## Architecture Patterns (Quick Reference)

| Pattern                 | Description                                                                                                                                                                                                                                                                                |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Structured Errors**   | Every tool returns `{success: false, error, code, category, suggestion, recoverable}` — never raw exceptions. Uses `formatHandlerError()`.                                                                                                                                                 |
| **Adapter Pattern**     | `DatabaseAdapter` (abstract) → `SqliteAdapter` (WASM) / `NativeSqliteAdapter` (Native). Both share tool handler files from `sqlite/tools/`.                                                                                                                                                |
| **Schema Cache**        | `SchemaManager` caches table/column metadata with configurable TTL. Auto-invalidates on DDL ops.                                                                                                                                                                                           |
| **Code Mode Bridge**    | `sqlite.*` API in worker thread communicates via MessagePort RPC to main thread tool handlers. All 9 groups exposed (`core`, `json`, `text`, `stats`, `vector`, `geo`, `admin`, `introspection`, `migration`).                                                                             |
| **Tool Filtering**      | `ToolFilter` parses `--tool-filter` string → whitelist/blacklist of tool names. `codemode` auto-injected unless excluded. Help resources filtered to match enabled groups.                                                                                                                 |
| **Output Schemas**      | All Zod output schemas live in `output-schemas/` with named exports — **never inline** in handler files. Handlers import from `../../output-schemas/index.js`. All schemas extend `ErrorFieldsMixin.shape`. Domain-specific fields are optional so error responses pass validation.        |
| **Input Coercion**      | All numeric params use `z.preprocess(coerceNumber, ...)` so wrong-type strings fall to defaults. Required enums use `z.string()` + handler validation. Optional enums use `coerceEnumValues()` factory. Array params coerce non-arrays to empty arrays for SDK `.partial()` compatibility. |
| **Readonly Guard**      | Code mode `isWriteTool()` uses fail-closed logic (`readOnlyHint === true`) — tools without annotations are blocked in readonly mode.                                                                                                                                                       |
| **Parameter Aliases**   | Core tools support backward-compatible aliases (`tableName`→`table`, `sql`→`query`, `name`→`indexName`) via `resolveAliases()` in handlers. Canonical names take precedence.                                                                                                               |
| **Barrel Re-exports**   | Every directory has `index.ts` barrel. Import from `./module/index.js` (with `.js` extension for ESM).                                                                                                                                                                                     |
| **Module Logger**       | `createModuleLogger("moduleName")` → structured logs with `[module]` prefix.                                                                                                                                                                                                               |
| **Help Resources**      | Pull-based `sqlite://help` + `sqlite://help/{group}` replace the old push-based `--instruction-level` flag. Per-group `.md` sources in `server-instructions/`.                                                                                                                             |
| **DNS Rebinding Guard** | `localhostHostValidation()` middleware from MCP SDK on HTTP transport.                                                                                                                                                                                                                     |

---

## Import Path Conventions

- All imports use **`.js` extension** (ESM requirement): `import { x } from "./foo/index.js"`
- After splitting `foo.ts` → `foo/` directory: update imports from `./foo.js` → `./foo/index.js`
- Error classes can be imported from either:
  - `../../utils/errors/index.js` (direct)
  - `../../types/index.js` (re-exported subset: `DbMcpError`, `ValidationError`, `ConnectionError`, `QueryError`, `AuthenticationError`, `AuthorizationError`)

---

## Test Infrastructure

| File / Directory                             | Purpose                                                                                                            |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `test-server/README.md`                      | Agent testing orchestration doc                                                                                    |
| `test-server/test-database.sql`              | Seed DDL+DML (10 tables, ~400 rows)                                                                                |
| `test-server/reset-database.ps1`             | Reset script — drops + re-seeds `test.db`                                                                          |
| `test-server/tool-reference.md`              | Complete 167/140 tool inventory with descriptions                                                                  |
| `test-server/test-preflight.md`              | Pre-test verification checklist                                                                                    |
| `test-server/test-tool-groups/`              | 10 self-contained test prompts — one per tool group. Direct calls only.                                            |
| `test-server/test-codemode/`                 | 10 self-contained test prompts — one per tool group. Code Mode execution only.                                     |
| `test-server/test-advanced/`                 | 10 self-contained advanced stress test prompts — one per tool group.                                               |
| `test-server/test-resources.md`              | MCP resource verification prompts                                                                                  |
| `test-server/test-prompts.md`                | MCP prompt verification prompts                                                                                    |
| `test-server/test-agent-experience.md`       | 20 open-ended scenarios — validates help resource sufficiency                                                      |
| `test-server/test-help-resources.mjs`        | Integration test — slim instructions + help resource filtering                                                     |
| `test-server/test-tool-annotations.mjs`      | Integration test — openWorldHint annotation verification                                                           |
| `test-server/fixtures/`                      | Test fixture files (e.g., `sample.csv`)                                                                            |
| `tests/adapters/tool-annotations.test.ts`    | Vitest invariant — every tool has `annotations` with explicit `readOnlyHint`, per-group checks, title validation   |
| `tests/adapters/tool-output-schemas.test.ts` | Vitest invariant — every tool has `outputSchema`, error response acceptance, centralized schema wiring, no orphans |
| `tests/`                                     | Vitest unit tests (per-module)                                                                                     |
| `tests/e2e/`                                 | Playwright E2E tests (~50 spec files, ~300+ tests) — HTTP/SSE transport parity                                     |
| `benchmarks/`                                | Vitest bench performance benchmarks                                                                                |

### E2E Spec Files (`tests/e2e/`)

| Spec File                                      | Coverage                                                                                                                                                   |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `zod-sweep.spec.ts`                            | Zod validation sweep — every WASM tool called with `{}`                                                                                                    |
| `zod-sweep-native.spec.ts`                     | Zod validation sweep — 20 native-only tools (FTS5, window, transactions, SpatiaLite)                                                                       |
| `errors.spec.ts`                               | Basic error path tests                                                                                                                                     |
| `errors-extended.spec.ts`                      | Per-group domain error paths                                                                                                                               |
| `errors-native.spec.ts`                        | Native-only error paths (20 tests)                                                                                                                         |
| `codemode.spec.ts`                             | Sandbox lifecycle, security, readonly, workflows, window function smoke tests, API discoverability                                                         |
| `codemode-groups.spec.ts`                      | All 9 groups via `sqlite.*` API                                                                                                                            |
| `codemode-introspection.spec.ts`               | Introspection code-mode-only params (~16 tests)                                                                                                            |
| `numeric-coercion.spec.ts`                     | String-typed numeric param coercion                                                                                                                        |
| `numeric-coercion-native.spec.ts`              | Native-only numeric coercion (8 tests)                                                                                                                     |
| `boundary.spec.ts`                             | Empty tables, NULLs, idempotency, edge cases, vector empty table edges                                                                                     |
| `help-resources.spec.ts`                       | Root + 8 group help resources listed, readable, non-empty                                                                                                  |
| `aliases.spec.ts`                              | Backward-compatible parameter aliases (14 tests)                                                                                                           |
| `resources.spec.ts`                            | MCP resource verification (schema, tables, indexes, health, meta, insights, help)                                                                          |
| `prompts.spec.ts`                              | MCP prompt verification (argsSchema, required args, content assertions)                                                                                    |
| `transactions-nested.spec.ts`                  | Nested savepoint data correctness (~4 tests)                                                                                                               |
| `integration-workflows.spec.ts`                | Cross-group pipelines (~8 tests)                                                                                                                           |
| `payloads-*.spec.ts`                           | Per-group payload correctness (core, json, text, fts, stats, vector, geo, admin, introspection, migration, spatialite, transactions, window, virtual, csv) |
| `auth.spec.ts`, `oauth-discovery.spec.ts`      | OAuth 2.1 and RFC 9728 metadata                                                                                                                            |
| `health.spec.ts`                               | Health endpoint verification                                                                                                                               |
| `security.spec.ts`                             | Security header assertions, HSTS                                                                                                                           |
| `sessions.spec.ts`, `session-advanced.spec.ts` | Session management (cross-protocol, sequential isolation, post-DELETE)                                                                                     |
| `streaming.spec.ts`, `streamable-http.spec.ts` | Raw SSE streaming verification                                                                                                                             |
| `rate-limiting.spec.ts`                        | 429 burst, Retry-After header, health exemption                                                                                                            |
| `protocols.spec.ts`                            | Transport protocol tests                                                                                                                                   |
| `stateless.spec.ts`                            | Stateless mode tests                                                                                                                                       |
| `tools.spec.ts`                                | Core tool listing and invocation                                                                                                                           |
| `native.spec.ts`, `wasm.spec.ts`               | Backend-specific tests                                                                                                                                     |
