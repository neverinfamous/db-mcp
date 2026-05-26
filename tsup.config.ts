import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    cli: "src/cli.ts",
  },
  format: ["esm"],
  dts: false,
  clean: true,
  treeshake: true,
  splitting: true,
  sourcemap: false,
  minify: false,
  outDir: "dist",
  target: "es2022",
  external: ["sql.js", "better-sqlite3", "sqlite-parser", "acorn", "isolated-vm"],
  tsconfig: "tsconfig.build.json",
});
