/**
 * Graph Tool Creators
 *
 * Dependency graph, topological sort, and cascade simulation tools.
 * All tools are read-only — they only query PRAGMAs.
 */

import type { SqliteAdapter } from "../../../sqlite-adapter.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../../types/index.js";
import { readOnly } from "../../../../../utils/annotations.js";
import { formatError } from "../../../../../utils/errors/index.js";
import { z } from "zod";
import type { ForeignKeyInfo } from "./helpers.js";
import { buildForeignKeyGraph, detectCycles } from "./helpers.js";

// =============================================================================
// Input Schemas
// =============================================================================

const DependencyGraphSchema = z
  .object({
    includeRowCounts: z
      .boolean()
      .optional()
      .describe("Include row counts per table (default: true)"),
  })
  .default({});

const TopologicalSortSchema = z
  .object({
    direction: z
      .enum(["create", "drop"])
      .optional()
      .describe(
        "Sort direction: 'create' = dependencies first, 'drop' = dependents first (default: create)",
      ),
  })
  .default({});

const CascadeSimulatorSchema = z.object({
  table: z.string().describe("Table name to simulate deletion from"),
  operation: z
    .enum(["DELETE", "DROP", "TRUNCATE"])
    .optional()
    .describe("Operation to simulate (default: DELETE)"),
});

// =============================================================================
// Output Schemas
// =============================================================================

const DependencyGraphOutputSchema = z.object({
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
  error: z.string().optional(),
});

const TopologicalSortOutputSchema = z.object({
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
  error: z.string().optional(),
});

const CascadeSimulatorOutputSchema = z.object({
  success: z.boolean(),
  sourceTable: z.string().optional(),
  operation: z.string().optional(),
  affectedTables: z
    .array(
      z.object({
        table: z.string(),
        action: z.string(),
        estimatedRows: z.number().optional(),
        path: z.array(z.string()),
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
  error: z.string().optional(),
});

// =============================================================================
// Tool Creators
// =============================================================================

export function createDependencyGraphTool(
  adapter: SqliteAdapter,
): ToolDefinition {
  return {
    name: "sqlite_dependency_graph",
    description:
      "Build a foreign key dependency graph showing relationships between all tables. Returns nodes (tables), edges (FK references), circular dependency detection, and root/leaf table identification.",
    group: "introspection",
    inputSchema: DependencyGraphSchema,
    outputSchema: DependencyGraphOutputSchema,
    requiredScopes: ["read"],
    annotations: readOnly("Dependency Graph"),
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const input = DependencyGraphSchema.parse(params);
        const includeRowCounts = input.includeRowCounts !== false;
        const { nodes, edges } = await buildForeignKeyGraph(adapter);

        // Build adjacency for cycle detection
        const adjacency = new Map<string, string[]>();
        for (const node of nodes) {
          adjacency.set(node.table, []);
        }
        for (const edge of edges) {
          adjacency.get(edge.from)?.push(edge.to);
        }

        const cycles = detectCycles(
          adjacency,
          nodes.map((n) => n.table),
        );

        // Identify root tables (no incoming FK references) and leaf tables (no outgoing FKs)
        const referencedTables = new Set(edges.map((e) => e.to));
        const referencingTables = new Set(edges.map((e) => e.from));
        const rootTables = nodes
          .filter((n) => !referencedTables.has(n.table))
          .map((n) => n.table);
        const leafTables = nodes
          .filter((n) => !referencingTables.has(n.table))
          .map((n) => n.table);

        return {
          success: true,
          nodes: nodes.map((n) => ({
            table: n.table,
            ...(includeRowCounts ? { rowCount: n.rowCount } : {}),
          })),
          edges,
          circularDependencies: cycles.length > 0 ? cycles : undefined,
          stats: {
            totalTables: nodes.length,
            totalRelationships: edges.length,
            rootTables,
            leafTables,
          },
        };
      } catch (error) {
        const structured = formatError(error);
        return { success: false, error: structured.error };
      }
    },
  };
}

export function createTopologicalSortTool(
  adapter: SqliteAdapter,
): ToolDefinition {
  return {
    name: "sqlite_topological_sort",
    description:
      "Generate a safe DDL execution order for tables based on foreign key dependencies. 'create' direction lists parent tables first; 'drop' direction lists child tables first.",
    group: "introspection",
    inputSchema: TopologicalSortSchema,
    outputSchema: TopologicalSortOutputSchema,
    requiredScopes: ["read"],
    annotations: readOnly("Topological Sort"),
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const input = TopologicalSortSchema.parse(params);
        const direction = input.direction ?? "create";
        const { nodes, edges } = await buildForeignKeyGraph(adapter);

        // Build adjacency + in-degree for Kahn's algorithm
        const adjacency = new Map<string, string[]>();
        const inDegree = new Map<string, number>();
        const deps = new Map<string, string[]>();

        for (const node of nodes) {
          adjacency.set(node.table, []);
          inDegree.set(node.table, 0);
          deps.set(node.table, []);
        }

        for (const edge of edges) {
          // from depends on to: from -> to is a dependency
          adjacency.get(edge.to)?.push(edge.from);
          inDegree.set(edge.from, (inDegree.get(edge.from) ?? 0) + 1);
          deps.get(edge.from)?.push(edge.to);
        }

        // Kahn's algorithm
        const queue: string[] = [];
        for (const [table, degree] of inDegree) {
          if (degree === 0) queue.push(table);
        }

        const sorted: {
          table: string;
          level: number;
          dependencies: string[];
        }[] = [];
        let level = 0;

        while (queue.length > 0) {
          const nextQueue: string[] = [];
          for (const table of queue) {
            sorted.push({
              table,
              level,
              dependencies: deps.get(table) ?? [],
            });
            for (const neighbor of adjacency.get(table) ?? []) {
              const newDegree = (inDegree.get(neighbor) ?? 1) - 1;
              inDegree.set(neighbor, newDegree);
              if (newDegree === 0) nextQueue.push(neighbor);
            }
          }
          queue.length = 0;
          queue.push(...nextQueue);
          level++;
        }

        const hasCycles = sorted.length < nodes.length;
        const cycles = hasCycles
          ? detectCycles(
              adjacency,
              nodes.map((n) => n.table),
            )
          : [];

        const result = direction === "drop" ? [...sorted].reverse() : sorted;

        return {
          success: true,
          order: result,
          direction,
          hasCycles,
          ...(hasCycles ? { cycles } : {}),
          ...(hasCycles
            ? {
                hint: "Circular dependencies detected. Manual intervention may be required for safe DDL ordering.",
              }
            : {}),
        };
      } catch (error) {
        const structured = formatError(error);
        return { success: false, error: structured.error };
      }
    },
  };
}

export function createCascadeSimulatorTool(
  adapter: SqliteAdapter,
): ToolDefinition {
  return {
    name: "sqlite_cascade_simulator",
    description:
      "Simulate the impact of a DELETE, DROP, or TRUNCATE on a table. Shows which tables would be affected through cascading foreign key actions, with severity scoring.",
    group: "introspection",
    inputSchema: CascadeSimulatorSchema,
    outputSchema: CascadeSimulatorOutputSchema,
    requiredScopes: ["read"],
    annotations: readOnly("Cascade Simulator"),
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const input = CascadeSimulatorSchema.parse(params);
        const operation = input.operation ?? "DELETE";
        // Verify table exists
        const tableCheck = await adapter.executeReadQuery(
          `SELECT 1 FROM sqlite_master WHERE type='table' AND name=?`,
          [input.table],
        );
        if ((tableCheck.rows?.length ?? 0) === 0) {
          return {
            success: false,
            error: `Table '${input.table}' does not exist`,
          };
        }

        const { nodes, fkInfo } = await buildForeignKeyGraph(adapter);
        const rowCounts = new Map(nodes.map((n) => [n.table, n.rowCount]));

        // Build reverse adjacency: for each table, find what references it
        const reverseAdj = new Map<string, ForeignKeyInfo[]>();
        for (const fk of fkInfo) {
          if (!reverseAdj.has(fk.toTable)) {
            reverseAdj.set(fk.toTable, []);
          }
          reverseAdj.get(fk.toTable)?.push(fk);
        }

        // BFS to walk cascading effects
        interface AffectedEntry {
          table: string;
          action: string;
          estimatedRows?: number | undefined;
          path: string[];
          depth: number;
        }

        const affected: AffectedEntry[] = [];
        const visited = new Set<string>();
        const queue: { table: string; path: string[]; depth: number }[] = [
          { table: input.table, path: [input.table], depth: 0 },
        ];

        let cascadeActions = 0;
        let blockingActions = 0;
        let setNullActions = 0;
        let maxDepth = 0;

        while (queue.length > 0) {
          const current = queue.shift();
          if (!current) break;
          const referencing = reverseAdj.get(current.table) ?? [];

          for (const fk of referencing) {
            if (visited.has(fk.fromTable)) continue;
            visited.add(fk.fromTable);

            const depth = current.depth + 1;
            maxDepth = Math.max(maxDepth, depth);

            let action: string;
            if (operation === "DROP") {
              action = "ORPHANED (parent table dropped)";
              cascadeActions++;
            } else {
              const onAction =
                operation === "DELETE" ? fk.onDelete : fk.onUpdate;
              switch (onAction.toUpperCase()) {
                case "CASCADE":
                  action = `CASCADE ${operation}`;
                  cascadeActions++;
                  break;
                case "SET NULL":
                  action = "SET NULL";
                  setNullActions++;
                  break;
                case "SET DEFAULT":
                  action = "SET DEFAULT";
                  setNullActions++;
                  break;
                case "RESTRICT":
                case "NO ACTION":
                  action = `BLOCKED (${onAction})`;
                  blockingActions++;
                  break;
                default:
                  action = onAction;
              }
            }

            const entry: AffectedEntry = {
              table: fk.fromTable,
              action,
              estimatedRows: rowCounts.get(fk.fromTable),
              path: [...current.path, fk.fromTable],
              depth,
            };
            affected.push(entry);

            // Continue BFS for CASCADE actions
            if (action.startsWith("CASCADE") || action.startsWith("ORPHANED")) {
              queue.push({
                table: fk.fromTable,
                path: entry.path,
                depth,
              });
            }
          }
        }

        // Calculate severity
        let severity: "low" | "medium" | "high" | "critical";
        if (affected.length === 0) {
          severity = "low";
        } else if (cascadeActions === 0 && blockingActions > 0) {
          severity = "medium";
        } else if (cascadeActions > 0 && maxDepth <= 2) {
          severity = "high";
        } else if (cascadeActions > 0 && maxDepth > 2) {
          severity = "critical";
        } else {
          severity = "medium";
        }

        return {
          success: true,
          sourceTable: input.table,
          operation,
          affectedTables: affected,
          severity,
          stats: {
            totalTablesAffected: affected.length,
            cascadeActions,
            blockingActions,
            setNullActions,
            maxDepth,
          },
        };
      } catch (error) {
        const structured = formatError(error);
        return { success: false, error: structured.error };
      }
    },
  };
}
