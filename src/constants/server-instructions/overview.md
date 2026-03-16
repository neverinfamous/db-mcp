# db-mcp (SQLite MCP Server)

## Quick Access

| Purpose         | Action                     |
| --------------- | -------------------------- |
| Health check    | `server_health` tool       |
| Server info     | `server_info` tool         |
| Database schema | `sqlite://schema` resource |
| Tool help       | `sqlite://help` resource   |

## Built-in Tools

`server_info`, `server_health`, `list_adapters` — always available.

## Help Resources

Read `sqlite://help` for gotchas and critical usage patterns.
Read `sqlite://help/{group}` for group-specific tool reference (json, text, stats, vector, geo, admin, introspection, migration).
Only help resources for your enabled tool groups are registered.
