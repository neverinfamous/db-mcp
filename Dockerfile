# db-mcp (SQLite MCP Server)
# Multi-stage build for optimized production image
FROM node:24-alpine AS builder

WORKDIR /app

# Install build dependencies for better-sqlite3 native compilation
# Use Alpine edge for latest security patches
RUN apk add --no-cache python3 make g++ && \
    apk add --no-cache --repository=https://dl-cdn.alpinelinux.org/alpine/edge/main curl && \
    apk upgrade --no-cache

# Upgrade npm globally to get fixed versions of bundled packages
RUN npm install -g npm@latest --force && npm cache clean --force

# Patch npm-bundled transitive dependencies (conditional — skips if already fixed upstream)
# Each patch checks the installed version before applying, so they become no-ops
# as npm releases include the fixes natively.
RUN cd /usr/local/lib/node_modules/npm && \
    # Fix GHSA-73rr-hh4g-fpgx: diff < 8.0.3 \
    DIFF_VER=$(node -p "try{require('./node_modules/diff/package.json').version}catch(e){'0.0.0'}") && \
    if [ "$(printf '%s\n' "8.0.3" "$DIFF_VER" | sort -V | head -n1)" != "8.0.3" ]; then \
      echo "Patching diff $DIFF_VER -> 8.0.3" && \
      npm pack diff@8.0.3 && rm -rf node_modules/diff && \
      tar -xzf diff-8.0.3.tgz && mv package node_modules/diff && rm diff-8.0.3.tgz; \
    else echo "diff $DIFF_VER already fixed, skipping"; fi && \
    # Fix CVE-2026-23950, CVE-2026-24842, CVE-2026-26960: tar < 7.5.8 \
    TAR_VER=$(node -p "try{require('./node_modules/tar/package.json').version}catch(e){'0.0.0'}") && \
    if [ "$(printf '%s\n' "7.5.8" "$TAR_VER" | sort -V | head -n1)" != "7.5.8" ]; then \
      echo "Patching tar $TAR_VER -> 7.5.8" && \
      npm pack tar@7.5.8 && rm -rf node_modules/tar && \
      tar -xzf tar-7.5.8.tgz && mv package node_modules/tar && rm tar-7.5.8.tgz; \
    else echo "tar $TAR_VER already fixed, skipping"; fi && \
    # Fix CVE-2026-26996: minimatch < 10.2.1 \
    MM_VER=$(node -p "try{require('./node_modules/minimatch/package.json').version}catch(e){'0.0.0'}") && \
    if [ "$(printf '%s\n' "10.2.1" "$MM_VER" | sort -V | head -n1)" != "10.2.1" ]; then \
      echo "Patching minimatch $MM_VER -> 10.2.1" && \
      npm pack minimatch@10.2.1 && rm -rf node_modules/minimatch && \
      tar -xzf minimatch-10.2.1.tgz && mv package node_modules/minimatch && rm minimatch-10.2.1.tgz; \
    else echo "minimatch $MM_VER already fixed, skipping"; fi && \
    # Fix CVE-2026-25547: @isaacs/brace-expansion < 5.0.1 \
    BE_VER=$(node -p "try{require('./node_modules/@isaacs/brace-expansion/package.json').version}catch(e){'0.0.0'}") && \
    if [ "$(printf '%s\n' "5.0.1" "$BE_VER" | sort -V | head -n1)" != "5.0.1" ]; then \
      echo "Patching @isaacs/brace-expansion $BE_VER -> 5.0.1" && \
      npm pack @isaacs/brace-expansion@5.0.1 && \
      rm -rf node_modules/@isaacs/brace-expansion && \
      mkdir -p node_modules/@isaacs/brace-expansion && \
      tar -xzf isaacs-brace-expansion-5.0.1.tgz && \
      mv package/* node_modules/@isaacs/brace-expansion/ && \
      rm -rf package isaacs-brace-expansion-5.0.1.tgz; \
    else echo "@isaacs/brace-expansion $BE_VER already fixed, skipping"; fi

# Copy package files first for better layer caching
COPY package*.json ./

# Install all dependencies (including devDependencies for build)
# This will compile better-sqlite3 native bindings
RUN npm ci

# Remove protobufjs CLI entirely - not needed at runtime
# Eliminates CVE-2019-10790 (taffydb), CVE-2025-54798 (tmp), CVE-2025-5889 (brace-expansion)
RUN rm -rf node_modules/protobufjs/cli || true

# Copy source code
COPY tsconfig.json ./
COPY src/ ./src/

# Build TypeScript
RUN npm run build

# Prune devDependencies after build (removes vulnerable rimraf -> @isaacs/brace-expansion chain)
RUN npm prune --omit=dev

# Production stage
FROM node:24-alpine

WORKDIR /app

# Install runtime dependencies with security fixes
RUN apk add --no-cache ca-certificates && \
    apk add --no-cache --repository=https://dl-cdn.alpinelinux.org/alpine/edge/main curl && \
    apk upgrade --no-cache && \
    npm install -g npm@latest --force && npm cache clean --force

# Patch npm-bundled transitive dependencies (conditional — same as builder stage)
RUN cd /usr/local/lib/node_modules/npm && \
    DIFF_VER=$(node -p "try{require('./node_modules/diff/package.json').version}catch(e){'0.0.0'}") && \
    if [ "$(printf '%s\n' "8.0.3" "$DIFF_VER" | sort -V | head -n1)" != "8.0.3" ]; then \
      echo "Patching diff $DIFF_VER -> 8.0.3" && \
      npm pack diff@8.0.3 && rm -rf node_modules/diff && \
      tar -xzf diff-8.0.3.tgz && mv package node_modules/diff && rm diff-8.0.3.tgz; \
    else echo "diff $DIFF_VER already fixed, skipping"; fi && \
    TAR_VER=$(node -p "try{require('./node_modules/tar/package.json').version}catch(e){'0.0.0'}") && \
    if [ "$(printf '%s\n' "7.5.8" "$TAR_VER" | sort -V | head -n1)" != "7.5.8" ]; then \
      echo "Patching tar $TAR_VER -> 7.5.8" && \
      npm pack tar@7.5.8 && rm -rf node_modules/tar && \
      tar -xzf tar-7.5.8.tgz && mv package node_modules/tar && rm tar-7.5.8.tgz; \
    else echo "tar $TAR_VER already fixed, skipping"; fi && \
    MM_VER=$(node -p "try{require('./node_modules/minimatch/package.json').version}catch(e){'0.0.0'}") && \
    if [ "$(printf '%s\n' "10.2.1" "$MM_VER" | sort -V | head -n1)" != "10.2.1" ]; then \
      echo "Patching minimatch $MM_VER -> 10.2.1" && \
      npm pack minimatch@10.2.1 && rm -rf node_modules/minimatch && \
      tar -xzf minimatch-10.2.1.tgz && mv package node_modules/minimatch && rm minimatch-10.2.1.tgz; \
    else echo "minimatch $MM_VER already fixed, skipping"; fi && \
    BE_VER=$(node -p "try{require('./node_modules/@isaacs/brace-expansion/package.json').version}catch(e){'0.0.0'}") && \
    if [ "$(printf '%s\n' "5.0.1" "$BE_VER" | sort -V | head -n1)" != "5.0.1" ]; then \
      echo "Patching @isaacs/brace-expansion $BE_VER -> 5.0.1" && \
      npm pack @isaacs/brace-expansion@5.0.1 && \
      rm -rf node_modules/@isaacs/brace-expansion && \
      mkdir -p node_modules/@isaacs/brace-expansion && \
      tar -xzf isaacs-brace-expansion-5.0.1.tgz && \
      mv package/* node_modules/@isaacs/brace-expansion/ && \
      rm -rf package isaacs-brace-expansion-5.0.1.tgz; \
    else echo "@isaacs/brace-expansion $BE_VER already fixed, skipping"; fi

# Copy built artifacts and production dependencies
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./
COPY LICENSE ./

# Create data directory for SQLite database with proper permissions
RUN mkdir -p /app/data && chmod 700 /app/data

# Create non-root user for security
RUN addgroup -g 1001 -S appgroup && \
    adduser -u 1001 -S appuser -G appgroup && \
    chown -R appuser:appgroup /app

# Set environment variables
ENV NODE_ENV=production

# Switch to non-root user
USER appuser

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "console.log('Server healthy')" || exit 1

# Run the MCP server (default: stdio transport with native backend)
ENTRYPOINT ["node", "dist/cli.js"]
CMD ["--transport", "stdio", "--sqlite-native", "/app/data/database.db"]

# Labels for Docker Hub
LABEL maintainer="Adamic.tech"
LABEL description="SQLite MCP Server with OAuth 2.1, HTTP/SSE transport, 122 tools, and smart tool filtering"
LABEL version="1.0.0"
LABEL org.opencontainers.image.source="https://github.com/neverinfamous/db-mcp"
LABEL io.modelcontextprotocol.server.name="io.github.neverinfamous/db-mcp"
