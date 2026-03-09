/**
 * Icon Utilities Tests
 *
 * Tests for tool group icon mapping.
 */

import { describe, it, expect } from "vitest";
import { getToolGroupIcon, SERVER_ICONS } from "../../src/utils/icons.js";

describe("Icon Utilities", () => {
  describe("getToolGroupIcon", () => {
    const KNOWN_GROUPS = [
      "core",
      "json",
      "text",
      "stats",
      "vector",
      "admin",
      "geo",
      "codemode",
    ] as const;

    it.each(KNOWN_GROUPS)(
      "should return valid icons for '%s' group",
      (group) => {
        const icons = getToolGroupIcon(group);

        expect(icons).toBeDefined();
        expect(Array.isArray(icons)).toBe(true);
        expect(icons!.length).toBeGreaterThan(0);

        for (const icon of icons!) {
          expect(icon.src).toMatch(/^https:\/\/cdn\.jsdelivr\.net/);
          expect(icon.src).toMatch(/\.svg$/);
          expect(icon.mimeType).toBe("image/svg+xml");
        }
      },
    );

    it("should return undefined for unknown groups", () => {
      expect(getToolGroupIcon("nonexistent")).toBeUndefined();
      expect(getToolGroupIcon("")).toBeUndefined();
    });

    it("should return distinct icons for different groups", () => {
      const coreSrc = getToolGroupIcon("core")![0].src;
      const jsonSrc = getToolGroupIcon("json")![0].src;
      const adminSrc = getToolGroupIcon("admin")![0].src;

      expect(coreSrc).not.toBe(jsonSrc);
      expect(coreSrc).not.toBe(adminSrc);
      expect(jsonSrc).not.toBe(adminSrc);
    });
  });

  describe("SERVER_ICONS", () => {
    it("should be a valid icon array", () => {
      expect(Array.isArray(SERVER_ICONS)).toBe(true);
      expect(SERVER_ICONS.length).toBeGreaterThan(0);
      expect(SERVER_ICONS[0].src).toMatch(/server\.svg$/);
      expect(SERVER_ICONS[0].mimeType).toBe("image/svg+xml");
    });
  });
});
