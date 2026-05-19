# Admin Tool Group Test Report

## Built-in Tools
1. `server_info` - ✅ Pass
2. `server_health` - ✅ Pass 
3. `list_adapters` - ✅ Pass

## Pragma & Inspection
1. `sqlite_pragma_database_list` - ✅ Pass
2. `sqlite_pragma_compile_options` - ✅ Pass
3. `sqlite_pragma_compile_options({filter: "FTS"})` - ✅ Pass (Returned FTS3 instead of FTS5 as expected)
4. `sqlite_pragma_settings({pragma: "journal_mode"})` - ✅ Pass (`wal`)
5. `sqlite_pragma_table_info({table: "test_products"})` - ✅ Pass
6. `sqlite_index_stats` - ✅ Pass
7. `sqlite_integrity_check` - ✅ Pass (`ok`)
8. `sqlite_analyze` - ✅ Pass
9. `sqlite_dbstat({summarize: true})` - ✅ Pass (JS fallback for WASM)

## View Management
10. `sqlite_create_view` - ✅ Pass
11. `sqlite_list_views` - ✅ Pass
12. `sqlite_drop_view` - ✅ Pass

## Virtual Tables
13. `sqlite_list_virtual_tables` - ✅ Pass
14. `sqlite_virtual_table_info` - ✅ Pass
15. `sqlite_generate_series` - ✅ Pass
16. `sqlite_create_rtree_table` - ✅ Pass (Returned expected structured error for WASM)
17. `sqlite_create_series_table` - ✅ Pass
18. Cleanup - ✅ Pass

## Backup/Restore
19. `sqlite_backup` - ✅ Pass (Returned structured error for WASM)
20. `sqlite_verify_backup` - ✅ Pass (Returned structured error for WASM)
21. `sqlite_restore` - ✅ Pass (Returned structured error for WASM)
22. Cleanup - N/A

## Optimization
23. `sqlite_vacuum` - ✅ Pass
24. `sqlite_optimize` - ✅ Pass
25. `sqlite_pragma_optimize` - ✅ Pass

## CSV
26. `sqlite_analyze_csv_schema` - ✅ Pass (Structured Error)
27. `sqlite_create_csv_table` - ✅ Pass (Structured Error)
28. Cleanup - N/A

## Insights
29. `sqlite_append_insight` - ✅ Pass

## Code Mode Testing
30. `sqlite_execute_code` (integrityCheck) - ✅ Pass (`ok`)
31. `sqlite_execute_code` (pragmaSettings) - ✅ Pass (`wal`)

## Error Path Testing
32. `sqlite_pragma_table_info({table: "nonexistent_table_xyz"})` - ✅ Pass (Structured Error)
33. `sqlite_virtual_table_info({tableName: "nonexistent_table_xyz"})` - ✅ Pass (Structured Error)
34. `sqlite_verify_backup({backupPath: "nonexistent_file.db"})` - ✅ Pass (Structured Error)

## Zod Validation Sweep
35. `sqlite_backup({})` - ✅ Pass
36. `sqlite_restore({})` - ✅ Pass
37. `sqlite_verify_backup({})` - ✅ Pass
38. `sqlite_pragma_table_info({})` - ✅ Pass
39. `sqlite_pragma_settings({})` - ✅ Pass
40. `sqlite_append_insight({})` - ✅ Pass
41. `sqlite_create_view({})` - ✅ Pass
42. `sqlite_drop_view({})` - ✅ Pass
43. `sqlite_virtual_table_info({})` - ✅ Pass (Structured Error)
44. `sqlite_drop_virtual_table({})` - ✅ Pass (Structured Error)
45. `sqlite_create_csv_table({})` - ✅ Pass (Structured Error)
46. `sqlite_analyze_csv_schema({})` - ✅ Pass (Structured Error)
47. `sqlite_create_rtree_table({})` - ✅ Pass (Structured Error)
48. `sqlite_create_series_table({})` - ✅ Pass (Structured Error)
49. `sqlite_generate_series({})` - ✅ Pass (Structured Error)
50. `sqlite_dbstat({})` - ✅ Pass (Success, no required parameters)
