# Unreleased

## Changed
- **Complexity Refactor**: Addressed source code complexity by splitting files exceeding logical grouping boundaries into modular directories with barrel exports:
  - Extracted query execution, initialization, and connection lifecycle handlers from `sqlite-adapter.ts`.
  - modularized authentication routines in `middleware.ts` and `scopes.ts`.
  - Refined administration and stats tools (`backup.ts`, `tracking.ts`, `vtable.ts`, `inference.ts`).
  - Extracted resource, tool, and prompt registration logic from `database-adapter.ts`.
- **Code Quality Audit**: Addressed technical debt across the codebase by replacing generic `any` casts with type-safe structures, normalizing test file naming from `.test` to `kebab-case`, extracting massive `native-sqlite-adapter.ts` tooling logic into `registration`, and removing unsafe type imports.
- **Code Quality Audit**: Removed dead code by deleting unused barrel files (`src/auth/index.ts` and `src/transports/index.ts`).
- **Performance Audit**: Disabled source maps generation in the production build to significantly reduce bundle size (from 3.7MB to 1.5MB), optimized sandbox serialization to reduce runtime memory allocations, and added caching to schema introspection tools via `SchemaManager`.

## Security
- **Strict Validation**: Hardened all Zod tool input schemas across sqlite and native-sqlite adapters using `.strict()` to reject unknown fields.
- **SQL Injection**: Added strong regex validation to `savepoint` names in the Native SQLite transaction methods to prevent potential arbitrary SQL injection.
- **CORS Advisory**: Updated `README.md` and `DOCKER_README.md` to explicitly warn about the permissive `["*"]` default CORS property in production HTTP deployments.

## Fixed
- **Validation Leaks**: Fixed Zod output schema errors in JSON tools (`sqlite_json_valid`, `sqlite_json_validate_path`) and core tools (`sqlite_drop_table`, `sqlite_create_index`, `sqlite_drop_index`) that caused the server to return raw MCP `-32602` validation frames instead of structured domain errors, by marking conditional message fields as optional.
- **Input Coercion**: Handled invalid numeric input types gracefully in JSON operations (`sqlite_json_each`, `sqlite_json_query`, `sqlite_json_analyze_schema`, `sqlite_json_storage_info`) by applying `z.coerce.number()` to `limit` and `sampleSize` parameters, enabling the SDK to pass the value instead of throwing a validation frame.
- **JSON Serialization**: Fixed an issue in `sqlite_json_query` where querying a column converted to JSONB would return the raw binary Buffer instead of the parsed JSON string by explicitly wrapping the column selection in `json()`.
