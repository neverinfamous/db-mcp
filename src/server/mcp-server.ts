/**
 * db-mcp - Main MCP Server
 *
 * SQLite MCP server with OAuth 2.1 authentication,
 * HTTP/SSE transport, and dynamic tool filtering.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type {
  McpServerConfig,
  DatabaseConfig,
  ToolFilterConfig,
} from "../types/index.js";
import { VERSION, NAME } from "../version.js";
import type { DatabaseAdapter } from "../adapters/database-adapter.js";
import type { HttpTransportConfig } from "../transports/http/types.js";
import {
  parseToolFilter,
  getFilterSummary,
  getToolFilterFromEnv,
} from "../filtering/tool-filter.js";
import {
  INSTRUCTIONS,
  HELP_CONTENT,
} from "../constants/server-instructions.js";
import type { ToolGroup } from "../types/index.js";
import { logger } from "../utils/logger/index.js";
import { SERVER_ICONS } from "../utils/icons.js";
import { READ_ONLY } from "../utils/annotations.js";
import { DbMcpError } from "../utils/errors/base.js";
import { ErrorCategory } from "../utils/errors/categories.js";
import { AuditLogger } from "../audit/logger.js";
import { BackupManager } from "../audit/backup-manager.js";
import { createAuditInterceptor } from "../audit/interceptor.js";
import type { AuditInterceptor } from "../audit/interceptor.js";
import { z } from "zod";

/**
 * Main db-mcp server class
 *
 * Manages database adapters, tool registration, and MCP protocol handling.
 */
export class DbMcpServer {
  private server: McpServer;
  private adapters = new Map<string, DatabaseAdapter>();
  private toolFilter: ToolFilterConfig;
  private config: McpServerConfig;
  private auditLogger: AuditLogger | null = null;
  private backupManager: BackupManager | null = null;
  private auditInterceptor: AuditInterceptor | null = null;
  private auditInitPromise: Promise<void> | null = null;

  constructor(config: McpServerConfig) {
    this.config = config;

    // Initialize tool filter from config or environment (needed for help resources)
    this.toolFilter = config.toolFilter
      ? parseToolFilter(config.toolFilter)
      : getToolFilterFromEnv();

    // Initialize MCP server with slim instructions (~600 chars)
    this.server = new McpServer(
      {
        name: config.name,
        version: config.version,
      },
      {
        capabilities: {
          logging: {},
        },
        instructions: INSTRUCTIONS,
      },
    );

    // Log filter summary
    logger.info(getFilterSummary(this.toolFilter), { module: "FILTER" });

    // Log server initialization with capabilities
    logger.info("MCP Server initialized", {
      module: "SERVER",
      name: config.name,
      version: config.version,
      toolFilter: config.toolFilter ?? "none",
      capabilities: ["logging"],
    });

    // Register built-in tools and help resources
    this.registerBuiltInTools();
    this.registerHelpResources();

    // Initialize audit subsystem if configured
    if (config.audit?.enabled) {
      this.auditInitPromise = this.initializeAudit(config);
    }
  }

  /**
   * Register a database adapter
   */
  async registerAdapter(
    adapter: DatabaseAdapter,
    config: DatabaseConfig,
  ): Promise<void> {
    const adapterId = `${adapter.type}:${config.connectionString ?? "default"}`;

    // Wait for audit subsystem to initialize before registering adapters
    if (this.auditInitPromise) {
      await this.auditInitPromise;
    }

    // Connect to database
    await adapter.connect(config);

    // Store adapter
    this.adapters.set(adapterId, adapter);

    // Inject audit interceptor if available (narrowed for type-only import)
    if (this.auditInterceptor && "setAuditInterceptor" in adapter) {
      (
        adapter as {
          setAuditInterceptor: (i: AuditInterceptor) => void;
        }
      ).setAuditInterceptor(this.auditInterceptor);
    }
    if (this.backupManager && "setBackupManager" in adapter) {
      (
        adapter as { setBackupManager: (m: BackupManager) => void }
      ).setBackupManager(this.backupManager);
    }

    // Register adapter's tools with filtering
    adapter.registerTools(this.server, this.toolFilter);
    adapter.registerResources(this.server);
    adapter.registerPrompts(this.server);

    logger.info(`Registered adapter: ${adapter.name} (${adapterId})`, {
      module: "SERVER",
    });
  }

  /**
   * Get an adapter by ID
   */
  getAdapter(adapterId: string): DatabaseAdapter | undefined {
    return this.adapters.get(adapterId);
  }

  /**
   * Get all registered adapters
   */
  getAdapters(): Map<string, DatabaseAdapter> {
    return this.adapters;
  }

  /**
   * Register built-in server tools (health, info, etc.)
   */
  private registerBuiltInTools(): void {
    // Build options with icons (SDK type doesn't include icons, so we cast)
    const serverInfoOpts: Record<string, unknown> = {
      title: "Server Info",
      description:
        "Get information about the db-mcp server and registered adapters",
      icons: SERVER_ICONS,
      annotations: READ_ONLY,
    };

    // Server info tool
    this.server.registerTool("server_info", serverInfoOpts, () => {
      const adapterInfo = [];
      for (const [id, adapter] of this.adapters) {
        adapterInfo.push({
          id,
          ...adapter.getInfo(),
        });
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                name: this.config.name,
                version: this.config.version,
                transport: this.config.transport,
                adapters: adapterInfo,
                toolFilter: {
                  raw: this.toolFilter.raw,
                  enabledGroups: [...this.toolFilter.enabledGroups],
                },
              },
              null,
              2,
            ),
          },
        ],
      };
    });

    // Health check tool
    const healthOpts: Record<string, unknown> = {
      title: "Server Health",
      description: "Check health status of all database connections",
      icons: SERVER_ICONS,
      annotations: READ_ONLY,
    };

    this.server.registerTool("server_health", healthOpts, async () => {
      const health: Record<string, unknown> = {
        server: "healthy",
        timestamp: new Date().toISOString(),
        adapters: {},
      };

      for (const [id, adapter] of this.adapters) {
        try {
          const adapterHealth = await adapter.getHealth();
          (health["adapters"] as Record<string, unknown>)[id] = adapterHealth;
        } catch (error) {
          (health["adapters"] as Record<string, unknown>)[id] = {
            connected: false,
            error: error instanceof Error ? error.message : "Unknown error",
          };
        }
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(health, null, 2),
          },
        ],
      };
    });

    // List adapters tool
    const listAdaptersOpts: Record<string, unknown> = {
      title: "List Adapters",
      description: "List all registered database adapters",
      icons: SERVER_ICONS,
      annotations: READ_ONLY,
    };

    this.server.registerTool("list_adapters", listAdaptersOpts, () => {
      const adapters = [];
      for (const [id, adapter] of this.adapters) {
        adapters.push({
          id,
          type: adapter.type,
          name: adapter.name,
          version: adapter.version,
          connected: adapter.isConnected(),
        });
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(adapters, null, 2),
          },
        ],
      };
    });
  }

  /**
   * Register sqlite://help resources for on-demand reference documentation.
   * Always registers sqlite://help (gotchas). Group-specific help is filtered
   * by the tool filter configuration.
   */
  private registerHelpResources(): void {
    // Always register sqlite://help (gotchas + code mode + WASM vs native)
    const gotchasContent = HELP_CONTENT.get("gotchas");
    if (gotchasContent) {
      this.server.registerResource(
        "sqlite_help",
        "sqlite://help",
        {
          description:
            "Critical gotchas, WASM vs Native comparison, and Code Mode API reference",
          mimeType: "text/markdown",
        },
        () => ({
          contents: [
            {
              uri: "sqlite://help",
              mimeType: "text/markdown",
              text: gotchasContent,
            },
          ],
        }),
      );
    }

    // Register group-specific help resources based on tool filter
    const groupHelpKeys: { group: ToolGroup; key: string }[] = [
      { group: "core", key: "core" },
      { group: "json", key: "json" },
      { group: "text", key: "text" },
      { group: "stats", key: "stats" },
      { group: "vector", key: "vector" },
      { group: "geo", key: "geo" },
      { group: "admin", key: "admin" },
      { group: "transactions", key: "transactions" },
      { group: "introspection", key: "introspection" },
      { group: "migration", key: "migration" },
    ];

    for (const { group, key } of groupHelpKeys) {
      const isCodemodeOnly =
        this.toolFilter.enabledGroups.size === 1 &&
        this.toolFilter.enabledGroups.has("codemode");

      if (!this.toolFilter.enabledGroups.has(group) && !isCodemodeOnly) {
        continue;
      }

      const content = HELP_CONTENT.get(key);
      if (!content) continue;

      this.server.registerResource(
        `sqlite_help_${key}`,
        `sqlite://help/${key}`,
        {
          description: `Tool reference for the ${group} tool group`,
          mimeType: "text/markdown",
        },
        () => ({
          contents: [
            {
              uri: `sqlite://help/${key}`,
              mimeType: "text/markdown",
              text: content,
            },
          ],
        }),
      );
    }

    // Log registered help resources
    const registeredHelp = ["sqlite://help"];
    for (const { group, key } of groupHelpKeys) {
      if (this.toolFilter.enabledGroups.has(group)) {
        registeredHelp.push(`sqlite://help/${key}`);
      }
    }
    logger.info(`Help resources: ${registeredHelp.join(", ")}`, {
      module: "SERVER",
    });
  }

  /**
   * Start the server with the configured transport
   */
  async start(): Promise<void> {
    switch (this.config.transport) {
      case "stdio":
        await this.startStdio();
        break;
      case "http":
        await this.startHttp();
        break;
      default:
        throw new DbMcpError(
          `Unsupported transport: ${this.config.transport}`,
          "SERVER_START_FAILED",
          ErrorCategory.CONFIGURATION,
        );
    }
  }

  /**
   * Start server with stdio transport
   */
  private async startStdio(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    logger.info(`db-mcp server started (stdio transport)`, {
      module: "SERVER",
    });
  }

  /**
   * Start server with HTTP transport (Streamable HTTP with SSE support)
   */
  private async startHttp(): Promise<void> {
    // Dynamic import to avoid loading Express in stdio mode
    const { HttpTransport } = await import("../transports/http/index.js");

    // Build OAuth config, only including defined optional properties
    const oauthConfig: HttpTransportConfig["oauth"] = {
      enabled: this.config.oauth?.enabled ?? false,
      authorizationServerUrl: this.config.oauth?.authorizationServerUrl ?? "",
      audience: this.config.oauth?.audience ?? this.config.name,
    };

    // Only add optional properties if they are defined
    if (this.config.oauth?.issuer !== undefined) {
      oauthConfig.issuer = this.config.oauth.issuer;
    }
    if (this.config.oauth?.jwksUri !== undefined) {
      oauthConfig.jwksUri = this.config.oauth.jwksUri;
    }
    if (this.config.oauth?.clockTolerance !== undefined) {
      oauthConfig.clockTolerance = this.config.oauth.clockTolerance;
    }
    if (this.config.oauth?.publicPaths !== undefined) {
      oauthConfig.publicPaths = this.config.oauth.publicPaths;
    }

    const transport = new HttpTransport({
      port: this.config.port ?? 3000,
      ...(this.config.host !== undefined && { host: this.config.host }),
      ...(this.config.authToken !== undefined && {
        authToken: this.config.authToken,
      }),
      ...(this.config.enableHSTS !== undefined && {
        enableHSTS: this.config.enableHSTS,
      }),
      oauth: oauthConfig,
      stateless: this.config.statelessHttp ?? false,
    });

    // Initialize transport with the MCP server reference
    // In stateful mode, transport manages sessions internally
    // In stateless mode, transport creates a single shared connection
    await transport.initialize(this.server);
    await transport.start();

    const mode = this.config.statelessHttp ? "stateless" : "stateful";
    const host = this.config.host ?? "0.0.0.0";
    const port = String(this.config.port ?? 3000);
    logger.info(
      `db-mcp server started (HTTP transport on ${host}:${port}, ${mode} mode)`,
      { module: "TRANSPORT", mode },
    );
  }

  /**
   * Gracefully shut down the server
   */
  async shutdown(): Promise<void> {
    logger.info("Shutting down db-mcp server...", { module: "SERVER" });

    // Disconnect all adapters
    for (const [id, adapter] of this.adapters) {
      try {
        await adapter.disconnect();
        logger.info(`Disconnected adapter: ${id}`, { module: "SERVER" });
      } catch (error) {
        logger.error(`Error disconnecting adapter ${id}`, {
          module: "SERVER",
          error: error instanceof Error ? error : undefined,
        });
      }
    }

    // Close audit logger
    if (this.auditLogger) {
      await this.auditLogger.close();
      logger.info("Audit logger closed", { module: "AUDIT" });
    }

    // Flush backup manager
    if (this.backupManager) {
      await this.backupManager.flush();
      logger.info("Backup manager flushed", { module: "AUDIT" });
    }

    // Close MCP server
    await this.server.close();
    logger.info("Server shutdown complete", { module: "SERVER" });
  }

  /**
   * Initialize the audit subsystem: logger, interceptor, backup manager,
   * sqlite://audit resource, and audit backup tools.
   */
  private async initializeAudit(config: McpServerConfig): Promise<void> {
    const auditConfig = config.audit;
    if (!auditConfig?.enabled) return;

    // Create audit logger and eagerly touch the log file
    this.auditLogger = new AuditLogger(auditConfig);
    await this.auditLogger.init();

    // Create backup manager if configured
    if (auditConfig.backup?.enabled) {
      this.backupManager = new BackupManager(
        auditConfig.backup,
        auditConfig.logPath,
      );
    }

    // Create interceptor (backup + query adapter wired after first adapter registers)
    this.auditInterceptor = createAuditInterceptor(
      this.auditLogger,
      this.backupManager ?? undefined,
      undefined, // queryAdapter wired later when adapter connects
    );

    // Register sqlite://audit resource
    this.registerAuditResource();

    // Register audit backup tools only if admin group is enabled in the tool filter
    if (this.backupManager && this.toolFilter.enabledGroups.has("admin")) {
      this.registerAuditBackupTools();
    }

    logger.info(
      `Audit logging enabled (${auditConfig.logPath}, redact=${String(auditConfig.redact)}, reads=${String(auditConfig.auditReads)}, backup=${String(!!auditConfig.backup?.enabled)})`,
      { module: "AUDIT" },
    );
  }

  /**
   * Register the sqlite://audit resource for agent access to audit log.
   */
  private registerAuditResource(): void {
    if (!this.auditLogger) return;
    const auditLogger = this.auditLogger;
    const backupManager = this.backupManager;

    this.server.registerResource(
      "sqlite_audit",
      "sqlite://audit",
      {
        description:
          "Recent audit log entries and backup statistics. Shows the last 50 tool invocations with timing, outcomes, and token estimates.",
        mimeType: "application/json",
      },
      async () => {
        const recent = await auditLogger.recent(50);
        const backupStats = backupManager
          ? await backupManager.getStats()
          : undefined;

        const payload = {
          entries: recent,
          stats: {
            totalEntries: recent.length,
            ...(backupStats && { backups: backupStats }),
          },
        };

        return {
          contents: [
            {
              uri: "sqlite://audit",
              mimeType: "application/json",
              text: JSON.stringify(payload, null, 2),
            },
          ],
        };
      },
    );
  }

  /**
   * Register audit backup tools for snapshot management.
   */
  private registerAuditBackupTools(): void {
    const backupManager = this.backupManager;
    if (!backupManager) return;

    // sqlite_audit_list_backups
    this.server.registerTool(
      "sqlite_audit_list_backups",
      {
        title: "List Audit Backups",
        description:
          "List pre-mutation DDL snapshots captured before destructive operations. Returns metadata for each snapshot including timestamp, tool, target, and size.",
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
      },
      async () => {
        const snapshots = await backupManager.listSnapshots();
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  snapshots,
                  count: snapshots.length,
                  _meta: {
                    tokenEstimate: Math.ceil(
                      Buffer.byteLength(JSON.stringify(snapshots), "utf8") / 4,
                    ),
                  },
                },
                null,
                2,
              ),
            },
          ],
        };
      },
    );

    // sqlite_audit_get_backup
    this.server.registerTool(
      "sqlite_audit_get_backup",
      {
        title: "Get Audit Backup",
        description:
          "Retrieve a specific pre-mutation DDL snapshot by filename. Returns the full snapshot content including DDL and optional data.",
        inputSchema: z.object({
          filename: z
            .string()
            .describe(
              "Snapshot filename from sqlite_audit_list_backups results",
            ),
        }),
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
      },
      async (args: unknown) => {
        const { filename } = args as { filename: string };
        const snapshot = await backupManager.getSnapshot(filename);
        if (!snapshot) {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(
                  {
                    success: false,
                    error: `Snapshot not found: ${filename}`,
                  },
                  null,
                  2,
                ),
              },
            ],
            isError: true,
          };
        }
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(snapshot, null, 2),
            },
          ],
        };
      },
    );

    // sqlite_audit_cleanup
    this.server.registerTool(
      "sqlite_audit_cleanup",
      {
        title: "Cleanup Audit Backups",
        description:
          "Apply retention policy to audit backup snapshots. Deletes snapshots exceeding age or count limits.",
        annotations: {
          readOnlyHint: false,
          destructiveHint: true,
          idempotentHint: true,
          openWorldHint: false,
        },
      },
      async () => {
        const deleted = await backupManager.cleanup();
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  success: true,
                  deletedCount: deleted,
                  message:
                    deleted > 0
                      ? `Cleaned up ${String(deleted)} snapshot(s)`
                      : "No snapshots to clean up",
                },
                null,
                2,
              ),
            },
          ],
        };
      },
    );

    logger.info(
      "Registered audit backup tools: sqlite_audit_list_backups, sqlite_audit_get_backup, sqlite_audit_cleanup",
      { module: "AUDIT" },
    );
  }
}

/**
 * Create and configure a db-mcp server instance
 */
export function createServer(config: McpServerConfig): DbMcpServer {
  return new DbMcpServer(config);
}

/**
 * Default server configuration
 */
export const DEFAULT_CONFIG: Partial<McpServerConfig> = {
  name: NAME,
  version: VERSION,
  transport: "stdio",
  databases: [],
};
