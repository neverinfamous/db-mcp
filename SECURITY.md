# 🔒 Security Policy

The db-mcp SQLite MCP server implements comprehensive security measures to protect your databases across stdio, HTTP, and SSE transports.

## 🛡️ **Database Security**

### **SQL Injection Prevention**

**Identifier Sanitization** (`src/utils/identifiers.ts`)

- ✅ **Comprehensive coverage** — all table, column, and index names validated and quoted across every tool group (admin, core, json, stats, geo, introspection, migration, text, vector)
- ✅ **SQLite identifier rules enforced** — start with letter/underscore, contain only alphanumerics, underscores, or $ signs
- ✅ **Length limits** enforced for compatibility and safety
- ✅ **Invalid identifiers** throw `InvalidIdentifierError`

Key functions:

- `sanitizeIdentifier(name)` — Validates and double-quotes an identifier
- `sanitizeTableName(table, schema?)` — Handles schema-qualified table references
- `sanitizeColumnRef(column, table?)` — Handles column references with optional table qualifier
- `sanitizeIdentifiers(names[])` — Batch sanitization for column lists

**Parameterized Queries**

- ✅ **All user-provided values** use parameterized queries via `better-sqlite3` / `sql.js` bindings
- ✅ **Identifier sanitization** complements parameterized values — defense in depth

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

Error codes are module-prefixed (e.g., `SQLITE_CONNECTION_FAILED`, `TABLE_NOT_FOUND`). Internal stack traces are logged server-side but never exposed to clients.

## 🔐 **Input Validation**

- ✅ **Zod schemas** — all tool inputs validated at tool boundaries before database operations
- ✅ **Parameterized queries** used throughout — never string interpolation
- ✅ **Identifier sanitization** — table, column, schema, and index names validated against injection
- ✅ **WHERE clause validation** — blocklist of dangerous patterns including `UNION SELECT`, stacked queries, comment injection, subqueries (`(SELECT ...`), `ATTACH DATABASE`, `load_extension`, `PRAGMA`, fileio functions, FTS tokenizer abuse, and hex string injection
- ✅ **Path Traversal Prevention** — database exports, backups, and dumps enforce strict path boundaries preventing arbitrary file writes (e.g. `sqlite_dump`, `sqlite_backup`).
- ✅ **JWT claims sanitization** — prototype-polluting keys (`__proto__`, `constructor`, `prototype`) are filtered from OAuth token payloads before spreading into claims objects

## 🧪 **Code Mode Sandbox Security**

Code Mode executes user-provided JavaScript inside a **`worker_threads` V8 isolate** with a secondary `vm.createContext()` boundary. Each worker thread runs in its own V8 instance with independent heap and resource limits (`maxOldGenerationSizeMb`), providing process-level isolation. The `vm` context layer provides namespace isolation with V8-enforced code generation restrictions:

### **Sandbox Restrictions**

- ✅ **V8 code generation restrictions** — `codeGeneration: { strings: false, wasm: false }` disables `eval()` and `Function()` construction from strings **at the V8 engine level**, not just via regex patterns. This closes the entire class of string-based code generation bypass attacks
- ✅ **Blocked globals** — `require`, `process`, `global`, `globalThis`, `module`, `exports`, `setTimeout`, `setInterval`, `setImmediate`, `Proxy` set to `undefined`
- ✅ **Blocked patterns** — 18 static regex rules reject code containing `require()`, `import()`, `eval()`, `Function()`, `__proto__`, `constructor.constructor`, `Reflect.*`, `Symbol.*`, `new Proxy()`, and filesystem/network/child_process references
- ✅ **Frozen prototypes** — all built-in prototypes (`Object`, `Function`, `Error`, `Array`, `Promise`, typed arrays, etc.) are frozen inside the `vm` context to prevent dynamic constructor chain escapes via string concatenation (e.g., `'con'+'structor'`)
- ✅ **RPC allowlist validation** — the host-side RPC handler validates every incoming method call against the serialized bindings allowlist before dispatching, preventing a compromised worker from invoking arbitrary host methods
- ✅ **Readonly Proxy traps** — group API objects are wrapped in Proxy traps that throw structured errors when stripped (readonly) methods are called, halting execution instead of silently returning undefined
- ✅ **Execution timeout** — 30s hard limit (configurable)
- ✅ **Input limits** — 50KB code input, 10MB result output
- ✅ **Rate limiting** — 60 executions per minute per client
- ✅ **Audit logging** — every execution logged with UUID, client ID, metrics, and code preview (truncated to 200 chars)
- ✅ **Admin scope** — Code Mode requires `admin` scope when OAuth is enabled

> **⚠️ Threat Model:** Code Mode is designed for use by **trusted AI agents**, not for executing arbitrary untrusted code from end users. While `worker_threads` provides a true V8 isolate boundary (separate heap, separate V8 instance), the `vm.createContext()` layer within it is namespace isolation, not a security sandbox. Defense-in-depth measures include V8-enforced `codeGeneration` restrictions (disabling `eval`/`Function` at the engine level), frozen built-in prototypes, 18 static regex rules, RPC allowlist validation, and blocked globals. Together these provide robust protection within the trusted AI agent threat model.
>
> **For untrusted input deployments:** Use process-level sandboxing such as running the container with `--cap-drop=ALL`, or replace `vm` with `isolated-vm` for additional V8 isolate-level separation within the worker.

## 🌐 **HTTP Transport Security**

When running in HTTP mode (`--transport http`), the following security measures apply:

### **Security Headers & Protections**

- ✅ **DNS Rebinding Protection** — `validateHostHeader()` strictly validates `Host` headers
- ✅ **X-Content-Type-Options: nosniff** — prevents MIME sniffing
- ✅ **X-Frame-Options: DENY** — prevents clickjacking
- ✅ **Content-Security-Policy: default-src 'none'; frame-ancestors 'none'** — prevents XSS and framing
- ✅ **Cache-Control: no-store, no-cache, must-revalidate** — prevents caching of sensitive data
- ✅ **Referrer-Policy: no-referrer** — prevents referrer leakage
- ✅ **Permissions-Policy: camera=(), microphone=(), geolocation=()** — restricts browser APIs

### **HSTS Support**

- ✅ **Strict-Transport-Security** header for HTTPS deployments
- ✅ Enable via `enableHSTS: true` configuration

### **CORS Configuration**

- ✅ **Deny-all by default** — `corsOrigins` defaults to `[]` (no origins allowed). Must be explicitly configured for cross-origin access.
- ✅ **Origin whitelist** with `Vary: Origin` header for caching
- ✅ **Wildcard subdomain matching** — supports patterns like `*.example.com`
- ✅ **Optional credentials support** — set automatically for explicit (non-wildcard) origins
- ✅ **MCP-specific headers** allowed (`mcp-session-id`, `mcp-protocol-version`)

### **Rate Limiting & Timeouts**

- ✅ **Built-in Rate Limiting** — 100 requests/minute per IP
- ✅ **Health Endpoint Bypass** — `/health` bypasses limits to ensure reliable load balancer checks
- ✅ **Returns 429 Too Many Requests** with proper `Retry-After` headers when limits are exceeded
- ✅ **Slowloris DoS Protection** — configurable read timeouts via `MCP_REQUEST_TIMEOUT` and `MCP_HEADERS_TIMEOUT`

> **Reverse Proxy Note:** Rate limiting uses `req.socket.remoteAddress`. Behind a reverse proxy (e.g., nginx, Cloudflare Tunnel), all requests may share the same source IP. Ensure your proxy forwards distinct client IPs, or apply rate limiting at the proxy layer instead.

### **Request Size Limits**

- ✅ **Configurable body limit** via `maxBodySize` (default: 1 MB) — prevents memory exhaustion DoS

## 🔑 **Authentication (OAuth 2.1)**

Full OAuth 2.1 for production multi-tenant deployments:

- ✅ **RFC 9728** Protected Resource Metadata (`/.well-known/oauth-protected-resource`)
- ✅ **RFC 8414** Authorization Server Discovery with caching
- ✅ **JWT validation** with JWKS support (TTL: 1 hour, configurable)
- ✅ **SQLite-specific scopes**: `read`, `write`, `admin`, `full`, `db:{name}`, `table:{name}`
- ✅ **Per-tool scope enforcement** via `AsyncLocalStorage` context threading
- ✅ **Fail-closed scope default** — unknown or unmapped tools default to `admin` scope, preventing accidental privilege escalation when new tools are added

> **⚠️ HTTP without OAuth:** When OAuth is not configured, all scope checks are bypassed. If you expose the HTTP transport without enabling OAuth, any client has full unrestricted access. Always enable OAuth for production HTTP deployments.

### **Simple Bearer Token Security**

- ✅ **Constant-time comparison** — bearer token validation uses `crypto.timingSafeEqual` to prevent timing side-channel attacks
- ✅ **CLI warning** — using `--auth-token` emits a warning that the token is visible in process listings

> **⚠️ Production guidance:** Prefer the `MCP_AUTH_TOKEN` environment variable over `--auth-token` for production deployments. Command-line arguments are visible via `ps`, `/proc/<pid>/cmdline`, and similar tools on the host.

> **⚠️ Scope limitation:** Simple bearer token auth authenticates clients but does **not** enforce per-tool scopes. All tools are accessible to any client presenting the correct token. For granular scope enforcement (`read`, `write`, `admin`, `full`), use OAuth 2.1 via `--oauth-enabled`.

## 🐳 **Docker Security**

### **Non-Root User**

- ✅ **Dedicated user**: `appuser` (UID 1001) with minimal privileges
- ✅ **Restricted group**: `appgroup` (GID 1001)
- ✅ **Restricted data directory**: `700` permissions

### **Container Hardening**

- ✅ **Minimal base image**: `node:24-alpine`
- ✅ **Multi-stage build**: Build dependencies not in production image
- ✅ **Production pruning**: `npm prune --omit=dev` after build
- ✅ **Health check**: Built-in `HEALTHCHECK` instruction (transport-aware for HTTP/SSE/stdio)
- ✅ **Process isolation** from host system

### **Dependency Patching**

The Dockerfile patches npm-bundled transitive dependencies for Docker Scout compliance:

- ✅ `diff@9.0.0` — GHSA-73rr-hh4g-fpgx
- ✅ `@isaacs/brace-expansion@5.0.1` — CVE-2026-25547
- ✅ `tar@7.5.15` — CVE-2026-23950, CVE-2026-24842, CVE-2026-26960
- ✅ `minimatch@10.2.5` — CVE-2026-26996
- ✅ `brace-expansion@5.0.6` — CVE-2026-45149, CVE-2026-33750

Additional `package.json` overrides mirror these patches for `npm audit` compliance. The `dockerfile-patch-drift.yml` CI workflow runs weekly to detect when patches become stale (bundled versions catch up), covering both Dockerfile patches and package.json overrides.

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

## 🔐 **Logging Security**

### **Audit Subsystem**

- ✅ **Full JSONL Audit Trails** — comprehensive logging array capturing mutations, Code Mode executions, and system events
- ✅ **Session Token Estimates** — robust burn-rate tracking appended to log entries
- ✅ **Pre-Mutation Snapshots** — interceptor captures table states before destructive administration operations

### **Credential Redaction**

- ✅ **Sensitive fields automatically redacted** in logs: `password`, `secret`, `token`, `apikey`, `issuer`, `audience`, `jwksUri`, `credentials`, etc.
- ✅ **Recursive sanitization** for nested objects

### **Log Injection Prevention**

- ✅ **Control character sanitization** (ASCII 0x00-0x1F except tab/newline, 0x7F, C1 characters)
- ✅ **Prevents log forging** and escape sequence attacks

## 🔄 **CI/CD Security**

- ✅ **CodeQL analysis** — automated static analysis on push/PR
- ✅ **npm audit** — dependency vulnerability checking (audit-level: moderate)
- ✅ **Dependabot** — automated dependency update PRs (weekly for npm and GitHub Actions)
- ✅ **Secrets scanning** — dedicated workflow on push and PR (defense-in-depth for direct pushes to main)
- ✅ **Lockfile integrity** — SHA-256 hash and `git diff --exit-code` verification before `npm ci` to detect post-checkout tampering
- ✅ **Patch drift detection** — weekly CI workflow validates Dockerfile patches and package.json overrides against upstream versions
- ✅ **E2E transport parity** — Playwright suite validates HTTP/SSE security behavior

## 🚨 **Security Best Practices**

### **For Users**

1. **Never commit database credentials** to version control — use environment variables
2. **Use OAuth 2.1 authentication** for HTTP transport in production — never expose HTTP transport without OAuth
3. **Restrict database user permissions** to minimum required
4. **Restrict filesystem access** to only the required database directory
5. **Enable HSTS** when running over HTTPS (`--enableHSTS`)
6. **Configure CORS origins explicitly** — avoid wildcards
7. **Use resource limits** — apply Docker `--memory` and `--cpus` limits
8. **Apply rate limiting at the proxy layer** when deploying behind a reverse proxy
9. **For WAL mode performance**, consider enabling `PRAGMA journal_mode=WAL;` in your initialization script.
10. **Consider SHA-pinning** critical GitHub Actions in CI workflows for supply-chain defense-in-depth

### **For Developers**

1. **Parameterized queries only** — never interpolate user input into SQL strings
2. **Zod validation** — all tool inputs validated via schemas at tool boundaries
3. **No secrets in code** — use environment variables (`.env` files are gitignored)
4. **Typed error classes** — descriptive messages with context; don't expose internals
5. **Regular updates** — keep Node.js and npm dependencies updated
6. **Security scanning** — regularly scan Docker images for vulnerabilities

## 📋 **Security Checklist**

- [x] Parameterized SQL queries throughout
- [x] Identifier sanitization (table, column, schema, index names)
- [x] WHERE clause validation with subquery detection
- [x] Input validation via Zod schemas
- [x] JWT claims sanitization (prototype pollution prevention)
- [x] Code Mode sandbox isolation (worker_threads V8 isolate + vm.createContext)
- [x] Code Mode V8 codeGeneration restrictions (eval/Function disabled at engine level)
- [x] Code Mode frozen built-in prototypes (constructor chain escape prevention)
- [x] Code Mode blocked patterns (18 static regex rules)
- [x] Code Mode Proxy constructor nullified in sandbox context
- [x] Code Mode RPC allowlist validation (host-side method authorization)
- [x] Code Mode readonly Proxy traps (structured errors for stripped methods)
- [x] Code Mode execution timeout (30s hard limit)
- [x] Code Mode rate limiting (60 executions/min)
- [x] Code Mode audit logging
- [x] HTTP body size limit (configurable, default 1 MB)
- [x] CORS deny-all by default (explicit origin configuration required)
- [x] Rate limiting (100 req/min per IP)
- [x] Slowloris DoS timeouts (`MCP_REQUEST_TIMEOUT`, `MCP_HEADERS_TIMEOUT`)
- [x] DNS rebinding protection via Host header validation
- [x] Security headers (CSP, X-Content-Type-Options, X-Frame-Options, Cache-Control, Referrer-Policy, Permissions-Policy)
- [x] HSTS (opt-in)
- [x] OAuth 2.1 with JWT/JWKS validation (RFC 9728, RFC 8414)
- [x] SQLite-specific scope enforcement (`read`, `write`, `admin`, `full`, `db:*`, `table:*`)
- [x] Fail-closed scope default (`admin`) for unknown tools
- [x] Per-tool scope enforcement via `AsyncLocalStorage`
- [x] Bearer auth scope limitation warning (startup + documentation)
- [x] Credential redaction in logs
- [x] Log injection prevention
- [x] Non-root Docker user
- [x] Multi-stage Docker build with production pruning
- [x] Transitive dependency CVE patching (Dockerfile + package.json overrides)
- [x] Patch drift detection (weekly CI workflow)
- [x] Lockfile integrity verification (SHA-256 + git diff in CI)
- [x] CI/CD security pipeline (CodeQL, npm audit, secrets scanning on push+PR)
- [x] Structured error responses (no internal details leaked)
- [x] Constant-time bearer token comparison (`crypto.timingSafeEqual`)
- [x] Comprehensive security documentation

## 🚨 **Reporting Security Issues**

| Version | Supported |
| ------- | --------- |
| 2.x.x   | ✅        |
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
- **Database maintenance**: Run `ANALYZE` and `VACUUM` regularly for optimal performance
- **Security patches**: Apply host system security updates

The db-mcp SQLite MCP server is designed with **security-first principles** to protect your databases while maintaining excellent performance and full SQLite capability.
