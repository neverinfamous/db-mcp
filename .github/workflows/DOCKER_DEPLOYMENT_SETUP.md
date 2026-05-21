# Docker Deployment Setup Guide

_Last Updated: May 21, 2026_

## 🚀 Automated Docker Deployment

This repository uses a **gatekeeper-orchestrated CI/CD pipeline** that fans out all security checks in parallel and gates Docker + npm publishing behind ALL of them. Publishing is triggered by tag pushes (`v*`) only.

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

### Tags Generated on Tag Push

When you push a `v*` tag and all gates pass, the pipeline creates:

- `latest` - Always points to most recent tagged release
- `vX.Y.Z` - Version from package.json
- `sha-XXXXXXX` - Git commit SHA pinned tag

## 🔄 Deployment Triggers

### Gatekeeper Pipeline (push to main or tag)

1. **Fan-out**: `lint-and-test`, `codeql`, `secrets-scanning`, `security-update` run in parallel
2. **Gate**: ALL four must pass before publish
3. **Publish**: Only on `v*` tag pushes → Docker build → npm publish (last)

### PR Checks

- ✅ **Pull requests** → Runs `lint-and-test`, `codeql`, `secrets-scanning`, `e2e` individually

### Release Workflow

Use the `/bump-deploy` workflow for releases:

```bash
# After PR is merged to main:
git tag -a vX.Y.Z -m "Release vX.Y.Z"
git push origin main --follow-tags
gh release create vX.Y.Z --title "vX.Y.Z" --notes-file releases/vX.Y.Z.md
```

## 🛡️ Security Features

### Multi-Layer Security Scanning (All Gate Publish)

1. **CodeQL** — Static analysis for JavaScript/TypeScript + GitHub Actions injection vulnerabilities
2. **TruffleHog + Gitleaks** — Dual secret scanning (verified secrets only)
3. **Trivy** — Docker image vulnerability scan (SARIF upload to Security tab + blocking table scan)
4. **Docker Scout** — Docker image CVE scan via official action (blocks fixable critical/high)
5. **npm audit** — Dependency vulnerability scan (all + production-only)

### Image Optimization

- **Multi-stage builds** keep images lean
- **Layer caching** speeds up builds
- **GitHub Actions cache** reduces build times
- **Non-root user** for container security

### Supply Chain Security

- **Build Provenance Attestation**: Signed provenance pushed to registry
- **Provenance**: Full build provenance tracking (`mode=max`)
- **SBOM**: Software Bill of Materials generated for every image

## 🧪 Testing

### Automated CI/CD Tests

- ✅ **Linting** — ESLint code quality checks
- ✅ **TypeScript check** — Type safety verification
- ✅ **Test suite** — Vitest unit tests
- ✅ **E2E tests** — Playwright with SQLite test database
- ✅ **Multi-version** — Node.js 22.x, 24.x, 25.x
- ✅ **Documentation drift** — Copilot-powered doc consistency audit on PRs

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
