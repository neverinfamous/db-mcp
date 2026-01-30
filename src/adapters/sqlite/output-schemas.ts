/**
 * SQLite Output Schemas (MCP 2025-11-25)
 *
 * Zod schemas defining structured output types for all SQLite tools.
 * These schemas enable clients to validate and extract tool responses.
 */

import { z } from "zod";

// =============================================================================
// Common Building Blocks
// =============================================================================

/**
 * Generic row record for query results - allows any string keys with unknown values
 */
const RowRecordSchema = z.record(z.string(), z.unknown());

// =============================================================================
// Core Tool Output Schemas (8 tools)
// =============================================================================

/**
 * sqlite_read_query output
 */
export const ReadQueryOutputSchema = z.object({
  success: z.boolean(),
  rowCount: z.number(),
  rows: z.array(RowRecordSchema),
  executionTimeMs: z.number().optional(),
});

/**
 * sqlite_write_query output
 */
export const WriteQueryOutputSchema = z.object({
  success: z.boolean(),
  rowsAffected: z.number(),
  executionTimeMs: z.number().optional(),
});

/**
 * sqlite_create_table output
 */
export const CreateTableOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  sql: z.string(),
});

/**
 * Table entry for list_tables
 */
const TableEntrySchema = z.object({
  name: z.string(),
  type: z.string(),
  rowCount: z.number().optional(),
  columnCount: z.number(),
});

/**
 * sqlite_list_tables output
 */
export const ListTablesOutputSchema = z.object({
  success: z.boolean(),
  count: z.number(),
  tables: z.array(TableEntrySchema),
});

/**
 * Column info for describe_table
 */
const ColumnInfoSchema = z.object({
  name: z.string(),
  type: z.string(),
  nullable: z.boolean().optional(),
  primaryKey: z.boolean().optional(),
  defaultValue: z.unknown().optional(),
});

/**
 * sqlite_describe_table output
 */
export const DescribeTableOutputSchema = z.object({
  success: z.boolean(),
  table: z.string(),
  rowCount: z.number().optional(),
  columns: z.array(ColumnInfoSchema),
});

/**
 * sqlite_drop_table output
 */
export const DropTableOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

/**
 * Index entry for get_indexes
 */
const IndexEntrySchema = z.object({
  name: z.string(),
  table: z.string(),
  unique: z.boolean(),
  sql: z.string(),
});

/**
 * sqlite_get_indexes output
 */
export const GetIndexesOutputSchema = z.object({
  success: z.boolean(),
  count: z.number(),
  indexes: z.array(IndexEntrySchema),
});

/**
 * sqlite_create_index output
 */
export const CreateIndexOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  sql: z.string(),
});

// =============================================================================
// JSON Helper Tool Output Schemas (6 tools)
// =============================================================================

/**
 * sqlite_json_insert output
 */
export const JsonInsertOutputSchema = z.object({
  success: z.boolean(),
  rowsAffected: z.number(),
  lastInsertRowid: z.number().optional(),
});

/**
 * sqlite_json_update output
 */
export const JsonUpdateOutputSchema = z.object({
  success: z.boolean(),
  rowsAffected: z.number(),
});

/**
 * sqlite_json_select output
 */
export const JsonSelectOutputSchema = z.object({
  success: z.boolean(),
  rowCount: z.number(),
  rows: z.array(RowRecordSchema),
});

/**
 * sqlite_json_query output
 */
export const JsonQueryOutputSchema = z.object({
  success: z.boolean(),
  rowCount: z.number(),
  rows: z.array(RowRecordSchema),
});

/**
 * sqlite_json_validate_path output
 */
export const JsonValidatePathOutputSchema = z.object({
  valid: z.boolean(),
  normalized: z.string().optional(),
  error: z.string().optional(),
});

/**
 * sqlite_json_merge output
 */
export const JsonMergeOutputSchema = z.object({
  success: z.boolean(),
  rowsAffected: z.number(),
});

/**
 * JSON property schema info
 */
const JsonPropertySchemaSchema = z.object({
  type: z.string(),
  nullable: z.boolean(),
  count: z.number(),
  itemType: z.string().optional(),
});

/**
 * sqlite_analyze_json_schema output
 */
export const AnalyzeJsonSchemaOutputSchema = z.object({
  success: z.boolean(),
  schema: z.object({
    type: z.string(),
    properties: z.record(z.string(), JsonPropertySchemaSchema),
    sampleSize: z.number(),
    nullCount: z.number(),
    errorCount: z.number(),
  }),
});

/**
 * sqlite_create_json_collection output
 */
export const CreateJsonCollectionOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  sql: z.array(z.string()),
  indexCount: z.number(),
});

/**
 * sqlite_jsonb_convert output
 */
export const JsonbConvertOutputSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
  rowsAffected: z.number().optional(),
  error: z.string().optional(),
  hint: z.string().optional(),
});

/**
 * sqlite_json_storage_info output
 */
export const JsonStorageInfoOutputSchema = z.object({
  success: z.boolean(),
  jsonbSupported: z.boolean(),
  sampleSize: z.number(),
  formats: z.object({
    text: z.number(),
    jsonb: z.number(),
    null: z.number(),
    unknown: z.number(),
  }),
  recommendation: z.string(),
});

/**
 * sqlite_json_normalize_column output
 */
export const JsonNormalizeColumnOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  normalized: z.number(),
  unchanged: z.number(),
  errors: z.number(),
  total: z.number(),
});

// =============================================================================
// JSON Operation Tool Output Schemas (12 tools)
// =============================================================================

/**
 * sqlite_json_extract output
 */
export const JsonExtractOutputSchema = z.object({
  success: z.boolean(),
  rowCount: z.number(),
  values: z.array(z.unknown()),
});

/**
 * sqlite_json_set output
 */
export const JsonSetOutputSchema = z.object({
  success: z.boolean(),
  rowsAffected: z.number(),
});

/**
 * sqlite_json_remove output
 */
export const JsonRemoveOutputSchema = z.object({
  success: z.boolean(),
  rowsAffected: z.number(),
});

/**
 * sqlite_json_type output
 */
export const JsonTypeOutputSchema = z.object({
  success: z.boolean(),
  rowCount: z.number(),
  types: z.array(z.string().nullable()),
});

/**
 * sqlite_json_array_length output
 */
export const JsonArrayLengthOutputSchema = z.object({
  success: z.boolean(),
  rowCount: z.number(),
  lengths: z.array(z.number().nullable()),
});

/**
 * sqlite_json_keys output
 */
export const JsonKeysOutputSchema = z.object({
  success: z.boolean(),
  keys: z.array(z.string().nullable()),
});

/**
 * sqlite_json_valid output
 */
export const JsonValidOutputSchema = z.object({
  valid: z.boolean(),
  error: z.string().optional(),
});

/**
 * sqlite_json_group_array output
 */
export const JsonGroupArrayOutputSchema = z.object({
  success: z.boolean(),
  rowCount: z.number(),
  results: z.array(z.record(z.string(), z.unknown())),
});

/**
 * sqlite_json_group_object output
 */
export const JsonGroupObjectOutputSchema = z.object({
  success: z.boolean(),
  rowCount: z.number(),
  results: z.array(z.record(z.string(), z.unknown())),
});

/**
 * sqlite_json_each output
 */
export const JsonEachOutputSchema = z.object({
  success: z.boolean(),
  rowCount: z.number(),
  elements: z.array(
    z.object({
      key: z.union([z.string(), z.number()]),
      value: z.unknown(),
      type: z.string(),
    }),
  ),
});

/**
 * sqlite_json_tree output
 */
export const JsonTreeOutputSchema = z.object({
  success: z.boolean(),
  rowCount: z.number(),
  nodes: z.array(
    z.object({
      key: z.union([z.string(), z.number()]).nullable(),
      value: z.unknown(),
      type: z.string(),
      path: z.string(),
    }),
  ),
});

/**
 * sqlite_json_patch output
 */
export const JsonPatchOutputSchema = z.object({
  success: z.boolean(),
  rowsAffected: z.number(),
});

// =============================================================================
// Text Processing Tool Output Schemas (8 tools)
// =============================================================================

/**
 * sqlite_regex_match output
 */
export const RegexMatchOutputSchema = z.object({
  success: z.boolean(),
  rowCount: z.number(),
  matches: z.array(RowRecordSchema),
});

/**
 * sqlite_regex_replace output
 */
export const RegexReplaceOutputSchema = z.object({
  success: z.boolean(),
  rowsAffected: z.number(),
});

/**
 * Result item with similarity score for fuzzy search
 */
const FuzzyResultSchema = z
  .object({
    similarity_score: z.number().optional(),
  })
  .loose();

/**
 * sqlite_fuzzy_search output
 */
export const FuzzySearchOutputSchema = z.object({
  success: z.boolean(),
  rowCount: z.number(),
  results: z.array(FuzzyResultSchema),
});

/**
 * sqlite_soundex output
 */
export const SoundexOutputSchema = z.object({
  success: z.boolean(),
  rowCount: z.number(),
  results: z.array(RowRecordSchema),
});

/**
 * sqlite_levenshtein output
 */
export const LevenshteinOutputSchema = z.object({
  success: z.boolean(),
  distance: z.number(),
  string1: z.string(),
  string2: z.string(),
});

/**
 * sqlite_trigram_similarity output
 */
export const TrigramSimilarityOutputSchema = z.object({
  success: z.boolean(),
  similarity: z.number(),
  string1: z.string(),
  string2: z.string(),
});

/**
 * sqlite_text_normalize output
 */
export const TextNormalizeOutputSchema = z.object({
  success: z.boolean(),
  original: z.string(),
  normalized: z.string(),
  operations: z.array(z.string()).optional(),
});

/**
 * sqlite_text_split output
 */
export const TextSplitOutputSchema = z.object({
  success: z.boolean(),
  parts: z.array(z.string()),
  count: z.number(),
});

// =============================================================================
// FTS5 Full-Text Search Tool Output Schemas (4 tools)
// =============================================================================

/**
 * sqlite_fts_create output
 */
export const FtsCreateOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  tableName: z.string(),
});

/**
 * Result item with rank/bm25 for FTS search
 */
const FtsResultSchema = z
  .object({
    rank: z.number().optional(),
    bm25: z.number().optional(),
  })
  .loose();

/**
 * sqlite_fts_search output
 */
export const FtsSearchOutputSchema = z.object({
  success: z.boolean(),
  rowCount: z.number(),
  results: z.array(FtsResultSchema),
});

/**
 * sqlite_fts_rebuild output
 */
export const FtsRebuildOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  tableName: z.string(),
});

/**
 * sqlite_fts_optimize output
 */
export const FtsOptimizeOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  tableName: z.string(),
});

// =============================================================================
// Statistical Analysis Tool Output Schemas (8 tools)
// =============================================================================

/**
 * sqlite_stats_describe output
 */
export const StatsDescribeOutputSchema = z.object({
  success: z.boolean(),
  column: z.string(),
  count: z.number(),
  mean: z.number().nullable(),
  min: z.number().nullable(),
  max: z.number().nullable(),
  sum: z.number().nullable(),
  stddev: z.number().nullable(),
  variance: z.number().nullable(),
});

/**
 * sqlite_stats_percentile output
 */
export const StatsPercentileOutputSchema = z.object({
  success: z.boolean(),
  column: z.string(),
  percentile: z.number(),
  value: z.number().nullable(),
});

/**
 * sqlite_stats_histogram output
 */
export const StatsHistogramOutputSchema = z.object({
  success: z.boolean(),
  column: z.string(),
  buckets: z.array(
    z.object({
      min: z.number(),
      max: z.number(),
      count: z.number(),
    }),
  ),
});

/**
 * sqlite_stats_correlation output
 */
export const StatsCorrelationOutputSchema = z.object({
  success: z.boolean(),
  column1: z.string(),
  column2: z.string(),
  correlation: z.number().nullable(),
});

/**
 * sqlite_stats_regression output
 */
export const StatsRegressionOutputSchema = z.object({
  success: z.boolean(),
  xColumn: z.string(),
  yColumn: z.string(),
  slope: z.number().nullable(),
  intercept: z.number().nullable(),
  rSquared: z.number().nullable(),
});

/**
 * sqlite_stats_mode output
 */
export const StatsModeOutputSchema = z.object({
  success: z.boolean(),
  column: z.string(),
  mode: z.unknown(),
  frequency: z.number(),
});

/**
 * sqlite_stats_median output
 */
export const StatsMedianOutputSchema = z.object({
  success: z.boolean(),
  column: z.string(),
  median: z.number().nullable(),
});

/**
 * sqlite_stats_outliers output
 */
export const StatsOutliersOutputSchema = z.object({
  success: z.boolean(),
  column: z.string(),
  method: z.string(),
  outliers: z.array(RowRecordSchema),
  count: z.number(),
});

// =============================================================================
// Virtual Table Tool Output Schemas (4 tools)
// =============================================================================

/**
 * sqlite_generate_series output
 */
export const GenerateSeriesOutputSchema = z.object({
  success: z.boolean(),
  count: z.number(),
  values: z.array(z.number()),
});

/**
 * sqlite_generate_dates output
 */
export const GenerateDatesOutputSchema = z.object({
  success: z.boolean(),
  count: z.number(),
  dates: z.array(z.string()),
});

/**
 * sqlite_cte_recursive output
 */
export const CteRecursiveOutputSchema = z.object({
  success: z.boolean(),
  rowCount: z.number(),
  rows: z.array(RowRecordSchema),
});

/**
 * sqlite_pivot_table output
 */
export const PivotTableOutputSchema = z.object({
  success: z.boolean(),
  rowCount: z.number(),
  columns: z.array(z.string()),
  rows: z.array(RowRecordSchema),
});

// =============================================================================
// Vector/Semantic Search Tool Output Schemas (11 tools)
// =============================================================================

/**
 * sqlite_vector_create output
 */
export const VectorCreateOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  tableName: z.string(),
  dimensions: z.number(),
});

/**
 * sqlite_vector_insert output
 */
export const VectorInsertOutputSchema = z.object({
  success: z.boolean(),
  rowsAffected: z.number(),
});

/**
 * Result item with distance/similarity for vector search
 */
const VectorResultSchema = z
  .object({
    distance: z.number().optional(),
    similarity: z.number().optional(),
  })
  .loose();

/**
 * sqlite_vector_search output
 */
export const VectorSearchOutputSchema = z.object({
  success: z.boolean(),
  rowCount: z.number(),
  results: z.array(VectorResultSchema),
});

/**
 * sqlite_vector_upsert output
 */
export const VectorUpsertOutputSchema = z.object({
  success: z.boolean(),
  inserted: z.number(),
  updated: z.number(),
});

/**
 * sqlite_vector_delete output
 */
export const VectorDeleteOutputSchema = z.object({
  success: z.boolean(),
  rowsAffected: z.number(),
});

/**
 * sqlite_cosine_similarity output
 */
export const CosineSimilarityOutputSchema = z.object({
  success: z.boolean(),
  similarity: z.number(),
});

/**
 * sqlite_euclidean_distance output
 */
export const EuclideanDistanceOutputSchema = z.object({
  success: z.boolean(),
  distance: z.number(),
});

/**
 * sqlite_dot_product output
 */
export const DotProductOutputSchema = z.object({
  success: z.boolean(),
  product: z.number(),
});

/**
 * sqlite_vector_normalize output
 */
export const VectorNormalizeOutputSchema = z.object({
  success: z.boolean(),
  normalized: z.array(z.number()),
});

/**
 * sqlite_vector_magnitude output
 */
export const VectorMagnitudeOutputSchema = z.object({
  success: z.boolean(),
  magnitude: z.number(),
});

/**
 * Result item with hybrid scores
 */
const HybridResultSchema = z
  .object({
    vector_score: z.number().optional(),
    text_score: z.number().optional(),
    combined_score: z.number().optional(),
  })
  .loose();

/**
 * sqlite_hybrid_search output
 */
export const HybridSearchOutputSchema = z.object({
  success: z.boolean(),
  rowCount: z.number(),
  results: z.array(HybridResultSchema),
});

// =============================================================================
// Geospatial Tool Output Schemas (7 tools)
// =============================================================================

/**
 * sqlite_geo_distance output
 */
export const GeoDistanceOutputSchema = z.object({
  success: z.boolean(),
  distance: z.number(),
  unit: z.string(),
});

/**
 * sqlite_geo_bounding_box output
 */
export const GeoBoundingBoxOutputSchema = z.object({
  success: z.boolean(),
  rowCount: z.number(),
  results: z.array(RowRecordSchema),
});

/**
 * Result item with distance for geo queries
 */
const GeoDistanceResultSchema = z
  .object({
    distance: z.number().optional(),
  })
  .loose();

/**
 * sqlite_geo_within_radius output
 */
export const GeoWithinRadiusOutputSchema = z.object({
  success: z.boolean(),
  rowCount: z.number(),
  results: z.array(GeoDistanceResultSchema),
});

/**
 * sqlite_geo_cluster output
 */
export const GeoClusterOutputSchema = z.object({
  success: z.boolean(),
  clusters: z.array(
    z.object({
      clusterId: z.number(),
      center: z.object({
        latitude: z.number(),
        longitude: z.number(),
      }),
      pointCount: z.number(),
      points: z.array(RowRecordSchema).optional(),
    }),
  ),
});

/**
 * Result item with required distance for nearest
 */
const GeoNearestResultSchema = z
  .object({
    distance: z.number(),
  })
  .loose();

/**
 * sqlite_geo_nearest output
 */
export const GeoNearestOutputSchema = z.object({
  success: z.boolean(),
  rowCount: z.number(),
  results: z.array(GeoNearestResultSchema),
});

/**
 * sqlite_geo_polygon_contains output
 */
export const GeoPolygonContainsOutputSchema = z.object({
  success: z.boolean(),
  contains: z.boolean(),
});

/**
 * sqlite_geo_encode output
 */
export const GeoEncodeOutputSchema = z.object({
  success: z.boolean(),
  geohash: z.string(),
  precision: z.number(),
});

// =============================================================================
// Admin Tool Output Schemas (4 tools)
// =============================================================================

/**
 * sqlite_vacuum output
 */
export const VacuumOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  sizeChange: z
    .object({
      before: z.number(),
      after: z.number(),
      saved: z.number(),
    })
    .optional(),
});

/**
 * sqlite_backup output
 */
export const BackupOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  path: z.string(),
  sizeBytes: z.number().optional(),
});

/**
 * sqlite_analyze output
 */
export const AnalyzeOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  tablesAnalyzed: z.number().optional(),
});

/**
 * sqlite_optimize output
 */
export const OptimizeOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  operations: z.array(z.string()).optional(),
});

/**
 * sqlite_integrity_check output
 */
export const IntegrityCheckOutputSchema = z.object({
  success: z.boolean(),
  integrity: z.enum(["ok", "errors_found"]),
  errorCount: z.number(),
  messages: z.array(z.string()).optional(),
});

/**
 * sqlite_restore output
 */
export const RestoreOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  sourcePath: z.string(),
  durationMs: z.number(),
});

/**
 * sqlite_verify_backup output
 */
export const VerifyBackupOutputSchema = z.object({
  success: z.boolean(),
  valid: z.boolean(),
  pageCount: z.number().optional(),
  pageSize: z.number().optional(),
  integrity: z.enum(["ok", "errors_found"]),
  messages: z.array(z.string()).optional(),
});

/**
 * Index column info
 */
const IndexColumnSchema = z.object({
  name: z.string(),
  seqno: z.number(),
});

/**
 * Index stats entry
 */
const IndexStatsEntrySchema = z.object({
  name: z.string(),
  table: z.string(),
  unique: z.boolean(),
  partial: z.boolean(),
  columns: z.array(IndexColumnSchema),
});

/**
 * sqlite_index_stats output
 */
export const IndexStatsOutputSchema = z.object({
  success: z.boolean(),
  indexes: z.array(IndexStatsEntrySchema),
});

/**
 * sqlite_pragma_compile_options output
 */
export const PragmaCompileOptionsOutputSchema = z.object({
  success: z.boolean(),
  options: z.array(z.string()),
});

/**
 * Database entry for database_list
 */
const DatabaseListEntrySchema = z.object({
  seq: z.number(),
  name: z.string(),
  file: z.string(),
});

/**
 * sqlite_pragma_database_list output
 */
export const PragmaDatabaseListOutputSchema = z.object({
  success: z.boolean(),
  databases: z.array(DatabaseListEntrySchema),
});

/**
 * sqlite_pragma_optimize output
 */
export const PragmaOptimizeOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  durationMs: z.number(),
});

/**
 * sqlite_pragma_settings output
 */
export const PragmaSettingsOutputSchema = z.object({
  success: z.boolean(),
  pragma: z.string(),
  value: z.unknown(),
  oldValue: z.unknown().optional(),
  newValue: z.unknown().optional(),
});

/**
 * Column info for pragma_table_info
 */
const PragmaTableInfoColumnSchema = z.object({
  cid: z.number(),
  name: z.string(),
  type: z.string(),
  notNull: z.boolean(),
  defaultValue: z.unknown().nullable(),
  pk: z.number(),
});

/**
 * sqlite_pragma_table_info output
 */
export const PragmaTableInfoOutputSchema = z.object({
  success: z.boolean(),
  table: z.string(),
  columns: z.array(PragmaTableInfoColumnSchema),
});

// =============================================================================
// Transaction Tool Output Schemas (7 tools - Native only)
// =============================================================================

/**
 * sqlite_transaction_begin output
 */
export const TransactionBeginOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  mode: z.string().optional(),
});

/**
 * sqlite_transaction_commit output
 */
export const TransactionCommitOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

/**
 * sqlite_transaction_rollback output
 */
export const TransactionRollbackOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

/**
 * sqlite_transaction_savepoint output
 */
export const TransactionSavepointOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  name: z.string(),
});

/**
 * sqlite_transaction_release output
 */
export const TransactionReleaseOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  name: z.string(),
});

/**
 * sqlite_transaction_rollback_to output
 */
export const TransactionRollbackToOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  name: z.string(),
});

/**
 * sqlite_transaction_execute output
 */
export const TransactionExecuteOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  statementsExecuted: z.number(),
  results: z.array(z.unknown()).optional(),
});

// =============================================================================
// Window Function Tool Output Schemas (6 tools - Native only)
// =============================================================================

/**
 * Result item with row_number
 */
const RowNumberResultSchema = z
  .object({
    row_number: z.number(),
  })
  .loose();

/**
 * sqlite_window_row_number output
 */
export const WindowRowNumberOutputSchema = z.object({
  success: z.boolean(),
  rowCount: z.number(),
  rows: z.array(RowNumberResultSchema),
});

/**
 * Result item with rank values
 */
const RankResultSchema = z
  .object({
    rank: z.number().optional(),
    dense_rank: z.number().optional(),
    percent_rank: z.number().optional(),
  })
  .loose();

/**
 * sqlite_window_rank output
 */
export const WindowRankOutputSchema = z.object({
  success: z.boolean(),
  rowCount: z.number(),
  rows: z.array(RankResultSchema),
});

/**
 * Result item with lag/lead values
 */
const LagLeadResultSchema = z
  .object({
    lag_value: z.unknown().optional(),
    lead_value: z.unknown().optional(),
  })
  .loose();

/**
 * sqlite_window_lag_lead output
 */
export const WindowLagLeadOutputSchema = z.object({
  success: z.boolean(),
  rowCount: z.number(),
  rows: z.array(LagLeadResultSchema),
});

/**
 * Result item with running_total
 */
const RunningTotalResultSchema = z
  .object({
    running_total: z.number(),
  })
  .loose();

/**
 * sqlite_window_running_total output
 */
export const WindowRunningTotalOutputSchema = z.object({
  success: z.boolean(),
  rowCount: z.number(),
  rows: z.array(RunningTotalResultSchema),
});

/**
 * Result item with moving_avg
 */
const MovingAvgResultSchema = z
  .object({
    moving_avg: z.number(),
  })
  .loose();

/**
 * sqlite_window_moving_avg output
 */
export const WindowMovingAvgOutputSchema = z.object({
  success: z.boolean(),
  rowCount: z.number(),
  rows: z.array(MovingAvgResultSchema),
});

/**
 * Result item with ntile bucket
 */
const NtileResultSchema = z
  .object({
    ntile: z.number(),
  })
  .loose();

/**
 * sqlite_window_ntile output
 */
export const WindowNtileOutputSchema = z.object({
  success: z.boolean(),
  rowCount: z.number(),
  rows: z.array(NtileResultSchema),
});

// =============================================================================
// Built-in Server Tool Output Schemas (3 tools)
// =============================================================================

/**
 * server_info output
 */
export const ServerInfoOutputSchema = z.object({
  name: z.string(),
  version: z.string(),
  transport: z.string(),
  adapters: z.array(
    z.object({
      id: z.string(),
      type: z.string(),
      name: z.string(),
    }),
  ),
  toolCount: z.number(),
  toolFilter: z.string().optional(),
});

/**
 * server_health output
 */
export const ServerHealthOutputSchema = z.object({
  status: z.enum(["healthy", "degraded", "unhealthy"]),
  adapters: z.array(
    z.object({
      id: z.string(),
      connected: z.boolean(),
      latencyMs: z.number().optional(),
      error: z.string().optional(),
    }),
  ),
  uptime: z.number().optional(),
});

/**
 * list_adapters output
 */
export const ListAdaptersOutputSchema = z.object({
  count: z.number(),
  adapters: z.array(
    z.object({
      id: z.string(),
      type: z.string(),
      name: z.string(),
      database: z.string().optional(),
      connected: z.boolean(),
    }),
  ),
});

// =============================================================================
// Export Type Aliases
// =============================================================================

export type ReadQueryOutput = z.infer<typeof ReadQueryOutputSchema>;
export type WriteQueryOutput = z.infer<typeof WriteQueryOutputSchema>;
export type CreateTableOutput = z.infer<typeof CreateTableOutputSchema>;
export type ListTablesOutput = z.infer<typeof ListTablesOutputSchema>;
export type DescribeTableOutput = z.infer<typeof DescribeTableOutputSchema>;
export type DropTableOutput = z.infer<typeof DropTableOutputSchema>;
export type GetIndexesOutput = z.infer<typeof GetIndexesOutputSchema>;
export type CreateIndexOutput = z.infer<typeof CreateIndexOutputSchema>;
