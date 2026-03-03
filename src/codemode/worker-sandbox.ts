/**
 * db-mcp - Code Mode Worker Sandbox
 *
 * Enhanced sandboxed execution using worker_threads for process-level isolation.
 * Provides stronger isolation than vm module by running code in a separate thread
 * with isolated memory space.
 *
 * Architecture:
 * 1. Main thread creates a Worker with user code + serialized API bindings
 * 2. Worker creates a MessageChannel for RPC
 * 3. Worker builds proxy objects that forward calls over the RPC port
 * 4. Main thread listens for RPC requests and dispatches to actual tool handlers
 * 5. Results are sent back to the worker via the RPC port
 */

import { Worker, MessageChannel } from "node:worker_threads";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_SANDBOX_OPTIONS,
  DEFAULT_POOL_OPTIONS,
  type SandboxOptions,
  type PoolOptions,
  type SandboxResult,
  type ExecutionMetrics,
  type RpcRequest,
} from "./types.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const WORKER_SCRIPT_PATH = join(__dirname, "worker-script.js");

/**
 * A sandboxed execution context using worker_threads
 * Provides stronger isolation than vm module with separate V8 instance
 */
export class WorkerSandbox {
  private readonly options: Required<SandboxOptions>;
  private disposed = false;

  private constructor(options: Required<SandboxOptions>) {
    this.options = options;
  }

  /**
   * Create a new worker sandbox instance
   */
  static create(options?: SandboxOptions): WorkerSandbox {
    const opts: Required<SandboxOptions> = {
      ...DEFAULT_SANDBOX_OPTIONS,
      ...options,
    };
    return new WorkerSandbox(opts);
  }

  /**
   * Execute code in a worker thread
   * Each execution spawns a fresh worker for maximum isolation
   */
  async execute(
    code: string,
    apiBindings: Record<string, unknown>,
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

    return new Promise<SandboxResult>((resolve) => {
      let settled = false;
      let worker: Worker | null = null;
      let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

      const cleanup = (): void => {
        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
          timeoutHandle = null;
        }
        if (worker) {
          worker.removeAllListeners();
          void worker.terminate();
          worker = null;
        }
      };

      const respond = (result: SandboxResult): void => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(result);
      };

      try {
        // Create MessageChannel for RPC bridge
        const { port1: mainPort, port2: workerPort } = new MessageChannel();

        // Serialize API bindings for worker transfer
        const serializedBindings = this.serializeBindings(apiBindings);

        // Create worker
        worker = new Worker(WORKER_SCRIPT_PATH, {
          workerData: {
            code,
            apiBindings: serializedBindings,
            timeout: this.options.timeoutMs,
            rpcPort: workerPort,
          },
          transferList: [workerPort],
          resourceLimits: {
            maxOldGenerationSizeMb: this.options.memoryLimitMb,
          },
        });

        // Handle RPC requests from worker
        mainPort.on("message", (msg: RpcRequest) => {
          void (async () => {
            try {
              const { id, group, method, args } = msg;

              // Resolve the actual method from apiBindings
              let target: unknown;
              if (group === "_topLevel") {
                target = apiBindings[method];
              } else {
                const groupObj = apiBindings[group];
                if (
                  groupObj !== undefined &&
                  groupObj !== null &&
                  typeof groupObj === "object"
                ) {
                  target = (groupObj as Record<string, unknown>)[method];
                }
              }

              if (typeof target === "function") {
                const result = await (
                  target as (...a: unknown[]) => Promise<unknown>
                )(...args);
                mainPort.postMessage({ id, result });
              } else {
                mainPort.postMessage({
                  id,
                  error: `Method not found: ${group}.${method}`,
                });
              }
            } catch (err) {
              mainPort.postMessage({
                id: msg.id,
                error: err instanceof Error ? err.message : String(err),
              });
            }
          })();
        });

        // Handle worker completion
        worker.on(
          "message",
          (msg: {
            success: boolean;
            result?: unknown;
            error?: string;
            stack?: string;
          }) => {
            const endTime = performance.now();
            const endMemory = process.memoryUsage().heapUsed;
            mainPort.close();

            respond({
              success: msg.success,
              result: msg.result,
              error: msg.error,
              stack: msg.stack,
              metrics: this.calculateMetrics(
                startTime,
                endTime,
                startMemory,
                endMemory,
              ),
            });
          },
        );

        // Handle worker errors
        worker.on("error", (error: Error) => {
          const endTime = performance.now();
          const endMemory = process.memoryUsage().heapUsed;
          mainPort.close();

          respond({
            success: false,
            error: error.message,
            stack: error.stack,
            metrics: this.calculateMetrics(
              startTime,
              endTime,
              startMemory,
              endMemory,
            ),
          });
        });

        // Handle worker exit
        worker.on("exit", (exitCode: number) => {
          if (!settled) {
            const endTime = performance.now();
            const endMemory = process.memoryUsage().heapUsed;
            mainPort.close();

            respond({
              success: false,
              error: `Worker exited with code ${String(exitCode)}`,
              metrics: this.calculateMetrics(
                startTime,
                endTime,
                startMemory,
                endMemory,
              ),
            });
          }
        });

        // Timeout enforcement
        timeoutHandle = setTimeout(() => {
          const endTime = performance.now();
          const endMemory = process.memoryUsage().heapUsed;
          mainPort.close();

          respond({
            success: false,
            error: `Execution timed out after ${String(this.options.timeoutMs)}ms`,
            metrics: this.calculateMetrics(
              startTime,
              endTime,
              startMemory,
              endMemory,
            ),
          });
        }, this.options.timeoutMs + 1000); // Extra 1s grace for cleanup
      } catch (error) {
        const endTime = performance.now();
        const endMemory = process.memoryUsage().heapUsed;

        respond({
          success: false,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          metrics: this.calculateMetrics(
            startTime,
            endTime,
            startMemory,
            endMemory,
          ),
        });
      }
    });
  }

  /**
   * Serialize API bindings for worker transfer.
   * Sends group → method name arrays so the worker can build RPC proxy stubs.
   * Top-level function keys (aliases like readQuery, help) are collected under "_topLevel".
   */
  serializeBindings(
    bindings: Record<string, unknown>,
  ): Record<string, string[]> {
    const result: Record<string, string[]> = {};
    const topLevel: string[] = [];

    for (const [key, value] of Object.entries(bindings)) {
      if (typeof value === "function") {
        // Top-level function (alias)
        topLevel.push(key);
      } else if (typeof value === "object" && value !== null) {
        // Group object — extract method names
        const methods: string[] = [];
        for (const [methodName, methodValue] of Object.entries(
          value as Record<string, unknown>,
        )) {
          if (typeof methodValue === "function") {
            methods.push(methodName);
          }
        }
        if (methods.length > 0) {
          result[key] = methods;
        }
      }
    }

    if (topLevel.length > 0) {
      result["_topLevel"] = topLevel;
    }

    return result;
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
      cpuTimeMs: Math.round(endTime - startTime),
      memoryUsedMb: Math.max(
        0,
        Math.round(((endMemory - startMemory) / 1024 / 1024) * 100) / 100,
      ),
    };
  }

  /**
   * Check if sandbox is healthy
   */
  isHealthy(): boolean {
    return !this.disposed;
  }

  /**
   * Dispose of the sandbox
   */
  dispose(): void {
    this.disposed = true;
  }
}

/**
 * Pool of worker sandboxes
 * Unlike VM pool, worker sandboxes are created fresh for each execution
 * so this pool is simpler (mainly for statistics and control)
 */
export class WorkerSandboxPool {
  private readonly options: Required<PoolOptions>;
  private readonly sandboxOptions: Required<SandboxOptions>;
  private activeCount = 0;

  constructor(poolOptions?: PoolOptions, sandboxOptions?: SandboxOptions) {
    this.options = { ...DEFAULT_POOL_OPTIONS, ...poolOptions };
    this.sandboxOptions = { ...DEFAULT_SANDBOX_OPTIONS, ...sandboxOptions };
  }

  /**
   * Initialize the pool
   */
  initialize(): void {
    // Worker sandboxes are created on demand, no pre-warming needed
  }

  /**
   * Execute code using a worker sandbox
   */
  async execute(
    code: string,
    apiBindings: Record<string, unknown>,
  ): Promise<SandboxResult> {
    if (this.activeCount >= this.options.maxInstances) {
      return {
        success: false,
        error: "Worker sandbox pool exhausted",
        metrics: { wallTimeMs: 0, cpuTimeMs: 0, memoryUsedMb: 0 },
      };
    }

    this.activeCount++;
    try {
      const sandbox = WorkerSandbox.create(this.sandboxOptions);
      return await sandbox.execute(code, apiBindings);
    } finally {
      this.activeCount--;
    }
  }

  /**
   * Get pool statistics
   */
  getStats(): { available: number; inUse: number; max: number } {
    return {
      available: this.options.maxInstances - this.activeCount,
      inUse: this.activeCount,
      max: this.options.maxInstances,
    };
  }

  /**
   * Dispose of the pool
   */
  dispose(): void {
    // Workers are created and cleaned up per execution, nothing to dispose
  }
}
