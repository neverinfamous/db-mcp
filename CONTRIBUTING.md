# Contributing to db-mcp

Thank you for your interest in contributing to db-mcp! This project is built by developers, for developers, and we welcome contributions that make the SQLite MCP experience better for everyone.

## 🚀 Quick Start

1. **Fork the repository** on GitHub
2. **Clone your fork** locally
3. **Create a feature branch** from `main`
4. **Make your changes** and test thoroughly
5. **Submit a pull request** with a clear description

## 🛠️ Development Setup

### Prerequisites

- **Node.js 24+** (see `engines` in `package.json`)
- **npm** (comes with Node.js)
- **Git** (for version control)
- **Docker** (optional, for container testing)

### Local Development

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/db-mcp.git
cd db-mcp

# Install dependencies
pnpm install

# Build TypeScript
pnpm run build

# Run the test suite
pnpm test

# Run the full quality check
pnpm run check   # Runs ESLint + TypeScript strict-mode type checking
```

### Running the Server Locally

```bash
# Connect to a local SQLite instance via stdio
node dist/cli.js --transport stdio --sqlite-native ./test.db

# HTTP transport (for testing with an MCP client)
node dist/cli.js --transport http --port 3000 --sqlite-native ./test.db
```

> **Database path required.** The server requires a valid SQLite database path. For local testing, you can use a `.env` file or pass the string directly.

### Docker Development (Optional)

```bash
# Build the Docker image locally
docker build -f Dockerfile -t db-mcp-dev .

# Run with a connection string
docker run --rm -i db-mcp-dev --transport stdio --sqlite-native /app/data/test.db
```

## 📋 What We're Looking For

We especially welcome contributions in these areas:

### 🎯 High Priority

- **Bug fixes** and stability improvements
- **Performance improvements** (faster tool dispatch, reduced overhead, connection pool tuning)
- **New tools** that extend SQLite capabilities within existing groups
- **Better error messages** with actionable remediation hints

### 🔍 Medium Priority

- **Enhanced Code Mode** worker-thread operations and sandbox capabilities
- **Additional SpatiaLite** advanced spatial/math tool coverage
- **New SQLite extensions integrations** (e.g., pgvector equivalent, full-text search improvements)
- **Documentation improvements** and Playwright end-to-end examples

### 💡 Future Features

- **New tool groups** for specialized SQLite workflows
- **Additional SQLite extension** integrations
- **Performance benchmarks** for new hot paths
- **IDE-specific integrations** beyond MCP

## 🧪 Testing Your Changes

### Automated Testing

```bash
# Run all tests
pnpm test

# Run tests with coverage
pnpm run test:coverage

# Run a specific test file
pnpm dlx vitest run src/__tests__/your-test-file.test.ts

# Run benchmarks
pnpm run bench
```

### Quality Checks

```bash
# Lint + type check (required before submitting)
pnpm run check   # ESLint + TypeScript strict-mode

# Or individually
pnpm run lint        # ESLint only
pnpm run typecheck   # TypeScript strict-mode type checking
```

### End-to-End Tests

The Playwright E2E suite validates HTTP and SSE transport parity:

```bash
pnpm run test:e2e
```

### Manual Testing with MCP Client

Add your local build to `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "db-mcp-dev": {
      "command": "node",
      "args": [
        "path/to/your/db-mcp/dist/cli.js",
        "--transport",
        "stdio",
        "--sqlite-native",
        "./test.db"
      ]
    }
  }
}
```

### Docker Testing

```bash
# Build and run locally
docker build -f Dockerfile -t db-mcp-dev .
docker run --rm -i db-mcp-dev --transport stdio --sqlite-native /app/data/test.db
```

## 📝 Coding Standards

### TypeScript Code Style

- **Strict mode** — `tsconfig.json` enforces strict TypeScript
- **ESLint** — Run `pnpm run lint` to check, `pnpm run lint:fix` to auto-fix (when available)
- **Prettier** — Formatting is handled automatically during the release workflow
- **Type safety** — Avoid `any`; use proper types and Zod schemas
- **Modularity** — Keep files under ~500 lines; split into sub-modules when approaching the limit
- **Error handling** — Use structured `{success, error, code, category, suggestion, recoverable}` responses in tool handlers

### File Naming

All files and directories use **kebab-case** (lowercase with dashes):

- ✅ `database-adapter.ts`, `tool-filter.ts`, `pool-manager/`
- ❌ `DatabaseAdapter.ts`, `toolFilter.ts`

### Structured Error Handling

Every tool must return structured error responses — never raw exceptions:

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

Error logic should leverage the `SqliteMcpError` hierarchy (e.g., `ValidationError`, `QueryError`). Our Auto-refinement system automatically maps generic codes to specific ones (e.g., `QUERY_ERROR` → `TABLE_NOT_FOUND`) and populates suggestions. Catch at the handler boundary and return `formatHandlerError(error)` to ensure a highly-compliant JSON payload. Always propagate stack traces — don't swallow errors.

### Input Validation

- All parameters are validated via **Zod schemas** with explicit coercion controls (e.g., `z.preprocess(coerceNumber, z.number().optional())` instead of aggressive `z.coerce.number()`)
- Output schemas are strictly defined to guarantee AI agents receive deterministic P154-compliant structures (using `openWorldHint: false`)
- Invalid inputs must return structured errors, automatically handled by `formatHandlerError()` without raw Zod validation messages
- SQL injection is prevented via **parameter binding** — never interpolate user input into SQL strings

### Logging

Use the centralized logger with structured payloads. Include: `module`, `operation`, `entityId`, `context`, and `stack` (for errors). Severity levels: `error`, `warning`, `info`, `debug`.

### Docker Considerations

- **Multi-stage builds** — Keep images lean
- **Security** — Run as non-root user, minimal privileges
- **Multi-platform** — Test on both amd64 and arm64 when possible
- **Documentation** — Update Docker guides if needed

## 🔧 Adding or Modifying Tools

db-mcp organizes tools into groups covering: `core`, `json`, `text`, `stats`, `vector`, `admin`, `transactions`, `geo`, `introspection`, `migration`, and `codemode`. When adding a new tool:

1. **Define the tool input and output schemas** using Zod in the appropriate group under `src/adapters/sqlite/schemas/`
2. **Implement the handler** in the corresponding adapter directory under `src/adapters/sqlite/tools/`
3. **Add structured error handling** by letting the handler return `formatHandlerError()` when exceptions are caught
4. **Write meaningful Vitest tests** and update E2E spec files if making systemic changes
5. **Add the tool to the group's help resource** (the markdown file under `src/constants/server-instructions/`)
6. **Update the tool reference documentation** in `test-server/tool-reference.md` and the filtering constants in `src/filtering/tool-constants.ts`
7. **Verify OAuth Scope** — ensure the new tool aligns with its group's defined OAuth 2.1 scope (`read`, `write`, or `admin`)
8. **Update `UNRELEASED.md`** with your change (see [Changelog](#-changelog) below)

## 🐛 Bug Reports

When reporting bugs, please include:

1. **Environment details** (OS, Node.js version, npm version)
2. **Steps to reproduce** the issue
3. **Expected vs actual behavior**
4. **SQLite version** and relevant extensions enabled
5. **MCP client details** (Cursor version, Claude Desktop, configuration)
6. **Relevant logs** or error messages

Use our [Bug Report template](.github/ISSUE_TEMPLATE/bug_report.md) for consistency.

## 💡 Feature Requests

For new features, please provide:

1. **Use case description** — What problem does this solve?
2. **Proposed solution** — How should it work?
3. **Tool group fit** — Which group does this belong to, or does it need a new one?
4. **Alternatives considered** — What other approaches did you think about?
5. **Implementation notes** — Any technical considerations

Use our [Feature Request template](.github/ISSUE_TEMPLATE/feature_request.md).

## 🔄 Pull Request Process

### Before Submitting

- [ ] **Fork** the repository and create a feature branch
- [ ] **Test** your changes (`pnpm run check && pnpm test`)
- [ ] **Update documentation** if you changed APIs or behavior
- [ ] **Add examples** for new features
- [ ] **Update `UNRELEASED.md`** with your change
- [ ] **Check** that existing functionality still works

### PR Description Should Include

- **Summary** of changes made
- **Testing** performed (how did you verify it works?)
- **Breaking changes** (if any)
- **Related issues** (fixes #123)

### Review Process

1. **Automated checks** must pass (lint, typecheck, tests)
2. **Maintainer review** — we'll provide feedback
3. **Address feedback** — make requested changes
4. **Merge** — once approved, we'll merge your PR

### What CI Will Check

| Workflow        | What It Does                                 |
| --------------- | -------------------------------------------- |
| **Lint & Test** | ESLint, TypeScript strict-mode, Vitest suite |
| **CodeQL**      | Static analysis for security vulnerabilities |
| **E2E**         | Playwright end-to-end transport parity tests |

All checks must pass before merge. Security steps **hard-fail on fixable issues** — this is intentional.

## 📄 Changelog

Log all changes in **[`UNRELEASED.md`](UNRELEASED.md)** at the project root using [Keep a Changelog](https://keepachangelog.com/) format. Use the appropriate header:

- `### Added` — new features or tools
- `### Changed` — changes to existing functionality
- `### Fixed` — bug fixes
- `### Removed` — removed features
- `### Security` — vulnerability fixes

> **Do not edit `CHANGELOG.md` directly** — it is assembled automatically during the release process.

## 🎯 Development Tips

### Working with MCP

- **Test with a real SQLite database** — behaviour varies across versions and extension states
- **Check tool responses** — Ensure JSON responses are well-formed
- **Output schemas** — All tools have Zod output schemas; error responses must pass validation
- **Dual-schema pattern** — Relaxed schemas for SDK validation, strict schemas inside handlers

### Architecture Overview

```
src/
├── adapters/       # SQLite queries, handlers, Zod schemas, prompts, and resources
├── audit/          # JSONL audit trail with session token estimates, pre-mutation snapshots, interceptor
├── auth/           # Transport-agnostic OAuth 2.1, scopes, RFC 6750 enforcement
├── cli.ts          # CLI argument parsing, server bootstrap, and entry point
├── codemode/       # Sandboxed JavaScript execution (Code Mode — VM & Worker Isolate)
├── constants/      # Help content generation and dynamic server instructions
├── filtering/      # Tool filter parsing, group resolution
├── pool/           # Connection pool management
├── server/         # MCP server setup, handler registration
├── transports/     # HTTP/SSE/stdio transport layer
├── types/          # Core TypeScript types (errors, schema, mcp, oauth)
├── utils/          # Logging, sanitization, validation, errors helpers
└── index.ts        # Public API exports
```

### Available Scripts

| Script                  | Purpose                                              |
| ----------------------- | ---------------------------------------------------- |
| `pnpm run build`         | Production build via tsc                             |
| `pnpm run dev`           | Watch mode (incremental builds)                      |
| `pnpm run check`         | **Quality gate** — lint + typecheck (run before PRs) |
| `pnpm run lint`          | ESLint only                                          |
| `pnpm run typecheck`     | TypeScript strict-mode type checking                 |
| `pnpm test`              | Run all unit tests (Vitest)                          |
| `pnpm run test:coverage` | Tests with V8 coverage report                        |
| `pnpm run test:e2e`      | Playwright end-to-end tests (HTTP/SSE transport)     |
| `pnpm run bench`         | Performance benchmarks (tinybench via Vitest)        |
| `pnpm run bench:verbose` | Benchmarks with detailed timings                     |

### Benchmarks

If your change touches a hot path (tool dispatch, schema parsing, auth, Code Mode, connection pool), run benchmarks to verify you haven't introduced a regression:

```bash
pnpm run bench
```

## 🔐 Security

If you discover a security vulnerability, **do not** open a public issue. Please follow our [Security Policy](SECURITY.md) and report it to **admin@adamic.tech**.

When contributing code, follow these security practices:

- **Parameter binding** for all SQL — never string interpolation
- **Input validation** via Zod schemas at tool boundaries
- **No secrets in code** — use environment variables (`.env` files are gitignored)
- **Typed error classes** with descriptive messages — don't expose internal details to end users
- **Transport Security** — preserve DNS rebinding protection and Slowloris DoS timeouts in HTTP layers

## 🤝 Community

- **Be respectful** — Follow our [Code of Conduct](CODE_OF_CONDUCT.md)
- **Ask questions** — Use GitHub Issues for discussion
- **Share ideas** — Feature requests and feedback welcome
- **Help others** — Answer questions and review PRs

## 📞 Getting Help

- **GitHub Issues** — Bug reports and feature requests
- **Documentation** — Check [README.md](README.md), [Wiki](https://github.com/neverinfamous/db-mcp/wiki), and Docker guides first
- **Email** — **admin@adamic.tech**

## 🏆 Recognition

Contributors are recognized in:

- **Release notes** — Major contributions highlighted
- **README** — Contributor acknowledgments
- **Git history** — Your commits are permanent record

Thank you for helping make db-mcp better for the developer community! 🚀
