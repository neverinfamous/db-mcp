/**
 * db-mcp - Sandbox Factory
 *
 * Factory functions for creating sandbox instances with configurable isolation modes.
 * Allows runtime selection between isolated-vm and worker-based sandboxes.
 */

import { CodeModeSandbox, SandboxPool } from "./sandbox.js";

import { logger } from "../utils/logger/index.js";
import type { SandboxOptions, PoolOptions, SandboxResult } from "./types.js";

/**
 * Sandbox isolation mode
 */
export type SandboxMode = "isolate"; // Worker mode explicitly disabled for security (H-1)

/**
 * Unified sandbox interface
 */
export interface ISandbox {
  execute(
    code: string,
    apiBindings: Record<string, unknown>,
    timeoutMs?: number,
  ): Promise<SandboxResult>;
  isHealthy(): boolean;
  dispose(): void;
}

/**
 * Unified sandbox pool interface
 */
export interface ISandboxPool {
  initialize(): void;
  execute(
    code: string,
    apiBindings: Record<string, unknown>,
    timeoutMs?: number,
  ): Promise<SandboxResult>;
  getStats(): { available: number; inUse: number; max: number };
  dispose(): void;
}

/**
 * Mode info for documentation/selection
 */
export interface SandboxModeInfo {
  name: string;
  isolation: string;
  performance: string;
  security: string;
  requirements: string;
}

// Default mode (module-level state)
let defaultMode: SandboxMode = "isolate";

/**
 * Set the default sandbox mode
 */
export function setDefaultSandboxMode(mode: SandboxMode): void {
  defaultMode = mode;
  logger.info(`Sandbox default mode set to: ${mode}`, {
    module: "CODEMODE" as const,
  });
}

/**
 * Get the current default mode
 */
export function getDefaultSandboxMode(): SandboxMode {
  return defaultMode;
}

/**
 * Get available sandbox modes
 */
export function getAvailableSandboxModes(): SandboxMode[] {
  return ["isolate"];
}

/**
 * Create a sandbox instance
 * @param mode - Isolation mode ('isolate' or 'worker')
 * @param options - Sandbox options
 */
export function createSandbox(
  mode?: SandboxMode,
  options?: SandboxOptions,
): ISandbox {
  const selectedMode = mode ?? defaultMode;

  if (selectedMode === "isolate") {
    return CodeModeSandbox.create(options);
  }
  throw new Error(
    "Only 'isolate' mode is supported. Worker mode was disabled for security.",
  );
}

/**
 * Create a sandbox pool
 * @param mode - Isolation mode ('isolate' or 'worker')
 * @param poolOptions - Pool configuration
 * @param sandboxOptions - Sandbox configuration
 */
export function createSandboxPool(
  mode?: SandboxMode,
  poolOptions?: PoolOptions,
  sandboxOptions?: SandboxOptions,
): ISandboxPool {
  const selectedMode = mode ?? defaultMode;

  if (selectedMode === "isolate") {
    return new SandboxPool(poolOptions, sandboxOptions);
  }
  throw new Error(
    "Only 'isolate' mode is supported. Worker mode was disabled for security.",
  );
}

/**
 * Get mode characteristics for documentation/selection
 */
export function getSandboxModeInfo(_mode: SandboxMode): SandboxModeInfo {
  return {
    name: "Isolated VM",
    isolation: "True V8 Isolate within same process",
    performance: "Low overhead (fast isolate creation)",
    security: "Maximum - strict C++ memory isolation",
    requirements: "isolated-vm native package",
  };
}
