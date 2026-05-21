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
```

## What they verify

- **test-tool-annotations.mjs**: Spins up the server in Native Mode (`--sqlite-native`) and verifies that all 154 tools (151 Native + 3 built-in) are properly exposed, and that they all contain the required `openWorldHint: false` annotation for local database safety.
- **test-help-resources.mjs**: Starts the server with multiple `--tool-filter` configurations to verify that the core instructions remain slim (within context limits) and that the correct `sqlite://help/{group}` resources are dynamically registered only when their respective tool groups are enabled.
- **test-prompts.mjs**: Starts the server and verifies that all 10 MCP prompts are successfully registered via `prompts/list`, and performs functional execution checks on `prompts/get` handling required vs. optional arguments, payload structure correctness, and proper JSON-RPC error rendering.
