/**
 * db-mcp - Code Mode Sandbox
 *
 * Sandboxed execution environment using isolated-vm.
 * Provides true V8 isolate separation for maximum security.
 */

import type ivm from "isolated-vm";
import * as acorn from "acorn";
import {
  DEFAULT_SANDBOX_OPTIONS,
  DEFAULT_POOL_OPTIONS,
  type SandboxOptions,
  type PoolOptions,
  type SandboxResult,
} from "./types.js";
import { transformAutoReturn } from "./auto-return.js";

/**
 * A sandboxed execution context using isolated-vm
 */
export class CodeModeSandbox {
  private readonly options: Required<SandboxOptions>;
  private disposed = false;
  private accumulatedLogs: string[] = [];

  private constructor(options: Required<SandboxOptions>) {
    this.options = options;
  }

  /**
   * Create a new sandbox instance
   */
  static create(options?: SandboxOptions): CodeModeSandbox {
    const opts: Required<SandboxOptions> = {
      ...DEFAULT_SANDBOX_OPTIONS,
      ...options,
    };
    return new CodeModeSandbox(opts);
  }

  /**
   * Execute code in the sandbox
   */
  async execute(
    code: string,
    apiBindings: Record<string, unknown>,
    timeoutMs?: number,
  ): Promise<SandboxResult> {
    if (this.disposed) {
      return {
        success: false,
        error: "Sandbox has been disposed",
        metrics: { wallTimeMs: 0, cpuTimeMs: 0, memoryUsedMb: 0 },
      };
    }

    const groupNameRegex = /^[a-zA-Z0-9_]+$/;
    for (const groupName of Object.keys(apiBindings)) {
      if (
        !groupNameRegex.test(groupName) ||
        groupName === "__proto__" ||
        groupName === "constructor" ||
        groupName === "prototype"
      ) {
        return {
          success: false,
          error: `Security Error: Invalid tool group name '${groupName}'`,
          metrics: { wallTimeMs: 0, cpuTimeMs: 0, memoryUsedMb: 0 },
        };
      }
    }

    try {
      const wrappedCode = `async function __wrapper() { ${code} }`;
      const ast = acorn.parse(wrappedCode, {
        ecmaVersion: "latest",
        sourceType: "script",
      });
      const validateAst = (node: unknown): void => {
        if (node === null || node === undefined || typeof node !== "object")
          return;
        const n = node as Record<string, unknown>;
        if (n["type"] === "WithStatement") {
          throw new Error("'with' statements are forbidden in sandbox code.");
        }
        if (
          n["type"] === "MemberExpression" &&
          n["object"] !== null &&
          n["object"] !== undefined &&
          typeof n["object"] === "object" &&
          (n["object"] as Record<string, unknown>)["type"] === "Identifier"
        ) {
          const objName = (n["object"] as Record<string, unknown>)[
            "name"
          ] as string;
          if (
            ["process", "require", "global", "globalThis"].includes(objName)
          ) {
            throw new Error(`Access to '${objName}' is forbidden.`);
          }
        }
        for (const key in n) {
          if (key !== "loc" && key !== "start" && key !== "end") {
            validateAst(n[key]);
          }
        }
      };
      validateAst(ast);
    } catch (e: unknown) {
      return {
        success: false,
        error:
          "Code validation failed: " +
          (e instanceof Error ? e.message : String(e)),
        metrics: { wallTimeMs: 0, cpuTimeMs: 0, memoryUsedMb: 0 },
      };
    }

    const effectiveTimeout = timeoutMs ?? this.options.timeoutMs;
    let ivmLib: typeof ivm | null = null;
    try {
      await SandboxPool.initialize();
      ivmLib = SandboxPool.getIvmLib();
    } catch {
      // Fallback to node:vm if isolated-vm is broken/missing
    }

    if (!ivmLib) {
      const vm = await import("node:vm");
      const logs: string[] = [];
      interface SandboxEnv {
        console: {
          log: (...args: unknown[]) => void;
          error: (...args: unknown[]) => void;
          warn: (...args: unknown[]) => void;
          info: (...args: unknown[]) => void;
          debug: (...args: unknown[]) => void;
        };
        sqlite: Record<string, unknown>;
      }

      const sandboxEnv: SandboxEnv = {
        console: {
          log: (...args: unknown[]) => logs.push(args.map(String).join(" ")),
          error: (...args: unknown[]) =>
            logs.push("[ERROR] " + args.map(String).join(" ")),
          warn: (...args: unknown[]) =>
            logs.push("[WARN] " + args.map(String).join(" ")),
          info: (...args: unknown[]) =>
            logs.push("[INFO] " + args.map(String).join(" ")),
          debug: (...args: unknown[]) =>
            logs.push("[DEBUG] " + args.map(String).join(" ")),
        },
        sqlite: {},
      };

      for (const [groupName, groupValue] of Object.entries(apiBindings)) {
        if (typeof groupValue === "object" && groupValue !== null) {
          const groupMethods: Record<string, unknown> = {};
          sandboxEnv.sqlite[groupName] = groupMethods;
          for (const [methodName, methodFn] of Object.entries(groupValue)) {
            if (typeof methodFn === "function") {
              groupMethods[methodName] = methodFn;
            }
          }
        } else if (typeof groupValue === "function") {
          sandboxEnv.sqlite[groupName] = groupValue;
        }
      }

      const context = vm.createContext(sandboxEnv);
      const startTime = performance.now();
      let result: unknown;
      let success = true;
      let errorMsg: string | undefined;

      try {
        const wrappedCode = `(async () => { ${transformAutoReturn(code)} })()`;
        result = await vm.runInContext(wrappedCode, context, {
          timeout: effectiveTimeout,
        });
      } catch (error: unknown) {
        success = false;
        errorMsg = error instanceof Error ? error.message : String(error);
      }
      const endTime = performance.now();

      this.accumulatedLogs.push(...logs);

      return {
        success,
        ...(success ? { result } : { error: errorMsg }),
        logs,
        metrics: {
          wallTimeMs: Math.round(endTime - startTime),
          cpuTimeMs: Math.round(endTime - startTime),
          memoryUsedMb: 0,
        },
      };
    }

    const isolate = new ivmLib.Isolate({
      memoryLimit: this.options.memoryLimitMb,
    });
    const context = isolate.createContextSync();
    const jail = context.global;
    jail.setSync("global", jail.derefInto());

    const logs: string[] = [];
    const logRef = new ivmLib.Reference((level: string, ...args: unknown[]) => {
      const msg = args
        .map((a) =>
          typeof a === "object" && a !== null ? JSON.stringify(a) : String(a),
        )
        .join(" ");
      logs.push(level === "LOG" ? msg : `[${level}] ${msg}`);
    });

    context.global.setSync("logRef", logRef);
    const setupScript = `
      globalThis.console = {
        log: (...args) => logRef.applyIgnored(undefined, ['LOG', ...args], { arguments: { copy: true } }),
        error: (...args) => logRef.applyIgnored(undefined, ['ERROR', ...args], { arguments: { copy: true } }),
        warn: (...args) => logRef.applyIgnored(undefined, ['WARN', ...args], { arguments: { copy: true } }),
        info: (...args) => logRef.applyIgnored(undefined, ['INFO', ...args], { arguments: { copy: true } }),
        debug: (...args) => logRef.applyIgnored(undefined, ['DEBUG', ...args], { arguments: { copy: true } })
      };
      globalThis.sqlite = {};
    `;
    context.evalSync(setupScript);

    let rpcCount = 0;
    // Security (CWE-400): Limit host tool calls per execution to prevent
    // malicious code from flooding the host via rapid RPC requests.
    const MAX_RPC_CALLS = 100;

    // Inject apiBindings
    const refCleanup: ivm.Reference<unknown>[] = [];
    for (const [groupName, groupValue] of Object.entries(apiBindings)) {
      if (typeof groupValue === "object" && groupValue !== null) {
        context.evalSync(
          `globalThis.sqlite[${JSON.stringify(groupName)}] = {};`,
        );
        for (const [methodName, methodFn] of Object.entries(groupValue)) {
          if (typeof methodFn === "function") {
            const fnRef = new ivmLib.Reference(async (...args: unknown[]) => {
              if (++rpcCount > MAX_RPC_CALLS) {
                throw new Error(
                  `QuotaExceededError: Maximum number of host tool calls (${MAX_RPC_CALLS}) exceeded (attempted call ${rpcCount}).`,
                );
              }
              try {
                return await (
                  methodFn as (...args: unknown[]) => Promise<unknown>
                )(...args);
              } catch (e) {
                throw new Error(e instanceof Error ? e.message : String(e), {
                  cause: e,
                });
              }
            });
            refCleanup.push(fnRef);
            const refName = `fnRef_${groupName}_${methodName}`;
            context.global.setSync(refName, fnRef);
            context.evalSync(`
              globalThis.sqlite[${JSON.stringify(groupName)}][${JSON.stringify(methodName)}] = async (...args) => {
                return await globalThis[${JSON.stringify(refName)}].apply(undefined, args, { arguments: { copy: true }, result: { promise: true, copy: true } });
              };
            `);
          }
        }
      } else if (typeof groupValue === "function") {
        const fnRef = new ivmLib.Reference(async (...args: unknown[]) => {
          if (++rpcCount > MAX_RPC_CALLS) {
            throw new Error(
              `QuotaExceededError: Maximum number of host tool calls (${MAX_RPC_CALLS}) exceeded (attempted call ${rpcCount}).`,
            );
          }
          try {
            return await (
              groupValue as (...args: unknown[]) => Promise<unknown>
            )(...args);
          } catch (e) {
            throw new Error(e instanceof Error ? e.message : String(e), {
              cause: e,
            });
          }
        });
        refCleanup.push(fnRef);
        const refName = `fnRef_${groupName}`;
        context.global.setSync(refName, fnRef);
        context.evalSync(`
          globalThis.sqlite[${JSON.stringify(groupName)}] = async (...args) => {
            return await globalThis[${JSON.stringify(refName)}].apply(undefined, args, { arguments: { copy: true }, result: { promise: true, copy: true } });
          };
        `);
      }
    }

    const startTime = performance.now();
    let result: unknown;
    let success = true;
    let errorMsg: string | undefined;

    try {
      const wrappedCode = `(async () => { ${transformAutoReturn(code)} })()`;
      const script = isolate.compileScriptSync(wrappedCode, {
        filename: `code-mode.js`,
      });
      result = await script.run(context, {
        timeout: effectiveTimeout,
        promise: true,
        copy: true,
      });
    } catch (error: unknown) {
      success = false;
      errorMsg = error instanceof Error ? error.message : String(error);
    } finally {
      // Cleanup references and isolate
      for (const ref of refCleanup) {
        ref.release();
      }
      logRef.release();
      context.release();
      isolate.dispose();
    }

    const endTime = performance.now();

    this.accumulatedLogs.push(...logs);

    return {
      success,
      ...(success ? { result } : { error: errorMsg }),
      logs,
      metrics: {
        wallTimeMs: Math.round(endTime - startTime),
        cpuTimeMs: Math.round(endTime - startTime), // ivm doesn't easily expose this per run without cpuTime
        memoryUsedMb: 0, // ivm doesn't easily expose this per run
      },
    };
  }

  getConsoleOutput(): string[] {
    return [...this.accumulatedLogs];
  }

  clearConsoleOutput(): void {
    this.accumulatedLogs = [];
  }

  isHealthy(): boolean {
    return !this.disposed;
  }

  dispose(): void {
    this.disposed = true;
    this.accumulatedLogs = [];
  }
}

/**
 * Pool of sandbox instances for reuse
 */
export class SandboxPool {
  private readonly options: Required<PoolOptions>;
  private readonly sandboxOptions: Required<SandboxOptions>;
  private inUseCount = 0;
  private readonly idlePool: CodeModeSandbox[] = [];
  private static ivmPromise: Promise<typeof ivm> | null = null;
  private static cachedIvmLib: typeof ivm | null = null;

  constructor(poolOptions?: PoolOptions, sandboxOptions?: SandboxOptions) {
    this.options = { ...DEFAULT_POOL_OPTIONS, ...poolOptions };
    this.sandboxOptions = { ...DEFAULT_SANDBOX_OPTIONS, ...sandboxOptions };
  }

  static getIvmLib(): typeof ivm {
    if (!SandboxPool.cachedIvmLib) {
      throw new Error("ivmLib not initialized");
    }
    return SandboxPool.cachedIvmLib;
  }

  static async initialize(): Promise<void> {
    SandboxPool.ivmPromise ??= import("isolated-vm")
      .then((m) => m.default)
      .catch(() => null as unknown as typeof ivm);
    const lib = await SandboxPool.ivmPromise;
    if (lib !== null) {
      SandboxPool.cachedIvmLib = lib;
    }
  }

  async initialize(): Promise<void> {
    await SandboxPool.initialize();
  }

  async execute(
    code: string,
    apiBindings: Record<string, unknown>,
    timeoutMs?: number,
  ): Promise<SandboxResult> {
    if (!SandboxPool.cachedIvmLib) {
      await SandboxPool.initialize();
    }

    if (this.inUseCount >= this.options.maxInstances) {
      throw new Error(
        `Sandbox pool exhausted (max ${this.options.maxInstances})`,
      );
    }

    this.inUseCount++;
    let sandbox = this.idlePool.pop();

    if (sandbox === undefined) {
      sandbox = CodeModeSandbox.create(this.sandboxOptions);
    } else {
      sandbox.clearConsoleOutput();
    }

    try {
      return await sandbox.execute(code, apiBindings, timeoutMs);
    } finally {
      this.inUseCount--;
      if (this.idlePool.length < 4 && sandbox.isHealthy()) {
        this.idlePool.push(sandbox);
      } else {
        sandbox.dispose();
      }
    }
  }

  cleanup(): void {
    for (const sandbox of this.idlePool) {
      sandbox.dispose();
    }
    this.idlePool.length = 0;
  }

  getStats(): { available: number; inUse: number; max: number; idle: number } {
    return {
      available: Math.max(0, this.options.maxInstances - this.inUseCount),
      inUse: this.inUseCount,
      max: this.options.maxInstances,
      idle: this.idlePool.length,
    };
  }

  dispose(): void {
    this.cleanup();
  }
}
