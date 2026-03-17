/**
 * Introspection Tool Output Schemas (9 tools)
 *
 * Graph tools: dependency_graph, topological_sort, cascade_simulator
 * Analysis tools: schema_snapshot, constraint_analysis, migration_risks
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
      .array(
        z.object({ table: z.string(), rowCount: z.number().optional() }),
      )
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
 * sqlite_schema_snapshot output
 */
export const SchemaSnapshotOutputSchema = z
  .object({
    success: z.boolean(),
    snapshot: z
      .object({
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
      })
      .optional(),
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
