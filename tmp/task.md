# Advanced Stress Test — db-mcp — [migration]

## Category 1: Initialization & Idempotency
- [x] 1. `migrationInit` -> success
- [x] 2. `migrationInit` -> idempotent success
- [x] 3. `migrationStatus` -> empty/clean state
- [x] 4. `migrationHistory` -> empty list

## Category 2: Full Lifecycle
- [x] 5. `migrationRecord` (add col)
- [x] 6. `migrationStatus` -> 1 recorded
- [x] 7. Verify column NOT added
- [x] 8. `migrationApply` (add col)
- [x] 9. `migrationStatus` -> 1 applied
- [x] 10. `migrationApply` (create table)
- [x] 11. `migrationHistory` -> both migrations
- [x] 12. `migrationRollback` (create table)
- [x] 13. Verify table gone
- [x] 14. `migrationHistory` -> check status

## Category 3: State Pollution & Ordering
- [x] 15. `migrationApply` (recreate)
- [x] 16. `migrationStatus` -> verify counts
- [x] 17. `migrationRecord` (duplicate version)
- [x] 18. `migrationRecord` (dup SQL)
- [x] 19. `migrationApply` (multi-statement index)
- [x] 20. Verify index created

## Category 4: Error Paths & Recovery
- [x] 21. `migrationApply` (bad SQL)
- [x] 22. `migrationStatus` -> verify failed state
- [x] 23. `migrationRollback` (nonexistent)
- [x] 24. `migrationRecord` (zod error)
- [x] 25. `migrationApply` (zod error)
- [x] 26. `migrationRollback` (zod error)

## Category 5: Error Message Quality
- [x] 27. Rollback nonexistent -> mentions version?
- [x] 28. Record empty -> lists missing fields?
- [x] 29. Rollback without rollbackSql -> rate clarity

## Final Cleanup
- [x] Drop _mcp_migrations
- [x] Drop stress_migration_data
- [x] Reset DB
- [x] Fix all issues
