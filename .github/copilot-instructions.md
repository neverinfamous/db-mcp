# db-mcp — Copilot Code Review Context

## Project Overview

db-mcp is a TypeScript MCP (Model Context Protocol) server for SQLite database integration. It offers **181 Native / 154 WASM tools** with dual backends — native (better-sqlite3) for full performance and WASM (sql.js) for zero-dependency portability. Features include Code Mode (sandboxed JS execution), HTTP/SSE transport, OAuth 2.1, Tool Filtering, and Audit/Token Logging.

**Stack**: TypeScript, Vitest, Playwright (E2E), Zod schemas, better-sqlite3 (native), sql.js (WASM), Commander (CLI).

> **Note**: For any CLI interactions involving Copilot, you must reference `gh copilot` and NEVER the deprecated `github-copilot-cli`.

## Session Context

Before starting work on this project, read `memory://briefing/db-mcp` from the `memory-journal-mcp` server for real-time context:

- **Recent journal entries** — what was just worked on by the development agent
- **GitHub status** — open issues, PRs, CI status, milestones
- **Workflow runs** — recent CI/CD results
- **Copilot review summaries** — your own recent review findings

For detailed session handoff context, search for entries tagged `session-summary` — these contain end-of-session notes from the development agent.

If you find issues during code review, use `create_entry` with tag `copilot-finding` to record them for the development agent to see in their next session briefing.

## Coding Standards

### Naming

- **Files and folders**: Always kebab-case (`database-adapter.ts`, `tool-filter.ts`)
- **Never** PascalCase or camelCase for filenames

### Modularity

- **File size limit**: Source files stay under ~500 lines
- **Split pattern**: `foo.ts` → `foo/` directory with sub-modules + `foo/index.ts` barrel re-export
- **Logical grouping**: Split by functional cohesion, not arbitrary line counts

### Type Safety

- **Strict TypeScript** — `tsconfig.json` enforces strict mode
- **Never use `eslint-disable`** to evade standards
- **Never use `any`** — use `unknown` and narrow with type guards
- **Never use `as` type assertions** — use `satisfies` operator or strict type guards
- **Never use `@ts-ignore` or `@ts-expect-error`** — fix the underlying type issue
- **Zod schemas** for all tool input validation at system boundaries
- **Union types over enums** — use `type Status = "active" | "inactive"` instead of `enum`

### Error Handling

All tool handlers return structured error responses — never raw exceptions:

```typescript
{
  success: false,
  error: string,        // Human-readable message
  code: string,         // Module-prefixed code (e.g., "QUERY_ERROR")
  category: string,     // Error category (validation, connection, query, etc.)
  suggestion: string,   // Actionable fix for the agent
  recoverable: boolean  // true = user can fix, false = server error
}
```

## Architecture

```
src/
├── cli.ts                      # CLI entry point (Commander)
├── index.ts                    # Library entry point
├── version.ts                  # Centralized version constant
├── adapters/                   # Database adapters (native + WASM)
├── audit/                      # Audit and token logging
├── auth/                       # OAuth 2.1 authentication
├── codemode/                   # Sandboxed JS execution engine
├── constants/                  # Server instructions, config
├── filtering/                  # Tool filtering (groups, meta-groups)
├── observability/              # Logging, metrics, and health checks
├── server/                     # MCP server setup and registration
├── transports/                 # HTTP/SSE transport layer
├── types/                      # Type definitions + barrel exports
└── utils/                      # Logger, error helpers, utilities
```

## Key Reference Files

| File               | Purpose                             |
| ------------------ | ----------------------------------- |
| `CONTRIBUTING.md`  | Development setup and PR guidelines |
| `DOCKER_README.md` | Docker Hub documentation            |
| `CHANGELOG.md`     | Version history                     |

## Review Checklist

When reviewing PRs, check for:

- [ ] Hardcoded tool/group counts — should be dynamic
- [ ] Missing barrel exports in `src/types/index.ts` when new types are added
- [ ] `eslint-disable` usage — always forbidden
- [ ] `@ts-ignore` or `as any` — always forbidden
- [ ] Raw exceptions from tool handlers — must use structured error responses
- [ ] Files approaching 500 lines — flag for splitting
- [ ] New tools missing from tool filtering configuration
- [ ] Missing Zod schemas on new tools
- [ ] Kebab-case violations in new filenames
- [ ] `continue-on-error: true` in workflow files — forbidden per project standards
