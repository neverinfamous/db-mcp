/**
 * HTTP Transport OAuth Setup
 *
 * OAuth 2.0 component initialization and auth middleware application.
 */

import { OAuthResourceServer } from "../../auth/oauth-resource-server.js";
import { AuthorizationServerDiscovery } from "../../auth/authorization-server-discovery.js";
import { TokenValidator } from "../../auth/token-validator.js";
import { createAuthMiddleware } from "../../auth/middleware.js";
import { SUPPORTED_SCOPES } from "../../auth/scopes.js";
import { createModuleLogger, ERROR_CODES } from "../../utils/logger/index.js";
import type { HttpTransportState } from "./types.js";

const logger = createModuleLogger("HTTP");

// =============================================================================
// Auth Middleware
// =============================================================================

/**
 * Apply OAuth authentication middleware if enabled
 */
export function applyAuthMiddleware(state: HttpTransportState): void {
  if (
    state.config.oauth.enabled &&
    state.tokenValidator &&
    state.resourceServer &&
    state.app
  ) {
    const authMiddleware = createAuthMiddleware({
      tokenValidator: state.tokenValidator,
      resourceServer: state.resourceServer,
      publicPaths: ["/health", ...(state.config.oauth.publicPaths ?? [])],
    });

    state.app.use(authMiddleware);
  }
}

// =============================================================================
// OAuth Setup
// =============================================================================

/**
 * Set up OAuth 2.0 components (resource server, discovery, token validator)
 */
export async function setupOAuth(
  state: HttpTransportState,
  resourceUri: string,
): Promise<void> {
  logger.info("Setting up OAuth 2.0...", { code: "HTTP_OAUTH_SETUP" });

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

    logger.info("OAuth 2.0 setup complete", { code: "HTTP_OAUTH_READY" });
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
