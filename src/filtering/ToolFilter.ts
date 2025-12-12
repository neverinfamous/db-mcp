/**
 * db-mcp - Tool Filtering System
 * 
 * Parses and applies tool filter rules from environment variables.
 * Compatible with sqlite-mcp-server and postgres-mcp-server filtering syntax.
 * 
 * Syntax:
 *   -group    → Disable all tools in a group
 *   -tool     → Disable a specific tool
 *   +tool     → Re-enable a tool after group disable
 * 
 * Example: DB_MCP_TOOL_FILTER="-vector,-geo,+vector_search"
 */

import type {
    ToolGroup,
    ToolFilterConfig,
    ToolDefinition
} from '../types/index.js';

/**
 * Default tool groups and their member tools.
 * This serves as the canonical mapping of tools to groups.
 */
export const TOOL_GROUPS: Record<ToolGroup, string[]> = {
    core: [
        'execute_query',
        'read_query',
        'write_query',
        'list_tables',
        'describe_table',
        'list_schemas',
        'create_table',
        'drop_table',
        'get_schema'
    ],
    json: [
        'json_extract',
        'json_insert',
        'json_replace',
        'json_remove',
        'json_set',
        'json_array',
        'json_object',
        'json_valid',
        'json_type',
        'json_query',
        'json_merge'
    ],
    text: [
        'fts_search',
        'create_fts_index',
        'fuzzy_search',
        'regex_match',
        'text_similarity',
        'phonetic_search',
        'tokenize_text',
        'highlight_match'
    ],
    stats: [
        'describe_stats',
        'percentile',
        'correlation',
        'regression',
        'histogram',
        'time_series_analysis',
        'moving_average',
        'outlier_detection'
    ],
    performance: [
        'analyze_query',
        'explain_query',
        'index_recommendations',
        'query_plan',
        'slow_queries',
        'workload_analysis'
    ],
    vector: [
        'vector_search',
        'cosine_similarity',
        'euclidean_distance',
        'create_vector_index',
        'hybrid_search',
        'vector_cluster',
        'nearest_neighbors',
        'embedding_stats'
    ],
    geo: [
        'distance_calc',
        'spatial_query',
        'create_spatial_index',
        'point_in_polygon',
        'buffer_query',
        'intersection_query',
        'bounding_box'
    ],
    backup: [
        'backup_database',
        'restore_database',
        'backup_table',
        'export_data'
    ],
    monitoring: [
        'health_check',
        'connection_status',
        'database_stats',
        'active_queries',
        'resource_usage'
    ],
    admin: [
        'vacuum_database',
        'analyze_tables',
        'pragma_get',
        'pragma_set',
        'extension_list',
        'extension_install',
        'create_index',
        'drop_index',
        'reindex',
        'optimize',
        // Native SQLite transaction tools
        'transaction_begin',
        'transaction_commit',
        'transaction_rollback',
        'transaction_savepoint',
        'transaction_release',
        'transaction_rollback_to',
        'transaction_execute',
        // Native SQLite window function tools
        'window_row_number',
        'window_rank',
        'window_lag_lead',
        'window_running_total',
        'window_moving_avg',
        'window_ntile'
    ]
};

/**
 * Get all tool names from all groups
 */
export function getAllToolNames(): string[] {
    return Object.values(TOOL_GROUPS).flat();
}

/**
 * Get the group for a specific tool
 */
export function getToolGroup(toolName: string): ToolGroup | undefined {
    for (const [group, tools] of Object.entries(TOOL_GROUPS)) {
        if (tools.includes(toolName)) {
            return group as ToolGroup;
        }
    }
    return undefined;
}

/**
 * Parse a tool filter string into structured rules
 * 
 * @param filterString - The filter string (e.g., "-vector,-geo,+vector_search")
 * @returns Parsed filter configuration
 */
export function parseToolFilter(filterString: string | undefined): ToolFilterConfig {
    // When no filter is specified, use empty Set to indicate "allow all"
    // This is checked in DatabaseAdapter.registerTools()
    if (!filterString || filterString.trim() === '') {
        return {
            raw: '',
            rules: [],
            enabledTools: new Set<string>() // Empty = allow all
        };
    }

    const config: ToolFilterConfig = {
        raw: filterString,
        rules: [],
        enabledTools: new Set(getAllToolNames())
    };

    // Split by comma and process each rule
    const parts = filterString.split(',').map(p => p.trim()).filter(p => p.length > 0);

    for (const part of parts) {
        if (part.startsWith('-')) {
            const target = part.slice(1);
            const isGroup = target in TOOL_GROUPS;

            config.rules.push({
                type: 'exclude',
                target,
                isGroup
            });

            // Apply the rule
            if (isGroup) {
                const groupTools = TOOL_GROUPS[target as ToolGroup];
                if (groupTools.length > 0) {
                    for (const tool of groupTools) {
                        config.enabledTools.delete(tool);
                    }
                }
            } else {
                config.enabledTools.delete(target);
            }
        } else if (part.startsWith('+')) {
            const target = part.slice(1);
            const isGroup = target in TOOL_GROUPS;

            config.rules.push({
                type: 'include',
                target,
                isGroup
            });

            // Apply the rule
            if (isGroup) {
                const groupTools = TOOL_GROUPS[target as ToolGroup];
                if (groupTools.length > 0) {
                    for (const tool of groupTools) {
                        config.enabledTools.add(tool);
                    }
                }
            } else {
                config.enabledTools.add(target);
            }
        }
        // Ignore rules without + or - prefix
    }

    return config;
}

/**
 * Check if a tool is enabled based on filter configuration
 */
export function isToolEnabled(toolName: string, config: ToolFilterConfig): boolean {
    return config.enabledTools.has(toolName);
}

/**
 * Filter a list of tool definitions based on filter configuration
 */
export function filterTools(
    tools: ToolDefinition[],
    config: ToolFilterConfig
): ToolDefinition[] {
    return tools.filter(tool => isToolEnabled(tool.name, config));
}

/**
 * Get the tool filter from environment variable
 */
export function getToolFilterFromEnv(): ToolFilterConfig {
    const filterString = process.env['DB_MCP_TOOL_FILTER'] ??
        process.env['TOOL_FILTER'] ??
        '';
    return parseToolFilter(filterString);
}

/**
 * Calculate token savings from tool filtering
 * Assumes ~200 tokens per tool definition (description + parameters)
 */
export function calculateTokenSavings(
    totalTools: number,
    enabledTools: number,
    tokensPerTool = 200
): { tokensSaved: number; percentSaved: number } {
    const disabledTools = totalTools - enabledTools;
    const tokensSaved = disabledTools * tokensPerTool;
    const percentSaved = totalTools > 0
        ? Math.round((disabledTools / totalTools) * 100)
        : 0;

    return { tokensSaved, percentSaved };
}

/**
 * Generate a summary of the current filter configuration
 */
export function getFilterSummary(config: ToolFilterConfig): string {
    const totalTools = getAllToolNames().length;

    // Empty enabledTools means "allow all" - show as all enabled
    const isAllEnabled = config.enabledTools.size === 0;
    const enabledCount = isAllEnabled ? totalTools : config.enabledTools.size;
    const { tokensSaved, percentSaved } = calculateTokenSavings(totalTools, enabledCount);

    const lines = [
        `Tool Filter Summary:`,
        `  Filter: ${config.raw || '(none)'}`,
        `  Tools: ${isAllEnabled ? 'all' : enabledCount}/${totalTools} enabled`,
        `  Token savings: ~${tokensSaved} tokens (${percentSaved}% reduction)`
    ];

    if (config.rules.length > 0) {
        lines.push(`  Rules applied: ${config.rules.length}`);
        for (const rule of config.rules) {
            const prefix = rule.type === 'exclude' ? '-' : '+';
            const type = rule.isGroup ? 'group' : 'tool';
            lines.push(`    ${prefix}${rule.target} (${type})`);
        }
    }

    return lines.join('\n');
}
