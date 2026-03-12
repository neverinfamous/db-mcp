import type { TokenClaims } from "../types.js";

declare module "express-serve-static-core" {
  interface Request {
    /** Authenticated user claims */
    auth?: TokenClaims;
    /** Raw access token */
    accessToken?: string;
    /** Request ID for tracing */
    requestId?: string;
  }
}
