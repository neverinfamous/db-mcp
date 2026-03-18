/**
 * Payload Contract Tests: Text Group
 *
 * Validates response shapes for representative text tools:
 * fuzzy_match, regex_match, text_validate, phonetic_match, advanced_search.
 */

import { test, expect } from "@playwright/test";
import {
  createClient,
  getBaseURL,
  callToolAndParse,
  expectSuccess,
} from "./helpers.js";

test.describe.configure({ mode: "serial" });

test.describe("Payload Contracts: Text", () => {
  test("sqlite_fuzzy_match returns { success, matchCount, tokenized, matches[] }", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_fuzzy_match", {
        table: "test_products",
        column: "name",
        search: "Laptop",
        maxDistance: 3,
      });

      expectSuccess(payload);
      expect(typeof payload.matchCount).toBe("number");
      expect(typeof payload.tokenized).toBe("boolean");
      expect(Array.isArray(payload.matches)).toBe(true);

      if ((payload.matchCount as number) > 0) {
        const match = (payload.matches as Record<string, unknown>[])[0];
        expect(match).toHaveProperty("value");
        expect(match).toHaveProperty("distance");
        expect(typeof match.distance).toBe("number");
      }
    } finally {
      await client.close();
    }
  });

  test("sqlite_regex_match returns { success, matches[], count }", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_regex_match", {
        table: "test_users",
        column: "email",
        pattern: "@example\\.com$",
      });

      expectSuccess(payload);
      expect(typeof payload.rowCount).toBe("number");
      expect(Array.isArray(payload.matches)).toBe(true);
      expect(payload.rowCount as number).toBeGreaterThan(0);
    } finally {
      await client.close();
    }
  });

  test("sqlite_text_validate returns { success, totalRows, validCount, invalidCount }", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_text_validate", {
        table: "test_users",
        column: "email",
        pattern: "email",
      });

      expectSuccess(payload);
      expect(typeof payload.totalRows).toBe("number");
      expect(typeof payload.validCount).toBe("number");
      expect(typeof payload.invalidCount).toBe("number");
      expect(Array.isArray(payload.invalidRows)).toBe(true);

      // Most emails in test_users should be valid
      expect(payload.validCount as number).toBeGreaterThan(0);
    } finally {
      await client.close();
    }
  });

  test("sqlite_phonetic_match returns { success, searchCode, matchCount, matches[] }", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_phonetic_match", {
        table: "test_users",
        column: "username",
        search: "john",
      });

      expectSuccess(payload);
      expect(typeof payload.matchCount).toBe("number");
      expect(typeof payload.searchCode).toBe("string");
      expect(Array.isArray(payload.matches)).toBe(true);
    } finally {
      await client.close();
    }
  });

  test("sqlite_advanced_search returns { success, matchCount, matches[] }", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_advanced_search", {
        table: "test_products",
        column: "name",
        searchTerm: "Mouse",
      });

      expectSuccess(payload);
      expect(typeof payload.matchCount).toBe("number");
      expect(Array.isArray(payload.matches)).toBe(true);
    } finally {
      await client.close();
    }
  });

  test("sqlite_regex_extract returns { success, rowCount, matches[] }", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_regex_extract", {
        table: "test_users",
        column: "email",
        pattern: "(@.+)$",
      });

      expectSuccess(payload);
      expect(typeof payload.rowCount).toBe("number");
      expect(Array.isArray(payload.matches)).toBe(true);

      if ((payload.rowCount as number) > 0) {
        const m = (payload.matches as Record<string, unknown>[])[0];
        expect(m).toHaveProperty("extracted");
      }
    } finally {
      await client.close();
    }
  });

  test("sqlite_text_split returns { success, rowCount, rows[] }", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_text_split", {
        table: "test_users",
        column: "email",
        delimiter: "@",
      });

      expectSuccess(payload);
      expect(typeof payload.rowCount).toBe("number");
      expect(Array.isArray(payload.rows)).toBe(true);

      if ((payload.rowCount as number) > 0) {
        const r = (payload.rows as Record<string, unknown>[])[0];
        expect(r).toHaveProperty("parts");
        expect(Array.isArray(r.parts)).toBe(true);
      }
    } finally {
      await client.close();
    }
  });

  test("sqlite_text_concat returns { success, rowCount, values[] }", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_text_concat", {
        table: "test_users",
        columns: ["username", "email"],
        separator: " - ",
      });

      expectSuccess(payload);
      expect(typeof payload.rowCount).toBe("number");
      expect(Array.isArray(payload.values)).toBe(true);
    } finally {
      await client.close();
    }
  });

  test("sqlite_text_trim returns { success, rowCount, results[] }", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_text_trim", {
        table: "test_users",
        column: "username",
      });

      expectSuccess(payload);
      expect(typeof payload.rowCount).toBe("number");
      expect(Array.isArray(payload.results)).toBe(true);
    } finally {
      await client.close();
    }
  });

  test("sqlite_text_case returns { success, rowCount, results[] }", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_text_case", {
        table: "test_users",
        column: "username",
        mode: "upper",
      });

      expectSuccess(payload);
      expect(typeof payload.rowCount).toBe("number");
      expect(Array.isArray(payload.results)).toBe(true);
    } finally {
      await client.close();
    }
  });

  test("sqlite_text_substring returns { success, rowCount, results[] }", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_text_substring", {
        table: "test_users",
        column: "email",
        start: 1,
        length: 5,
      });

      expectSuccess(payload);
      expect(typeof payload.rowCount).toBe("number");
      expect(Array.isArray(payload.results)).toBe(true);
    } finally {
      await client.close();
    }
  });

  test("sqlite_text_normalize returns { success, rowCount, rows[] }", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const payload = await callToolAndParse(client, "sqlite_text_normalize", {
        table: "test_users",
        column: "username",
        mode: "nfc",
      });

      expectSuccess(payload);
      expect(typeof payload.rowCount).toBe("number");
      expect(Array.isArray(payload.rows)).toBe(true);

      if ((payload.rowCount as number) > 0) {
        const r = (payload.rows as Record<string, unknown>[])[0];
        expect(r).toHaveProperty("original");
        expect(r).toHaveProperty("normalized");
      }
    } finally {
      await client.close();
    }
  });
});
