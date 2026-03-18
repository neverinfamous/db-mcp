# 🔒 Security Guide

The db-mcp SQLite MCP server implements comprehensive security measures to protect your databases across both WASM and Native backends.

## 🛡️ **Database Security**

### **Dual SQLite Architecture**

db-mcp offers two backend options — both with layered security:

- ✅ **WASM (sql.js)** — runs in-process with zero native dependencies; 115 tools
- ✅ **Native (better-sqlite3)** — full-featured with native bindings; 139 tools

### **PRAGMA Hardening**

Both backends apply security-relevant PRAGMAs on initialization:

- ✅ **PRAGMA foreign_keys = ON** — enforces referential integrity and `ON DELETE CASCADE`
- ✅ **PRAGMA journal_mode = WAL** — auto-enabled for file-based databases (high concurrency, non-blocking reads)
- ✅ **PRAGMA busy_timeout** — configurable wait to avoid `SQLITE_BUSY` errors under contention
- ✅ **Parameterized queries** — all user input bound via `?` placeholders

### **File Permissions (Docker)**

- ✅ **Data directory**: `700` (full access for owner only) in Docker
- ✅ **Non-root user** (`appuser:appgroup`) owns data directory

## 🔐 **Input Validation**

### **SQL Injection Prevention**

- ✅ **Parameterized queries** used throughout — never string interpolation
- ✅ **Input validation** via Zod schemas before database operations
- ✅ **WHERE clause validation** with 10 dangerous pattern detections:
  - Subquery injection (`SELECT` inside WHERE)
  - Statement termination (`;`)
  - SQL comments (`--`, `/*`)
  - UNION injection (`UNION SELECT`)
  - Extension loading (`load_extension()`)
  - Database attachment (`ATTACH DATABASE`)
  - PRAGMA injection
  - File I/O (`writefile()`, `readfile()`)
  - Tokenizer exploitation (`fts3_tokenizer()`)
  - Hex blob injection (`X'...'`)
- ✅ **Identifier sanitization** — table, column, and index names validated against injection
- ✅ **FTS5 / LIKE pattern sanitization** — escapes `%`, `_`, `\` wildcards

### **Structured Error Handling**

Every tool returns structured error responses — never raw exceptions or internal details:

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

Error codes are module-prefixed (e.g., `JSON_PARSE_FAILED`, `VECTOR_DIMENSION_MISMATCH`). Internal stack traces are logged server-side but never exposed to clients.

## 🧪 **Code Mode Sandbox Security**

Code Mode (`sqlite_execute_code`) runs user-supplied JavaScript in a secure sandbox:

### **Isolation Modes**

| Mode                 | Environment Variable        | Security Level                                   |
| -------------------- | --------------------------- | ------------------------------------------------ |
| **Worker** (default) | `CODEMODE_ISOLATION=worker` | Enhanced — `worker_threads` with MessagePort RPC |
| **VM**               | `CODEMODE_ISOLATION=vm`     | Standard — `node:vm` context isolation           |

### **Sandbox Restrictions**

- ✅ **No filesystem access** — `fs`, `path`, `child_process` are unavailable
- ✅ **No network access** — `fetch`, `http`, `net` modules are unavailable
- ✅ **No global mutation** — `setTimeout`, `setInterval`, `process`, `require` are removed from the sandbox context
- ✅ **Execution timeout** — 30-second hard limit per execution (configurable, max 30s)
- ✅ **Idle timeout** — sandbox instances auto-dispose after 60 seconds of inactivity
- ✅ **MessagePort RPC bridge** — in Worker mode, API calls cross a serialization boundary; no shared memory

### **API Surface**

Code Mode exposes only the typed `sqlite.*` SDK — agents can compose queries and chain operations but cannot escape the sandbox boundary.

## 🌐 **HTTP Transport Security**

When running in HTTP mode (`--transport http`), the following security measures apply:

### **CORS Configuration**

- ✅ **Configurable origins** via `--cors-origins` flag (comma-separated)
- ✅ **Wildcard subdomain matching** (e.g., `*.example.com` matches `app.example.com`)
- ⚠️ **Default: `*`** (allow all origins) for backward compatibility
- 🔒 **Recommended**: Set specific origins for production deployments

```bash
# Restrict CORS to specific origins
db-mcp --transport http --cors-origins "http://localhost:3000,https://my-app.com"
```

### **Security Headers & Protections**

- ✅ **DNS Rebinding Protection** — `localhostHostValidation` middleware from MCP SDK
- ✅ **Strict-Transport-Security (HSTS)** — max-age=31536000; includeSubDomains (opt-in via `--enable-hsts`)
- ✅ **X-Content-Type-Options: nosniff** — prevents MIME sniffing
- ✅ **X-Frame-Options: DENY** — prevents clickjacking
- ✅ **Content-Security-Policy: default-src 'none'; frame-ancestors 'none'** — prevents XSS and framing
- ✅ **Cache-Control: no-store, no-cache, must-revalidate** — prevents caching of sensitive data
- ✅ **Referrer-Policy: no-referrer** — prevents referrer leakage
- ✅ **Permissions-Policy: camera=(), microphone=(), geolocation=()** — restricts browser APIs
- ⚠️ **CORS wildcard warning** — server logs a warning when CORS origin is `*`

### **Rate Limiting & Timeouts**

- ✅ **Built-in Rate Limiting** — 100 requests/minute per IP (sliding window with `Retry-After` header)
- ✅ **Health check exempt** — `/health` endpoint bypasses rate limiting
- ✅ **Trust Proxy** — opt-in `--trust-proxy` for X-Forwarded-For IP extraction behind reverse proxies
- ✅ **Server Timeouts** — Request, keep-alive, and headers timeouts prevent slowloris-style DoS

### **Session Management (Stateful Mode)**

- ✅ **UUID-based session IDs** (cryptographically random)
- ✅ **Explicit session termination** via `DELETE /mcp`
- ✅ **Cross-protocol guard** — SSE session IDs rejected on `/mcp` and vice versa

### **Request Size Limits**

- ✅ **Configurable body limit** via `--max-body-bytes` (default: 1 MB) — prevents memory exhaustion DoS

## 🔑 **Authentication**

### **Simple Bearer Token**

Lightweight authentication for development or single-tenant deployments:

```bash
db-mcp --transport http --auth-token my-secret --sqlite-native ./database.db
```

- ✅ Clients must include `Authorization: Bearer <token>` on all requests
- ✅ `/health` and `/` endpoints are exempt
- ✅ Unauthenticated requests receive `401` with `WWW-Authenticate: Bearer` per RFC 6750

### **OAuth 2.1 (Enterprise)**

Full OAuth 2.1 for production multi-tenant deployments:

- ✅ **RFC 9728** Protected Resource Metadata (`/.well-known/oauth-protected-resource`)
- ✅ **RFC 8414** Authorization Server Discovery with caching
- ✅ **JWT validation** with JWKS support
- ✅ **Granular scopes**: `read`, `write`, `admin`, `db:{name}`, `table:{db}:{table}`
- ✅ **Priority**: When both `--auth-token` and `--oauth-enabled` are set, OAuth takes precedence

```bash
db-mcp --transport http --oauth-enabled \
  --oauth-issuer http://localhost:8080/realms/db-mcp \
  --oauth-audience db-mcp-server \
  --sqlite-native ./database.db
```

## 🐳 **Docker Security**

### **Non-Root User**

- ✅ **Dedicated user**: `appuser` (UID 1001) with minimal privileges
- ✅ **Restricted group**: `appgroup` (GID 1001)
- ✅ **Restricted data directory**: `700` permissions

### **Container Hardening**

- ✅ **Minimal base image**: `node:24-alpine`
- ✅ **Multi-stage build**: Build dependencies not in production image
- ✅ **Production pruning**: `npm prune --omit=dev` after build
- ✅ **Health check**: Built-in `HEALTHCHECK` instruction
- ✅ **Process isolation** from host system

### **Dependency Patching**

The Dockerfile patches npm-bundled transitive dependencies for Docker Scout compliance:

- ✅ `diff@8.0.3` — GHSA-73rr-hh4g-fpgx
- ✅ `@isaacs/brace-expansion@5.0.1` — CVE-2026-25547
- ✅ `tar@7.5.11` — CVE-2026-23950, CVE-2026-24842, CVE-2026-26960
- ✅ `minimatch@10.2.4` — CVE-2026-26996
- ✅ `protobufjs/cli` removed — CVE-2019-10790, CVE-2025-54798, CVE-2025-5889

### **Volume Mounting Security**

```bash
# Secure volume mounting
docker run -v ./data:/app/data:rw,noexec,nosuid,nodev writenotenow/db-mcp:latest
```

### **Resource Limits**

```bash
# Apply resource limits
docker run --memory=1g --cpus=1 writenotenow/db-mcp:latest
```

## 🔄 **CI/CD Security**

- ✅ **CodeQL analysis** — automated static analysis on push/PR
- ✅ **Docker Scout** — container image vulnerability scanning (hard-fail on fixable critical/high)
- ✅ **npm audit** — dependency vulnerability checking (audit-level: moderate)
- ✅ **Dependabot** — automated dependency update PRs
- ✅ **E2E transport parity** — Playwright suite validates HTTP/SSE security behavior

## 🚨 **Security Best Practices**

### **For Users**

1. **Set a CORS origin** when exposing the HTTP transport on a network
2. **Use authentication** — configure `--auth-token` or `--oauth-enabled` for HTTP deployments
3. **Keep Node.js updated**: Use Node.js 24+ (LTS)
4. **Secure host system**: Ensure your host machine is secure
5. **Use tool filtering**: Expose only the tools you need (`--tool-filter`)
6. **Limit network access**: Don't expose the HTTP transport to untrusted networks
7. **Use resource limits**: Apply Docker `--memory` and `--cpus` limits

### **For Developers**

1. **Parameterized queries only** — never interpolate user input into SQL strings
2. **Zod validation** — all tool inputs validated via schemas at tool boundaries
3. **No secrets in code** — use environment variables (`.env` files are gitignored)
4. **Typed error classes** — descriptive messages with context; don't expose internals
5. **Regular updates**: Keep Node.js and npm dependencies updated
6. **Security scanning**: Regularly scan Docker images for vulnerabilities

## 📋 **Security Checklist**

- [x] Parameterized SQL queries throughout
- [x] WHERE clause validation with 10 dangerous pattern detections
- [x] Identifier sanitization (table, column, index names)
- [x] FTS5 / LIKE pattern sanitization
- [x] Input validation via Zod schemas
- [x] Code Mode sandbox isolation (Worker + VM modes)
- [x] Code Mode execution timeout (30s hard limit)
- [x] HTTP body size limit (configurable, default 1 MB)
- [x] Configurable CORS with wildcard subdomain matching
- [x] Rate limiting (100 req/min per IP, sliding window)
- [x] DNS rebinding protection (MCP SDK middleware)
- [x] Security headers (CSP, X-Content-Type-Options, X-Frame-Options, Cache-Control, Referrer-Policy, Permissions-Policy)
- [x] HSTS (opt-in)
- [x] Server timeouts (request, keep-alive, headers)
- [x] Bearer token authentication (RFC 6750)
- [x] OAuth 2.1 with JWT/JWKS validation (RFC 9728, RFC 8414)
- [x] Granular scope enforcement (`read`, `write`, `admin`, `db:*`, `table:*:*`)
- [x] Non-root Docker user
- [x] Multi-stage Docker build with production pruning
- [x] Transitive dependency CVE patching in Dockerfile
- [x] CI/CD security pipeline (CodeQL, Docker Scout, npm audit)
- [x] Structured error responses (no internal details leaked)
- [x] Comprehensive security documentation

## 🚨 **Reporting Security Issues**

| Version | Supported |
| ------- | --------- |
| 1.x.x   | ✅        |
| < 1.0   | ❌        |

If you discover a security vulnerability:

1. **Do not** open a public GitHub issue
2. **Email** security concerns to: **admin@adamic.tech**
3. **Include** detailed reproduction steps and potential impact
4. **Allow** reasonable time for a fix before public disclosure

### Response Timeline

- **Initial Response**: Within 48 hours
- **Status Update**: Within 7 days
- **Fix Timeline**: Depends on severity

We appreciate responsible disclosure and will acknowledge your contribution in our release notes (unless you prefer to remain anonymous).

## 🔄 **Security Updates**

- **Container updates**: Rebuild Docker images when base images are updated
- **Dependency updates**: Keep npm packages updated via `npm audit` and Dependabot
- **Database maintenance**: Run `ANALYZE` and `PRAGMA optimize` regularly
- **Security patches**: Apply host system security updates

The db-mcp SQLite MCP server is designed with **security-first principles** to protect your databases while maintaining excellent performance and full SQLite capability.
