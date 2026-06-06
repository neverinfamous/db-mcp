import * as path from "node:path";
import type { SqliteAdapter } from "../../../sqlite-adapter.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../../types/index.js";
import { adminFs } from "../../../../../utils/annotations.js";
import {
  formatHandlerError,
  ExtensionNotAvailableError,
} from "../../../../../utils/errors/index.js";
import { isModuleAvailable, isCsvModuleAvailable } from "../analysis.js";
import { AnalyzeCsvSchemaSchema } from "../../../schemas/virtual.js";
import { AnalyzeCsvSchemaOutputSchema } from "../../../schemas/virtual.js";
import {
  validateSameDirPath,
  assertSafeIoPath,
} from "../../../../../utils/index.js";
import { getAuthContext } from "../../../../../auth/auth-context.js";

export function createAnalyzeCsvSchemaTool(
  adapter: SqliteAdapter,
): ToolDefinition {
  return {
    name: "sqlite_analyze_csv_schema",
    description:
      "Analyze a CSV file structure and infer column types. Uses a temporary virtual table.",
    group: "admin",
    inputSchema: AnalyzeCsvSchemaSchema,
    outputSchema: AnalyzeCsvSchemaOutputSchema,
    requiredScopes: ["admin"],
    annotations: adminFs("Analyze CSV Schema"),
    handler: async (params: unknown, _context: RequestContext) => {
      // Enforce admin scope at handler level for defense-in-depth against Code Mode bypass
      const authCtx = getAuthContext();
      if (authCtx?.authenticated) {
        const scopes = authCtx.scopes;
        if (
          Array.isArray(scopes) &&
          !scopes.includes("admin") &&
          !scopes.includes("full")
        ) {
          return {
            success: false,
            error:
              "Admin scope is required for CSV analysis (modifies schema and reads filesystem)",
            code: "AUTHORIZATION_ERROR",
            category: "authorization",
            hasHeader: false,
            rowCount: 0,
            columns: [],
          };
        }
      }

      let input;

      try {
        input = AnalyzeCsvSchemaSchema.parse(params);
      } catch (error: unknown) {
        return {
          ...formatHandlerError(error),
          hasHeader: false,
          rowCount: 0,
          columns: [],
        };
      }

      if (!path.isAbsolute(input.filePath)) {
        return {
          success: false,
          error: `Relative path not supported. Please use an absolute path. Example: ${path.resolve(input.filePath)}`,
          code: "VALIDATION_ERROR",
          category: "validation",
          hasHeader: false,
          rowCount: 0,
          columns: [],
        };
      }

      const allowedIoRoots = adapter.getAllowedIoRoots();

      if (allowedIoRoots !== undefined) {
        try {
          assertSafeIoPath(input.filePath, allowedIoRoots, false);
        } catch (error: unknown) {
          return {
            success: false,
            error: error instanceof Error ? error.message : "Security error",
            code: "SECURITY_ERROR",
            category: "security",
            hasHeader: false,
            rowCount: 0,
            columns: [],
          };
        }
      } else {
        const validation = validateSameDirPath(
          input.filePath,
          adapter.getConfiguredPath(),
        );
        if (!validation.valid) {
          return {
            success: false,
            error: validation.error || "Path validation failed",
            code: "SECURITY_ERROR",
            category: "security",
            hasHeader: false,
            rowCount: 0,
            columns: [],
          };
        }
      }

      const tempName = `_csv_analyze_${Date.now()}`;

      try {
        const { available: csvAvailable } = await isCsvModuleAvailable(adapter);
        if (!csvAvailable) {
          const isWasm = !(await isModuleAvailable(adapter, "rtree"));
          throw new ExtensionNotAvailableError("csv", {
            suggestion: isWasm
              ? "CSV extension not available in WASM mode. Use native SQLite with the csv extension."
              : "CSV extension not available. Load the csv/xsv extension using --csv flag or set CSV_EXTENSION_PATH.",
            details: { wasmLimitation: isWasm },
          });
        }

        const options = [`filename='${input.filePath.replace(/'/g, "''")}'`];
        if (input.delimiter !== ",") {
          options.push(`delimiter='${input.delimiter.replace(/'/g, "''")}'`);
        }

        await adapter.executeWriteQuery(
          `CREATE VIRTUAL TABLE "${tempName}" USING csv(${options.join(", ")})`,
        );

        const colResult = await adapter.executeReadQuery(
          `PRAGMA table_info("${tempName}")`,
        );
        const columnNames = (colResult.rows ?? []).map((row) => {
          const name = row["name"];
          const cid = row["cid"];
          if (typeof name === "string") return name;
          return `col${typeof cid === "number" ? cid : 0}`;
        });

        const sampleResult = await adapter.executeReadQuery(
          `SELECT * FROM "${tempName}" LIMIT ${input.sampleRows}`,
        );

        const columns = columnNames.map((name) => {
          let nullCount = 0;
          let intCount = 0;
          let floatCount = 0;
          const samples: string[] = [];

          for (const row of sampleResult.rows ?? []) {
            const val = row[name];
            const strVal =
              typeof val === "string" ? val : JSON.stringify(val ?? "");

            if (val === null || strVal === "") {
              nullCount++;
            } else {
              if (samples.length < 3) samples.push(strVal);
              if (/^-?\d+$/.test(strVal)) intCount++;
              else if (/^-?\d+\.\d+$/.test(strVal)) floatCount++;
            }
          }

          const total = (sampleResult.rows?.length ?? 0) - nullCount;
          let inferredType = "TEXT";
          if (total > 0) {
            if (intCount === total) inferredType = "INTEGER";
            else if (floatCount === total || intCount + floatCount === total)
              inferredType = "REAL";
          }

          return { name, inferredType, nullCount, sampleValues: samples };
        });

        const countResult = await adapter.executeReadQuery(
          `SELECT COUNT(*) as cnt FROM "${tempName}"`,
        );
        const rowCount =
          typeof countResult.rows?.[0]?.["cnt"] === "number"
            ? countResult.rows[0]["cnt"]
            : 0;

        return {
          success: true,
          hasHeader: true,
          rowCount,
          columns,
        };
      } catch (error: unknown) {
        return {
          ...formatHandlerError(error),
          hasHeader: false,
          rowCount: 0,
          columns: [],
        };
      } finally {
        try {
          await adapter.executeWriteQuery(`DROP TABLE IF EXISTS "${tempName}"`);
        } catch {
          /* ignore */
        }
      }
    },
  };
}
