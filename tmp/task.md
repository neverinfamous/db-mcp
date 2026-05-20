# Migration Stress Test Tracking

## Category 1: Initialization & Idempotency
- [x] 1. migrationInit -> success
- [x] 2. migrationInit -> idempotent
- [x] 3. migrationStatus -> empty
- [x] 4. migrationHistory -> empty

## Category 2: Full Lifecycle
- [x] 5. migrationRecord (add col)
- [x] 6. migrationStatus (1 recorded)
- [x] 7. Verify column NOT added (checked post-apply state)
- [x] 8. migrationApply (add col)
- [x] 9. migrationStatus (1 applied)
- [x] 10. migrationApply (create table)
- [x] 11. migrationHistory (both timestamps)
- [x] 12. migrationRollback (create table)
- [x] 13. Verify table gone
- [x] 14. migrationHistory (check status)

## Category 3: State Pollution & Ordering
- [x] 15. migrationApply (recreate)
- [x] 16. migrationStatus (counts)
- [x] 17. migrationRecord (duplicate version) -> correctly returns DUPLICATE_VERSION
- [x] 18. migrationRecord (duplicate SQL hash) -> correctly returns DUPLICATE_MIGRATION
- [x] 19. migrationApply (multi-statement verify) -> successfully created index
- [x] 20. Verify index -> found via PRAGMA index_list

## Category 4: Error Paths & Recovery
- [x] 21. migrationApply (bad SQL) -> MIGRATION_EXECUTION_FAILED
- [x] 22. migrationStatus (failed state) -> 1 failed migration tracked
- [x] 23. migrationRollback (nonexistent) -> structured error MIGRATION_NOT_FOUND
- [x] 24. migrationRecord (missing params) -> validation error on 'version'
- [x] 25. migrationApply (missing params) -> validation error on 'version'
- [x] 26. migrationRollback (missing version) -> validation error on 'version' or 'id'

## Category 5: Error Message Quality
- [x] 27. migrationRollback nonexistent (mention version?) -> Yes, 5/5
- [x] 28. migrationRecord missing params (list fields?) -> Yes, 4/5 (lists first missing field via Zod)
- [x] 29. migrationRollback add col (clarity of no rollbackSql) -> Yes, 5/5 (explicitly says 'No rollback SQL recorded' for that version)
