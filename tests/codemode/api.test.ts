/**
 * Code Mode API Tests
 *
 * Tests for the POSITIONAL_PARAM_MAP and toolNameToMethodName
 * in the code mode sandbox API.
 */

import { describe, it, expect } from "vitest";
import { toolNameToMethodName } from "../../src/codemode/api.js";

describe("Code Mode API", () => {
  describe("toolNameToMethodName", () => {
    it("should convert core tool names", () => {
      expect(toolNameToMethodName("sqlite_read_query", "core")).toBe(
        "readQuery",
      );
      expect(toolNameToMethodName("sqlite_list_tables", "core")).toBe(
        "listTables",
      );
      expect(toolNameToMethodName("sqlite_describe_table", "core")).toBe(
        "describeTable",
      );
    });

    it("should convert json tool names", () => {
      expect(toolNameToMethodName("sqlite_json_extract", "json")).toBe(
        "extract",
      );
      expect(toolNameToMethodName("sqlite_json_valid", "json")).toBe("valid");
      expect(toolNameToMethodName("sqlite_json_pretty", "json")).toBe("pretty");
      expect(toolNameToMethodName("sqlite_json_validate_path", "json")).toBe(
        "validatePath",
      );
      expect(toolNameToMethodName("sqlite_json_set", "json")).toBe("set");
      expect(toolNameToMethodName("sqlite_json_remove", "json")).toBe("remove");
      expect(toolNameToMethodName("sqlite_json_type", "json")).toBe("type");
      expect(toolNameToMethodName("sqlite_json_array_length", "json")).toBe(
        "arrayLength",
      );
      expect(toolNameToMethodName("sqlite_json_each", "json")).toBe("each");
      expect(toolNameToMethodName("sqlite_json_keys", "json")).toBe("keys");
      expect(toolNameToMethodName("sqlite_json_group_array", "json")).toBe(
        "groupArray",
      );
      expect(toolNameToMethodName("sqlite_json_group_object", "json")).toBe(
        "groupObject",
      );
      expect(toolNameToMethodName("sqlite_json_analyze_schema", "json")).toBe(
        "analyzeSchema",
      );
      expect(toolNameToMethodName("sqlite_json_merge", "json")).toBe("merge");
      expect(toolNameToMethodName("sqlite_json_insert", "json")).toBe("insert");
      expect(toolNameToMethodName("sqlite_json_update", "json")).toBe("update");
      expect(toolNameToMethodName("sqlite_json_select", "json")).toBe("select");
      expect(toolNameToMethodName("sqlite_json_query", "json")).toBe("query");
      expect(toolNameToMethodName("sqlite_json_storage_info", "json")).toBe(
        "storageInfo",
      );
      expect(toolNameToMethodName("sqlite_jsonb_convert", "json")).toBe(
        "jsonbConvert",
      );
      expect(toolNameToMethodName("sqlite_json_normalize_column", "json")).toBe(
        "normalizeColumn",
      );
    });

    it("should convert text tool names", () => {
      expect(toolNameToMethodName("sqlite_regex_match", "text")).toBe(
        "regexMatch",
      );
      expect(toolNameToMethodName("sqlite_fuzzy_match", "text")).toBe(
        "fuzzyMatch",
      );
    });

    it("should convert stats tool names (keeping prefix)", () => {
      expect(toolNameToMethodName("sqlite_stats_basic", "stats")).toBe(
        "statsBasic",
      );
      expect(toolNameToMethodName("sqlite_stats_histogram", "stats")).toBe(
        "statsHistogram",
      );
    });

    it("should convert vector tool names", () => {
      expect(toolNameToMethodName("sqlite_vector_search", "vector")).toBe(
        "search",
      );
      expect(toolNameToMethodName("sqlite_vector_store", "vector")).toBe(
        "store",
      );
    });

    it("should convert admin tool names (keeping prefix)", () => {
      expect(toolNameToMethodName("sqlite_vacuum", "admin")).toBe("vacuum");
      expect(toolNameToMethodName("sqlite_backup", "admin")).toBe("backup");
      expect(toolNameToMethodName("sqlite_integrity_check", "admin")).toBe(
        "integrityCheck",
      );
    });

    it("should convert geo tool names", () => {
      expect(toolNameToMethodName("sqlite_geo_distance", "geo")).toBe(
        "distance",
      );
      expect(toolNameToMethodName("sqlite_geo_nearby", "geo")).toBe("nearby");
    });
  });
});
