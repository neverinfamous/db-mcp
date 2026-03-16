/**
 * E2E Tests: Help Resources
 *
 * Validates the sqlite://help resource system that agents use
 * for on-demand tool reference documentation.
 *
 * Tests:
 * - sqlite://help (root gotchas + code mode + WASM vs native)
 * - sqlite://help/{group} for all 8 tool groups
 * - Content structure and non-empty responses
 *
 * The test servers run with --tool-filter +all, so all 9 help
 * resources should be registered.
 */

import { test, expect } from "@playwright/test";
import { createClient, getBaseURL } from "./helpers.js";

test.describe.configure({ mode: "serial" });

const HELP_GROUPS = [
  "json",
  "text",
  "stats",
  "vector",
  "geo",
  "admin",
  "introspection",
  "migration",
];

test.describe("Help Resources", () => {
  test("sqlite://help is listed in resources", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const list = await client.listResources();
      const uris = list.resources.map((r) => r.uri);
      expect(uris).toContain("sqlite://help");
    } finally {
      await client.close();
    }
  });

  test("all 8 group help resources are listed", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const list = await client.listResources();
      const uris = list.resources.map((r) => r.uri);
      for (const group of HELP_GROUPS) {
        expect(uris, `Missing sqlite://help/${group}`).toContain(
          `sqlite://help/${group}`,
        );
      }
    } finally {
      await client.close();
    }
  });

  test("sqlite://help returns non-empty markdown", async ({}, testInfo) => {
    const client = await createClient(getBaseURL(testInfo));
    try {
      const response = await client.readResource({ uri: "sqlite://help" });

      expect(response.contents).toBeDefined();
      expect(response.contents.length).toBe(1);
      expect(response.contents[0].uri).toBe("sqlite://help");
      expect(response.contents[0].mimeType).toBe("text/markdown");

      const text = response.contents[0].text as string;
      expect(text.length).toBeGreaterThan(100);
    } finally {
      await client.close();
    }
  });

  for (const group of HELP_GROUPS) {
    test(`sqlite://help/${group} returns non-empty markdown`, async ({}, testInfo) => {
      const client = await createClient(getBaseURL(testInfo));
      try {
        const response = await client.readResource({
          uri: `sqlite://help/${group}`,
        });

        expect(response.contents).toBeDefined();
        expect(response.contents.length).toBe(1);
        expect(response.contents[0].uri).toBe(`sqlite://help/${group}`);
        expect(response.contents[0].mimeType).toBe("text/markdown");

        const text = response.contents[0].text as string;
        expect(text.length, `${group} help content too short`).toBeGreaterThan(50);
      } finally {
        await client.close();
      }
    });
  }
});
