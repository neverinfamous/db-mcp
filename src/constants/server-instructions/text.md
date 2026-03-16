# db-mcp Help — Text Processing & FTS5

## Full-Text Search / FTS5 (4 tools, Native only)

```javascript
// Create FTS5 table with triggers for auto-sync on future changes
sqlite_fts_create({ tableName: "articles_fts", sourceTable: "articles", columns: ["title", "content"] });
sqlite_fts_rebuild({ table: "articles_fts" }); // ⚠️ Required: populate index with existing data

// FTS5 uses AND by default: "machine learning" = rows containing BOTH words
// Use OR explicitly: "machine OR learning" for rows containing EITHER word
sqlite_fts_search({ table: "articles_fts", query: "machine learning", limit: 10 });
sqlite_fts_match_info({ table: "articles_fts", query: "machine learning" }); // bm25 ranking info
```

⚠️ FTS5 virtual tables (`*_fts`) and shadow tables (`*_fts_*`) are hidden from `sqlite_list_tables` for cleaner output

## Text Processing (13 tools)

```javascript
// Regex patterns: ⚠️ Double-escape backslashes (\\) when passing through JSON/MCP
sqlite_regex_match({ table: "logs", column: "message", pattern: "ERROR:\\\\s+(\\\\w+)" });
sqlite_regex_extract({ table: "users", column: "email", pattern: "@([a-zA-Z0-9.-]+)", groupIndex: 1 });

// Text manipulation
sqlite_text_split({ table: "users", column: "email", delimiter: "@" }); // split into parts array
sqlite_text_concat({ table: "users", columns: ["first_name", "last_name"], separator: " " });
sqlite_text_replace({ table: "docs", column: "content", search: "old", replacement: "new" });
sqlite_text_trim({ table: "users", column: "name" }); // trim whitespace
sqlite_text_case({ table: "products", column: "name", mode: "upper" }); // or "lower"
sqlite_text_substring({ table: "codes", column: "value", start: 1, length: 3 }); // extract substring
sqlite_text_normalize({ table: "docs", column: "content", mode: "strip_accents" }); // or nfc, nfd, nfkc, nfkd

// Validation patterns: email, phone, url, uuid, ipv4, custom
sqlite_text_validate({ table: "users", column: "email", pattern: "email" });
sqlite_text_validate({ table: "data", column: "field", pattern: "custom", customPattern: "^[A-Z]{2}[0-9]{4}$" });

// Fuzzy matching — matches WORD TOKENS by default (not entire value)
// "laptop" matches "Laptop Pro 15" (distance 0 on first token). Use tokenize: false for full-string matching.
sqlite_fuzzy_match({ table: "products", column: "name", search: "laptop", maxDistance: 2 });
sqlite_fuzzy_match({ table: "products", column: "name", search: "laptob", maxDistance: 2, tokenize: false }); // full value

// Phonetic matching — finds words that sound alike (matches against any word in value)
// Use includeRowData: false for lighter payloads when only matching values are needed
sqlite_phonetic_match({ table: "products", column: "name", search: "laptop", algorithm: "soundex" });
sqlite_phonetic_match({ table: "products", column: "name", search: "laptop", includeRowData: false }); // lighter

// Advanced search — combines exact, fuzzy, and phonetic techniques
// fuzzyThreshold: 0.3-0.4 = loose matching (more results), 0.6-0.8 = strict matching (fewer results)
sqlite_advanced_search({
  table: "products", column: "name", searchTerm: "laptop",
  techniques: ["exact", "fuzzy", "phonetic"], fuzzyThreshold: 0.4,
});
```
