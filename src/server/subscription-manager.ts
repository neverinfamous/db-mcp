import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { logger } from "../utils/logger/index.js";

/**
 * Manages MCP resource subscriptions for the server.
 * Tracks which transport sessions are subscribed to which resource URIs.
 */
export class SubscriptionManager {
  private readonly server: McpServer;

  // Map of URI string -> Set of Session IDs
  private subscriptions = new Map<string, Set<string>>();

  constructor(server: McpServer) {
    this.server = server;
  }

  /**
   * Subscribe a session to a resource URI.
   */
  public subscribe(uri: string, sessionId?: string): void {
    if (!sessionId) {
      logger.debug(
        `Subscription requested for ${uri} but no sessionId provided. Assuming stateless transport.`,
      );
      return;
    }

    let sessions = this.subscriptions.get(uri);
    if (!sessions) {
      sessions = new Set<string>();
      this.subscriptions.set(uri, sessions);
    }

    if (!sessions.has(sessionId)) {
      sessions.add(sessionId);
      logger.debug(`Session ${sessionId} subscribed to resource ${uri}`, {
        module: "SERVER",
      });
    }
  }

  /**
   * Unsubscribe a session from a resource URI.
   */
  public unsubscribe(uri: string, sessionId?: string): void {
    if (!sessionId) {
      return;
    }

    const sessions = this.subscriptions.get(uri);
    if (sessions?.has(sessionId)) {
      sessions.delete(sessionId);
      logger.debug(`Session ${sessionId} unsubscribed from resource ${uri}`, {
        module: "SERVER",
      });

      if (sessions.size === 0) {
        this.subscriptions.delete(uri);
      }
    }
  }

  /**
   * Unsubscribe a session from all resources (useful on transport disconnect).
   */
  public unsubscribeSession(sessionId: string): void {
    let count = 0;
    for (const [uri, sessions] of this.subscriptions.entries()) {
      if (sessions.has(sessionId)) {
        sessions.delete(sessionId);
        count++;
        if (sessions.size === 0) {
          this.subscriptions.delete(uri);
        }
      }
    }
    if (count > 0) {
      logger.debug(
        `Session ${sessionId} disconnected, removed ${count} subscriptions`,
        { module: "SERVER" },
      );
    }
  }

  /**
   * Notifies all subscribed clients that a resource has changed.
   */
  public async notifyResourceUpdated(uri: string): Promise<void> {
    if (!this.hasSubscribers(uri)) {
      return;
    }

    try {
      await this.server.server.sendResourceUpdated({ uri });
      logger.debug(`Notified subscribers of update to ${uri}`, {
        module: "SERVER",
      });
    } catch (error) {
      logger.error(`Failed to notify subscribers for ${uri}`, {
        module: "SERVER",
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }

  /**
   * Notifies subscribers of schema-related resources (schema, tables, and specific tables).
   */
  public async notifySchemaSubscribers(): Promise<void> {
    const urisToNotify = new Set<string>([
      "sqlite://schema",
      "sqlite://tables",
    ]);

    // Find any specific table subscriptions
    for (const uri of this.subscriptions.keys()) {
      if (uri.startsWith("sqlite://table/")) {
        urisToNotify.add(uri);
      }
    }

    const promises = Array.from(urisToNotify).map((uri) =>
      this.notifyResourceUpdated(uri),
    );
    await Promise.allSettled(promises);
  }

  /**
   * Check if there are any active subscribers for a specific URI.
   */
  public hasSubscribers(uri: string): boolean {
    const sessions = this.subscriptions.get(uri);
    return sessions ? sessions.size > 0 : false;
  }
}
