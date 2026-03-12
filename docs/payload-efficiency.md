# Payload Efficiency Findings

Running log of token-efficiency improvements discovered while auditing tool response shapes.

> [!NOTE]
> "Tokens" in this context means the total JSON payload size that gets serialized back to the LLM agent. Smaller payloads = lower latency, lower cost, less context pollution.

## Findings

### 🔴 High Impact

| # | Tool(s) | Finding | Improvement |
|---|---------|---------|-------------|
| 1 | `vector_search` | Returns ALL columns from the table (content, category, embedding string) alongside `_similarity` | Add `compact` flag to return only id + `_similarity`. The `returnColumns` param exists but defaults to all. |
| 2 | `vector_get` | Returns full `metadata` object with ALL row columns + raw `embedding` string + parsed `vector` array (embedding serialized twice) | Omit raw `embedding` from `metadata` when it duplicates `vector`. Add `includeMetadata: false` option. |
| 3 | Error payloads (all tools) | Every error includes 5-6 fields: `error`, `code`, `category`, `suggestion`, `recoverable`, `details` | Most agent consumers only need `error` + `code`. Add global `compactErrors` config. |
| 4 | `schema_snapshot` | Returns full column definitions (name, type, nullable, primaryKey, defaultValue) for every column on every table | `compact: true` exists but is opt-in. Consider making it the default. |

### 🟡 Medium Impact

| # | Tool(s) | Finding | Improvement |
|---|---------|---------|-------------|
| 5 | `phonetic_match` | `includeRowData: true` by default returns entire row for every match | Default should be `false` — match `value` + `phoneticCode` is sufficient for most agent queries. |
| 6 | `stats_group_by` | Always includes result column named `stat_value` regardless of stat type | Rename to the actual stat name (e.g., `avg_value`) for clearer agent parsing. |
| 7 | `storage_analysis` | Always includes `tables[]` array with per-table breakdown (sizeBytes, pctOfTotal, pageCount, rowCount, avgRowBytes) | `includeTableDetails` defaults to `true`. For quick checks, agent only needs `database` summary. |
| 8 | `dependency_graph` | Always returns `stats` object (totalTables, totalRelationships, rootTables[], leafTables[]) | These are derivable from nodes/edges. Add `includeStats: false` option. |
| 9 | `regex_match`, `regex_extract` | Returns entire row objects in `matches[]` array (all columns) | Only need `rowid` + `value` for most agent use cases. Already filtered but still verbose. |

### 🟢 Low Impact

| # | Tool(s) | Finding | Improvement |
|---|---------|---------|-------------|
| 10 | `advanced_search` | Truncates text at 100 chars — good | ✅ Already optimized. |
| 11 | `fuzzy_match` | Returns `tokenized` field on every response | Minor — one boolean field. |
| 12 | `text_validate` | Returns `invalidRows[]` which can be large | `limit` param constrains this. |
| 13 | `json_analyze_schema` | Schema object can be deeply nested | `sampleSize` param limits input, but output grows with schema complexity. |

---

*This document is updated as new tools are audited during the payload coverage expansion.*
