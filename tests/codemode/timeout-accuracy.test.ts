/**
 * WorkerSandbox Timeout Accuracy Tests
 *
 * Tests real timeout enforcement using actual Worker threads (no mocking).
 * Validates that the sandbox terminates within a predictable window
 * of the configured timeout, accounting for TIMEOUT_GRACE_MS (1000ms)
 * and worker startup overhead.
 *
 * These tests are intentionally slow (~3-5s each) because they exercise
 * real worker thread lifecycle. Tagged with longer Vitest timeout.
 *
 * IMPORTANT: Requires `npm run build` first — the worker script must
 * exist at dist/worker-script.js for real Worker threads to function.
 */

import { describe, it, expect, vi } from "vitest";
import { resolve } from "node:path";

/**
 * Redirect Worker script path from src/ → dist/.
 * Vitest runs from source, but real Workers need compiled JS on disk.
 * This thin wrapper extends the real Worker — all behavior is preserved,
 * only the script path is patched at construction time.
 */
vi.mock("node:worker_threads", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:worker_threads")>();
  const distWorkerPath = resolve("dist", "worker-script.js");

  return {
    ...actual,
    Worker: class PatchedWorker extends actual.Worker {
      constructor(
        script: string | URL,
        options?: ConstructorParameters<typeof actual.Worker>[1],
      ) {
        const fixedScript =
          typeof script === "string" && script.endsWith("worker-script.js")
            ? distWorkerPath
            : script;
        super(fixedScript, options);
      }
    },
  };
});

// Must import after vi.mock (hoisted by Vitest)
const { WorkerSandbox } = await import(
  "../../src/codemode/worker-sandbox.js"
);

/**
 * The grace period added by WorkerSandbox (see worker-sandbox.ts line 33).
 * The main-thread timeout fires at `effectiveTimeout + TIMEOUT_GRACE_MS`.
 */
const TIMEOUT_GRACE_MS = 1000;

/**
 * Extra tolerance for worker startup, thread scheduling, and CI variance.
 * 700ms covers slow CI runners and Windows thread creation overhead.
 */
const TOLERANCE_MS = 700;

describe(
  "WorkerSandbox Timeout Accuracy",
  { timeout: 15000 },
  () => {
    it("should enforce 500ms timeout within expected window", async () => {
      const sandbox = WorkerSandbox.create({ timeoutMs: 500 });
      const start = performance.now();

      const result = await sandbox.execute("while(true) {}", {}, 500);

      const elapsed = performance.now() - start;
      sandbox.dispose();

      expect(result.success).toBe(false);
      expect(result.error).toContain("timed out");

      // Wall time should be at least the timeout value
      // and at most timeout + grace + tolerance
      const maxExpected = 500 + TIMEOUT_GRACE_MS + TOLERANCE_MS;
      expect(elapsed).toBeGreaterThanOrEqual(400); // allow 100ms clock jitter
      expect(elapsed).toBeLessThanOrEqual(maxExpected);
    });

    it("should enforce 1000ms timeout within expected window", async () => {
      const sandbox = WorkerSandbox.create({ timeoutMs: 1000 });
      const start = performance.now();

      const result = await sandbox.execute("while(true) {}", {}, 1000);

      const elapsed = performance.now() - start;
      sandbox.dispose();

      expect(result.success).toBe(false);
      expect(result.error).toContain("timed out");

      const maxExpected = 1000 + TIMEOUT_GRACE_MS + TOLERANCE_MS;
      expect(elapsed).toBeGreaterThanOrEqual(900);
      expect(elapsed).toBeLessThanOrEqual(maxExpected);
    });

    it("should complete fast code well before timeout expires", async () => {
      const sandbox = WorkerSandbox.create({ timeoutMs: 5000 });
      const start = performance.now();

      const result = await sandbox.execute("return 42;", {}, 5000);

      const elapsed = performance.now() - start;
      sandbox.dispose();

      expect(result.success).toBe(true);
      expect(result.result).toBe(42);

      // Fast code should complete in well under the timeout
      // Allow up to 3000ms for worker startup on slow CI
      expect(elapsed).toBeLessThan(3000);
    });

    it("should report accurate wall time in metrics", async () => {
      const sandbox = WorkerSandbox.create({ timeoutMs: 500 });

      const result = await sandbox.execute("while(true) {}", {}, 500);

      sandbox.dispose();

      expect(result.success).toBe(false);
      expect(result.metrics).toBeDefined();
      expect(result.metrics.wallTimeMs).toBeGreaterThanOrEqual(400);

      const maxExpected = 500 + TIMEOUT_GRACE_MS + TOLERANCE_MS;
      expect(result.metrics.wallTimeMs).toBeLessThanOrEqual(maxExpected);
    });
  },
);
