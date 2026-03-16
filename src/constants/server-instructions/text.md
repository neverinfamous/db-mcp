# db-mcp Help — Text Processing & FTS5

## Full-Text Search / FTS5 (4 tools, Native only)

- `sqlite_fts_create({ tableName, sourceTable, columns: ["title", "content"] })` — creates FTS5 table with auto-sync triggers
- `sqlite_fts_rebuild({ table })` — ⚠️ Required after create to populate index with existing data
- `sqlite_fts_search({ table, query, limit })` — search FTS5 index. AND by default; use `OR` explicitly
- `sqlite_fts_match_info({ table, query })` — get FTS5 match ranking information using bm25

## Text Processing (13 tools)

- `sqlite_regex_match({ table, column, pattern })` — ⚠️ double-escape backslashes in JSON
- `sqlite_regex_extract({ table, column, pattern, groupIndex })` — extract capture group
- `sqlite_text_split({ table, column, delimiter })` — split into parts array
- `sqlite_text_concat({ table, columns: ["first", "last"], separator: " " })`
- `sqlite_text_replace({ table, column, search, replacement })` — replace text using SQLite `replace()`
- `sqlite_text_trim({ table, column })` — trim whitespace
- `sqlite_text_case({ table, column, mode: "upper" })` — or `"lower"`
- `sqlite_text_substring({ table, column, start, length })` — extract substring
- `sqlite_text_normalize({ table, column, mode: "strip_accents" })` — or nfc, nfd, nfkc, nfkd
- `sqlite_text_validate({ table, column, pattern: "email" })` — patterns: email, phone, url, uuid, ipv4, custom. For custom: `pattern: "custom", customPattern: "^[A-Z]{2}[0-9]{4}$"`
- `sqlite_fuzzy_match({ table, column, search, maxDistance, tokenize? })` — matches WORD TOKENS by default. Use `tokenize: false` for full-string matching
- `sqlite_phonetic_match({ table, column, search, algorithm: "soundex" })` — matches against any word in value. Use `includeRowData: false` for lighter payloads
- `sqlite_advanced_search({ table, column, searchTerm, techniques: ["exact", "fuzzy", "phonetic"], fuzzyThreshold })` — fuzzyThreshold: 0.3-0.4 = loose, 0.6-0.8 = strict
