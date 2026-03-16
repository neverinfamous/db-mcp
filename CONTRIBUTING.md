# Contributing to db-mcp

Thank you for your interest in contributing to db-mcp! This guide covers everything you need to get started — from setting up your environment to understanding our code conventions and submitting a pull request.

## Prerequisites

- **Node.js 24+** (LTS) — required by `engines` in `package.json`
- **Git** with SSH access configured
- **Docker** (optional, for container-based testing)

For native backend development (better-sqlite3), you'll also need a C++ build toolchain:

- **Windows:** Visual Studio Build Tools (C++ workload)
- **macOS:** Xcode Command Line Tools (`xcode-select --install`)
- **Linux:** `build-essential`, `python3`

## Getting Started

1. **Fork** the repository on GitHub
2. **Clone** your fork locally:

   ```bash
   git clone https://github.com/YOUR_USERNAME/db-mcp.git
   cd db-mcp
   ```

3. **Install** dependencies:

   ```bash
   npm install
   ```

4. **Build** the project:

   ```bash
   npm run build
   ```

5. **Run the quality gate** to confirm everything works:

   ```bash
   npm run check   # Runs ESLint + TypeScript strict-mode type checking
   npm test         # Runs the full Vitest suite (941+ tests)
   ```

6. **Create a branch** for your changes:

   ```bash
   git checkout -b feature/your-feature-name
   ```

## Development Workflow

### Available Scripts

| Script                | Purpose                                          |
| --------------------- | ------------------------------------------------ |
| `npm run build`       | Production build via tsup                        |
| `npm run check`       | **Quality gate** — lint + typecheck (run before PRs) |
| `npm run lint`        | ESLint only                                      |
| `npm run lint:fix`    | ESLint with auto-fix                             |
| `npm run typecheck`   | TypeScript strict-mode type checking             |
| `npm test`            | Run all unit tests (Vitest)                      |
| `npm run test:watch`  | Watch mode for iterative development             |
| `npm run test:e2e`    | Playwright end-to-end tests (HTTP/SSE transport) |
| `npm run bench`       | Performance benchmarks (tinybench via Vitest)    |
| `npm run bench:verbose` | Benchmarks with detailed timings               |

### Running the Server Locally

```bash
# Native backend (better-sqlite3) — full 139-tool feature set
node dist/cli.js --transport stdio --sqlite-native :memory:

# WASM backend (sql.js) — 115 tools, no native dependencies
node dist/cli.js --transport stdio --sqlite :memory:
```

> **Backend choice matters for testing.** If your change touches native-only features (transactions, window functions, SpatiaLite, FTS5 advanced), test against `--sqlite-native`. If it's backend-agnostic, verify against both.

## Project Architecture

```
src/
├── adapters/       # Database backend implementations (WASM + Native)
├── auth/           # OAuth 2.1, bearer token, scope enforcement
├── cli.ts          # CLI argument parsing and server bootstrap
├── codemode/       # Sandboxed JavaScript execution (Code Mode)
├── constants/      # Tool definitions, help content, prompts
├── filtering/      # Tool filter parsing, group/shortcut resolution
├── server/         # MCP server setup, handler registration
├── transports/     # HTTP/SSE/stdio transport layer
├── types/          # Shared TypeScript type definitions
├── utils/          # Logging, sanitization, validation helpers
└── version.ts      # Version SSoT (synced with package.json)
```

## Code Conventions

### File Naming

All files and directories use **kebab-case** (lowercase with dashes):

- ✅ `database-adapter.ts`, `tool-filter.ts`, `json-operations/`
- ❌ `DatabaseAdapter.ts`, `toolFilter.ts`

### TypeScript

- **Strict mode** with no `any` types — the entire codebase is fully type-safe
- **No `eslint-disable`** — do not suppress linting rules. Exceptions are allowed only for external SDK deprecations where the linter genuinely misunderstands intent
- **Formatting** is handled automatically by Prettier during the release workflow — no need to run it manually

### Modularity

- **Source files stay under ~500 lines.** If a file is approaching that limit, split it proactively
- **Split pattern:** `foo.ts` → `foo/` directory with sub-modules + `foo/index.ts` barrel re-export
- **Group by functional cohesion** (e.g., CRUD vs. analysis, basic vs. advanced), not arbitrary line counts

### Structured Error Handling

Every tool must return structured error responses — never raw exceptions. The format is:

```json
{
  "success": false,
  "error": "Descriptive message with context",
  "code": "MODULE_ERROR_CODE",
  "category": "VALIDATION_ERROR",
  "suggestion": "Actionable remediation hint",
  "recoverable": true
}
```

Error codes should be module-prefixed (e.g., `JSON_PARSE_FAILED`, `VECTOR_DIMENSION_MISMATCH`). Use `try/catch` at boundaries, not every statement. Always propagate stack traces — don't swallow errors.

### Logging

Use the centralized logger with structured payloads. Include: `module`, `operation`, `entityId`, `context`, and `stack` (for errors). Severity levels: `error`, `warning`, `info`, `debug`.

## Adding or Modifying Tools

db-mcp organizes tools into **10 groups**: `core`, `json`, `text`, `stats`, `vector`, `admin`, `geo`, `introspection`, `migration`, and `codemode`. When adding a new tool:

1. **Define the tool** with its Zod input schema in the appropriate group under `src/constants/`
2. **Implement the handler** in the corresponding adapter directory
3. **Add structured error handling** using the pattern above
4. **Write tests** — meaningful tests, not coverage boosters
5. **Add the tool to the group's help resource** (the markdown file under `src/constants/`)
6. **Update `UNRELEASED.md`** with your change (see [Changelog](#changelog) below)

### Input Validation

- All parameters are validated via **Zod schemas** with coercion where appropriate (e.g., `z.coerce.number()` for numeric params that may arrive as strings)
- Invalid inputs must return structured errors, not raw Zod validation messages
- SQL injection is prevented via **parameter binding** — never interpolate user input into SQL strings

## Testing

### Unit Tests

Tests live alongside source files or in a `__tests__` directory. We use **Vitest**:

```bash
# Run the full suite
npm test

# Run a specific test file
npx vitest run src/adapters/sqlite-native.test.ts

# Watch mode for a specific file
npx vitest src/adapters/sqlite-native.test.ts
```

Write meaningful tests that validate behavior. Every new tool should have tests covering:

- Happy path with expected inputs
- Edge cases (empty inputs, boundary values)
- Error paths (invalid inputs return structured errors, not exceptions)

### End-to-End Tests

The Playwright E2E suite validates HTTP and SSE transport parity:

```bash
npm run test:e2e
```

### Benchmarks

If your change touches a hot path (tool dispatch, schema parsing, auth, Code Mode), run benchmarks to verify you haven't introduced a regression:

```bash
npm run bench
```

## Changelog

Log all changes in **[`UNRELEASED.md`](UNRELEASED.md)** at the project root using [Keep a Changelog](https://keepachangelog.com/) format. Use the appropriate header:

- `### Added` — new features or tools
- `### Changed` — changes to existing functionality
- `### Fixed` — bug fixes
- `### Removed` — removed features
- `### Security` — vulnerability fixes

> **Do not edit `CHANGELOG.md` directly** — it is assembled automatically during the release process.

## Submitting a Pull Request

1. **Ensure all checks pass:**

   ```bash
   npm run check   # Lint + typecheck
   npm test         # Unit tests
   ```

2. **Update documentation** — if your change affects user-facing behavior, update the README, help resources, or Wiki as appropriate
3. **Update `UNRELEASED.md`** with your change
4. **Commit** with a clear, descriptive message. Reference issues when applicable (`Fixes #123`). Keep commits atomic — one logical change per commit
5. **Push** to your fork and **open a Pull Request**

Our [PR template](.github/pull_request_template.md) includes a checklist — please complete it. We also have [issue templates](.github/ISSUE_TEMPLATE/) for bug reports and feature requests.

### What CI Will Check

When you open a PR, the following checks run automatically:

| Workflow        | What It Does                                       |
| --------------- | -------------------------------------------------- |
| **Lint & Test** | ESLint, TypeScript strict-mode, Vitest suite       |
| **CodeQL**      | Static analysis for security vulnerabilities       |
| **E2E**         | Playwright end-to-end transport parity tests       |

All checks must pass before merge. Security steps **hard-fail on fixable issues** — this is intentional.

## Security

If you discover a security vulnerability, **do not** open a public issue. Please follow our [Security Policy](SECURITY.md) and report it to **admin@adamic.tech**.

When contributing code, follow these security practices:

- **Parameter binding** for all SQL — never string interpolation
- **Input validation** via Zod schemas at tool boundaries
- **No secrets in code** — use environment variables (`.env` files are gitignored)
- **Typed error classes** with descriptive messages — don't expose internal details to end users

## Questions?

If you have questions or want to discuss a potential contribution, feel free to:

- Open an [issue](https://github.com/neverinfamous/db-mcp/issues) for discussion
- Email **admin@adamic.tech**
