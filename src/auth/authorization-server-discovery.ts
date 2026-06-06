/**
 * db-mcp - Authorization Server Discovery (RFC 8414)
 *
 * Discovers and caches OAuth 2.1 Authorization Server Metadata
 * as specified in RFC 8414.
 *
 * @see https://datatracker.ietf.org/doc/html/rfc8414
 */

import type {
  AuthorizationServerMetadata,
  AuthServerDiscoveryConfig,
} from "./types.js";
import { AuthServerDiscoveryError } from "./errors.js";
import { createModuleLogger, ERROR_CODES } from "../utils/logger/index.js";
import { DbMcpError, ErrorCategory } from "../utils/errors/index.js";
import { ConfigurationError } from "../utils/errors/classes.js";

const logger = createModuleLogger("AUTH");

// =============================================================================
// Authorization Server Discovery
// =============================================================================

/**
 * Authorization Server Metadata Discovery
 *
 * Fetches and caches OAuth 2.1 authorization server metadata
 * from the /.well-known/oauth-authorization-server endpoint.
 */
export class AuthorizationServerDiscovery {
  private readonly authServerUrl: string;
  private readonly cacheTtl: number;
  private readonly timeout: number;

  private cachedMetadata: AuthorizationServerMetadata | null = null;
  private cacheExpiry = 0;

  constructor(config: AuthServerDiscoveryConfig) {
    // Normalize URL (remove trailing slash)
    this.authServerUrl = config.authServerUrl.replace(/\/+$/, "");
    this.cacheTtl = config.cacheTtl ?? 3600;
    this.timeout = config.timeout ?? 5000;

    // F-5: Reject non-HTTPS discovery URLs in production to prevent MITM
    if (
      !this.authServerUrl.startsWith("https://") &&
      process.env["NODE_ENV"] !== "development" &&
      process.env["NODE_ENV"] !== "test"
    ) {
      const url = new URL(this.authServerUrl);
      const isLocalDev =
        url.hostname === "localhost" ||
        url.hostname === "127.0.0.1" ||
        url.hostname === "[::1]";
      if (!isLocalDev) {
        throw new ConfigurationError(
          `Security: Authorization server URL must use HTTPS in production. ` +
            `Got: ${this.authServerUrl}. ` +
            `Set NODE_ENV=development to allow HTTP for local testing.`,
        );
      }
    }

    logger.info(
      `Authorization Server Discovery initialized for: ${this.authServerUrl}`,
      { code: "AUTH_INIT" },
    );
  }

  /**
   * Discover authorization server metadata
   *
   * Fetches from /.well-known/oauth-authorization-server
   * Results are cached for cacheTtl seconds.
   *
   * @returns Authorization server metadata
   * @throws AuthServerDiscoveryError if discovery fails
   */
  async discover(): Promise<AuthorizationServerMetadata> {
    // Check cache
    if (this.cachedMetadata && Date.now() < this.cacheExpiry) {
      logger.info("Using cached authorization server metadata", {
        code: "AUTH_CACHE_HIT",
      });
      return this.cachedMetadata;
    }

    const metadataUrl = `${this.authServerUrl}/.well-known/oauth-authorization-server`;

    logger.info(`Fetching authorization server metadata from: ${metadataUrl}`, {
      code: "AUTH_DISCOVERY",
    });

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(metadataUrl, {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new DbMcpError(
          `HTTP ${String(response.status)}: ${response.statusText}`,
          ERROR_CODES.AUTH.DISCOVERY_FAILED.full,
          ErrorCategory.CONNECTION,
        );
      }

      const metadata = (await response.json()) as AuthorizationServerMetadata;

      // Validate required fields per RFC 8414
      this.validateMetadata(metadata);

      // Cache the metadata
      this.cachedMetadata = metadata;
      this.cacheExpiry = Date.now() + this.cacheTtl * 1000;

      logger.info(
        `Authorization server metadata cached for ${String(this.cacheTtl)}s`,
        { code: "AUTH_DISCOVERY_SUCCESS" },
      );

      return metadata;
    } catch (error: unknown) {
      const cause = error instanceof Error ? error : new Error(String(error));

      logger.error(
        `Failed to discover authorization server: ${this.authServerUrl}`,
        {
          code: ERROR_CODES.AUTH.DISCOVERY_FAILED.full,
          operation: "discover",
          entityId: this.authServerUrl,
          error: cause,
        },
      );

      throw new AuthServerDiscoveryError(this.authServerUrl, cause);
    }
  }

  /**
   * Validate required metadata fields per RFC 8414
   */
  private validateMetadata(metadata: AuthorizationServerMetadata): void {
    if (!metadata.issuer) {
      throw new DbMcpError(
        "Missing required field: issuer",
        "AUTH_DISCOVERY_INVALID",
        ErrorCategory.VALIDATION,
      );
    }

    if (!metadata.token_endpoint) {
      throw new DbMcpError(
        "Missing required field: token_endpoint",
        "AUTH_DISCOVERY_INVALID",
        ErrorCategory.VALIDATION,
      );
    }

    try {
      new URL(metadata.issuer);
      new URL(metadata.token_endpoint);
    } catch {
      throw new DbMcpError(
        "Invalid URL format in metadata fields",
        "AUTH_DISCOVERY_INVALID",
        ErrorCategory.VALIDATION,
      );
    }

    // Validate issuer matches the expected URL
    // Per RFC 8414 §3.3, issuer MUST be identical to the authorization server URL
    // F-2: Fail closed on mismatch to prevent key set swapping via DNS spoofing
    const expectedIssuer = this.authServerUrl;
    if (metadata.issuer !== expectedIssuer) {
      throw new DbMcpError(
        `Issuer validation failed. Per RFC 8414 §3.3, the issuer MUST be identical to the authorization server URL.`,
        "AUTH_ISSUER_MISMATCH",
        ErrorCategory.VALIDATION,
      );
    }
  }

  /**
   * Get cached metadata (throws if not discovered)
   */
  getMetadata(): AuthorizationServerMetadata {
    if (!this.cachedMetadata) {
      throw new DbMcpError(
        "Authorization server metadata not yet discovered. Call discover() first.",
        "AUTH_DISCOVERY_REQUIRED",
        ErrorCategory.INTERNAL,
      );
    }
    return this.cachedMetadata;
  }

  /**
   * Get JWKS URI from metadata
   *
   * @throws Error if metadata not discovered or jwks_uri not present
   */
  getJwksUri(): string {
    const metadata = this.getMetadata();

    if (!metadata.jwks_uri) {
      throw new DbMcpError(
        "Authorization server does not provide jwks_uri",
        "AUTH_DISCOVERY_INVALID",
        ErrorCategory.VALIDATION,
      );
    }

    return metadata.jwks_uri;
  }

  /**
   * Get token endpoint from metadata
   */
  getTokenEndpoint(): string {
    return this.getMetadata().token_endpoint;
  }

  /**
   * Get issuer from metadata
   */
  getIssuer(): string {
    return this.getMetadata().issuer;
  }

  /**
   * Get registration endpoint from metadata (RFC 7591)
   *
   * @returns Registration endpoint or null if not supported
   */
  getRegistrationEndpoint(): string | null {
    return this.getMetadata().registration_endpoint ?? null;
  }

  /**
   * Check if dynamic client registration is supported
   */
  supportsClientRegistration(): boolean {
    return this.getRegistrationEndpoint() !== null;
  }

  /**
   * Get supported scopes from metadata
   */
  getSupportedScopes(): string[] {
    return this.getMetadata().scopes_supported ?? [];
  }

  /**
   * Check if a specific scope is supported
   */
  isScopeSupported(scope: string): boolean {
    const supportedScopes = this.getSupportedScopes();
    // If no scopes are listed, assume all scopes are supported
    return supportedScopes.length === 0 || supportedScopes.includes(scope);
  }

  /**
   * Clear cached metadata
   */
  clearCache(): void {
    this.cachedMetadata = null;
    this.cacheExpiry = 0;
    logger.info("Authorization server metadata cache cleared", {
      code: "AUTH_CACHE_CLEARED",
    });
  }

  /**
   * Check if cache is valid
   */
  isCacheValid(): boolean {
    return this.cachedMetadata !== null && Date.now() < this.cacheExpiry;
  }

  /**
   * Get the authorization server URL
   */
  getAuthServerUrl(): string {
    return this.authServerUrl;
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create an Authorization Server Discovery instance
 */
export function createAuthServerDiscovery(
  authServerUrl: string,
  options?: Partial<Omit<AuthServerDiscoveryConfig, "authServerUrl">>,
): AuthorizationServerDiscovery {
  return new AuthorizationServerDiscovery({
    authServerUrl,
    cacheTtl: options?.cacheTtl,
    timeout: options?.timeout,
  });
}
