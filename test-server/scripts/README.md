# db-mcp Test Scripts

This directory contains integration test scripts that verify the functional parity and proper configuration of the `db-mcp` server.

## Running the tests

You must run these scripts from the project root using Node. Ensure you have built the project (`npm run build`) before running them so that the compiled `dist/cli.js` reflects your latest changes.

```bash
# Run from the project root:
npm run build

# 1. Test tool annotations and total tool count (Native Mode)
node test-server/scripts/test-tool-annotations.mjs

# 2. Test help resources and dynamic filtering
node test-server/scripts/test-help-resources.mjs

# 3. Test prompts registration and validation
node test-server/scripts/test-prompts.mjs

# 4. Test Progress Notifications (including chunked query streaming)
node test-server/scripts/test-progress.mjs

# 5. Test resource subscriptions and notifications
node test-server/scripts/test-subscriptions-raw.mjs
node test-server/scripts/test-subscriptions-sdk.mjs
```

## What they verify

- **test-tool-annotations.mjs**: Spins up the server in Native Mode (`--sqlite-native --audit-log stderr --audit-backup`) and verifies that all 175 MCP total tools (172 inventory + 3 built-in) are properly exposed, and that they all contain the required `openWorldHint: false` annotation for local database safety.
- **test-help-resources.mjs**: Starts the server with multiple `--tool-filter` configurations to verify that the core instructions remain slim (within context limits) and that the correct `sqlite://help/{group}` resources are dynamically registered only when their respective tool groups are enabled.
- **test-prompts.mjs**: Starts the server and verifies that all 10 MCP prompts are successfully registered via `prompts/list`, and performs functional execution checks on `prompts/get` handling required vs. optional arguments, payload structure correctness, and proper JSON-RPC error rendering.
- **test-progress.mjs**: Starts the server and verifies that progress notifications are successfully emitted across 8 supported tools. This includes a custom JavaScript busy-wait loop inside `sqlite_execute_code`, several long-running database operations (vacuum, backup, restore, dump, optimize, migration_apply), and the chunked row streaming behavior of `sqlite_read_query` (`stream: true`).
- **test-subscriptions-raw.mjs**: Connects to the server over `stdio` without the official MCP SDK to manually test raw JSON-RPC subscription handling and verify that subscriptions are successfully registered and notifications are emitted despite the stateless `stdio` environment.
- **test-subscriptions-sdk.mjs**: Connects to the server using the official MCP SDK to test subscription capabilities using the official Client SDK.

## Utilities

- **standardize-prompts.js**: A Node utility script that enforces uniform boilerplate and formatting across all 41 test prompts in `test-codemode`, `test-advanced`, and `test-tool-groups`. It dynamically extracts the specific test content and schema configurations from each prompt and rebuilds the file using the standardized layout defined in `prompt-template.md`.
- **prompt-template.md**: The pure Markdown template used by `standardize-prompts.js` to construct the testing prompts. If you need to change the reporting rules, testing standards, or boilerplate instructions, edit this template and run `node test-server/scripts/standardize-prompts.js` from the project root to update all 41 prompts instantly.
