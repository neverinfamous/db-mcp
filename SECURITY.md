# 🔒 Security Policy

The db-mcp SQLite MCP server implements comprehensive security measures to protect your databases across stdio, HTTP, and SSE transports.

## 🛡️ **Database Security**

### **SQL Injection Prevention**

**Identifier Sanitization** (`src/utils/identifiers.ts`)

- ✅ **Comprehensive coverage** — all table, column, and index names validated and quoted across every tool group (admin, core, json, stats, geo, introspection, migration, text, vector)
- ✅ **SQLite identifier rules enforced** — start with letter/underscore, contain only alphanumerics and underscores
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

### **Native Extension Loading**

- ✅ **Extension paths**: The server relies on native extension loading for advanced capabilities (e.g., via `SPATIALITE_PATH`). Exercise caution when deploying, as these environment variables resolve to native library files on the host.
- ✅ Ensure extension paths map only to trusted directories containing verified libraries to prevent arbitrary code execution via malicious `.so`/`.dll`/`.dylib` files.

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
- ✅ **WHERE clause validation** — Core and stats tools enforce strict structured arrays (`WhereCondition[]`), completely eliminating SQL injection vectors present in legacy string-based WHERE properties. For raw query tools, a blocklist rejects dangerous patterns including `UNION SELECT`, stacked queries, comment injection, subqueries (`(SELECT ...`), `ATTACH DATABASE`, `load_extension`, `PRAGMA`, fileio functions, FTS tokenizer abuse, hex string injection, `GLOB` leading wildcards, and `RANDOMBLOB`/`ZEROBLOB` memory allocation DoS. Input is Unicode NFC-normalized with full-width Latin character (U+FF01–U+FF5E) to ASCII mapping before pattern matching to prevent homoglyph-based blocklist bypasses (CWE-20)
- ✅ **JSON path validation** — all JSON path parameters (e.g., `$.key[0].subkey`) are validated against a strict regex allowlist (`^\$(\.\w+|\[\d+\]|\[#\]|\[\*\])*$`) before SQL interpolation, preventing injection via malicious path values. See `src/utils/validate-json-path.ts`
- ✅ **Aggregate function validation** — SQL aggregate functions (`COUNT`, `SUM`, `AVG`, `MIN`, `MAX`, `GROUP_CONCAT`, `TOTAL`) are validated against a strict whitelist with column name sanitization, preventing arbitrary SQL execution via `aggregateFunction` parameters
- ✅ **Path Traversal Prevention** — database exports, backups, and dumps enforce strict path boundaries preventing arbitrary file writes (e.g. `sqlite_dump`, `sqlite_backup`). This validation strictly enforces exact directory matching, blocking access even to legitimate subdirectories. _Note: In-memory databases (`:memory:`) bypass path validation by design._
- ✅ **DDL Validation** — Migration tools (`sqlite_migration_apply`, `sqlite_migration_rollback`) use `validateMigrationSql` to strictly prevent unauthorized DDL commands such as `ATTACH`, `DETACH`, `PRAGMA`, and `LOAD_EXTENSION`.
- ✅ **JWT claims sanitization** — prototype-polluting keys (`__proto__`, `constructor`, `prototype`) are filtered from OAuth token payloads before spreading into claims objects

## 🧪 **Code Mode Sandbox Security**

Code Mode executes user-provided JavaScript inside a **process-level `isolated-vm` V8 isolate**, providing strict memory separation and secure C++ execution boundaries. The previous insecure `node:vm` and `worker_threads` architectures have been entirely replaced to mitigate prototype pollution and execution escapes.

### **Sandbox Restrictions**

- ✅ **Strict Memory Separation** — `isolated-vm` enforces true, native V8 isolates. The executing code has absolutely no memory access to the host Node.js environment, `worker_threads`, or shared `vm` namespaces.
- ✅ **Blocked globals** — `require`, `process`, `global`, `globalThis`, `module`, `exports`, `setTimeout`, `setInterval`, `setImmediate`, `Proxy` are strictly undefined.
- ✅ **Blocked patterns** — 29 static regex rules reject code containing `require()`, `import()`, `eval()`, `Function()`, `__proto__`, `constructor.constructor`, `Reflect.*`, `Symbol.*`, `new Proxy()`, `fetch()`, `WebSocket`, `Object.getPrototypeOf`, `Object.defineProperty`, and filesystem/network/child_process references. Code comments (`/* ... */` and `//`) are stripped, and `\u` / `\x` escapes are explicitly blocked prior to validation to prevent pattern evasion.
- ✅ **RPC boundary enforcement** — Host-side API capabilities (e.g. `sqlite.*` tools) are explicitly bridged into the isolate via explicit C++ `Reference` instances. The isolate cannot bridge out to host functions arbitrarily.
- ✅ **Readonly Proxy traps** — group API objects are wrapped in Proxy traps that throw structured errors when stripped (readonly) methods are called, halting execution instead of silently returning undefined.
- ✅ **Execution timeout** — 30s hard limit (configurable), enforced strictly by the isolate engine.
- ✅ **Input limits** — 50KB code input, 10MB result output.
- ✅ **Rate limiting** — 10 executions per minute per client for Code Mode (internal map capped at 10,000 active clients to prevent memory exhaustion DoS).
- ✅ **Sandbox pooling** — Isolate instances are managed via a strict LRU pool (`maxInstances: 5`) to prevent memory exhaustion and host starvation during concurrency bursts.
- ✅ **Audit logging** — every execution logged with UUID, client ID, metrics, and code preview (truncated to 200 chars, credential patterns redacted).
- ✅ **Forensic traceability** — each isolate script execution uses a unique `randomUUID()` filename for distinguishable stack traces. Stack traces are strictly stripped from worker error responses in production (`NODE_ENV=production`) to prevent internal path and dependency leakage.
- ✅ **Admin scope** — Code Mode requires `admin` scope when OAuth is enabled.

> **⚠️ Threat Model:** Code Mode is designed for use by **trusted AI agents**, not for executing arbitrary untrusted code from end users. While `isolated-vm` provides robust security against context escapes, this server still runs the isolation within the main Node.js process space.
>
> **For untrusted input deployments:** Use infrastructure-level sandboxing:
>
> 1. Run the container with `--cap-drop=ALL --security-opt=no-new-privileges` to limit post-compromise capabilities.
> 2. Apply Docker resource limits (`--memory`, `--cpus`) and read-only filesystem (`--read-only`) where possible.

## 🌐 **HTTP Transport Security**

When running in HTTP mode (`--transport http`), the following security measures apply:

### **Security Headers & Protections**

- ✅ **DNS Rebinding Protection** — `validateHostHeader()` strictly validates `Host` headers
- ✅ **X-Powered-By** header suppression — prevents framework version fingerprinting
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
- ✅ **Health Endpoint Bypass** — `/health` bypasses limits to ensure reliable load balancer checks. Unauthenticated requests receive only minimal data (`{ status, timestamp }`) to prevent information disclosure.
- ✅ **Returns 429 Too Many Requests** with proper `Retry-After` headers when limits are exceeded
- ✅ **Slowloris DoS Protection** — configurable read timeouts via `MCP_REQUEST_TIMEOUT` and `MCP_HEADERS_TIMEOUT`

> **⚠️ Reverse Proxy Note:** When `trustProxy` is enabled, rate limiting uses the rightmost `X-Forwarded-For` IPs (up to `trustedProxyCount`, default 1). **Only enable `trustProxy` when deploying behind a trusted reverse proxy** (e.g., nginx, Cloudflare Tunnel) that securely appends to the `X-Forwarded-For` header. Without a trusted proxy, clients can spoof this header to bypass rate limits. When `trustProxy` is disabled (the default), `req.socket.remoteAddress` is used directly and behind a proxy all requests share the same source IP — apply rate limiting at the proxy layer instead.

> **⚠️ Multi-Instance Deployments:** The default `express-rate-limit` in-memory store is per-process. In multi-instance deployments behind a load balancer, each instance maintains independent counters, effectively multiplying the rate limit by the number of instances. For production clusters, configure a shared rate limit store by providing a Redis store instance (e.g., `rate-limit-redis`).

### **Session Management**

- ✅ **UUID session IDs** — cryptographically random session identifiers via `crypto.randomUUID()`
- ✅ **Session ownership binding** — each session is bound to the authenticated subject (`req.auth.sub`) at creation. Every subsequent POST, GET (SSE stream, including legacy SSE connections), and DELETE request verifies that the requester's identity matches the session owner, preventing cross-client session hijack (CWE-284, CWE-639)
- ✅ **Graceful degradation** — when auth is disabled (stdio transport, local dev), session ownership is not enforced (owner is `undefined`)

> **⚠️ In-Memory Sessions:** Session state (including ownership binding) is stored in-memory. Server restarts clear all sessions, forcing clients to re-establish. In multi-instance deployments, sessions are not shared across instances — use sticky sessions at the load balancer or implement a shared session store for production clusters.

### **Request Size Limits**

- ✅ **Configurable body limit** via `maxBodySize` (default: 1 MB) — prevents memory exhaustion DoS

## 🔑 **Authentication (OAuth 2.1)**

Full OAuth 2.1 for production multi-tenant deployments:

- ✅ **RFC 9728** Protected Resource Metadata (`/.well-known/oauth-protected-resource`)
- ✅ **RFC 8414** Authorization Server Discovery with caching
- ✅ **JWT validation** with JWKS support (TTL: 1 hour, configurable), enforcing strict HTTPS for all JWKS and discovery URLs in production.
- ✅ **SQLite-specific scopes**: `read`, `write`, `admin`, `full`
- ✅ **Per-tool scope enforcement** via `AsyncLocalStorage` context threading
- ✅ **Resource and Prompt authorization** — Scope enforcement middleware covers `resources/read` and `prompts/get`, requiring `admin` scope for audit resources and `read` scope for others
- ✅ **Fail-closed scope default** — unknown or unmapped tools default to `admin` scope, preventing accidental privilege escalation when new tools are added
- ✅ **Dynamic scope set derivation** — `ADMIN_TOOLS`, `READ_ONLY_TOOLS`, and `WRITE_TOOLS` are derived at module load from `TOOL_GROUPS × TOOL_GROUP_SCOPES`, preventing drift between tool registration and scope enforcement
- ✅ **Generic error responses** — token validation errors return generic `"Token validation failed"` messages to clients, preventing leakage of internal auth infrastructure URLs (e.g., JWKS endpoint addresses). Detailed errors are logged server-side only
- ✅ **WWW-Authenticate sanitization** — `error_description` attributes in `WWW-Authenticate` headers are sanitized (quotes stripped, truncated to 200 chars) to prevent header injection (CWE-113) and information disclosure (CWE-209)

> **⚠️ HTTP without OAuth:** When OAuth is not configured, all scope checks are bypassed. If you expose the HTTP transport without enabling OAuth, any client has full unrestricted access. Always enable OAuth for production HTTP deployments.

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
- ✅ **SSE payload redaction** — legacy SSE transport logs only session ID at debug level, never serialized message content (prevents bypassing logger redaction via raw JSON payloads)
- ✅ **Code preview redaction** — Code Mode audit log applies credential pattern matching (`sk-`, `Bearer`, `token=`, `password=`, `secret=`, `apikey=`, `api_key=`) to code previews before logging, preventing embedded secrets from leaking to server logs

### **Log Injection Prevention**

- ✅ **Control character sanitization** (ASCII 0x00-0x1F except tab/newline, 0x7F, C1 characters)
- ✅ **Prevents log forging** and escape sequence attacks

## 🔄 **CI/CD Security**

- ✅ **CodeQL analysis** — automated static analysis on push/PR
- ✅ **npm audit** — dependency vulnerability checking (audit-level: moderate)
- ✅ **Secrets scanning** — dedicated workflow on push and PR (defense-in-depth for direct pushes to main)
- ✅ **Lockfile integrity** — SHA-256 hash and `git diff --exit-code` verification before `npm ci` to detect post-checkout tampering
- ✅ **Patch drift detection** — weekly CI workflow validates Dockerfile patches and package.json overrides against upstream versions
- ✅ **Dependabot Action Updates** — proactive weekly `.github/dependabot.yml` policy monitors and updates GitHub Action versions.
- ✅ **Credential Isolation** — CI workflows strictly pass credentials (`DEST_CREDS`, `NPM_TOKEN`) via environment variables rather than command-line arguments to prevent leakage into intermediate shell evaluations or process listings.
- ✅ **E2E transport parity** — Playwright suite validates HTTP/SSE security behavior
- ✅ **Artifact Exposure Limits** — sensitive workflow artifacts are explicitly purged after 24 hours

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
- [x] WHERE clause Unicode NFC normalization + full-width→ASCII mapping (homoglyph bypass prevention)
- [x] Input validation via Zod schemas
- [x] Strict DDL validation with boundary regexes
- [x] Global AST pre-parsing rejection for mutating PRAGMAs (with multi-line comment stripping evasion protection)
- [x] Strict escaping for DDL identifiers (foreign keys, check constraints)
- [x] JWT claims sanitization (prototype pollution prevention)
- [x] Code Mode sandbox isolation (worker_threads V8 isolate + vm.createContext)
- [x] Code Mode V8 codeGeneration restrictions (eval/Function disabled at engine level)
- [x] Code Mode frozen built-in prototypes (constructor chain escape prevention)
- [x] Code Mode blocked patterns (29 static regex rules)
- [x] Code Mode Proxy constructor nullified in sandbox context
- [x] Code Mode RPC allowlist validation (host-side method authorization)
- [x] Code Mode readonly Proxy traps (structured errors for stripped methods)
- [x] Code Mode execution timeout (30s hard limit)
- [x] Code Mode RPC bridge quota enforcement (100 calls/execution)
- [x] Code Mode Regex input truncation (10,000 chars) for ReDoS mitigation
- [x] Code Mode rate limiting (60 executions/min)
- [x] LRU eviction algorithm for rate-limit map to prevent starvation DoS
- [x] Code Mode streaming egress boundary (abort serialization mid-flight on oversized results)
- [x] Code Mode `maxYoungGenerationSizeMb` resource limit (caps V8 nursery allocation bursts)
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
- [x] Per-tool scope enforcement via `AsyncLocalStorage` and protocol-layer `tools/list` filtering

- [x] Credential redaction in logs
- [x] Log injection prevention
- [x] Non-root Docker user
- [x] Multi-stage Docker build with production pruning
- [x] Transitive dependency CVE patching (Dockerfile + package.json overrides)
- [x] Patch drift detection (weekly CI workflow)
- [x] Lockfile integrity verification (SHA-256 + git diff in CI)
- [x] CI/CD security pipeline (CodeQL, npm audit, secrets scanning on push+PR)
- [x] Artifact retention limited to 1 day for sensitive workflow outputs
- [x] Structured error responses (no internal details leaked)

- [x] Session ownership binding (session ID → auth subject verification)
- [x] SSE payload redaction (no raw message content in logs)
- [x] Code preview credential redaction in audit logs
- [x] Recursive structural JSON credential redaction (deep-clone) in audit logs to prevent serialization corruption
- [x] WWW-Authenticate header sanitization (quote stripping, truncation)
- [x] Generic token validation error responses (no internal URL leakage)
- [x] Code Mode vm sandbox gated to non-production environments
- [x] Per-execution UUID filenames in vm.Script for forensic traceability
- [x] Implicit prototype traversal prevention (Object.getPrototypeOf) in worker sandbox
- [x] Code Mode buffer uninitialized memory read prevention
- [x] Strict HTTPS JWKS enforcement in production (via ALLOW_HTTP_JWKS)
- [x] CI/CD pipeline Trivy SHA-pinning
- [x] SQL string literal credential redaction in audit logs
- [x] DSN/URI regex credential scrubbing in error formatters
- [x] Code Mode worker sandbox Function constructor nullification
- [x] Strict PRAGMA blocklist extended for DoS prevention (`locking_mode`, `mmap_size`)
- [x] Strict path boundary blocking for in-memory virtual paths (`:memory:`)
- [x] Scope enforcement without implicit admin fallback
- [x] Strict JWT clockTolerance defaults (30 seconds)
- [x] CI/CD concurrent execution block safeguards
- [x] Unauthenticated HTTP transport implicitly fails closed without `--no-auth-enforcement` flag
- [x] Session ID format and length validation (UUIDv4) for stateful transport

- [x] WebAssembly and SharedArrayBuffer blocked in Code Mode sandbox
- [x] File I/O functions (`WRITEFILE`, `READFILE`) blocked in restore tool
- [x] Obfuscated adapter ID mapping in built-in tools
- [x] Low entropy startup warning for single-tenant tokens
- [x] Comprehensive security documentation
- [x] DDL Validation blocklist for `ATTACH` / `DETACH` / `LOAD_EXTENSION` (CWE-89, CWE-22)
- [x] Code Mode recursive credential redaction for deeply nested array objects (CWE-200)
- [x] Tool annotations with exact allowlist enforcement for `openWorldHint=true` (filesystem-touching tools only)

## 🚨 **Reporting Security Issues**

| Version | Supported |
| ------- | --------- |
| 3.x.x   | ✅        |
| 2.x.x   | ✅        |
| 1.x.x   | ❌        |
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
- **Dependency updates**: Keep npm packages updated via `npm audit` and manual dependency upgrades
- **Database maintenance**: Run `ANALYZE` and `VACUUM` regularly for optimal performance
- **Security patches**: Apply host system security updates

The db-mcp SQLite MCP server is designed with **security-first principles** to protect your databases while maintaining excellent performance and full SQLite capability.
