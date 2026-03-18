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

For native backend development (better-sqlite3), you'll also need a C++ build toolchain:

- **Windows:** Visual Studio Build Tools (C++ workload)
- **macOS:** Xcode Command Line Tools (`xcode-select --install`)
- **Linux:** `build-essential`, `python3`

### Local Development

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/db-mcp.git
cd db-mcp

# Install dependencies
npm install

# Build TypeScript
npm run build

# Run the test suite
npm test

# Run the full quality check
npm run check   # Runs ESLint + TypeScript strict-mode type checking
```

### Running the Server Locally

```bash
# Native backend (better-sqlite3) — full 139-tool feature set
node dist/cli.js --transport stdio --sqlite-native :memory:

# WASM backend (sql.js) — 115 tools, no native dependencies
node dist/cli.js --transport stdio --sqlite :memory:
```

> **Backend choice matters for testing.** If your change touches native-only features (transactions, window functions, SpatiaLite, FTS5 advanced), test against `--sqlite-native`. If it's backend-agnostic, verify against both.

### Docker Development (Optional)

```bash
# Build the Docker image locally
docker build -f Dockerfile -t db-mcp-dev .

# Run with a data volume
docker run --rm -i -v ./data:/workspace db-mcp-dev --sqlite-native /workspace/database.db
```

## 📋 What We're Looking For

We especially welcome contributions in these areas:

### 🎯 High Priority

- **Bug fixes** and stability improvements
- **Performance improvements** (faster tool dispatch, reduced overhead)
- **New tools** that extend SQLite capabilities within existing groups
- **Better error messages** with actionable remediation hints

### 🔍 Medium Priority

- **Enhanced Code Mode** features and sandbox capabilities
- **Additional vector search** models and similarity metrics
- **Geospatial improvements** (SpatiaLite integration, new geo tools)
- **Documentation improvements** and examples

### 💡 Future Features

- **New tool groups** for specialized SQL workflows
- **Additional SQLite extension** integrations
- **Performance benchmarks** for new hot paths
- **IDE-specific integrations** beyond MCP

## 🧪 Testing Your Changes

### Automated Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run a specific test file
npx vitest run src/adapters/sqlite-native.test.ts

# Run benchmarks
npm run bench
```

### Quality Checks

```bash
# Lint + type check (required before submitting)
npm run check   # ESLint + TypeScript strict-mode

# Or individually
npm run lint        # ESLint only
npm run lint:fix    # ESLint with auto-fix
npm run typecheck   # TypeScript strict-mode type checking
```

### End-to-End Tests

The Playwright E2E suite validates HTTP and SSE transport parity:

```bash
npm run test:e2e
```

### Manual Testing with MCP Client

Add your local build to `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "db-mcp-dev": {
      "command": "node",
      "args": ["path/to/your/db-mcp/dist/cli.js", "--transport", "stdio", "--sqlite-native", ":memory:"]
    }
  }
}
```

### Docker Testing

```bash
# Build and run locally
docker build -f Dockerfile -t db-mcp-dev .
docker run --rm -i -v ./data:/workspace db-mcp-dev --sqlite-native /workspace/database.db
```

## 📝 Coding Standards

### TypeScript Code Style

- **Strict mode** — `tsconfig.json` enforces strict TypeScript
- **ESLint** — Run `npm run lint` to check, `npm run lint:fix` to auto-fix
- **Prettier** — Formatting is handled automatically during the release workflow
- **Type safety** — Avoid `any`; use proper types and Zod schemas
- **Modularity** — Keep files under ~500 lines; split into sub-modules when approaching the limit
- **Error handling** — Use structured `{success, error, code, category, suggestion, recoverable}` responses in tool handlers

### File Naming

All files and directories use **kebab-case** (lowercase with dashes):

- ✅ `database-adapter.ts`, `tool-filter.ts`, `json-operations/`
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

Error codes should be module-prefixed (e.g., `JSON_PARSE_FAILED`, `VECTOR_DIMENSION_MISMATCH`). Use `try/catch` at boundaries, not every statement. Always propagate stack traces — don't swallow errors.

### Input Validation

- All parameters are validated via **Zod schemas** with coercion where appropriate (e.g., `z.coerce.number()` for numeric params that may arrive as strings)
- Invalid inputs must return structured errors, not raw Zod validation messages
- SQL injection is prevented via **parameter binding** — never interpolate user input into SQL strings

### Logging

Use the centralized logger with structured payloads. Include: `module`, `operation`, `entityId`, `context`, and `stack` (for errors). Severity levels: `error`, `warning`, `info`, `debug`.

### Docker Considerations

- **Multi-stage builds** — Keep images lean
- **Security** — Run as non-root user, minimal privileges
- **Multi-platform** — Test on both amd64 and arm64 when possible
- **Documentation** — Update Docker guides if needed

## 🔧 Adding or Modifying Tools

db-mcp organizes tools into **10 groups**: `core`, `json`, `text`, `stats`, `vector`, `admin`, `geo`, `introspection`, `migration`, and `codemode`. When adding a new tool:

1. **Define the tool** with its Zod input schema in the appropriate group under `src/constants/`
2. **Implement the handler** in the corresponding adapter directory
3. **Add structured error handling** using the pattern above
4. **Write tests** — meaningful tests, not coverage boosters
5. **Add the tool to the group's help resource** (the markdown file under `src/constants/`)
6. **Update `UNRELEASED.md`** with your change (see [Changelog](#-changelog) below)

## 🐛 Bug Reports

When reporting bugs, please include:

1. **Environment details** (OS, Node.js version, npm version)
2. **Steps to reproduce** the issue
3. **Expected vs actual behavior**
4. **Backend used** (`--sqlite` WASM or `--sqlite-native`)
5. **MCP client details** (Cursor version, Claude Desktop, configuration)
6. **Relevant logs** or error messages

Use our [Bug Report template](.github/ISSUE_TEMPLATE/bug_report.md) for consistency.

## 💡 Feature Requests

For new features, please provide:

1. **Use case description** — What problem does this solve?
2. **Proposed solution** — How should it work?
3. **Tool group fit** — Which of the 10 groups does this belong to?
4. **Alternatives considered** — What other approaches did you think about?
5. **Implementation notes** — Any technical considerations

Use our [Feature Request template](.github/ISSUE_TEMPLATE/feature_request.md).

## 🔄 Pull Request Process

### Before Submitting

- [ ] **Fork** the repository and create a feature branch
- [ ] **Test** your changes (`npm run check && npm test`)
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

| Workflow       | What It Does                                     |
| -------------- | ------------------------------------------------ |
| **Lint & Test** | ESLint, TypeScript strict-mode, Vitest suite     |
| **CodeQL**     | Static analysis for security vulnerabilities     |
| **E2E**        | Playwright end-to-end transport parity tests     |

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

- **Test both backends** — WASM and Native behave differently for some features
- **Check tool responses** — Ensure JSON responses are well-formed
- **Output schemas** — All tools have Zod output schemas; error responses must pass validation
- **Dual-schema pattern** — Relaxed schemas for SDK validation, strict schemas inside handlers

### Architecture Overview

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

### Available Scripts

| Script                | Purpose                                            |
| --------------------- | -------------------------------------------------- |
| `npm run build`       | Production build via tsup                          |
| `npm run check`       | **Quality gate** — lint + typecheck (run before PRs) |
| `npm run lint`        | ESLint only                                        |
| `npm run lint:fix`    | ESLint with auto-fix                               |
| `npm run typecheck`   | TypeScript strict-mode type checking               |
| `npm test`            | Run all unit tests (Vitest)                        |
| `npm run test:watch`  | Watch mode for iterative development               |
| `npm run test:e2e`    | Playwright end-to-end tests (HTTP/SSE transport)   |
| `npm run bench`       | Performance benchmarks (tinybench via Vitest)      |
| `npm run bench:verbose` | Benchmarks with detailed timings                 |

### Benchmarks

If your change touches a hot path (tool dispatch, schema parsing, auth, Code Mode), run benchmarks to verify you haven't introduced a regression:

```bash
npm run bench
```

## 🔐 Security

If you discover a security vulnerability, **do not** open a public issue. Please follow our [Security Policy](SECURITY.md) and report it to **admin@adamic.tech**.

When contributing code, follow these security practices:

- **Parameter binding** for all SQL — never string interpolation
- **Input validation** via Zod schemas at tool boundaries
- **No secrets in code** — use environment variables (`.env` files are gitignored)
- **Typed error classes** with descriptive messages — don't expose internal details to end users

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
