/**
 * Schema Diff Tool
 *
 * Compare two schema snapshots and report structured drift.
 * Accepts "current" (live DB) or inline snapshot objects
 * from a previous sqlite_schema_snapshot call.
 */

import type { z } from "zod";
import type { SqliteAdapter } from "../../../sqlite-adapter.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../../types/index.js";
import { readOnly } from "../../../../../utils/annotations.js";
import { formatHandlerError } from "../../../../../utils/errors/index.js";
import type { SchemaSnapshotShape } from "../../../schemas/introspection.js";
import {
  SchemaDiffSchema,
  SchemaDiffOutputSchema,
} from "../../../schemas/introspection.js";
import { captureSchemaSnapshot } from "./snapshot.js";

// =============================================================================
// Types
// =============================================================================

type SnapshotData = z.infer<typeof SchemaSnapshotShape>;
type DiffSection = "tables" | "views" | "indexes" | "triggers";
type Severity = "none" | "low" | "medium" | "high";

interface ColumnChange {
  type:
    | "column_added"
    | "column_removed"
    | "column_type_changed"
    | "column_nullable_changed"
    | "column_pk_changed"
    | "column_default_changed";
  column?: string;
  baseline?: string;
  target?: string;
}

interface TableColumn {
  name: string;
  type: string;
  nullable: boolean;
  primaryKey: boolean;
  defaultValue?: unknown;
}

interface NamedItem {
  name: string;
}

interface NamedWithTable {
  name: string;
  table: string;
}

interface SqlItem extends NamedItem {
  sql: string;
  table?: string;
}

// =============================================================================
// Diff Helpers
// =============================================================================

/**
 * Diff two sets of named items — returns added, removed, and common names.
 */
function diffNameSets<T extends NamedItem>(
  baseline: T[],
  target: T[],
): { added: T[]; removed: T[]; common: [T, T][] } {
  const baseMap = new Map(baseline.map((b) => [b.name, b]));
  const targetMap = new Map(target.map((t) => [t.name, t]));

  const added = target.filter((t) => !baseMap.has(t.name));
  const removed = baseline.filter((b) => !targetMap.has(b.name));
  const common: [T, T][] = [];
  for (const [name, baseItem] of baseMap) {
    const targetItem = targetMap.get(name);
    if (targetItem) {
      common.push([baseItem, targetItem]);
    }
  }

  return { added, removed, common };
}

/**
 * Compare columns between two table snapshots.
 */
function diffTableColumns(
  baselineColumns: TableColumn[],
  targetColumns: TableColumn[],
): ColumnChange[] {
  const changes: ColumnChange[] = [];
  const baseMap = new Map(baselineColumns.map((c) => [c.name, c]));
  const targetMap = new Map(targetColumns.map((c) => [c.name, c]));

  // Added columns
  for (const [name] of targetMap) {
    if (!baseMap.has(name)) {
      changes.push({ type: "column_added", column: name });
    }
  }

  // Removed columns
  for (const [name] of baseMap) {
    if (!targetMap.has(name)) {
      changes.push({ type: "column_removed", column: name });
    }
  }

  // Modified columns
  for (const [name, baseCol] of baseMap) {
    const targetCol = targetMap.get(name);
    if (!targetCol) continue;

    if (baseCol.type !== targetCol.type) {
      changes.push({
        type: "column_type_changed",
        column: name,
        baseline: baseCol.type,
        target: targetCol.type,
      });
    }
    if (baseCol.nullable !== targetCol.nullable) {
      changes.push({
        type: "column_nullable_changed",
        column: name,
        baseline: String(baseCol.nullable),
        target: String(targetCol.nullable),
      });
    }
    if (baseCol.primaryKey !== targetCol.primaryKey) {
      changes.push({
        type: "column_pk_changed",
        column: name,
        baseline: String(baseCol.primaryKey),
        target: String(targetCol.primaryKey),
      });
    }
    const baseDef = JSON.stringify(baseCol.defaultValue ?? null);
    const targetDef = JSON.stringify(targetCol.defaultValue ?? null);
    if (baseDef !== targetDef) {
      changes.push({
        type: "column_default_changed",
        column: name,
        baseline: baseDef,
        target: targetDef,
      });
    }
  }

  return changes;
}

/**
 * Compute overall severity from change counts.
 *
 * - none:   0 changes
 * - low:    only additions (backward compatible)
 * - medium: modifications (column type changes, SQL changes)
 * - high:   removals (breaking changes)
 */
function computeSeverity(
  addedCount: number,
  removedCount: number,
  modifiedCount: number,
): Severity {
  if (addedCount + removedCount + modifiedCount === 0) return "none";
  if (removedCount > 0) return "high";
  if (modifiedCount > 0) return "medium";
  return "low";
}

// =============================================================================
// Tool Creator
// =============================================================================

export function createSchemaDiffTool(
  adapter: SqliteAdapter,
): ToolDefinition {
  return {
    name: "sqlite_schema_diff",
    description:
      "Compare two schema snapshots and report structured drift — added, removed, and modified tables, views, indexes, and triggers. Accepts 'current' to capture the live database, or an inline snapshot object from a previous sqlite_schema_snapshot call.",
    group: "introspection",
    inputSchema: SchemaDiffSchema,
    outputSchema: SchemaDiffOutputSchema,
    requiredScopes: ["read"],
    annotations: readOnly("Schema Diff"),
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const input = SchemaDiffSchema.parse(params);
        const sections: DiffSection[] = input.sections ?? [
          "tables",
          "views",
          "indexes",
          "triggers",
        ];
        const captureOpts = {
          sections,
          compact: false as const,
          excludeSystemTables: input.excludeSystemTables,
        };

        // Resolve baseline and target snapshots
        const baselineData: SnapshotData =
          input.baseline === "current"
            ? (await captureSchemaSnapshot(adapter, captureOpts)).snapshot
            : input.baseline;

        const targetData: SnapshotData =
          input.target === "current"
            ? (await captureSchemaSnapshot(adapter, captureOpts)).snapshot
            : input.target;

        // Build diff for each requested section
        const result: Record<string, unknown> = {};
        let totalAdded = 0;
        let totalRemoved = 0;
        let totalModified = 0;

        // --- Tables ---
        if (sections.includes("tables")) {
          interface TableEntry { name: string; columns?: TableColumn[] }
          const baseTables = (baselineData.tables ?? []) as TableEntry[];
          const targetTables = (targetData.tables ?? []) as TableEntry[];
          const { added, removed, common } = diffNameSets(
            baseTables,
            targetTables,
          );

          const modified: { name: string; changes: ColumnChange[] }[] = [];
          for (const [baseTable, targetTable] of common) {
            const baseColumns = baseTable.columns ?? [];
            const targetColumns = targetTable.columns ?? [];
            const changes = diffTableColumns(baseColumns, targetColumns);
            if (changes.length > 0) {
              modified.push({ name: baseTable.name, changes });
            }
          }

          totalAdded += added.length;
          totalRemoved += removed.length;
          totalModified += modified.length;

          result["tables"] = {
            added: added.map((t) => ({ name: t.name })),
            removed: removed.map((t) => ({ name: t.name })),
            modified,
          };
        }

        // --- Views ---
        if (sections.includes("views")) {
          const baseViews = (baselineData.views ?? []) as SqlItem[];
          const targetViews = (targetData.views ?? []) as SqlItem[];
          const { added, removed, common } = diffNameSets(
            baseViews,
            targetViews,
          );

          const modified: {
            name: string;
            baselineSql: string;
            targetSql: string;
          }[] = [];
          for (const [baseView, targetView] of common) {
            if (baseView.sql !== targetView.sql) {
              modified.push({
                name: baseView.name,
                baselineSql: baseView.sql,
                targetSql: targetView.sql,
              });
            }
          }

          totalAdded += added.length;
          totalRemoved += removed.length;
          totalModified += modified.length;

          result["views"] = {
            added: added.map((v) => ({ name: v.name })),
            removed: removed.map((v) => ({ name: v.name })),
            modified,
          };
        }

        // --- Indexes ---
        if (sections.includes("indexes")) {
          const baseIndexes = (baselineData.indexes ?? []) as (SqlItem &
            NamedWithTable)[];
          const targetIndexes = (targetData.indexes ?? []) as (SqlItem &
            NamedWithTable)[];
          const { added, removed, common } = diffNameSets(
            baseIndexes,
            targetIndexes,
          );

          const modified: {
            name: string;
            table: string;
            baselineSql: string;
            targetSql: string;
          }[] = [];
          for (const [baseIdx, targetIdx] of common) {
            if (baseIdx.sql !== targetIdx.sql) {
              modified.push({
                name: baseIdx.name,
                table: baseIdx.table,
                baselineSql: baseIdx.sql,
                targetSql: targetIdx.sql,
              });
            }
          }

          totalAdded += added.length;
          totalRemoved += removed.length;
          totalModified += modified.length;

          result["indexes"] = {
            added: added.map((idx) => ({
              name: idx.name,
              table: idx.table,
            })),
            removed: removed.map((idx) => ({
              name: idx.name,
              table: idx.table,
            })),
            modified,
          };
        }

        // --- Triggers ---
        if (sections.includes("triggers")) {
          const baseTriggers = (baselineData.triggers ?? []) as (SqlItem &
            NamedWithTable)[];
          const targetTriggers = (targetData.triggers ?? []) as (SqlItem &
            NamedWithTable)[];
          const { added, removed, common } = diffNameSets(
            baseTriggers,
            targetTriggers,
          );

          const modified: {
            name: string;
            table: string;
            baselineSql: string;
            targetSql: string;
          }[] = [];
          for (const [baseTrig, targetTrig] of common) {
            if (baseTrig.sql !== targetTrig.sql) {
              modified.push({
                name: baseTrig.name,
                table: baseTrig.table,
                baselineSql: baseTrig.sql,
                targetSql: targetTrig.sql,
              });
            }
          }

          totalAdded += added.length;
          totalRemoved += removed.length;
          totalModified += modified.length;

          result["triggers"] = {
            added: added.map((t) => ({
              name: t.name,
              table: t.table,
            })),
            removed: removed.map((t) => ({
              name: t.name,
              table: t.table,
            })),
            modified,
          };
        }

        return {
          success: true,
          sections: result,
          summary: {
            totalChanges: totalAdded + totalRemoved + totalModified,
            added: totalAdded,
            removed: totalRemoved,
            modified: totalModified,
            severity: computeSeverity(
              totalAdded,
              totalRemoved,
              totalModified,
            ),
          },
          comparedAt: new Date().toISOString(),
        };
      } catch (error) {
        return formatHandlerError(error);
      }
    },
  };
}
