import type { Request, Response, NextFunction, RequestHandler } from "express";
import type { TokenValidator } from "../token-validator.js";
import type { OAuthResourceServer } from "../oauth-resource-server.js";
import { TokenMissingError } from "../errors.js";
import { createModuleLogger, ERROR_CODES } from "../../utils/logger/index.js";
import { extractBearerToken } from "./extraction.js";

const logger = createModuleLogger("AUTH");

export interface AuthMiddlewareConfig {
  /** Token validator instance */
  tokenValidator: TokenValidator;

  /** Resource server instance (for WWW-Authenticate header) */
  resourceServer: OAuthResourceServer;

  /** Paths that bypass authentication (e.g., '/.well-known/*', '/health') */
  publicPaths?: string[];
}

function isPublicPath(path: string, publicPaths: string[]): boolean {
  if (path.startsWith("/.well-known/")) {
    return true;
  }

  for (const pattern of publicPaths) {
    if (pattern === path) {
      return true;
    }

    if (pattern.endsWith("/*")) {
      const prefix = pattern.slice(0, -2);
      if (path === prefix || path.startsWith(prefix + "/")) {
        return true;
      }
    }
  }

  return false;
}

export function createAuthMiddleware(
  config: AuthMiddlewareConfig,
): RequestHandler {
  const { tokenValidator, resourceServer, publicPaths = [] } = config;

  return async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const requestId = crypto.randomUUID();
    req.requestId = requestId;

    if (isPublicPath(req.path, publicPaths)) {
      logger.info(`Public path accessed: ${req.path}`, {
        code: "AUTH_PUBLIC_PATH",
        requestId,
        path: req.path,
      });
      next();
      return;
    }

    const token = extractBearerToken(req.headers.authorization);

    if (!token) {
      const error = new TokenMissingError(resourceServer.getResourceUri());

      logger.warning("No access token provided", {
        code: ERROR_CODES.AUTH.TOKEN_MISSING.full,
        requestId,
        path: req.path,
      });

      res.status(error.httpStatus);
      res.setHeader("WWW-Authenticate", error.wwwAuthenticate ?? "");
      res.json({
        error: "unauthorized",
        error_description: error.message,
      });
      return;
    }

    const result = await tokenValidator.validate(token);

    if (!result.valid) {
      logger.warning(
        `Token validation failed: ${result.error ?? "Unknown error"}`,
        {
          code: result.errorCode ?? ERROR_CODES.AUTH.TOKEN_INVALID.full,
          requestId,
          path: req.path,
        },
      );

      res.status(401);
      res.setHeader(
        "WWW-Authenticate",
        resourceServer.getWWWAuthenticateHeader("invalid_token", result.error),
      );
      res.json({
        error: "invalid_token",
        error_description: result.error,
      });
      return;
    }

    const claims = result.claims;
    if (!claims) {
      res.status(500).json({ error: "internal_error" });
      return;
    }
    req.auth = claims;
    req.accessToken = token;

    logger.info(`Request authenticated: ${claims.sub}`, {
      code: "AUTH_SUCCESS",
      requestId,
      sub: claims.sub,
      scopes: claims.scopes.length,
      path: req.path,
    });

    next();
  };
}
