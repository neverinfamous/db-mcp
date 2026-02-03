/**
 * InsightsManager Tests
 *
 * Tests for the business insights singleton manager.
 * Target: 22% → 90%+ coverage
 */

import { describe, it, expect, beforeEach } from "vitest";
import { insightsManager } from "../../src/utils/insightsManager.js";

describe("InsightsManager", () => {
    beforeEach(() => {
        // Clear insights before each test
        insightsManager.clear();
    });

    describe("append", () => {
        it("should append a valid insight", () => {
            insightsManager.append("Revenue increased 15% this quarter");
            expect(insightsManager.count()).toBe(1);
            expect(insightsManager.getAll()).toContain(
                "Revenue increased 15% this quarter",
            );
        });

        it("should trim whitespace from insights", () => {
            insightsManager.append("  Leading and trailing spaces  ");
            const insights = insightsManager.getAll();
            expect(insights[0]).toBe("Leading and trailing spaces");
        });

        it("should ignore empty strings", () => {
            insightsManager.append("");
            expect(insightsManager.count()).toBe(0);
        });

        it("should ignore whitespace-only strings", () => {
            insightsManager.append("   ");
            expect(insightsManager.count()).toBe(0);
        });

        it("should append multiple insights", () => {
            insightsManager.append("Insight 1");
            insightsManager.append("Insight 2");
            insightsManager.append("Insight 3");
            expect(insightsManager.count()).toBe(3);
        });
    });

    describe("getAll", () => {
        it("should return empty array when no insights", () => {
            expect(insightsManager.getAll()).toEqual([]);
        });

        it("should return copy of insights (not reference)", () => {
            insightsManager.append("Test insight");
            const insights1 = insightsManager.getAll();
            const insights2 = insightsManager.getAll();
            expect(insights1).not.toBe(insights2);
            expect(insights1).toEqual(insights2);
        });

        it("should preserve order of insights", () => {
            insightsManager.append("First");
            insightsManager.append("Second");
            insightsManager.append("Third");
            expect(insightsManager.getAll()).toEqual(["First", "Second", "Third"]);
        });
    });

    describe("count", () => {
        it("should return 0 for empty manager", () => {
            expect(insightsManager.count()).toBe(0);
        });

        it("should return correct count", () => {
            insightsManager.append("One");
            insightsManager.append("Two");
            expect(insightsManager.count()).toBe(2);
        });
    });

    describe("clear", () => {
        it("should remove all insights", () => {
            insightsManager.append("Insight 1");
            insightsManager.append("Insight 2");
            expect(insightsManager.count()).toBe(2);

            insightsManager.clear();
            expect(insightsManager.count()).toBe(0);
            expect(insightsManager.getAll()).toEqual([]);
        });

        it("should work on already empty manager", () => {
            insightsManager.clear();
            expect(insightsManager.count()).toBe(0);
        });
    });

    describe("synthesizeMemo", () => {
        it("should return default message when no insights", () => {
            const memo = insightsManager.synthesizeMemo();
            expect(memo).toBe("No business insights have been discovered yet.");
        });

        it("should format single insight without summary", () => {
            insightsManager.append("Customer retention improved by 20%");
            const memo = insightsManager.synthesizeMemo();

            expect(memo).toContain("📊 Business Intelligence Memo 📊");
            expect(memo).toContain("Key Insights Discovered:");
            expect(memo).toContain("- Customer retention improved by 20%");
            // Single insight should NOT have summary
            expect(memo).not.toContain("Summary:");
        });

        it("should include summary for multiple insights", () => {
            insightsManager.append("Revenue up 15%");
            insightsManager.append("Customer base grew 10%");
            const memo = insightsManager.synthesizeMemo();

            expect(memo).toContain("Summary:");
            expect(memo).toContain("2 key business insights");
        });

        it("should format all insights as bullet points", () => {
            insightsManager.append("Insight A");
            insightsManager.append("Insight B");
            insightsManager.append("Insight C");
            const memo = insightsManager.synthesizeMemo();

            expect(memo).toContain("- Insight A");
            expect(memo).toContain("- Insight B");
            expect(memo).toContain("- Insight C");
        });
    });
});
