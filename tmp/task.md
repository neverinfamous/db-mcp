# DB-MCP Migration Stress Test Tracker

## Category 1: Initialization & Idempotency
- [x] 1. migrationInit
- [x] 2. migrationInit (idempotent)
- [x] 3. migrationStatus (clean state)
- [x] 4. migrationHistory (empty list)

## Category 2: Full Lifecycle
- [x] 5. migrationRecord (add_col)
- [x] 6. migrationStatus (1 recorded)
- [x] 7. Verify column NOT added
- [x] 8. migrationApply (add_col)
- [x] 9. migrationStatus (1 applied)
- [x] 10. migrationApply (create_table)
- [x] 11. migrationHistory (both applied)
- [x] 12. migrationRollback (create_table)
- [x] 13. Verify table is gone
- [x] 14. migrationHistory (after rollback)

## Category 3: State Pollution & Ordering
- [x] 15. migrationApply (recreate)
- [x] 16. migrationStatus (verify counts)
- [x] 17. migrationRecord (duplicate version)
- [x] 18. migrationRecord (dup SQL)
- [x] 19. migrationApply (add index)
- [x] 20. Verify index created

## Category 4: Error Paths & Recovery
- [x] 21. migrationApply (bad sql)
- [x] 22. migrationStatus (verify failed)
- [x] 23. migrationRollback (nonexistent)
- [x] 24. migrationRecord (zod error)
- [x] 25. migrationApply (zod error)
- [x] 26. migrationRollback (zod error)

## Category 5: Error Message Quality
- [x] 27. migrationRollback (nonexistent) rate 1-5: **5/5** (Explicitly mentions `version=nonexistent_migration_xyz`)
- [x] 28. migrationRecord (missing params) rate 1-5: **3/5** (Only mentions `version`, fails to list `description` and `sql` which are also missing)
- [x] 29. migrationRollback (no rollback sql) rate 1-5: **4/5** (Clear, but lacks context of the version ID)

## Final Cleanup
- [x] Drop _mcp_migrations
- [x] Drop stress_migration_data
- [x] Drop stress_idx_flag
- [x] Run reset-database.ps1
- [x] Verify test_products (16 rows, original columns)
