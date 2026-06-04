# Utility Scripts (`scripts/`)

This directory contains internal tooling and utility scripts used for repository maintenance, documentation generation, and build steps.

## Scripts
- **`generate-server-instructions.ts`**: Generates or updates MCP server instructions/documentation dynamically based on schemas or capabilities.
- **`update-badges.ts`**: Automates the updating of status badges (like test coverage or CI status) within the repository's `README.md`.

You can typically run these scripts via `npx tsx scripts/<script-name>.ts` or through designated package.json scripts (e.g., `pnpm run ...`).
