/**
 * HTTP Transport Middleware
 *
 * Security headers, CORS configuration, and rate limiting.
 * These are standalone functions that operate on HttpTransportState.
 */

import cors from "cors";
import type { Request, Response, RequestHandler } from "express";
import {
  DEFAULT_RATE_LIMIT_WINDOW_MS,
  DEFAULT_RATE_LIMIT_MAX,
  type HttpTransportState,
} from "./types.js";

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
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains",
    );
    next();
  });
}

// =============================================================================
// CORS
// =============================================================================

/**
 * Configure CORS with configurable origins
 */
export function setupCors(state: HttpTransportState): void {
  if (!state.app) return;

  const corsOrigins = state.config.corsOrigins ?? ["*"];
  const isWildcard = corsOrigins.includes("*");

  // CORS middleware
  state.app.use((req: Request, res: Response, next: () => void) => {
    const origin = req.headers.origin;

    // Set Access-Control-Allow-Origin
    if (isWildcard) {
      res.setHeader("Access-Control-Allow-Origin", "*");
    } else if (origin && corsOrigins.includes(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
      // Only set credentials for explicit origins (not wildcard)
      res.setHeader("Access-Control-Allow-Credentials", "true");
    }

    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET, POST, DELETE, OPTIONS",
    );
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
 * Set up per-IP sliding-window rate limiting
 */
export function setupRateLimiting(state: HttpTransportState): void {
  if (!state.app) return;

  const windowMs = DEFAULT_RATE_LIMIT_WINDOW_MS;
  const maxRequests = process.env["MCP_RATE_LIMIT_MAX"]
    ? parseInt(process.env["MCP_RATE_LIMIT_MAX"], 10)
    : DEFAULT_RATE_LIMIT_MAX;

  // Periodic cleanup of expired entries
  state.rateLimitCleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [ip, entry] of state.rateLimitMap) {
      if (now >= entry.resetAt) {
        state.rateLimitMap.delete(ip);
      }
    }
  }, windowMs);
  // Don't block process exit
  state.rateLimitCleanupTimer.unref();

  state.app.use((req: Request, res: Response, next: () => void) => {
    // Skip rate limiting for health checks
    if (req.path === "/health") {
      next();
      return;
    }

    const ip = req.ip ?? req.socket.remoteAddress ?? "unknown";
    const now = Date.now();
    let entry = state.rateLimitMap.get(ip);

    if (!entry || now >= entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs };
      state.rateLimitMap.set(ip, entry);
    }

    entry.count++;

    if (entry.count > maxRequests) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      res.setHeader("Retry-After", String(retryAfter));
      res.status(429).json({
        error: "Too Many Requests",
        retryAfter,
      });
      return;
    }

    next();
  });
}
