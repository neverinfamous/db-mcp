# Unreleased

## Changed
- **Complexity Refactor**: Addressed source code complexity by splitting files exceeding logical grouping boundaries into modular directories with barrel exports:
  - Extracted query execution, initialization, and connection lifecycle handlers from `sqlite-adapter.ts`.
  - modularized authentication routines in `middleware.ts` and `scopes.ts`.
  - Refined administration and stats tools (`backup.ts`, `tracking.ts`, `vtable.ts`, `inference.ts`).
  - Extracted resource, tool, and prompt registration logic from `database-adapter.ts`.
