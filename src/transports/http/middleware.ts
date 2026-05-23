/**
 * HTTP Transport Middleware
 *
 * Security headers, CORS configuration, and rate limiting.
 * These are standalone functions that operate on HttpTransportState.
 */

import cors from "cors";
import rateLimit from "express-rate-limit";
import type { Request, Response, RequestHandler } from "express";
import {
  DEFAULT_RATE_LIMIT_WINDOW_MS,
  DEFAULT_RATE_LIMIT_MAX,
  DEFAULT_HSTS_MAX_AGE,
  type HttpTransportState,
} from "./types.js";

// =============================================================================
// Client IP Extraction
// =============================================================================

/**
 * Extract client IP address from the request.
 * When trustProxy is enabled, uses the leftmost IP from X-Forwarded-For.
 * Falls back to Express's req.ip then req.socket.remoteAddress.
 */
export function getClientIp(req: Request, trustProxy: boolean): string {
  if (trustProxy) {
    const forwarded = req.headers["x-forwarded-for"];
    if (typeof forwarded === "string") {
      const firstIp = forwarded.split(",")[0]?.trim();
      if (firstIp) return firstIp;
    }
  }
  return req.ip ?? req.socket.remoteAddress ?? "unknown";
}

// =============================================================================
// Security Headers
// =============================================================================

/**
 * Set security headers on all responses
 */
export function setupSecurityHeaders(state: HttpTransportState): void {
  if (!state.app) return;

  state.app.use((_req: Request, res: Response, next: () => void) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'none'; frame-ancestors 'none'",
    );
    res.setHeader(
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=()",
    );
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("X-Permitted-Cross-Domain-Policies", "none");

    // HSTS — only set when explicitly enabled (requires HTTPS)
    if (state.config.enableHSTS) {
      const maxAge = state.config.hstsMaxAge ?? DEFAULT_HSTS_MAX_AGE;
      res.setHeader(
        "Strict-Transport-Security",
        `max-age=${String(maxAge)}; includeSubDomains`,
      );
    }

    next();
  });
}

// =============================================================================
// CORS
// =============================================================================

/**
 * Check if an origin matches a CORS pattern.
 * Supports exact matches and wildcard subdomain patterns (e.g., "*.example.com").
 */
export function matchesCorsOrigin(origin: string, pattern: string): boolean {
  if (pattern === "*") return true;
  if (pattern.startsWith("*.")) {
    // Wildcard subdomain: "*.example.com" matches "https://app.example.com"
    const domain = pattern.slice(1); // ".example.com"
    // Enforce HTTPS for wildcard subdomain patterns to prevent protocol downgrade,
    // but exempt localhost/127.0.0.1 for development workflows (e.g., Playwright E2E)
    const isLocalDev =
      origin.startsWith("http://localhost") ||
      origin.startsWith("http://127.0.0.1");
    if (!isLocalDev && !origin.startsWith("https://")) return false;
    return origin.endsWith(domain) && origin.length > domain.length;
  }
  return origin === pattern;
}

/**
 * Configure CORS with configurable origins
 */
export function setupCors(state: HttpTransportState): void {
  if (!state.app) return;

  const corsOrigins = state.config.corsOrigins ?? [];
  const isWildcard = corsOrigins.includes("*");

  // CORS middleware
  state.app.use((req: Request, res: Response, next: () => void) => {
    const origin = req.headers.origin;

    // Set Access-Control-Allow-Origin
    if (isWildcard) {
      res.setHeader("Access-Control-Allow-Origin", "*");
    } else if (
      origin &&
      corsOrigins.some((pattern) => matchesCorsOrigin(origin, pattern))
    ) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
      // Only set credentials for explicit origins (not wildcard)
      res.setHeader("Access-Control-Allow-Credentials", "true");
    }

    res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Accept, Authorization, mcp-session-id, Last-Event-ID, mcp-protocol-version",
    );
    res.setHeader("Access-Control-Expose-Headers", "mcp-session-id");

    // Handle OPTIONS preflight requests
    if (req.method === "OPTIONS") {
      // Cache preflight for 24 hours to reduce repeated OPTIONS roundtrips
      res.setHeader("Access-Control-Max-Age", "86400");
      res.status(204).end();
      return;
    }

    next();
  });

  // Additional CORS config if provided
  if (state.config.cors) {
    state.app.use(cors(state.config.cors) as RequestHandler);
  }
}


// =============================================================================
// Rate Limiting
// =============================================================================

/**
 * Set up per-IP sliding-window rate limiting using express-rate-limit
 */
export function setupRateLimiting(state: HttpTransportState): void {
  if (!state.app) return;

  const windowMs = DEFAULT_RATE_LIMIT_WINDOW_MS;
  const parsedMax = process.env["MCP_RATE_LIMIT_MAX"]
    ? parseInt(process.env["MCP_RATE_LIMIT_MAX"], 10)
    : DEFAULT_RATE_LIMIT_MAX;
  // L-4: Clamp max requests to a safe range (1 to 10000)
  const maxRequests = Math.max(1, Math.min(parsedMax, 10000));
  const trustProxy = state.config.trustProxy ?? false;

  // M-4: Warning: The default express-rate-limit in-memory store is per-process.
  // In multi-instance deployments behind a load balancer, each instance maintains 
  // independent counters. For production clusters, use a shared store.

  const limiter = rateLimit({
    windowMs,
    max: maxRequests,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => getClientIp(req, trustProxy),
    skip: (req) => req.path === "/health",
    handler: (_req, res, _next, options) => {
      res.status(options.statusCode).json({
        error: "Too Many Requests",
      });
    },
  });

  state.app.use(limiter);
}
