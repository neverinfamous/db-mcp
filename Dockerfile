# db-mcp (SQLite MCP Server)
# Multi-stage build for optimized production image
FROM node:24-alpine AS builder

WORKDIR /app

# Install build dependencies for better-sqlite3 native compilation
# Use Alpine edge for latest security patches
RUN apk add --no-cache python3 make g++ && \
    apk add --no-cache --repository=https://dl-cdn.alpinelinux.org/alpine/edge/main curl openssl musl nghttp2

# Pin pnpm version for reproducible builds
RUN npm install -g pnpm@9.15.4 && pnpm config set store-dir /app/.pnpm-store

# Copy package files first for better layer caching
COPY package.json pnpm-lock.yaml ./

# Install all dependencies (including devDependencies for build)
# This will compile better-sqlite3 native bindings
RUN pnpm install --frozen-lockfile

# Ensure better-sqlite3 native addon is compiled for the current target architecture
# (prevents stale/cross-arch cached binaries from pnpm install)
RUN pnpm rebuild better-sqlite3

# Remove protobufjs CLI entirely - not needed at runtime
# Eliminates CVE-2019-10790 (taffydb), CVE-2025-54798 (tmp), CVE-2025-5889 (brace-expansion)
RUN rm -rf node_modules/protobufjs/cli || true

# Copy source code
COPY tsconfig*.json tsup.config.ts binding.gyp ./
COPY src/ ./src/

# Build TypeScript
RUN pnpm run build

# Prune devDependencies after build
RUN pnpm prune --prod

# Production stage
FROM node:24-alpine

WORKDIR /app

# Install runtime dependencies with security fixes
RUN apk add --no-cache ca-certificates && \
    apk add --no-cache --repository=https://dl-cdn.alpinelinux.org/alpine/edge/main curl openssl musl nghttp2 && \
    apk upgrade --no-cache

# Patch npm-bundled transitive dependencies for Docker Scout compliance.
# These only matter in the production image (what gets scanned and deployed).

# Fix GHSA-73rr-hh4g-fpgx: Manually update npm's bundled diff to 9.0.0
RUN cd /usr/local/lib/node_modules/npm && \
    npm pack diff@9.0.0 && \
    echo "b898bf23c95594607576e25ddd4013f1d51ed0e862aaf0732815830c87b3b58f  diff-9.0.0.tgz" | sha256sum -c && \
    rm -rf node_modules/diff && \
    tar -xzf diff-9.0.0.tgz && \
    mv package node_modules/diff && \
    rm diff-9.0.0.tgz

# Fix CVE-2026-25547: Manually update npm's bundled @isaacs/brace-expansion to 5.0.1
RUN cd /usr/local/lib/node_modules/npm && \
    npm pack @isaacs/brace-expansion@5.0.1 && \
    echo "c908309f6735b002952f2b02563e68d98cba0375322a189ebc4f6f47637ee95b  isaacs-brace-expansion-5.0.1.tgz" | sha256sum -c && \
    rm -rf node_modules/@isaacs/brace-expansion && \
    mkdir -p node_modules/@isaacs/brace-expansion && \
    tar -xzf isaacs-brace-expansion-5.0.1.tgz && \
    mv package/* node_modules/@isaacs/brace-expansion/ && \
    rm -rf package isaacs-brace-expansion-5.0.1.tgz

# Fix CVE-2026-23950, CVE-2026-24842, CVE-2026-26960: Manually update npm's bundled tar to 7.5.16
RUN cd /usr/local/lib/node_modules/npm && \
    npm pack tar@7.5.16 && \
    echo "bff788a9bc2d2ac084ce78ea12068040fbc59b8b7627d99c1184f1300f597a09  tar-7.5.16.tgz" | sha256sum -c && \
    rm -rf node_modules/tar && \
    tar -xzf tar-7.5.16.tgz && \
    mv package node_modules/tar && \
    rm tar-7.5.16.tgz

# Fix CVE-2026-26996: Manually update npm's bundled minimatch to 10.2.5
RUN cd /usr/local/lib/node_modules/npm && \
    npm pack minimatch@10.2.5 && \
    echo "a6cea46915bfc6c3fae60f9bd003ea4f9d6a4233aa59a9ca729474d3824ca9e5  minimatch-10.2.5.tgz" | sha256sum -c && \
    rm -rf node_modules/minimatch && \
    tar -xzf minimatch-10.2.5.tgz && \
    mv package node_modules/minimatch && \
    rm minimatch-10.2.5.tgz

# Fix CVE-2026-45149, CVE-2026-33750: Manually update npm's bundled brace-expansion to 5.0.6
RUN cd /usr/local/lib/node_modules/npm && \
    npm pack brace-expansion@5.0.6 && \
    echo "fca5c7f55b6c26ad332b915fa9f77e69df50d711ca22d9033d13a58fb0480600  brace-expansion-5.0.6.tgz" | sha256sum -c && \
    rm -rf node_modules/brace-expansion && \
    tar -xzf brace-expansion-5.0.6.tgz && \
    mv package node_modules/brace-expansion && \
    rm brace-expansion-5.0.6.tgz

# Copy built artifacts and production dependencies
# Remove package managers CLI after building — they are not needed at runtime and reduce attack surface (L-4)
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/pnpm /usr/local/bin/pnpx && \
    rm -rf /root/.npm /app/.pnpm-store
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package.json pnpm-lock.yaml ./
COPY LICENSE ./

# Create data directory for SQLite database with proper permissions
RUN mkdir -p /app/data && chmod 700 /app/data

# Create non-root user for security
RUN addgroup -g 1001 -S appgroup && \
    adduser -u 1001 -S appuser -G appgroup && \
    chown -R appuser:appgroup /app

# Set environment variables
ENV NODE_ENV=production
ENV MCP_HOST=0.0.0.0

# Switch to non-root user
USER appuser

# Health check — uses HTTP endpoint for HTTP transport, falls back to Node.js check for stdio
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD /bin/sh -c 'if [ "${MCP_TRANSPORT:-stdio}" = "http" ]; then curl -sf "http://localhost:${PORT:-3000}/health"; else node -e "console.log(\"ok\")"; fi'

# Run the MCP server (default: stdio transport with native backend)
ENTRYPOINT ["node", "dist/cli.js"]
CMD ["--transport", "stdio", "--sqlite-native", "/app/data/database.db"]

# Labels for Docker Hub
LABEL maintainer="Adamic.tech"
LABEL description="SQLite MCP Server with OAuth 2.1, HTTP/SSE transport, 177 tools, and smart tool filtering"
LABEL org.opencontainers.image.source="https://github.com/neverinfamous/db-mcp"
LABEL io.modelcontextprotocol.server.name="io.github.neverinfamous/db-mcp"
