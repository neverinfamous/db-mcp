import { ValidationError } from "../../../utils/errors/classes.js";

/**
 * Force redaction of SQL string literals to prevent secret exposure
 * in audit logs and backups, regardless of operator configuration.
 */
export function redactSqlLiterals(text: string): string {
  return text.replace(/'(?:''|[^'])*'/g, "'***'");
}

/**
 * Validate DDL to prevent execution of unauthorized or destructive statements
 * during restore operations from tampered backups.
 */
export function validateDdl(sql: string): void {
  const cleanSql = sql.replace(/\/\*[\s\S]*?\*\//g, "").replace(/--.*$/gm, "");
  const upperSql = cleanSql.toUpperCase();
  // Reject potentially destructive or unauthorized statements
  if (
    upperSql.includes("ATTACH ") ||
    upperSql.includes("DETACH ") ||
    upperSql.includes("PRAGMA ") ||
    upperSql.includes("LOAD_EXTENSION(")
  ) {
    throw new ValidationError(
      `DDL validation failed: unauthorized command or function call`,
    );
  }

  // Ensure triggers do not attempt to target other databases explicitly
  if (upperSql.includes(" ON MAIN.") || upperSql.includes(" ON TEMP.")) {
    throw new ValidationError(
      `DDL validation failed: trigger attempts to target a specific database`,
    );
  }
}

