## Tool Filtering

Available presets via `--tool-filter`:
| Shortcut | WASM | Native | Use Case |
|----------|------|--------|----------|
| `starter` | 45 | 49 | ⭐ Recommended: Core(8) + JSON(23) + Text(13-17*) + Codemode(1) |
| `analytics` | 45 | 51 | Core(8) + JSON(23) + Stats(19: 13 core + 6 window) + Codemode(1) |
| `search` | 33 | 37 | Core(8) + Text(13-17*) + Vector(11) + Codemode(1) |
| `spatial` | 24 | 31 | Core(8) + Geo(4-11) + Vector(11) + Codemode(1) |
| `minimal` | 9 | 9 | Core(8) + Codemode(1) |
| `full` | 99 | 123 | All tools |

_+3 built-in tools (`server_info`, `server_health`, `list_adapters`) always included_

**Groups**: `core`, `json`, `text`, `stats`, `vector`, `admin`, `geo`, `codemode`
**Syntax**: `"core,json"` (whitelist), `"+stats"` (add), `"-admin"` (remove)
_Text group: 17 native, 13 in WASM (4 FTS5 tools require native)_
