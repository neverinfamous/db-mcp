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
import { INSTRUCTIONS } from "../constants/server-instructions.js";

import { logger } from "../utils/logger/index.js";

import { DbMcpError } from "../utils/errors/base.js";
import { ErrorCategory } from "../utils/errors/categories.js";
import { AuditLogger } from "../audit/logger.js";
import { BackupManager } from "../audit/backup-manager.js";
import { createAuditInterceptor } from "../audit/interceptor.js";
import type { AuditInterceptor } from "../audit/interceptor.js";
import {
  registerBuiltInTools,
  registerHelpResources,
  registerAuditResource,
  registerAuditBackupTools,
} from "./registration/index.js";

/**
 * Monkey-patch McpServer to return structured JSON errors for validation failures.
 * This ensures that SDK-level Zod validation errors match the handler error format
 * expected by clients ({ success: false, error: "..." }).
 */
const proto = McpServer.prototype as unknown as Record<
  string,
  (errorMessage: string) => { content: { type: string; text: string }[]; isError: boolean }
>;

if (typeof proto['createToolError'] === "function") {
  const originalCreateToolError = proto['createToolError'];
  proto['createToolError'] = function (errorMessage: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = originalCreateToolError.call(this as any, errorMessage);
    if (result.content?.[0]?.type === "text") {
      const rawError = result.content[0].text;
      const structured = {
        success: false,
        error: rawError,
        code: "VALIDATION_ERROR",
        category: ErrorCategory.VALIDATION,
      };
      result.content[0].text = JSON.stringify(structured, null, 2);
    }
    return result;
  };
}

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
    registerBuiltInTools(this.server, this.adapters, this.config, this.toolFilter);
    registerHelpResources(this.server, this.toolFilter);

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
    registerAuditResource(this.server, this.auditLogger, this.backupManager);

    // Register audit backup tools only if admin group is enabled in the tool filter
    if (this.backupManager && this.toolFilter.enabledGroups.has("admin")) {
      registerAuditBackupTools(this.server, this.backupManager, this.adapters);
    }

    logger.info(
      `Audit logging enabled (${auditConfig.logPath}, redact=${String(auditConfig.redact)}, reads=${String(auditConfig.auditReads)}, backup=${String(!!auditConfig.backup?.enabled)})`,
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
