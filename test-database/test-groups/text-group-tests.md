# Text Tool Group Tests

## Overview

The **Text** group provides text processing capabilities including regex operations, FTS5 full-text search, fuzzy matching, and phonetic search.

| Environment | Tool Count |
| ----------- | ---------- |
| WASM        | 17         |
| Native      | 17         |

## Tools in Group

### Text Processing (13 tools)

| Tool                     | Description                         |
| ------------------------ | ----------------------------------- |
| `sqlite_regex_extract`   | Extract text using regex pattern    |
| `sqlite_regex_match`     | Match rows using regex pattern      |
| `sqlite_text_split`      | Split text into array               |
| `sqlite_text_concat`     | Concatenate columns                 |
| `sqlite_text_replace`    | Replace text in column              |
| `sqlite_text_trim`       | Trim whitespace                     |
| `sqlite_text_case`       | Change text case                    |
| `sqlite_text_substring`  | Extract substring                   |
| `sqlite_fuzzy_match`     | Fuzzy string matching               |
| `sqlite_phonetic_search` | Phonetic search (Soundex/Metaphone) |
| `sqlite_text_normalize`  | Normalize text (Unicode, accents)   |
| `sqlite_text_validate`   | Validate text patterns              |
| `sqlite_advanced_search` | Multi-technique search              |

### FTS5 Full-Text Search (4 tools)

| Tool                    | Description            |
| ----------------------- | ---------------------- |
| `sqlite_fts_create`     | Create FTS5 table      |
| `sqlite_fts_search`     | Search FTS table       |
| `sqlite_fts_rebuild`    | Rebuild FTS index      |
| `sqlite_fts_match_info` | Get match ranking info |

## Test Tables

- `test_articles` (8 rows) - Article content with title and body
- `test_users` (8 rows) - User profiles with usernames, emails, bios
- `test_categories` (17 rows) - Hierarchical path data

---

## Text Processing Tests

### 1. sqlite_regex_extract

**Test 1.1: Extract email domain**

```json
{
  "table": "test_users",
  "column": "email",
  "pattern": "@([a-zA-Z0-9.-]+)"
}
```

Expected: Returns extracted domains (example.com, company.org, etc.).

**Test 1.2: Extract year from dates**

```json
{
  "table": "test_articles",
  "column": "published_at",
  "pattern": "(\\d{4})"
}
```

Expected: Returns year portion of dates.

---

### 2. sqlite_regex_match

**Test 2.1: Match rows with pattern**

```json
{
  "table": "test_users",
  "column": "email",
  "pattern": ".*\\.com$"
}
```

Expected: Returns users with .com emails.

**Test 2.2: Match phone patterns**

```json
{
  "table": "test_users",
  "column": "phone",
  "pattern": "^\\+1-"
}
```

Expected: Returns US phone numbers starting with +1-.

---

### 3. sqlite_text_split

**Test 3.1: Split category paths**

```json
{
  "table": "test_categories",
  "column": "path",
  "delimiter": "."
}
```

Expected: Returns path segments as arrays.

**Test 3.2: Split with limit**

```json
{
  "table": "test_users",
  "column": "email",
  "delimiter": "@",
  "limit": 2
}
```

Expected: Returns [username, domain] arrays.

---

### 4. sqlite_text_concat

**Test 4.1: Concat with separator**

```json
{
  "table": "test_users",
  "columns": ["username", "email"],
  "separator": " - "
}
```

Expected: Returns "username - email" formatted strings.

---

### 5. sqlite_text_replace

**Test 5.1: Replace in text**

```json
{
  "table": "test_articles",
  "column": "body",
  "search": "SQLite",
  "replacement": "**SQLite**"
}
```

Expected: Returns body with SQLite wrapped in markdown bold.

---

### 6. sqlite_text_trim

**Test 6.1: Trim whitespace**

```json
{
  "table": "test_users",
  "column": "bio",
  "mode": "both"
}
```

Expected: Returns trimmed bio text.

**Test 6.2: Left trim only**

```json
{
  "table": "test_users",
  "column": "bio",
  "mode": "left"
}
```

Expected: Returns left-trimmed text.

---

### 7. sqlite_text_case

**Test 7.1: Convert to uppercase**

```json
{
  "table": "test_products",
  "column": "category",
  "mode": "upper"
}
```

Expected: Returns ELECTRONICS, ACCESSORIES, etc.

**Test 7.2: Convert to lowercase**

```json
{
  "table": "test_users",
  "column": "username",
  "mode": "lower"
}
```

Expected: Returns all lowercase usernames.

---

### 8. sqlite_text_substring

**Test 8.1: Extract substring**

```json
{
  "table": "test_products",
  "column": "name",
  "start": 1,
  "length": 10
}
```

Expected: Returns first 10 characters of product names.

---

### 9. sqlite_fuzzy_match

**Test 9.1: Fuzzy search products**

```json
{
  "table": "test_products",
  "column": "name",
  "search": "Laptpp",
  "threshold": 0.6
}
```

Expected: Returns "Laptop Pro 15" (fuzzy match for typo).

**Test 9.2: Fuzzy match usernames**

```json
{
  "table": "test_users",
  "column": "username",
  "search": "johndo",
  "threshold": 0.7
}
```

Expected: Returns "johndoe" as match.

---

### 10. sqlite_phonetic_search

**Test 10.1: Soundex search**

```json
{
  "table": "test_users",
  "column": "username",
  "search": "Jon",
  "algorithm": "soundex"
}
```

Expected: Returns "johndoe" (sounds like John).

**Test 10.2: Metaphone search**

```json
{
  "table": "test_products",
  "column": "name",
  "search": "Keybord",
  "algorithm": "metaphone"
}
```

Expected: Returns "Mechanical Keyboard" match.

---

### 11. sqlite_text_normalize

**Test 11.1: Strip accents**

```json
{
  "table": "test_articles",
  "column": "title",
  "mode": "strip_accents"
}
```

Expected: Returns normalized text without diacritics.

**Test 11.2: Unicode NFC normalization**

```json
{
  "table": "test_users",
  "column": "bio",
  "mode": "nfc"
}
```

Expected: Returns NFC-normalized text.

---

### 12. sqlite_text_validate

**Test 12.1: Validate emails**

```json
{
  "table": "test_users",
  "column": "email",
  "pattern": "email"
}
```

Expected: All emails validate as true.

**Test 12.2: Validate phone numbers**

```json
{
  "table": "test_users",
  "column": "phone",
  "pattern": "phone"
}
```

Expected: Returns validation results for phone column.

---

### 13. sqlite_advanced_search

**Test 13.1: Multi-technique search**

```json
{
  "table": "test_products",
  "column": "name",
  "search": "Laptop",
  "techniques": ["exact", "fuzzy", "phonetic"],
  "fuzzyThreshold": 0.7
}
```

Expected: Returns matches from all techniques.

---

## FTS5 Full-Text Search Tests

### 14. sqlite_fts_create

**Test 14.1: Create FTS table for articles**

```json
{
  "tableName": "fts_test_articles",
  "sourceTable": "test_articles",
  "columns": ["title", "body"],
  "tokenizer": "unicode61"
}
```

Expected: FTS5 virtual table created.

**Test 14.2: Create with Porter stemmer**

```json
{
  "tableName": "fts_test_articles_porter",
  "sourceTable": "test_articles",
  "columns": ["title", "body"],
  "tokenizer": "porter"
}
```

Expected: FTS5 table with Porter stemming created.

---

### 15. sqlite_fts_search

**Test 15.1: Basic FTS search**

```json
{
  "table": "fts_test_articles",
  "query": "database performance",
  "limit": 10
}
```

Expected: Returns articles matching "database" or "performance".

**Test 15.2: Phrase search**

```json
{
  "table": "fts_test_articles",
  "query": "\"full-text search\"",
  "limit": 10
}
```

Expected: Returns articles with exact phrase.

**Test 15.3: Search with highlighting**

```json
{
  "table": "fts_test_articles",
  "query": "SQLite",
  "highlight": true,
  "limit": 5
}
```

Expected: Returns matches with `<b>SQLite</b>` highlighting.

**Test 15.4: Column-specific search**

```json
{
  "table": "fts_test_articles",
  "query": "title:Introduction",
  "columns": ["title"]
}
```

Expected: Returns articles with "Introduction" in title only.

---

### 16. sqlite_fts_rebuild

**Test 16.1: Rebuild index**

```json
{
  "table": "fts_test_articles"
}
```

Expected: Index rebuilt successfully.

---

### 17. sqlite_fts_match_info

**Test 17.1: Get BM25 ranking**

```json
{
  "table": "fts_test_articles",
  "query": "database",
  "format": "bm25"
}
```

Expected: Returns matches with BM25 relevance scores.

---

## Cleanup

```sql
DROP TABLE IF EXISTS fts_test_articles;
DROP TABLE IF EXISTS fts_test_articles_porter;
```

## Known Issues / Notes

- Regex operations are performed in JavaScript (no native SQLite regex)
- FTS5 requires the FTS5 extension (available in both WASM and Native)
- Phonetic algorithms: Soundex is more lenient, Metaphone is more precise
- Fuzzy matching uses Levenshtein distance (threshold 0-1)
