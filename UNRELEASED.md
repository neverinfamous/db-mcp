# Unreleased

## Changed
- **Complexity Refactor**: Addressed source code complexity by splitting files exceeding logical grouping boundaries into modular directories with barrel exports:
  - Extracted query execution, initialization, and connection lifecycle handlers from `sqlite-adapter.ts`.
  - modularized authentication routines in `middleware.ts` and `scopes.ts`.
  - Refined administration and stats tools (`backup.ts`, `tracking.ts`, `vtable.ts`, `inference.ts`).
  - Extracted resource, tool, and prompt registration logic from `database-adapter.ts`.
- **Code Quality Audit**: Addressed technical debt across the codebase by replacing generic `any` casts with type-safe structures, normalizing test file naming from `.test` to `kebab-case`, extracting massive `native-sqlite-adapter.ts` tooling logic into `registration`, and removing unsafe type imports.
- **Code Quality Audit**: Removed dead code by deleting unused barrel files (`src/auth/index.ts` and `src/transports/index.ts`).
