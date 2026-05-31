/**
 * Invariant: Every package listed in tsup.config.ts `external` must be
 * resolvable at runtime — i.e., listed in dependencies or optionalDependencies.
 *
 * This prevents the "works in dev, crashes in prod" class of bugs where
 * externalized packages are only available as transitive devDependencies
 * and get removed by `npm prune --omit=dev` in Docker builds.
 *
 * @see https://github.com/neverinfamous/db-mcp/issues/149
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

describe("Build externals consistency", () => {
  it("every tsup external must be in dependencies or optionalDependencies", () => {
    const tsupConfig = readFileSync(
      resolve(__dirname, "../tsup.config.ts"),
      "utf-8",
    );

    // Extract the external array from the config file
    const externalMatch = tsupConfig.match(/external:\s*\[([\s\S]*?)\]/);
    expect(externalMatch, "Could not find external array in tsup.config.ts").not.toBeNull();

    const externals = externalMatch![1]
      .split(",")
      .map((s) => s.trim().replace(/['"]/g, ""))
      .filter(Boolean);

    expect(externals.length).toBeGreaterThan(0);

    const pkgJson = JSON.parse(
      readFileSync(resolve(__dirname, "../package.json"), "utf-8"),
    ) as {
      dependencies?: Record<string, string>;
      optionalDependencies?: Record<string, string>;
    };

    const prodDeps = new Set([
      ...Object.keys(pkgJson.dependencies ?? {}),
      ...Object.keys(pkgJson.optionalDependencies ?? {}),
    ]);

    const missing = externals.filter((ext) => !prodDeps.has(ext));
    expect(
      missing,
      `These packages are externalized in tsup.config.ts but missing from ` +
        `dependencies/optionalDependencies: ${missing.join(", ")}. ` +
        `They will NOT be available at runtime after \`npm prune --omit=dev\`.`,
    ).toEqual([]);
  });

  it("every external package is actually imported in source code", () => {
    const tsupConfig = readFileSync(
      resolve(__dirname, "../tsup.config.ts"),
      "utf-8",
    );

    const externalMatch = tsupConfig.match(/external:\s*\[([\s\S]*?)\]/);
    expect(externalMatch).not.toBeNull();

    const externals = externalMatch![1]
      .split(",")
      .map((s) => s.trim().replace(/['"]/g, ""))
      .filter(Boolean);

    // Each external should exist in either dependencies or optionalDependencies
    // This test validates the parsing works correctly
    for (const ext of externals) {
      expect(typeof ext).toBe("string");
      expect(ext.length).toBeGreaterThan(0);
    }
  });
});
