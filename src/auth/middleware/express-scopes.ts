import type { Request, Response, NextFunction, RequestHandler } from "express";
import { InsufficientScopeError, isOAuthError } from "../errors.js";
import { scopesGrantToolAccess } from "../scopes/index.js";
import { createModuleLogger, ERROR_CODES } from "../../utils/logger/index.js";

const logger = createModuleLogger("AUTH");

export function requireScope(scope: string): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.auth) {
      res.status(401).json({
        error: "unauthorized",
        error_description: "Authentication required",
      });
      return;
    }

    const scopeGranted =
      req.auth.scopes.includes(scope) ||
      req.auth.scopes.includes("admin") ||
      req.auth.scopes.includes("full");

    if (!scopeGranted) {
      const error = new InsufficientScopeError(scope, req.auth.scopes);

      logger.warning(`Insufficient scope: required ${scope}`, {
        code: ERROR_CODES.AUTH.SCOPE_DENIED.full,
        requestId: req.requestId,
        requiredScope: scope,
        providedScopes: req.auth.scopes,
      });

      res.status(error.httpStatus);
      res.setHeader("WWW-Authenticate", error.wwwAuthenticate ?? "");
      res.json({
        error: "insufficient_scope",
        error_description: error.message,
        required_scope: scope,
      });
      return;
    }

    next();
  };
}

export function requireAnyScope(scopes: string[]): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.auth) {
      res.status(401).json({
        error: "unauthorized",
        error_description: "Authentication required",
      });
      return;
    }

    if (req.auth.scopes.includes("full") || req.auth.scopes.includes("admin")) {
      next();
      return;
    }

    const hasAnyScope = scopes.some((scope) =>
      req.auth?.scopes.includes(scope),
    );

    if (!hasAnyScope) {
      const error = new InsufficientScopeError(scopes, req.auth.scopes);

      logger.warning(
        `Insufficient scope: required one of [${scopes.join(", ")}]`,
        {
          code: ERROR_CODES.AUTH.SCOPE_DENIED.full,
          requestId: req.requestId,
          requiredScopes: scopes,
          providedScopes: req.auth.scopes,
        },
      );

      res.status(error.httpStatus);
      res.setHeader("WWW-Authenticate", error.wwwAuthenticate ?? "");
      res.json({
        error: "insufficient_scope",
        error_description: error.message,
        required_scopes: scopes,
      });
      return;
    }

    next();
  };
}

export function requireToolScope(toolName: string): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.auth) {
      res.status(401).json({
        error: "unauthorized",
        error_description: "Authentication required",
      });
      return;
    }

    const hasAccess = scopesGrantToolAccess(req.auth.scopes, toolName);

    if (!hasAccess) {
      const error = new InsufficientScopeError(
        `Tool access: ${toolName}`,
        req.auth.scopes,
      );

      logger.warning(`Insufficient scope for tool: ${toolName}`, {
        code: ERROR_CODES.AUTH.SCOPE_DENIED.full,
        requestId: req.requestId,
        toolName,
        providedScopes: req.auth.scopes,
      });

      res.status(error.httpStatus);
      res.setHeader("WWW-Authenticate", error.wwwAuthenticate ?? "");
      res.json({
        error: "insufficient_scope",
        error_description: `Access to tool '${toolName}' denied`,
        tool: toolName,
      });
      return;
    }

    next();
  };
}

export function oauthErrorHandler(
  error: Error,
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (isOAuthError(error)) {
    res.status(error.httpStatus);

    if (error.wwwAuthenticate) {
      res.setHeader("WWW-Authenticate", error.wwwAuthenticate);
    }

    res.json({
      error: error.code,
      error_description: error.message,
    });
    return;
  }

  next(error);
}
