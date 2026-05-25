/**
 * db-mcp - Code Mode Worker Script
 *
 * This script runs in a worker thread to execute user code in isolation.
 * It uses Node.js vm module within the worker for additional sandboxing.
 *
 * API calls (sqlite.*) are proxied over a MessagePort RPC bridge to the
 * main thread where the actual adapter methods execute.
 */

import { parentPort, workerData, type MessagePort } from "node:worker_threads";
import { randomUUID } from "node:crypto";
import vm from "node:vm";
import { transformAutoReturn } from "./auto-return.js";

// Security (F01): Freeze outer-context prototypes to prevent sandbox escape via prototype pollution
try { Object.freeze(Object.prototype); } catch { /* ignore */ }
try { Object.freeze(Function.prototype); } catch { /* ignore */ }

interface WorkerData {
  code: string;
  apiBindings: Record<string, string[]>;
  timeout: number;
  rpcPort: MessagePort;
  maxResultSize: number;
}

interface WorkerResult {
  success: boolean;
  result?: unknown;
  error?: string | undefined;
  stack?: string | undefined;
  logs?: string[];
}

interface RpcResponse {
  id: number;
  result?: unknown;
  error?: string;
  errorDetails?: Record<string, unknown>;
}

/**
 * Build a proxy sqlite object that forwards all method calls over the RPC port.
 * The apiBindings provide group → method name arrays from the main thread.
 * Each method becomes an async function that sends RPC and waits for response.
 */
function buildSqliteProxy(
  bindings: Record<string, string[]>,
  rpcPort: MessagePort,
): Record<string, unknown> {
  const pending = new Map<
    number,
    { resolve: (v: unknown) => void; reject: (e: Error) => void }
  >();
  let nextId = 0;

  // Listen for RPC responses from the main thread
  rpcPort.on("message", (msg: RpcResponse) => {
    const p = pending.get(msg.id);
    if (p) {
      pending.delete(msg.id);
      if (msg.error !== undefined) {
        const err = new Error(msg.error || "Empty error message");
        if (msg.errorDetails) {
          Object.assign(err, msg.errorDetails);
        }
        p.reject(err);
      } else {
        p.resolve(msg.result);
      }
    }
  });

  const sqlite: Record<string, unknown> = {};
  const groupNames: string[] = [];

  for (const [key, methods] of Object.entries(bindings)) {
    // Skip the special _topLevel key — handle separately below
    if (key === "_topLevel") continue;

    groupNames.push(key);

    const groupApi: Record<string, unknown> = {};
    for (const method of methods) {
      if (method === "help") continue; // We build help separately

      groupApi[method] = (...args: unknown[]): Promise<unknown> =>
        new Promise((resolve, reject) => {
          const id = nextId++;
          pending.set(id, { resolve, reject });
          rpcPort.postMessage({ id, group: key, method, args });
        });
    }

    // Add help() for each group — returns method list
    groupApi["help"] = (): { group: string; methods: string[] } => ({
      group: key,
      methods: methods.filter((m) => m !== "help"),
    });

    // Wrap in a Proxy so that calling an undefined method (e.g. a mutation
    // that was stripped in readonly mode) throws a rejected Promise instead
    // of silently returning undefined — this halts control flow in the
    // sandbox and surfaces a proper error to the caller.
    const methodNames = methods.filter((m) => m !== "help");
    const groupProxyWrapped = new Proxy(groupApi, {
      get(target, prop) {
        // Symbols (Symbol.toPrimitive, Symbol.iterator, etc.) — pass through
        if (typeof prop === "symbol") return undefined;
        const propKey = prop;
        if (propKey in target) return target[propKey];
        // `then` must return undefined so the Proxy is never treated as a
        // thenable. Without this, `return sqlite.core` would trigger Promise
        // resolution → `.then()` → immediate reject with a misleading error.
        if (propKey === "then") return undefined;
        // Unknown/stripped method — reject so the sandbox try/catch catches it
        const available = methodNames.join(", ") || "none";
        const reason =
          methodNames.length === 0
            ? `Operation '${propKey}' is not available — this group has no methods (read-only mode?). Available: ${available}.`
            : `Operation '${propKey}' is not found in group '${key}'. Available: ${available}.`;
        return (..._args: unknown[]) => Promise.reject(new Error(reason));
      },
    });

    sqlite[key] = groupProxyWrapped;
  }

  // Handle top-level aliases (e.g., readQuery, help)
  const topLevel = bindings["_topLevel"];
  if (topLevel) {
    for (const method of topLevel) {
      if (method === "help") {
        // Top-level help returns all groups
        sqlite["help"] = (): {
          groups: string[];
          totalMethods: number;
          usage: string;
        } => {
          let totalMethods = 0;
          for (const k of groupNames) {
            totalMethods += (bindings[k] ?? []).filter(
              (m: string) => m !== "help",
            ).length;
          }
          return {
            groups: groupNames,
            totalMethods,
            usage:
              "Use sqlite.<group>.help() for group details. Example: sqlite.core.help()",
          };
        };
      } else {
        // Top-level aliases forward via _topLevel group
        sqlite[method] = (...args: unknown[]): Promise<unknown> =>
          new Promise((resolve, reject) => {
            const id = nextId++;
            pending.set(id, { resolve, reject });
            rpcPort.postMessage({
              id,
              group: "_topLevel",
              method,
              args,
            });
          });
      }
    }
  }

  // If no top-level help was set, add one
  if (sqlite["help"] === undefined) {
    sqlite["help"] = (): {
      groups: string[];
      totalMethods: number;
      usage: string;
    } => {
      let totalMethods = 0;
      for (const k of groupNames) {
        totalMethods += (bindings[k] ?? []).filter(
          (m: string) => m !== "help",
        ).length;
      }
      return {
        groups: groupNames,
        totalMethods,
        usage:
          "Use sqlite.<group>.help() for group details. Example: sqlite.core.help()",
      };
    };
  }

  return sqlite;
}

/**
 * Run user code in a vm context within the worker thread
 */
async function executeInWorker(): Promise<void> {
  const data = workerData as WorkerData;
  const { code, apiBindings, timeout, rpcPort } = data;
  const logs: string[] = [];

  try {
    // Start receiving RPC responses
    rpcPort.ref();

    // Build the sqlite proxy object with RPC bridge
    const sqlite = buildSqliteProxy(apiBindings, rpcPort);

    // Create sandbox context
    const sandbox: Record<string, unknown> = {
      sqlite,
      console: {
        log: (...args: unknown[]): void => {
          logs.push(args.map(String).join(" "));
        },
        error: (...args: unknown[]): void => {
          logs.push("[ERROR] " + args.map(String).join(" "));
        },
        warn: (...args: unknown[]): void => {
          logs.push("[WARN] " + args.map(String).join(" "));
        },
        info: (...args: unknown[]): void => {
          logs.push("[INFO] " + args.map(String).join(" "));
        },
        debug: (...args: unknown[]): void => {
          logs.push("[DEBUG] " + args.map(String).join(" "));
        },
      },
      setTimeout: undefined,
      setInterval: undefined,
      setImmediate: undefined,
      process: undefined,
      require: undefined,
      module: undefined,
      exports: undefined,
      __dirname: undefined,
      __filename: undefined,
      globalThis: undefined,
      global: undefined,
      Proxy: undefined,
      Reflect: undefined,
      Buffer: undefined,
    };

    const context = vm.createContext(sandbox, {
      name: "worker-sandbox",
      codeGeneration: {
        strings: false,
        wasm: false,
      },
    });

    // H-1 Remediation: Freeze built-in prototypes inside the sandbox
    // to prevent dynamic constructor chain escapes like:
    //   const c = 'con'+'structor'; Error()[c][c]('return process')()
    // By freezing prototypes, the `constructor` property becomes
    // non-configurable and returns a frozen function that cannot be
    // used to reach the real Function constructor.
    vm.runInContext(
      `(function() {
        "use strict";
        const builtins = [
          Object, Function, Array, String, Number, Boolean, RegExp,
          Error, TypeError, RangeError, ReferenceError, SyntaxError,
          URIError, EvalError, Map, Set, WeakMap, WeakSet,
          Promise, Date, ArrayBuffer, DataView,
          Int8Array, Uint8Array, Uint8ClampedArray,
          Int16Array, Uint16Array, Int32Array, Uint32Array,
          Float32Array, Float64Array, BigInt64Array, BigUint64Array,
          JSON, Math,
        ];
        const secureFreeze = (obj) => {
          try {
            Object.freeze(obj);
            if (!Object.isFrozen(obj)) throw new Error("Freeze failed silently");
          } catch(e) {
            throw new Error("Failed to secure sandbox: could not freeze " + (obj?.name || typeof obj));
          }
        };

        for (const B of builtins) {
          if (B && typeof B === "function" && B.prototype) {
            secureFreeze(B.prototype);
          }
          secureFreeze(B);
        }
        // Freeze Object.prototype to block __proto__ traversal
        secureFreeze(Object.prototype);
        // Freeze Function.prototype to block constructor chain
        secureFreeze(Function.prototype);
        // Freeze Object.getPrototypeOf to block prototype chain escapes
        secureFreeze(Object.getPrototypeOf);
      }).call(this);
      
      // Remove Function from global scope AFTER freezing it
      this.Function = undefined;
      `,
      context,
    );

    // Wrap in async IIFE for top-level await
    const wrappedCode = `(async () => { ${transformAutoReturn(code)} })()`;

    const script = new vm.Script(wrappedCode, {
      filename: `user-code-${randomUUID()}.js`,
    });

    const result: unknown = await (script.runInContext(context, {
      timeout,
      displayErrors: true,
    }) as Promise<unknown>);

    // Close the RPC port before sending result
    rpcPort.unref();
    rpcPort.close();

    const response: WorkerResult = {
      success: true,
      result,
      logs,
    };

    // Streaming egress boundary enforcement: abort serialization mid-flight
    // if the result exceeds maxResultSize. This prevents OOM from materializing
    // a multi-hundred-MB string before checking its length.
    const egressLimit = data.maxResultSize;
    try {
      let bytes = 0;
      const seen = new Set();

      JSON.stringify(
        result,
        (_key: string, value: unknown) => {
          if (typeof value === "object" && value !== null) {
            if (seen.has(value)) return "[Circular]";
            seen.add(value);
          }
          if (typeof value === "string") {
            bytes += Buffer.byteLength(value, "utf8") + 2; // include quotes
          } else if (
            typeof value === "number" ||
            typeof value === "boolean"
          ) {
            bytes += Buffer.byteLength(String(value), "utf8");
          } else {
            bytes += 5; // brackets/keys/null overhead
          }

          if (bytes > egressLimit) {
            throw new Error(`EgressLimitExceeded:${String(bytes)}`);
          }
          return value;
        },
      );
    } catch (err) {
      if (
        err instanceof Error &&
        err.message.startsWith("EgressLimitExceeded:")
      ) {
        const actualBytesStr = err.message.split(":")[1];
        const actualBytes =
          actualBytesStr !== undefined
            ? Number(actualBytesStr)
            : egressLimit + 1;
        const actualKb = (actualBytes / 1024).toFixed(1);
        response.success = false;
        response.result = undefined;
        response.error = `Output limit exceeded: Result serialization exceeded the ${String(Math.round(egressLimit / 1024))}KB boundary (actual: >${actualKb}KB). Aggregate or filter results to reduce payload size.`;
      } else {
        response.success = false;
        response.result = undefined;
        response.error = `Result could not be serialized: ${err instanceof Error ? err.message : String(err)}`;
      }
    }

    parentPort?.postMessage(response);
  } catch (error: unknown) {
    // Close the RPC port before sending error
    rpcPort.unref();
    rpcPort.close();

    const response: WorkerResult = {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    };
    if (typeof logs !== "undefined") {
      response.logs = logs;
    }

    parentPort?.postMessage(response);
  }
}

// Run immediately when worker starts
void executeInWorker();
