/**
 * Graph Helpers
 *
 * Shared types and utilities for building foreign key dependency graphs
 * and detecting circular dependencies.
 */

import type { SqliteAdapter } from "../../../sqlite-adapter.js";
import { isSpatialiteSystemTable } from "../../core/tables.js";

// =============================================================================
// Types
// =============================================================================

export interface ForeignKeyInfo {
  fromTable: string;
  toTable: string;
  fromColumn: string;
  toColumn: string;
  onDelete: string;
  onUpdate: string;
}

export interface GraphNode {
  table: string;
  rowCount: number;
}

export interface GraphEdge {
  from: string;
  to: string;
  fromColumn: string;
  toColumn: string;
  onDelete: string;
  onUpdate: string;
}

// =============================================================================
// Utilities
// =============================================================================

/**
 * Build the foreign key graph from all user tables.
 * Queries `PRAGMA foreign_key_list(table)` for each table.
 */
export async function buildForeignKeyGraph(
  adapter: SqliteAdapter,
  options: { excludeSystemTables?: boolean | undefined } = {},
): Promise<{
  nodes: GraphNode[];
  edges: GraphEdge[];
  fkInfo: ForeignKeyInfo[];
}> {
  const excludeSystem = options.excludeSystemTables !== false;
  // Get all user tables (exclude internal/system)
  const adapterUnknown = adapter as unknown as Record<string, unknown>;
  const _schemaManager = "schemaManager" in adapterUnknown 
    ? adapterUnknown["schemaManager"] as { getRawTableNames: () => Promise<string[]> } 
    : undefined;
  let tableNames: string[];
  
  if (_schemaManager && typeof _schemaManager.getRawTableNames === "function") {
      tableNames = await _schemaManager.getRawTableNames();
  } else {
      const tablesResult = await adapter.executeReadQuery(
        `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_mcp_%' ORDER BY name`,
      );
      tableNames = (tablesResult.rows ?? []).map((r) => r["name"] as string);
  }

  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const fkInfo: ForeignKeyInfo[] = [];

  // Filter system tables if requested
  const filteredNames = excludeSystem
    ? tableNames.filter((name) => !isSpatialiteSystemTable(name))
    : tableNames;

  for (const tableName of filteredNames) {
    nodes.push({ table: tableName, rowCount: 0 });

    // Get foreign keys (may fail for virtual tables in WASM)
    try {
      const fkResult = await adapter.executeReadQuery(
        `PRAGMA foreign_key_list("${tableName}")`,
      );
      for (const fk of fkResult.rows ?? []) {
        const info: ForeignKeyInfo = {
          fromTable: tableName,
          toTable: fk["table"] as string,
          fromColumn: fk["from"] as string,
          toColumn: fk["to"] as string,
          onDelete: (fk["on_delete"] as string) || "NO ACTION",
          onUpdate: (fk["on_update"] as string) || "NO ACTION",
        };
        fkInfo.push(info);
        edges.push({
          from: tableName,
          to: fk["table"] as string,
          fromColumn: fk["from"] as string,
          toColumn: fk["to"] as string,
          onDelete: info.onDelete,
          onUpdate: info.onUpdate,
        });
      }
    } catch {
      // Skip FK analysis for tables that can't be queried
    }
  }

  return { nodes, edges, fkInfo };
}

/**
 * Detect circular dependencies using DFS cycle detection.
 */
export function detectCycles(
  adjacency: Map<string, string[]>,
  tables: string[],
): string[][] {
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const inStack = new Set<string>();

  function dfs(node: string, path: string[]): void {
    if (inStack.has(node)) {
      // Found a cycle — extract it from the path
      const cycleStart = path.indexOf(node);
      if (cycleStart !== -1) {
        cycles.push([...path.slice(cycleStart), node]);
      }
      return;
    }
    if (visited.has(node)) return;

    visited.add(node);
    inStack.add(node);
    path.push(node);

    for (const neighbor of adjacency.get(node) ?? []) {
      dfs(neighbor, path);
    }

    path.pop();
    inStack.delete(node);
  }

  for (const table of tables) {
    if (!visited.has(table)) {
      dfs(table, []);
    }
  }

  return cycles;
}
