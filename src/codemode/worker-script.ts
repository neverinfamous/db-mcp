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
import vm from "node:vm";

interface WorkerData {
  code: string;
  apiBindings: Record<string, string[]>;
  timeout: number;
  rpcPort: MessagePort;
}

interface WorkerResult {
  success: boolean;
  result?: unknown;
  error?: string | undefined;
  stack?: string | undefined;
}

interface RpcResponse {
  id: number;
  result?: unknown;
  error?: string;
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
      if (msg.error) {
        p.reject(new Error(msg.error));
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

    sqlite[key] = groupApi;
  }

  // Handle top-level aliases (e.g., readQuery, help)
  const topLevel = bindings["_topLevel"];
  if (topLevel) {
    for (const method of topLevel) {
      if (method === "help") {
        // Top-level help returns all groups
        sqlite["help"] = (): { groups: string[] } => ({
          groups: groupNames,
        });
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
    sqlite["help"] = (): { groups: string[] } => ({
      groups: groupNames,
    });
  }

  return sqlite;
}

/**
 * Run user code in a vm context within the worker thread
 */
async function executeInWorker(): Promise<void> {
  const data = workerData as WorkerData;
  const { code, apiBindings, timeout, rpcPort } = data;

  try {
    // Start receiving RPC responses
    rpcPort.ref();

    // Build the sqlite proxy object with RPC bridge
    const sqlite = buildSqliteProxy(apiBindings, rpcPort);

    // Create sandbox context
    const sandbox: Record<string, unknown> = {
      sqlite,
      console: {
        log: (): void => {
          /* intentionally empty */
        },
        error: (): void => {
          /* intentionally empty */
        },
        warn: (): void => {
          /* intentionally empty */
        },
        info: (): void => {
          /* intentionally empty */
        },
        debug: (): void => {
          /* intentionally empty */
        },
      },
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
      name: "worker-sandbox",
    });

    // Wrap in async IIFE for top-level await
    const wrappedCode = `(async () => { ${code} })()`;

    const script = new vm.Script(wrappedCode, {
      filename: "user-code.js",
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
    };

    parentPort?.postMessage(response);
  } catch (error) {
    // Close the RPC port before sending error
    rpcPort.unref();
    rpcPort.close();

    const response: WorkerResult = {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    };

    parentPort?.postMessage(response);
  }
}

// Run immediately when worker starts
void executeInWorker();
