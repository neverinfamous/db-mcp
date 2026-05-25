/**
 * db-mcp - Code Mode Sandbox
 *
 * Sandboxed execution environment using isolated-vm.
 * Provides true V8 isolate separation for maximum security.
 */

import type ivm from "isolated-vm";
import { randomUUID } from "node:crypto";
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

    const effectiveTimeout = timeoutMs ?? this.options.timeoutMs;
    let ivmLib: typeof ivm;
    try {
      ivmLib = (await import("isolated-vm")).default;
    } catch {
      return {
        success: false,
        error: "isolated-vm is not installed or failed to load. Set CODEMODE_ISOLATION=worker.",
        metrics: { wallTimeMs: 0, cpuTimeMs: 0, memoryUsedMb: 0 },
      };
    }

    const isolate = new ivmLib.Isolate({ memoryLimit: 128 });
    const context = isolate.createContextSync();
    const jail = context.global;
    jail.setSync("global", jail.derefInto());

    const logs: string[] = [];
    const logRef = new ivmLib.Reference((level: string, ...args: unknown[]) => {
      const msg = args.map(a => typeof a === "object" && a !== null ? JSON.stringify(a) : String(a)).join(" ");
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

    // Inject apiBindings
    const refCleanup: ivm.Reference<unknown>[] = [];
    for (const [groupName, groupValue] of Object.entries(apiBindings)) {
      if (typeof groupValue === "object" && groupValue !== null) {
        context.evalSync(`globalThis.sqlite['${groupName}'] = {};`);
        for (const [methodName, methodFn] of Object.entries(groupValue)) {
          if (typeof methodFn === "function") {
            const fnRef = new ivmLib.Reference(async (...args: unknown[]) => {
              try {
                return await (methodFn as (...args: unknown[]) => Promise<unknown>)(...args);
              } catch (e) {
                throw new Error(e instanceof Error ? e.message : String(e), { cause: e });
              }
            });
            refCleanup.push(fnRef);
            const refName = `fnRef_${groupName}_${methodName}`;
            context.global.setSync(refName, fnRef);
            context.evalSync(`
              globalThis.sqlite['${groupName}']['${methodName}'] = async (...args) => {
                return await globalThis['${refName}'].apply(undefined, args, { arguments: { copy: true }, result: { promise: true, copy: true } });
              };
            `);
          }
        }
      } else if (typeof groupValue === "function") {
        const fnRef = new ivmLib.Reference(async (...args: unknown[]) => {
          try {
            return await (groupValue as (...args: unknown[]) => Promise<unknown>)(...args);
          } catch (e) {
            throw new Error(e instanceof Error ? e.message : String(e), { cause: e });
          }
        });
        refCleanup.push(fnRef);
        const refName = `fnRef_${groupName}`;
        context.global.setSync(refName, fnRef);
        context.evalSync(`
          globalThis.sqlite['${groupName}'] = async (...args) => {
            return await globalThis['${refName}'].apply(undefined, args, { arguments: { copy: true }, result: { promise: true, copy: true } });
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
      const script = isolate.compileScriptSync(wrappedCode, { filename: `user-code-${randomUUID()}.js` });
      result = await script.run(context, { timeout: effectiveTimeout, promise: true, copy: true });
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
        memoryUsedMb: 0 // ivm doesn't easily expose this per run
      }
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

  constructor(poolOptions?: PoolOptions, sandboxOptions?: SandboxOptions) {
    this.options = { ...DEFAULT_POOL_OPTIONS, ...poolOptions };
    this.sandboxOptions = { ...DEFAULT_SANDBOX_OPTIONS, ...sandboxOptions };
  }

  initialize(): void {
    // isolated-vm isolates are fast to create, no need to aggressively pre-warm
  }

  async execute(
    code: string,
    apiBindings: Record<string, unknown>,
    timeoutMs?: number,
  ): Promise<SandboxResult> {
    if (this.inUseCount >= this.options.maxInstances) {
      throw new Error(`Sandbox pool exhausted (max ${this.options.maxInstances})`);
    }

    this.inUseCount++;
    const sandbox = CodeModeSandbox.create(this.sandboxOptions);
    try {
      return await sandbox.execute(code, apiBindings, timeoutMs);
    } finally {
      sandbox.dispose();
      this.inUseCount--;
    }
  }

  cleanup(): void {
    // No-op for isolate pool
  }

  getStats(): { available: number; inUse: number; max: number } {
    // "Available" in the context of an isolate pool is how many more we can spawn
    return { 
      available: Math.max(0, this.options.maxInstances - this.inUseCount), 
      inUse: this.inUseCount, 
      max: this.options.maxInstances 
    };
  }

  dispose(): void {
    // No-op for isolate pool
  }
}
