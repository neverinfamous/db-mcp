/**
 * HTTP Transport OAuth Setup
 *
 * OAuth 2.1 component initialization and auth middleware application.
 */

import { OAuthResourceServer } from "../../auth/oauth-resource-server.js";
import { AuthorizationServerDiscovery } from "../../auth/authorization-server-discovery.js";
import { TokenValidator } from "../../auth/token-validator.js";
import { createAuthMiddleware } from "../../auth/middleware/index.js";
import { SUPPORTED_SCOPES } from "../../auth/scopes/index.js";
import { createModuleLogger, ERROR_CODES } from "../../utils/logger/index.js";
import type { HttpTransportState } from "./types.js";
import type { RequestHandler } from "express";

const logger = createModuleLogger("HTTP");

// =============================================================================
// Auth Middleware
// =============================================================================

/**
 * Apply authentication middleware if configured.
 *
 * Priority: OAuth 2.1 > simple bearer token > none.
 * Warns if no auth is configured.
 */
export function applyAuthMiddleware(state: HttpTransportState): void {
  if (
    state.config.oauth.enabled &&
    state.tokenValidator &&
    state.resourceServer &&
    state.app
  ) {
    // Full OAuth 2.1 middleware
    const authMiddleware = createAuthMiddleware({
      tokenValidator: state.tokenValidator,
      resourceServer: state.resourceServer,
      publicPaths: ["/health", ...(state.config.oauth.publicPaths ?? [])],
    });

    state.app.use(authMiddleware);
  } else if (state.config.authToken && state.app) {
    // Simple bearer token middleware
    state.app.use(createSimpleBearerAuth(state.config.authToken));
    logger.info("Simple bearer token authentication enabled", {
      code: "AUTH_BEARER_ENABLED",
    });
  } else if (state.app) {
    logger.warning(
      "No authentication configured for HTTP transport. " +
        "Set --auth-token or --oauth-enabled for production deployments.",
      { code: "AUTH_NONE" },
    );
  }
}

/**
 * Simple bearer token authentication middleware.
 *
 * Compares the Authorization header against a static token.
 * Lighter-weight than full OAuth 2.1 — suitable for development
 * or single-tenant deployments behind a reverse proxy.
 */
function createSimpleBearerAuth(expectedToken: string): RequestHandler {
  const publicPaths = ["/health", "/", "/.well-known"];

  return (req, res, next) => {
    // Skip public paths
    if (
      publicPaths.some((p) => req.path === p || req.path.startsWith(`${p}/`))
    ) {
      next();
      return;
    }

    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      res.status(401);
      res.setHeader("WWW-Authenticate", 'Bearer realm="db-mcp"');
      res.json({
        error: "unauthorized",
        error_description: "Bearer token required",
      });
      return;
    }

    const token = authHeader.slice(7);
    if (token !== expectedToken) {
      logger.warning("Invalid bearer token rejected", {
        code: "AUTH_BEARER_REJECTED",
      });
      res.status(401);
      res.setHeader(
        "WWW-Authenticate",
        'Bearer realm="db-mcp", error="invalid_token"',
      );
      res.json({
        error: "unauthorized",
        error_description: "Invalid bearer token",
      });
      return;
    }

    next();
  };
}

// =============================================================================
// OAuth Setup
// =============================================================================

/**
 * Set up OAuth 2.1 components (resource server, discovery, token validator)
 */
export async function setupOAuth(
  state: HttpTransportState,
  resourceUri: string,
): Promise<void> {
  logger.info("Setting up OAuth 2.1...", { code: "HTTP_OAUTH_SETUP" });

  // Create Resource Server
  state.resourceServer = new OAuthResourceServer({
    resource: resourceUri,
    authorizationServers: [state.config.oauth.authorizationServerUrl],
    scopesSupported: [...SUPPORTED_SCOPES],
  });

  // Serve Protected Resource Metadata endpoint
  state.app?.get(
    "/.well-known/oauth-protected-resource",
    state.resourceServer.getMetadataHandler(),
  );

  // Discover authorization server metadata
  state.authServerDiscovery = new AuthorizationServerDiscovery({
    authServerUrl: state.config.oauth.authorizationServerUrl,
  });

  try {
    const metadata = await state.authServerDiscovery.discover();

    // Create Token Validator
    state.tokenValidator = new TokenValidator({
      jwksUri: state.config.oauth.jwksUri ?? metadata.jwks_uri ?? "",
      issuer: state.config.oauth.issuer ?? metadata.issuer,
      audience: state.config.oauth.audience,
      clockTolerance: state.config.oauth.clockTolerance,
    });

    logger.info("OAuth 2.1 setup complete", { code: "HTTP_OAUTH_READY" });
  } catch (error) {
    // If discovery fails, we can still start without OAuth validation
    logger.warning(
      "Authorization server discovery failed. OAuth validation disabled.",
      {
        code: ERROR_CODES.AUTH.DISCOVERY_FAILED.full,
        error: error instanceof Error ? error : undefined,
      },
    );

    if (!state.config.oauth.jwksUri) {
      logger.error(
        "No JWKS URI available. Please provide oauth.jwksUri in config.",
        { code: ERROR_CODES.AUTH.DISCOVERY_FAILED.full },
      );
      throw error;
    }

    state.tokenValidator = new TokenValidator({
      jwksUri: state.config.oauth.jwksUri,
      issuer:
        state.config.oauth.issuer ?? state.config.oauth.authorizationServerUrl,
      audience: state.config.oauth.audience,
      clockTolerance: state.config.oauth.clockTolerance,
    });
  }
}
