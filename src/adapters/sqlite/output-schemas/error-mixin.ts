/**
 * Error Fields Mixin
 *
 * Re-exports ErrorResponseFields from the canonical location as ErrorFieldsMixin.
 * This keeps backward compatibility for output-schema files that import from here.
 *
 * Single source of truth: src/utils/errors/error-response-fields.ts
 */

export { ErrorResponseFields as ErrorFieldsMixin } from "../../../utils/errors/error-response-fields.js";
