/**
 * Introspection Tool Output Schemas (10 tools)
 *
 * Graph tools: dependency_graph, topological_sort, cascade_simulator
 * Analysis tools: schema_snapshot, schema_diff, constraint_analysis, migration_risks
 * Diagnostics tools: storage_analysis, index_audit, query_plan
 */

import { z } from "zod";
import { ErrorFieldsMixin } from "./error-mixin.js";

// =============================================================================
// Graph Tool Schemas
// =============================================================================

/**
 * sqlite_dependency_graph output
 */
export const DependencyGraphOutputSchema = z
  .object({
    success: z.boolean(),
    nodes: z
      .array(z.object({ table: z.string(), rowCount: z.number().optional() }))
      .optional(),
    edges: z
      .array(
        z.object({
          from: z.string(),
          to: z.string(),
          fromColumn: z.string(),
          toColumn: z.string(),
          onDelete: z.string(),
          onUpdate: z.string(),
        }),
      )
      .optional(),
    circularDependencies: z.array(z.array(z.string())).optional(),
    stats: z
      .object({
        totalTables: z.number(),
        totalRelationships: z.number(),
        rootTables: z.array(z.string()),
        leafTables: z.array(z.string()),
      })
      .optional(),
  })
  .extend(ErrorFieldsMixin.shape);

/**
 * sqlite_topological_sort output
 */
export const TopologicalSortOutputSchema = z
  .object({
    success: z.boolean(),
    order: z
      .array(
        z.object({
          table: z.string(),
          level: z.number(),
          dependencies: z.array(z.string()),
        }),
      )
      .optional(),
    direction: z.string().optional(),
    hasCycles: z.boolean().optional(),
    cycles: z.array(z.array(z.string())).optional(),
    hint: z.string().optional(),
  })
  .extend(ErrorFieldsMixin.shape);

/**
 * sqlite_cascade_simulator output
 */
export const CascadeSimulatorOutputSchema = z
  .object({
    success: z.boolean(),
    sourceTable: z.string().optional(),
    operation: z.string().optional(),
    affectedTables: z
      .array(
        z.object({
          table: z.string(),
          action: z.string(),
          estimatedRows: z.number().optional(),
          path: z.array(z.string()).optional(),
          depth: z.number(),
        }),
      )
      .optional(),
    severity: z.enum(["low", "medium", "high", "critical"]).optional(),
    stats: z
      .object({
        totalTablesAffected: z.number(),
        cascadeActions: z.number(),
        blockingActions: z.number(),
        setNullActions: z.number(),
        maxDepth: z.number(),
      })
      .optional(),
  })
  .extend(ErrorFieldsMixin.shape);

// =============================================================================
// Analysis Tool Schemas
// =============================================================================

/**
 * Reusable snapshot shape — shared between sqlite_schema_snapshot output
 * and sqlite_schema_diff input so both reference the same definition.
 */
export const SchemaSnapshotShape = z.object({
  tables: z
    .array(
      z.object({
        name: z.string(),
        columnCount: z.number(),
        rowCount: z.number().optional(),
        columns: z
          .array(
            z.object({
              name: z.string(),
              type: z.string(),
              nullable: z.boolean(),
              primaryKey: z.boolean(),
              defaultValue: z.unknown().optional(),
            }),
          )
          .optional(),
      }),
    )
    .optional(),
  views: z
    .array(z.object({ name: z.string(), sql: z.string() }))
    .optional(),
  indexes: z
    .array(
      z.object({
        name: z.string(),
        table: z.string(),
        unique: z.boolean(),
        sql: z.string(),
      }),
    )
    .optional(),
  triggers: z
    .array(
      z.object({
        name: z.string(),
        table: z.string(),
        sql: z.string(),
      }),
    )
    .optional(),
});

/**
 * sqlite_schema_snapshot output
 */
export const SchemaSnapshotOutputSchema = z
  .object({
    success: z.boolean(),
    snapshot: SchemaSnapshotShape.optional(),
    stats: z
      .object({
        tables: z.number(),
        views: z.number(),
        indexes: z.number(),
        triggers: z.number(),
      })
      .optional(),
    generatedAt: z.string().optional(),
  })
  .extend(ErrorFieldsMixin.shape);

/**
 * sqlite_constraint_analysis output
 */
export const ConstraintAnalysisOutputSchema = z
  .object({
    success: z.boolean(),
    findings: z
      .array(
        z.object({
          type: z.string(),
          severity: z.enum(["info", "warning", "error"]),
          table: z.string(),
          description: z.string(),
          suggestion: z.string().optional(),
        }),
      )
      .optional(),
    summary: z
      .object({
        totalFindings: z.number(),
        byType: z.record(z.string(), z.number()),
        bySeverity: z.record(z.string(), z.number()),
      })
      .optional(),
  })
  .extend(ErrorFieldsMixin.shape);

/**
 * sqlite_migration_risks output
 */
export const MigrationRisksOutputSchema = z
  .object({
    success: z.boolean(),
    risks: z
      .array(
        z.object({
          statement: z.string(),
          statementIndex: z.number(),
          riskLevel: z.enum(["low", "medium", "high", "critical"]),
          category: z.string(),
          description: z.string(),
          mitigation: z.string().optional(),
        }),
      )
      .optional(),
    summary: z
      .object({
        totalStatements: z.number(),
        totalRisks: z.number(),
        highestRisk: z.string(),
      })
      .optional(),
  })
  .extend(ErrorFieldsMixin.shape);

// =============================================================================
// Diagnostics Tool Schemas
// =============================================================================

/**
 * sqlite_storage_analysis output
 */
export const StorageAnalysisOutputSchema = z
  .object({
    success: z.boolean(),
    database: z
      .object({
        totalSizeBytes: z.number(),
        pageSize: z.number(),
        totalPages: z.number(),
        freePages: z.number(),
        fragmentationPct: z.number(),
        journalMode: z.string(),
        autoVacuum: z.string(),
      })
      .optional(),
    tables: z
      .array(
        z.object({
          name: z.string(),
          sizeBytes: z.number(),
          pctOfTotal: z.number(),
          pageCount: z.number(),
          rowCount: z.number(),
          avgRowBytes: z.number(),
        }),
      )
      .optional(),
    recommendations: z
      .array(
        z.object({
          type: z.string(),
          severity: z.enum(["info", "warning", "error"]),
          message: z.string(),
        }),
      )
      .optional(),
  })
  .extend(ErrorFieldsMixin.shape);

/**
 * sqlite_index_audit output
 */
export const IndexAuditOutputSchema = z
  .object({
    success: z.boolean(),
    totalIndexes: z.number().optional(),
    findings: z
      .array(
        z.object({
          type: z.enum([
            "redundant",
            "missing_fk_index",
            "unindexed_large_table",
          ]),
          severity: z.enum(["info", "warning", "error"]),
          table: z.string(),
          index: z.string().optional(),
          redundantOf: z.string().optional(),
          column: z.string().optional(),
          suggestion: z.string(),
        }),
      )
      .optional(),
    summary: z
      .object({
        redundant: z.number(),
        missingFk: z.number(),
        unindexedLarge: z.number(),
        total: z.number(),
      })
      .optional(),
  })
  .extend(ErrorFieldsMixin.shape);

/**
 * sqlite_query_plan output
 */
export const QueryPlanOutputSchema = z
  .object({
    success: z.boolean(),
    sql: z.string().optional(),
    plan: z
      .array(
        z.object({
          id: z.number(),
          parent: z.number(),
          detail: z.string(),
          scanType: z
            .enum([
              "full_scan",
              "index_scan",
              "covering_index",
              "search",
              "subquery",
              "compound",
              "other",
            ])
            .optional(),
          table: z.string().optional(),
        }),
      )
      .optional(),
    analysis: z
      .object({
        fullScans: z.array(z.string()),
        indexScans: z.array(z.string()),
        coveringIndexes: z.array(z.string()),
        estimatedEfficiency: z.enum(["good", "moderate", "poor"]),
      })
      .optional(),
    suggestions: z.array(z.string()).optional(),
  })
  .extend(ErrorFieldsMixin.shape);

// =============================================================================
// Input Schemas
// =============================================================================

const VALID_SECTIONS = ["tables", "views", "indexes", "triggers"] as const;

/** Filter array to only valid section values; pass non-arrays through for Zod to reject */
const coerceSections = (val: unknown): unknown =>
  Array.isArray(val)
    ? val.filter(
        (v) =>
          typeof v === "string" &&
          (VALID_SECTIONS as readonly string[]).includes(v),
      )
    : val;

const VALID_CHECKS = [
  "missing_pk",
  "missing_not_null",
  "unindexed_fk",
  "missing_fk",
] as const;

/** Filter array to only valid check values; pass non-arrays through for Zod to reject */
const coerceChecks = (val: unknown): unknown =>
  Array.isArray(val)
    ? val.filter(
        (v) =>
          typeof v === "string" &&
          (VALID_CHECKS as readonly string[]).includes(v),
      )
    : val;

const VALID_DIRECTIONS = ["create", "drop"] as const;
const coerceDirection = (val: unknown): unknown =>
  typeof val === "string" &&
  (VALID_DIRECTIONS as readonly string[]).includes(val)
    ? val
    : typeof val === "string"
      ? undefined
      : val;

const VALID_OPERATIONS = ["DELETE", "DROP", "TRUNCATE"] as const;
const coerceOperation = (val: unknown): unknown =>
  typeof val === "string" &&
  (VALID_OPERATIONS as readonly string[]).includes(val)
    ? val
    : typeof val === "string"
      ? undefined
      : val;

export const StorageAnalysisSchema = z
  .object({
    includeTableDetails: z
      .boolean()
      .optional()
      .describe("Include per-table size breakdown (default: true)"),
    excludeSystemTables: z
      .boolean()
      .optional()
      .describe(
        "Exclude SpatiaLite system tables from per-table breakdown (default: true)",
      ),
    limit: z
      .number()
      .optional()
      .describe("Maximum number of tables to include (default: 50)"),
  })
  .default({});
export type StorageAnalysisInput = z.infer<typeof StorageAnalysisSchema>;

export const QueryPlanSchema = z.object({
  sql: z.string().describe("SQL query to analyze (SELECT only)"),
});
export type QueryPlanInput = z.infer<typeof QueryPlanSchema>;

export const IndexAuditSchema = z
  .object({
    table: z
      .string()
      .optional()
      .describe("Optional table name to audit (default: all tables)"),
    excludeSystemTables: z
      .boolean()
      .optional()
      .describe(
        "Exclude SpatiaLite system tables from audit findings (default: true)",
      ),
    minSeverity: z
      .enum(["info", "warning", "error"])
      .optional()
      .describe(
        "Minimum severity to include in findings (default: all). Reduces payload for large databases.",
      ),
  })
  .default({});
export type IndexAuditInput = z.infer<typeof IndexAuditSchema>;

export const SchemaSnapshotSchema = z
  .object({
    sections: z
      .preprocess(
        coerceSections,
        z.array(z.enum(["tables", "views", "indexes", "triggers"])).optional(),
      )
      .describe("Specific sections to include (default: all)"),
    compact: z
      .boolean()
      .optional()
      .describe(
        "Omit column details from tables section for reduced payload (default: false)",
      ),
    excludeSystemTables: z
      .boolean()
      .optional()
      .describe(
        "Exclude SpatiaLite system tables, views, indexes, and triggers (default: true)",
      ),
  })
  .default({});
export type SchemaSnapshotInput = z.infer<typeof SchemaSnapshotSchema>;

export const MigrationRisksSchema = z.object({
  statements: z
    .array(z.string())
    .describe("Array of DDL statements to analyze for risks"),
});
export type MigrationRisksInput = z.infer<typeof MigrationRisksSchema>;

export const ConstraintAnalysisSchema = z
  .object({
    table: z
      .string()
      .optional()
      .describe("Analyze constraints for a specific table only"),
    checks: z
      .preprocess(
        coerceChecks,
        z
          .array(
            z.enum([
              "missing_pk",
              "missing_not_null",
              "unindexed_fk",
              "missing_fk",
            ]),
          )
          .optional(),
      )
      .describe("Specific checks to run (default: all)"),
    excludeSystemTables: z
      .boolean()
      .optional()
      .describe(
        "Exclude SpatiaLite system tables from constraint analysis (default: true)",
      ),
  })
  .default({});
export type ConstraintAnalysisInput = z.infer<typeof ConstraintAnalysisSchema>;

export const DependencyGraphSchema = z
  .object({
    includeRowCounts: z
      .boolean()
      .optional()
      .describe("Include row counts per table (default: true)"),
    nodesOnly: z
      .boolean()
      .optional()
      .describe(
        "Return only nodes without edges for a lightweight response (default: false)",
      ),
    excludeSystemTables: z
      .boolean()
      .optional()
      .describe(
        "Exclude SpatiaLite system tables from results (default: true)",
      ),
  })
  .default({});
export type DependencyGraphInput = z.infer<typeof DependencyGraphSchema>;

export const TopologicalSortSchema = z
  .object({
    direction: z
      .preprocess(coerceDirection, z.enum(["create", "drop"]).optional())
      .describe(
        "Sort direction: 'create' = dependencies first, 'drop' = dependents first (default: create)",
      ),
    excludeSystemTables: z
      .boolean()
      .optional()
      .describe(
        "Exclude SpatiaLite system tables from results (default: true)",
      ),
  })
  .default({});
export type TopologicalSortInput = z.infer<typeof TopologicalSortSchema>;

export const CascadeSimulatorSchema = z.object({
  table: z.string().describe("Table name to simulate deletion from"),
  operation: z
    .preprocess(
      coerceOperation,
      z.enum(["DELETE", "DROP", "TRUNCATE"]).optional(),
    )
    .describe("Operation to simulate (default: DELETE)"),
  compact: z
    .boolean()
    .optional()
    .describe(
      "Omit path arrays from affected entries to reduce payload (default: false)",
    ),
});
export type CascadeSimulatorInput = z.infer<typeof CascadeSimulatorSchema>;

// =============================================================================
// Schema Diff Schemas
// =============================================================================

/** Change descriptor for a single column-level diff */
const ColumnChangeSchema = z.object({
  type: z.enum([
    "column_added",
    "column_removed",
    "column_type_changed",
    "column_nullable_changed",
    "column_pk_changed",
    "column_default_changed",
  ]),
  column: z.string().optional(),
  baseline: z.string().optional(),
  target: z.string().optional(),
});

/** Change descriptor for a SQL-body diff (views, indexes, triggers) */
const SqlBodyChangeSchema = z.object({
  name: z.string(),
  table: z.string().optional(),
  baselineSql: z.string(),
  targetSql: z.string(),
});

/** Named item with table association (indexes, triggers) */
const NamedWithTableSchema = z.object({
  name: z.string(),
  table: z.string(),
});

/**
 * sqlite_schema_diff output
 */
export const SchemaDiffOutputSchema = z
  .object({
    success: z.boolean(),
    sections: z
      .object({
        tables: z
          .object({
            added: z.array(z.object({ name: z.string() })),
            removed: z.array(z.object({ name: z.string() })),
            modified: z.array(
              z.object({
                name: z.string(),
                changes: z.array(ColumnChangeSchema),
              }),
            ),
          })
          .optional(),
        views: z
          .object({
            added: z.array(z.object({ name: z.string() })),
            removed: z.array(z.object({ name: z.string() })),
            modified: z.array(SqlBodyChangeSchema),
          })
          .optional(),
        indexes: z
          .object({
            added: z.array(NamedWithTableSchema),
            removed: z.array(NamedWithTableSchema),
            modified: z.array(SqlBodyChangeSchema),
          })
          .optional(),
        triggers: z
          .object({
            added: z.array(NamedWithTableSchema),
            removed: z.array(NamedWithTableSchema),
            modified: z.array(SqlBodyChangeSchema),
          })
          .optional(),
      })
      .optional(),
    summary: z
      .object({
        totalChanges: z.number(),
        added: z.number(),
        removed: z.number(),
        modified: z.number(),
        severity: z.enum(["none", "low", "medium", "high"]),
      })
      .optional(),
    comparedAt: z.string().optional(),
  })
  .extend(ErrorFieldsMixin.shape);

/**
 * sqlite_schema_diff input
 *
 * Both baseline and target accept either "current" (capture live DB schema)
 * or an inline snapshot object from a previous sqlite_schema_snapshot call.
 */
const VALID_DIFF_SECTIONS = ["tables", "views", "indexes", "triggers"] as const;

const coerceDiffSections = (val: unknown): unknown =>
  Array.isArray(val)
    ? val.filter(
        (v) =>
          typeof v === "string" &&
          (VALID_DIFF_SECTIONS as readonly string[]).includes(v),
      )
    : val;

export const SchemaDiffSchema = z
  .object({
    baseline: z
      .union([z.literal("current"), SchemaSnapshotShape])
      .describe(
        "Baseline schema — 'current' to snapshot live DB, or an inline snapshot object from a previous sqlite_schema_snapshot call",
      ),
    target: z
      .union([z.literal("current"), SchemaSnapshotShape])
      .describe(
        "Target schema to compare against baseline — 'current' to snapshot live DB, or an inline snapshot object",
      ),
    sections: z
      .preprocess(
        coerceDiffSections,
        z
          .array(z.enum(["tables", "views", "indexes", "triggers"]))
          .optional(),
      )
      .describe("Sections to compare (default: all)"),
    excludeSystemTables: z
      .boolean()
      .optional()
      .describe(
        "Exclude SpatiaLite system tables when capturing live schema (default: true)",
      ),
  });
export type SchemaDiffInput = z.infer<typeof SchemaDiffSchema>;
