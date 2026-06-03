import { describe, it, expect } from "vitest";
import { sanitizeFtsQuery } from "../../../../../src/adapters/sqlite/tools/text/helpers.js";

describe("Text Helpers", () => {
  describe("sanitizeFtsQuery", () => {
    it("should return empty string for empty input", () => {
      expect(sanitizeFtsQuery("")).toBe("");
      expect(sanitizeFtsQuery("   ")).toBe("");
    });

    it("should strip unbalanced double quotes", () => {
      expect(sanitizeFtsQuery('"hello')).toBe("hello");
      expect(sanitizeFtsQuery('hello"')).toBe("hello");
      expect(sanitizeFtsQuery('"hello" world"')).toBe("hello world");
    });

    it("should preserve balanced double quotes", () => {
      expect(sanitizeFtsQuery('"hello world"')).toBe('"hello world"');
      expect(sanitizeFtsQuery('"hello" "world"')).toBe('"hello" "world"');
    });

    it("should normalize whitespace", () => {
      expect(sanitizeFtsQuery("hello   world")).toBe("hello world");
      expect(sanitizeFtsQuery("  hello \t world \n")).toBe("hello world");
    });

    it("should remove stray operators at start and end", () => {
      expect(sanitizeFtsQuery("AND hello")).toBe("hello");
      expect(sanitizeFtsQuery("OR hello")).toBe("hello");
      expect(sanitizeFtsQuery("NOT hello")).toBe("hello");
      expect(sanitizeFtsQuery("hello AND")).toBe("hello");
      expect(sanitizeFtsQuery("hello OR")).toBe("hello");
      expect(sanitizeFtsQuery("hello NOT")).toBe("hello");
      expect(sanitizeFtsQuery("AND hello OR")).toBe("hello");
    });

    it("should replace consecutive operators with AND", () => {
      expect(sanitizeFtsQuery("hello AND OR world")).toBe("hello AND world");
      expect(sanitizeFtsQuery("hello OR NOT world")).toBe("hello AND world");
      // The improved regex now correctly reduces 3+ consecutive operators down to a single AND.
      expect(sanitizeFtsQuery("hello NOT AND OR world")).toBe(
        "hello AND world",
      );
    });

    it("should combine all fixes correctly", () => {
      // Balanced quotes are kept. Stray AND / NOT are removed.
      expect(
        sanitizeFtsQuery('  AND "balanced   hello AND OR world"  NOT '),
      ).toBe('"balanced hello AND world"');
    });
  });
});
