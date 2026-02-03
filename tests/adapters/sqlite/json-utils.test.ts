/**
 * JSON Utilities Tests
 *
 * Tests for SQLite JSON normalization and JSONB support utilities.
 * Target: 43% → 80%+ coverage
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  normalizeJson,
  isJsonbSupportedVersion,
  isJsonbSupported,
  setJsonbSupported,
  toJsonbSql,
  toJsonSql,
  getJsonFunction,
  detectJsonStorageFormat,
  parseJsonValue,
  isValidJsonPath,
  isValidJson,
  DEFAULT_NORMALIZATION_OPTIONS,
} from "../../../src/adapters/sqlite/json-utils.js";

describe("JSON Utilities", () => {
  describe("normalizeJson", () => {
    it("should return input unchanged if not valid JSON string", () => {
      const result = normalizeJson("not valid json");
      expect(result.wasModified).toBe(false);
      expect(result.changes).toContain("Input is not valid JSON");
      expect(result.normalized).toBe("not valid json");
    });

    it("should parse and normalize JSON string", () => {
      const result = normalizeJson('{"b":2,"a":1}');
      expect(result.normalized).toBe('{"a":1,"b":2}');
      expect(result.wasModified).toBe(true);
    });

    it("should normalize object values directly", () => {
      const result = normalizeJson({ b: 2, a: 1 });
      expect(result.normalized).toBe('{"a":1,"b":2}');
    });

    it("should handle null values", () => {
      const result = normalizeJson({ key: null });
      expect(result.normalized).toBe('{"key":null}');
    });

    it("should handle undefined values", () => {
      const result = normalizeJson({ key: undefined });
      expect(result.normalized).toBe('{"key":null}');
    });

    it("should sort keys alphabetically when sortKeys is true", () => {
      const result = normalizeJson({ z: 1, a: 2, m: 3 }, { sortKeys: true });
      expect(result.normalized).toBe('{"a":2,"m":3,"z":1}');
    });

    it("should not sort keys when sortKeys is false", () => {
      const result = normalizeJson({ z: 1, a: 2 }, { sortKeys: false });
      // Keys in original order
      const parsed = JSON.parse(result.normalized);
      expect(Object.keys(parsed)).toEqual(["z", "a"]);
    });

    it("should apply Unicode normalization when enabled", () => {
      // café with combining character vs precomposed
      const combining = "cafe\u0301"; // e + combining acute
      const precomposed = "café"; // precomposed

      const result = normalizeJson(
        { name: combining },
        { unicodeNormalize: true },
      );
      const parsed = JSON.parse(result.normalized);
      expect(parsed.name).toBe(precomposed);
      expect(result.changes).toContainEqual(
        expect.stringContaining("Unicode normalized"),
      );
    });

    it("should coerce string 'true' to boolean when typeCoercion is true", () => {
      const result = normalizeJson({ active: "true" }, { typeCoercion: true });
      const parsed = JSON.parse(result.normalized);
      expect(parsed.active).toBe(true);
      expect(result.changes).toContainEqual(expect.stringContaining("Coerced"));
    });

    it("should coerce string 'false' to boolean when typeCoercion is true", () => {
      const result = normalizeJson({ active: "FALSE" }, { typeCoercion: true });
      const parsed = JSON.parse(result.normalized);
      expect(parsed.active).toBe(false);
    });

    it("should coerce numeric strings when typeCoercion is true", () => {
      const result = normalizeJson({ count: "42" }, { typeCoercion: true });
      const parsed = JSON.parse(result.normalized);
      expect(parsed.count).toBe(42);
    });

    it("should not coerce empty strings to numbers", () => {
      const result = normalizeJson({ empty: "  " }, { typeCoercion: true });
      const parsed = JSON.parse(result.normalized);
      expect(parsed.empty).toBe("  ");
    });

    it("should normalize nested arrays", () => {
      const result = normalizeJson({ items: [{ b: 2, a: 1 }] });
      expect(result.normalized).toBe('{"items":[{"a":1,"b":2}]}');
    });

    it("should handle number and boolean values unchanged", () => {
      const result = normalizeJson({ num: 42, bool: true });
      const parsed = JSON.parse(result.normalized);
      expect(parsed.num).toBe(42);
      expect(parsed.bool).toBe(true);
    });

    it("should format with indentation when compact is false", () => {
      const result = normalizeJson({ a: 1 }, { compact: false });
      expect(result.normalized).toContain("\n");
      expect(result.normalized).toContain("  ");
    });

    it("should use default options", () => {
      expect(DEFAULT_NORMALIZATION_OPTIONS.sortKeys).toBe(true);
      expect(DEFAULT_NORMALIZATION_OPTIONS.compact).toBe(true);
      expect(DEFAULT_NORMALIZATION_OPTIONS.unicodeNormalize).toBe(true);
      expect(DEFAULT_NORMALIZATION_OPTIONS.typeCoercion).toBe(false);
    });
  });

  describe("JSONB Support Detection", () => {
    afterEach(() => {
      // Reset cache
      setJsonbSupported(false);
    });

    it("should detect SQLite 3.45.0 as JSONB supported", () => {
      expect(isJsonbSupportedVersion("3.45.0")).toBe(true);
    });

    it("should detect SQLite 3.45.1 as JSONB supported", () => {
      expect(isJsonbSupportedVersion("3.45.1")).toBe(true);
    });

    it("should detect SQLite 3.46.0 as JSONB supported", () => {
      expect(isJsonbSupportedVersion("3.46.0")).toBe(true);
    });

    it("should detect SQLite 4.0.0 as JSONB supported", () => {
      expect(isJsonbSupportedVersion("4.0.0")).toBe(true);
    });

    it("should detect SQLite 3.44.0 as JSONB not supported", () => {
      expect(isJsonbSupportedVersion("3.44.0")).toBe(false);
    });

    it("should detect SQLite 3.44.9 as JSONB not supported", () => {
      expect(isJsonbSupportedVersion("3.44.9")).toBe(false);
    });

    it("should return false for invalid version string", () => {
      expect(isJsonbSupportedVersion("invalid")).toBe(false);
    });

    it("should return false for empty string", () => {
      expect(isJsonbSupportedVersion("")).toBe(false);
    });

    it("should set and get JSONB support status", () => {
      expect(isJsonbSupported()).toBe(false);
      setJsonbSupported(true);
      expect(isJsonbSupported()).toBe(true);
    });
  });

  describe("SQL Generation", () => {
    it("should generate jsonb() SQL wrapper", () => {
      const sql = toJsonbSql('{"key":"value"}');
      expect(sql).toBe('jsonb(\'{"key":"value"}\')');
    });

    it("should escape single quotes in jsonb SQL", () => {
      const sql = toJsonbSql('{"name":"O\'Brien"}');
      expect(sql).toBe("jsonb('{\"name\":\"O''Brien\"}')");
    });

    it("should generate json() SQL wrapper", () => {
      const sql = toJsonSql('{"key":"value"}');
      expect(sql).toBe('json(\'{"key":"value"}\')');
    });

    it("should escape single quotes in json SQL", () => {
      const sql = toJsonSql('{"name":"O\'Brien"}');
      expect(sql).toBe("json('{\"name\":\"O''Brien\"}')");
    });
  });

  describe("getJsonFunction", () => {
    afterEach(() => {
      setJsonbSupported(false);
    });

    it("should return base function name when useJsonb is false", () => {
      setJsonbSupported(true);
      expect(getJsonFunction("json_extract", false)).toBe("json_extract");
    });

    it("should return base function name when JSONB not supported", () => {
      setJsonbSupported(false);
      expect(getJsonFunction("json_extract", true)).toBe("json_extract");
    });

    it("should return jsonb function when JSONB supported and useJsonb is true", () => {
      setJsonbSupported(true);
      expect(getJsonFunction("json_extract", true)).toBe("jsonb_extract");
    });

    it("should replace json_ prefix with jsonb_ for set function", () => {
      setJsonbSupported(true);
      expect(getJsonFunction("json_set", true)).toBe("jsonb_set");
    });
  });

  describe("detectJsonStorageFormat", () => {
    it("should detect Buffer as jsonb format", () => {
      const buffer = Buffer.from([0x01, 0x02, 0x03]);
      expect(detectJsonStorageFormat(buffer)).toBe("jsonb");
    });

    it("should detect Uint8Array as jsonb format", () => {
      const arr = new Uint8Array([0x01, 0x02, 0x03]);
      expect(detectJsonStorageFormat(arr)).toBe("jsonb");
    });

    it("should detect string as text format", () => {
      expect(detectJsonStorageFormat('{"key":"value"}')).toBe("text");
    });

    it("should return unknown for number", () => {
      expect(detectJsonStorageFormat(42)).toBe("unknown");
    });

    it("should return unknown for null", () => {
      expect(detectJsonStorageFormat(null)).toBe("unknown");
    });

    it("should return unknown for object", () => {
      expect(detectJsonStorageFormat({ key: "value" })).toBe("unknown");
    });
  });

  describe("parseJsonValue", () => {
    it("should return null for null input", () => {
      expect(parseJsonValue(null)).toBeNull();
    });

    it("should return null for undefined input", () => {
      expect(parseJsonValue(undefined)).toBeNull();
    });

    it("should return object as-is if already parsed", () => {
      const obj = { key: "value" };
      expect(parseJsonValue(obj)).toBe(obj);
    });

    it("should return array as-is if already parsed", () => {
      const arr = [1, 2, 3];
      expect(parseJsonValue(arr)).toBe(arr);
    });

    it("should parse JSON string", () => {
      const result = parseJsonValue('{"key":"value"}');
      expect(result).toEqual({ key: "value" });
    });

    it("should return string as-is if not valid JSON", () => {
      const result = parseJsonValue("not json");
      expect(result).toBe("not json");
    });

    it("should throw error for Buffer input", () => {
      const buffer = Buffer.from([0x01, 0x02]);
      expect(() => parseJsonValue(buffer)).toThrow(
        "JSONB blob cannot be parsed directly",
      );
    });

    it("should return Uint8Array as-is (object check passes before Buffer check)", () => {
      const arr = new Uint8Array([0x01, 0x02]);
      // Note: Current implementation treats Uint8Array as object, not throwing
      // This is because typeof Uint8Array === 'object' and it's not instanceof Buffer
      const result = parseJsonValue(arr);
      expect(result).toBe(arr);
    });

    it("should return number as-is", () => {
      expect(parseJsonValue(42)).toBe(42);
    });

    it("should return boolean as-is", () => {
      expect(parseJsonValue(true)).toBe(true);
      expect(parseJsonValue(false)).toBe(false);
    });
  });

  describe("isValidJsonPath", () => {
    it("should accept root path $", () => {
      expect(isValidJsonPath("$")).toBe(true);
    });

    it("should accept simple dot notation", () => {
      expect(isValidJsonPath("$.foo")).toBe(true);
    });

    it("should accept nested dot notation", () => {
      expect(isValidJsonPath("$.foo.bar")).toBe(true);
    });

    it("should accept array index notation", () => {
      expect(isValidJsonPath("$.items[0]")).toBe(true);
    });

    it("should accept mixed notation", () => {
      expect(isValidJsonPath("$.items[0].name")).toBe(true);
    });

    it("should accept underscore in property names", () => {
      expect(isValidJsonPath("$.user_name")).toBe(true);
    });

    it("should reject path not starting with $", () => {
      expect(isValidJsonPath("foo.bar")).toBe(false);
    });

    it("should reject path starting with number in property", () => {
      expect(isValidJsonPath("$.123abc")).toBe(false);
    });

    it("should reject path with special characters", () => {
      expect(isValidJsonPath("$.foo-bar")).toBe(false);
    });
  });

  describe("isValidJson", () => {
    it("should return true for valid JSON object", () => {
      expect(isValidJson('{"key":"value"}')).toBe(true);
    });

    it("should return true for valid JSON array", () => {
      expect(isValidJson("[1,2,3]")).toBe(true);
    });

    it("should return true for JSON string", () => {
      expect(isValidJson('"hello"')).toBe(true);
    });

    it("should return true for JSON number", () => {
      expect(isValidJson("42")).toBe(true);
    });

    it("should return true for JSON boolean", () => {
      expect(isValidJson("true")).toBe(true);
    });

    it("should return true for JSON null", () => {
      expect(isValidJson("null")).toBe(true);
    });

    it("should return false for invalid JSON", () => {
      expect(isValidJson("not json")).toBe(false);
    });

    it("should return false for empty string", () => {
      expect(isValidJson("")).toBe(false);
    });

    it("should return false for unquoted string", () => {
      expect(isValidJson("hello")).toBe(false);
    });
  });
});
