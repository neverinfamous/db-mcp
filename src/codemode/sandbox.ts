/**
 * db-mcp - Code Mode Sandbox
 *
 * Sandboxed execution environment using Node.js vm module.
 * Provides code isolation with memory/time limits for LLM-generated code.
 *
 * Note: This uses Node.js vm module which provides script isolation but not
 * a full security boundary. For enhanced isolation, use worker mode.
 */

import vm from "node:vm";
import { DbMcpError } from "../utils/errors/base.js";
import { ErrorCategory } from "../utils/errors/categories.js";
import {
  DEFAULT_SANDBOX_OPTIONS,
  DEFAULT_POOL_OPTIONS,
  type SandboxOptions,
  type PoolOptions,
  type SandboxResult,
  type ExecutionMetrics,
} from "./types.js";

/**
 * A sandboxed execution context using Node.js vm module
 */
export class CodeModeSandbox {
  private context: vm.Context;
  private readonly options: Required<SandboxOptions>;
  private disposed = false;
  private readonly logBuffer: string[] = [];

  private constructor(context: vm.Context, options: Required<SandboxOptions>) {
    this.context = context;
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

    const logBuffer: string[] = [];

    // Create a restricted global scope
    const sandbox: Record<string, unknown> = {
      console: {
        log(...args: unknown[]): void {
          logBuffer.push(
            args
              .map((a) => (typeof a === "string" ? a : JSON.stringify(a)))
              .join(" "),
          );
        },
        warn(...args: unknown[]): void {
          logBuffer.push(
            `[WARN] ${args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" ")}`,
          );
        },
        error(...args: unknown[]): void {
          logBuffer.push(
            `[ERROR] ${args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" ")}`,
          );
        },
        info(...args: unknown[]): void {
          logBuffer.push(
            `[INFO] ${args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" ")}`,
          );
        },
      },
      // Safe built-ins
      JSON,
      Math,
      Date,
      Array,
      Object,
      String,
      Number,
      Boolean,
      RegExp,
      Map,
      Set,
      WeakMap,
      WeakSet,
      Promise,
      Symbol,
      Error,
      TypeError,
      RangeError,
      SyntaxError,
      ReferenceError,
      URIError,
      parseInt,
      parseFloat,
      isNaN,
      isFinite,
      encodeURI,
      encodeURIComponent,
      decodeURI,
      decodeURIComponent,
      // Blocked globals
      setTimeout: undefined,
      setInterval: undefined,
      setImmediate: undefined,
      process: undefined,
      require: undefined,
      __dirname: undefined,
      __filename: undefined,
      globalThis: undefined,
      global: undefined,
    };

    const context = vm.createContext(sandbox, {
      name: "codemode-sandbox",
    });

    const instance = new CodeModeSandbox(context, opts);
    // Share logBuffer reference
    instance.logBuffer.length = 0;
    Object.defineProperty(instance, "logBuffer", {
      value: logBuffer,
      writable: false,
    });

    return instance;
  }

  /**
   * Execute code in the sandbox
   * @param code - TypeScript/JavaScript code to execute
   * @param apiBindings - Object with sqlite.* API methods to expose
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

    const startTime = performance.now();
    const startMemory = process.memoryUsage().heapUsed;
    const effectiveTimeout = timeoutMs ?? this.options.timeoutMs;

    try {
      // Inject API bindings into context
      this.context["sqlite"] = apiBindings;

      // Wrap in async IIFE for top-level await
      const wrappedCode = `(async () => { ${code} })()`;

      const script = new vm.Script(wrappedCode, {
        filename: "user-code.js",
      });

      const result: unknown = await (script.runInContext(this.context, {
        timeout: effectiveTimeout,
        displayErrors: true,
      }) as Promise<unknown>);

      const endTime = performance.now();
      const endMemory = process.memoryUsage().heapUsed;

      return {
        success: true,
        result,
        metrics: this.calculateMetrics(
          startTime,
          endTime,
          startMemory,
          endMemory,
        ),
      };
    } catch (error) {
      const endTime = performance.now();
      const endMemory = process.memoryUsage().heapUsed;

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        metrics: this.calculateMetrics(
          startTime,
          endTime,
          startMemory,
          endMemory,
        ),
      };
    }
  }

  /**
   * Calculate execution metrics
   */
  private calculateMetrics(
    startTime: number,
    endTime: number,
    startMemory: number,
    endMemory: number,
  ): ExecutionMetrics {
    return {
      wallTimeMs: Math.round(endTime - startTime),
      cpuTimeMs: Math.round(endTime - startTime), // Approximate
      memoryUsedMb: Math.max(
        0,
        Math.round(((endMemory - startMemory) / 1024 / 1024) * 100) / 100,
      ),
    };
  }

  /**
   * Get console output from the sandbox
   */
  getConsoleOutput(): string[] {
    return [...this.logBuffer];
  }

  /**
   * Clear console output buffer
   */
  clearConsoleOutput(): void {
    this.logBuffer.length = 0;
  }

  /**
   * Check if sandbox is healthy
   */
  isHealthy(): boolean {
    return !this.disposed;
  }

  /**
   * Dispose of the sandbox and release resources
   */
  dispose(): void {
    this.disposed = true;
    this.logBuffer.length = 0;
    // Clear context references
    this.context = vm.createContext({});
  }
}

/**
 * Pool of sandbox instances for reuse
 */
export class SandboxPool {
  private readonly options: Required<PoolOptions>;
  private readonly sandboxOptions: Required<SandboxOptions>;
  private readonly available: CodeModeSandbox[] = [];
  private readonly inUse = new Set<CodeModeSandbox>();

  constructor(poolOptions?: PoolOptions, sandboxOptions?: SandboxOptions) {
    this.options = { ...DEFAULT_POOL_OPTIONS, ...poolOptions };
    this.sandboxOptions = { ...DEFAULT_SANDBOX_OPTIONS, ...sandboxOptions };
  }

  /**
   * Initialize the pool with minimum instances
   */
  initialize(): void {
    while (this.available.length < this.options.minInstances) {
      try {
        const sandbox = CodeModeSandbox.create(this.sandboxOptions);
        this.available.push(sandbox);
      } catch {
        // Pre-warming failed; sandboxes will be created on demand
        break;
      }
    }
  }

  /**
   * Acquire a sandbox from the pool
   */
  private acquire(): CodeModeSandbox {
    // Try to get an available sandbox
    while (this.available.length > 0) {
      const sandbox = this.available.pop();
      if (sandbox?.isHealthy()) {
        this.inUse.add(sandbox);
        return sandbox;
      }
      // Dispose unhealthy sandboxes
      sandbox?.dispose();
    }

    // Create a new one if under max
    if (this.inUse.size < this.options.maxInstances) {
      const sandbox = CodeModeSandbox.create(this.sandboxOptions);
      this.inUse.add(sandbox);
      return sandbox;
    }

    throw new DbMcpError(
      "Sandbox pool exhausted",
      "CODEMODE_POOL_EXHAUSTED",
      ErrorCategory.RESOURCE
    );
  }

  /**
   * Release a sandbox back to the pool
   */
  private release(sandbox: CodeModeSandbox): void {
    this.inUse.delete(sandbox);

    if (
      sandbox.isHealthy() &&
      this.available.length < this.options.maxInstances
    ) {
      sandbox.clearConsoleOutput();
      this.available.push(sandbox);
    } else {
      sandbox.dispose();
    }
  }

  async execute(
    code: string,
    apiBindings: Record<string, unknown>,
    timeoutMs?: number,
  ): Promise<SandboxResult> {
    const sandbox = this.acquire();
    try {
      return await sandbox.execute(code, apiBindings, timeoutMs);
    } finally {
      this.release(sandbox);
    }
  }

  /**
   * Clean up excess idle sandboxes
   */
  cleanup(): void {
    while (this.available.length > this.options.minInstances) {
      const sandbox = this.available.pop();
      sandbox?.dispose();
    }
  }

  /**
   * Get pool statistics
   */
  getStats(): { available: number; inUse: number; max: number } {
    return {
      available: this.available.length,
      inUse: this.inUse.size,
      max: this.options.maxInstances,
    };
  }

  /**
   * Dispose of all sandboxes in the pool
   */
  dispose(): void {
    for (const sandbox of this.available) {
      sandbox.dispose();
    }
    this.available.length = 0;

    for (const sandbox of this.inUse) {
      sandbox.dispose();
    }
    this.inUse.clear();
  }
}
