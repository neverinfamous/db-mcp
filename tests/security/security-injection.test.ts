/**
 * Security Injection Tests
 *
 * Tests for SQL injection prevention in db-mcp.
 * Validates WHERE clause validation and identifier sanitization utilities.
 */

import { describe, it, expect } from "vitest";
import {
  validateWhereClause,
  sanitizeWhereClause,
  UnsafeWhereClauseError,
  validateIdentifier,
  InvalidIdentifierError,
  sanitizeIdentifier,
  sanitizeTableName,
  sanitizeColumnRef,
  quoteIdentifier,
} from "../../src/utils/index.js";

describe("Security: WHERE Clause Validation", () => {
  describe("validateWhereClause", () => {
    describe("valid clauses", () => {
      it("should allow simple conditions", () => {
        expect(() => validateWhereClause("id = 1")).not.toThrow();
        expect(() => validateWhereClause("name = 'Alice'")).not.toThrow();
        expect(() => validateWhereClause("status = 'active'")).not.toThrow();
      });

      it("should allow compound conditions", () => {
        expect(() =>
          validateWhereClause("id > 0 AND status = 'active'"),
        ).not.toThrow();
        expect(() =>
          validateWhereClause("name LIKE '%test%' OR email IS NOT NULL"),
        ).not.toThrow();
      });

      it("should allow BETWEEN clauses", () => {
        expect(() =>
          validateWhereClause(
            "created_at BETWEEN '2024-01-01' AND '2024-12-31'",
          ),
        ).not.toThrow();
      });

      it("should allow IN clauses", () => {
        expect(() => validateWhereClause("status IN ('active', 'pending')")).not
          .toThrow;
      });

      it("should allow NULL checks", () => {
        expect(() => validateWhereClause("deleted_at IS NULL")).not.toThrow();
        expect(() =>
          validateWhereClause("deleted_at IS NOT NULL"),
        ).not.toThrow();
      });

      it("should allow subqueries for legitimate use", () => {
        expect(() =>
          validateWhereClause("id IN (SELECT user_id FROM orders)"),
        ).not.toThrow();
      });
    });

    describe("SQL injection prevention - Command Injection", () => {
      it("should reject DROP statements", () => {
        expect(() => validateWhereClause("1=1; DROP TABLE users;")).toThrow(
          UnsafeWhereClauseError,
        );
        expect(() => validateWhereClause("id = 1; DROP DATABASE")).toThrow(
          UnsafeWhereClauseError,
        );
      });

      it("should reject DELETE statements", () => {
        expect(() => validateWhereClause("1=1; DELETE FROM users;")).toThrow(
          UnsafeWhereClauseError,
        );
      });

      it("should reject INSERT statements", () => {
        expect(() =>
          validateWhereClause("1=1; INSERT INTO users VALUES (1);"),
        ).toThrow(UnsafeWhereClauseError);
      });

      it("should reject UPDATE statements", () => {
        expect(() =>
          validateWhereClause("1=1; UPDATE users SET admin = 1;"),
        ).toThrow(UnsafeWhereClauseError);
      });

      it("should reject CREATE statements", () => {
        expect(() =>
          validateWhereClause("1=1; CREATE TABLE exploit (data TEXT);"),
        ).toThrow(UnsafeWhereClauseError);
      });

      it("should reject ALTER statements", () => {
        expect(() =>
          validateWhereClause("1=1; ALTER TABLE users ADD COLUMN pwned TEXT;"),
        ).toThrow(UnsafeWhereClauseError);
      });

      it("should reject TRUNCATE statements", () => {
        expect(() => validateWhereClause("1=1; TRUNCATE TABLE users;")).toThrow(
          UnsafeWhereClauseError,
        );
      });

      it("should reject EXEC/EXECUTE statements (PostgreSQL/SQL Server specific - may not apply to SQLite)", () => {
        // Note: EXEC is not in SQLite blocklist since it's database-specific
        // The semicolon-based stacked query detection handles this
        expect(() =>
          validateWhereClause("1=1; EXEC xp_cmdshell; DROP TABLE"),
        ).toThrow(UnsafeWhereClauseError);
      });
    });

    describe("SQL injection prevention - SQLite-Specific Attacks", () => {
      it("should reject ATTACH DATABASE attacks", () => {
        expect(() =>
          validateWhereClause("1=1; ATTACH DATABASE '/tmp/pwned.db' AS pwned"),
        ).toThrow(UnsafeWhereClauseError);
      });

      it("should reject load_extension attacks", () => {
        expect(() =>
          validateWhereClause("id = load_extension('/tmp/exploit.so')"),
        ).toThrow(UnsafeWhereClauseError);
      });

      it("should reject PRAGMA injections", () => {
        expect(() => validateWhereClause("1=1; PRAGMA database_list")).toThrow(
          UnsafeWhereClauseError,
        );
        expect(() =>
          validateWhereClause("1=1; PRAGMA writable_schema = ON"),
        ).toThrow(UnsafeWhereClauseError);
      });

      it("should reject fileio function attacks", () => {
        expect(() =>
          validateWhereClause("id = readfile('/etc/passwd')"),
        ).toThrow(UnsafeWhereClauseError);
        expect(() =>
          validateWhereClause("id = writefile('/tmp/exploit', 'data')"),
        ).toThrow(UnsafeWhereClauseError);
      });

      it("should reject hex string binary injections", () => {
        expect(() => validateWhereClause("data = X'DEADBEEF'")).toThrow(
          UnsafeWhereClauseError,
        );
      });
    });

    describe("SQL injection prevention - Comment Injection", () => {
      it("should reject SQL comments (double dash)", () => {
        expect(() => validateWhereClause("id = 1 -- comment")).toThrow(
          UnsafeWhereClauseError,
        );
      });

      it("should reject SQL comments (block)", () => {
        expect(() => validateWhereClause("id = 1 /* comment */")).toThrow(
          UnsafeWhereClauseError,
        );
      });
    });

    describe("SQL injection prevention - Stacked Queries", () => {
      it("should reject stacked queries with DROP", () => {
        expect(() => validateWhereClause("id = 1; DROP TABLE users")).toThrow(
          UnsafeWhereClauseError,
        );
      });

      it("should reject stacked queries with INSERT", () => {
        expect(() =>
          validateWhereClause("id = 1; INSERT INTO users VALUES (1)"),
        ).toThrow(UnsafeWhereClauseError);
      });

      it("should reject stacked queries with DELETE", () => {
        expect(() => validateWhereClause("id = 1; DELETE FROM users")).toThrow(
          UnsafeWhereClauseError,
        );
      });
    });

    describe("SQL injection prevention - UNION-based Attacks", () => {
      it("should reject UNION SELECT attacks", () => {
        expect(() =>
          validateWhereClause("1=0 UNION SELECT username, password FROM users"),
        ).toThrow(UnsafeWhereClauseError);
      });

      it("should reject UNION ALL attacks", () => {
        expect(() =>
          validateWhereClause("1=0 UNION ALL SELECT * FROM secrets"),
        ).toThrow(UnsafeWhereClauseError);
      });
    });

    describe("edge cases", () => {
      it("should throw for empty strings (security measure)", () => {
        expect(() => validateWhereClause("")).toThrow(UnsafeWhereClauseError);
      });

      it("should allow whitespace-only strings (filtered elsewhere)", () => {
        // Whitespace-only is allowed - validation focuses on dangerous patterns
        expect(() => validateWhereClause("   ")).not.toThrow();
      });
      it("should be case-insensitive for dangerous patterns", () => {
        expect(() => validateWhereClause("1=1; drop TABLE users;")).toThrow(
          UnsafeWhereClauseError,
        );
        expect(() => validateWhereClause("1=1; DROP table Users;")).toThrow(
          UnsafeWhereClauseError,
        );
      });
    });
  });

  describe("sanitizeWhereClause", () => {
    it("should return the same clause if safe", () => {
      expect(sanitizeWhereClause("id = 1")).toBe("id = 1");
      expect(sanitizeWhereClause("status = 'active'")).toBe(
        "status = 'active'",
      );
    });

    it("should preserve complex safe clauses", () => {
      const clause = "id > 0 AND status = 'active' OR name LIKE '%test%'";
      expect(sanitizeWhereClause(clause)).toBe(clause);
    });

    it("should throw for dangerous clauses", () => {
      expect(() => sanitizeWhereClause("1=1; DROP TABLE users;")).toThrow(
        UnsafeWhereClauseError,
      );
      expect(() => sanitizeWhereClause("id = 1 -- comment")).toThrow(
        UnsafeWhereClauseError,
      );
    });

    it("should throw for empty string", () => {
      expect(() => sanitizeWhereClause("")).toThrow(UnsafeWhereClauseError);
    });
  });
});

describe("Security: Identifier Validation", () => {
  describe("validateIdentifier", () => {
    describe("valid identifiers", () => {
      it("should allow simple identifiers", () => {
        expect(() => validateIdentifier("users")).not.toThrow();
        expect(() => validateIdentifier("user_data")).not.toThrow();
        expect(() => validateIdentifier("_private")).not.toThrow();
      });

      it("should allow identifiers with numbers", () => {
        expect(() => validateIdentifier("table1")).not.toThrow();
        expect(() => validateIdentifier("user_2024")).not.toThrow();
      });

      it("should allow uppercase identifiers", () => {
        expect(() => validateIdentifier("USERS")).not.toThrow();
        expect(() => validateIdentifier("User_Data")).not.toThrow();
      });
    });

    describe("invalid identifiers", () => {
      it("should reject identifiers starting with numbers", () => {
        expect(() => validateIdentifier("1users")).toThrow(
          InvalidIdentifierError,
        );
        expect(() => validateIdentifier("123table")).toThrow(
          InvalidIdentifierError,
        );
      });

      it("should reject identifiers with special characters", () => {
        expect(() => validateIdentifier("user-data")).toThrow(
          InvalidIdentifierError,
        );
        expect(() => validateIdentifier("user.data")).toThrow(
          InvalidIdentifierError,
        );
        expect(() => validateIdentifier("user@data")).toThrow(
          InvalidIdentifierError,
        );
      });

      it("should reject empty identifiers", () => {
        expect(() => validateIdentifier("")).toThrow(InvalidIdentifierError);
      });

      it("should reject whitespace-only identifiers", () => {
        expect(() => validateIdentifier("   ")).toThrow(InvalidIdentifierError);
      });

      it("should allow long identifiers (SQLite has no practical limit)", () => {
        const longName = "a".repeat(129);
        // SQLite doesn't enforce a strict limit like PostgreSQL
        expect(() => validateIdentifier(longName)).not.toThrow();
      });
      it("should reject SQL injection attempts in identifiers", () => {
        expect(() => validateIdentifier("users; DROP TABLE--")).toThrow(
          InvalidIdentifierError,
        );
        expect(() => validateIdentifier("users' OR '1'='1")).toThrow(
          InvalidIdentifierError,
        );
      });
    });
  });

  describe("sanitizeIdentifier", () => {
    it("should return quoted identifiers", () => {
      expect(sanitizeIdentifier("users")).toBe('"users"');
      expect(sanitizeIdentifier("user_data")).toBe('"user_data"');
    });
    it("should throw for invalid identifiers", () => {
      expect(() => sanitizeIdentifier("1users")).toThrow(
        InvalidIdentifierError,
      );
    });
  });

  describe("sanitizeTableName", () => {
    it("should sanitize simple table names", () => {
      expect(sanitizeTableName("users")).toBe('"users"');
    });

    it("should throw for dotted names (not supported in this implementation)", () => {
      // The utility requires pre-split identifiers
      expect(() => sanitizeTableName("main.users")).toThrow();
    });
    it("should throw for invalid table names", () => {
      expect(() => sanitizeTableName("users; DROP TABLE--")).toThrow();
    });
  });

  describe("sanitizeColumnRef", () => {
    it("should sanitize simple column names", () => {
      expect(sanitizeColumnRef("id")).toBe('"id"');
    });

    it("should throw for dotted names (not supported in this implementation)", () => {
      // The utility requires pre-split identifiers
      expect(() => sanitizeColumnRef("users.id")).toThrow();
    });
  });

  describe("quoteIdentifier", () => {
    it("should quote identifiers with double quotes", () => {
      expect(quoteIdentifier("users")).toBe('"users"');
    });

    it("should throw for identifiers with embedded special characters", () => {
      // quoteIdentifier validates pattern first
      expect(() => quoteIdentifier('my"table')).toThrow(InvalidIdentifierError);
    });
  });
});
