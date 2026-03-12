import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/cli.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  treeshake: true,
  splitting: false,
  sourcemap: false,
  minify: false,
  outDir: "dist",
  target: "es2022",
  external: ["sql.js", "better-sqlite3"],
});
