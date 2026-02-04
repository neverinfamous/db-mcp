# Docker Deployment Setup Guide

_Last Updated: February 4, 2026 - v1.0.0_

## 🚀 Automated Docker Deployment

This repository is configured for **automatic Docker image deployment** to Docker Hub on every push to the `main` branch after tests pass.

## 📋 Current Status

### ✅ Production-Ready Deployment

- **Version**: v1.0.0 (Production/Stable)
- **Base Image**: `node:24-alpine` (Alpine Linux)
- **Docker Hub**: `writenotenow/db-mcp`
- **Platforms**: `linux/amd64`, `linux/arm64` (Apple Silicon support)
- **Backend**: better-sqlite3 (native) with sql.js (WASM) fallback

## 📦 Required GitHub Secrets

Before the Docker deployment workflow can run, add these secrets to your GitHub repository:

### 1. Navigate to Repository Settings

1. Go to your repository: https://github.com/neverinfamous/db-mcp
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**

### 2. Required Secrets

#### `DOCKER_USERNAME`

- **Value**: `writenotenow` (Docker Hub username)
- **Description**: Docker Hub username for authentication

#### `DOCKER_PASSWORD`

- **Value**: Docker Hub access token (NOT your password)
- **Description**: Docker Hub access token for secure authentication

#### `NPM_TOKEN`

- **Value**: npm access token (for npm publishing)
- **Description**: Required for `publish-npm.yml` workflow on GitHub releases

### 3. Generate Docker Hub Access Token (If Needed)

1. Go to [Docker Hub](https://hub.docker.com)
2. Click your avatar → **Account Settings**
3. Go to **Security** → **Personal Access Tokens**
4. Click **Generate New Token**
5. Name: `GitHub-Actions-db-mcp`
6. Permissions: **Read, Write, Delete**
7. Copy the token and use it as `DOCKER_PASSWORD`

### 4. Generate npm Access Token (If Needed)

1. Go to [npmjs.com](https://www.npmjs.com) → **Access Tokens**
2. Click **Generate New Token** → **Automation**
3. Copy the token and use it as `NPM_TOKEN`

## 🏗️ What Gets Built

### Image Configuration

- **Native Backend**: better-sqlite3 with full 122 tools (transactions, window functions, SpatiaLite support)
- **WASM Fallback**: sql.js with 102 tools (pure JavaScript, no native dependencies)
- **Base**: Node.js 24 on Alpine Linux

### Supported Platforms

- **linux/amd64** - x86_64 architecture
- **linux/arm64** - Apple Silicon / ARM64

### Tags Generated on Each Push

When you push to `main` branch, the workflow automatically creates:

- `latest` - Always points to most recent main branch build
- `v1.0.0` - Current version from package.json
- `sha-XXXXXXX` - Git commit SHA pinned tag

## 🔄 Deployment Triggers

### Automatic Deployment

- ✅ **Push to main** → Runs `lint-and-test`, then builds and pushes Docker images
- ✅ **Pull requests** → Runs `lint-and-test` only (no Docker push)

### Manual Deployment

```bash
# Create and push a release tag
git tag v1.0.0
git push origin v1.0.0
```

## 🛡️ Security Features

### Multi-Layer Security Scanning

1. **Docker Scout CLI** - Runs during build, blocks critical/high vulnerabilities
   - Scans single-platform (linux/amd64) image locally
   - 8-minute timeout for efficient CI/CD
   - Blocks deployment if fixable critical/high CVEs detected

2. **npm audit** - Runs during lint-and-test workflow

### Image Optimization

- **Multi-stage builds** keep images lean
- **Layer caching** speeds up builds
- **GitHub Actions cache** reduces build times
- **Non-root user** for container security

### Supply Chain Security

- **Attestations**: Enabled for all images
- **Provenance**: Full build provenance tracking
- **SBOM**: Software Bill of Materials generated

## 🧪 Testing

### Automated CI/CD Tests

- ✅ **Linting** - ESLint code quality checks
- ✅ **TypeScript check** - Type safety verification
- ✅ **Test suite** - 941 tests with Vitest
- ✅ **Multi-version** - Node.js 22.x, 24.x, 25.x

### Manual Testing

```bash
# Test latest build
docker pull writenotenow/db-mcp:latest

# Run with native backend
docker run -i --rm writenotenow/db-mcp:latest --sqlite-native :memory:

# Run with WASM backend
docker run -i --rm writenotenow/db-mcp:latest --sqlite :memory:

# Mount database file
docker run -i --rm -v $(pwd):/workspace writenotenow/db-mcp:latest --sqlite-native /workspace/database.db
```

## 🚨 Troubleshooting

### Common Issues

#### 1. Build fails with authentication error

**Symptoms**: `Error saving credentials`
**Solution**:

- Verify `DOCKER_USERNAME` and `DOCKER_PASSWORD` secrets in GitHub
- Check Docker Hub access token hasn't expired
- Ensure token has Read, Write, Delete permissions

#### 2. Native build fails on ARM64

**Symptoms**: `better-sqlite3` compilation errors
**Status**: ✅ Should work with build tools in Dockerfile
**Details**: Python3, make, g++ are included in builder stage

#### 3. Security scan fails

**Symptoms**: Build blocked with critical/high vulnerabilities
**Solution**:

1. Review Docker Scout output in Actions logs
2. Update base image or pinned packages
3. Commit and push to trigger new build

## 📚 Additional Resources

- **GitHub Repository**: https://github.com/neverinfamous/db-mcp
- **GitHub Wiki**: https://github.com/neverinfamous/db-mcp/wiki
- **Docker Hub**: https://hub.docker.com/r/writenotenow/db-mcp
