# Core Group Test Task

| Tool | Happy Path | Domain Error | Zod Error |
| ---- | ---------- | ------------ | --------- |
| readQuery | ✅ | ✅ | ✅ |
| writeQuery | ✅ | ✅ | ✅ |
| listTables | ✅ | ✅ | ✅ |
| describeTable | ✅ | ✅ | ✅ |
| getIndexes | ✅ | ✅ | ✅ |
| count | ✅ | ✅ | ✅ |
| exists | ✅ | ✅ | ✅ |
| createTable | ✅ | ✅ | ✅ |
| dropTable | ✅ | ✅ | ✅ |
| createIndex | ✅ | ✅ | ✅ |
| dropIndex | ✅ | ✅ | ✅ |
| upsert | ✅ | ✅ | ✅ |
| batchInsert | ✅ | ✅ | ✅ |
| truncate | ✅ | ✅ | ✅ |

## Test Results

### Phase 1: Happy Paths
- `readQuery` [x]
- `writeQuery` [x]
- `listTables` [x]
- `describeTable` [x]
- `getIndexes` [x]
- `count` [x]
- `exists` [x]
- `createTable` [x]
- `dropTable` [x]
- `createIndex` [x]
- `dropIndex` [x]
- `upsert` [x]
- `batchInsert` [x]
- `truncate` [x]

### Phase 2: Domain Errors
- [x] Read/Query tools
- [x] Write tools
- [x] Boundary conditions

### Phase 3: Zod Validation
- [x] Empty parameters check

### Phase 4: Multi-Step Workflows
- [x] 4.1 ETL pipeline
- [x] 4.2 Schema introspection + query
- [x] 4.3 Loop with accumulator
- [x] 4.4 Schema mutation + verification
