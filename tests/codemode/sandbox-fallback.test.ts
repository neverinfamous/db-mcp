/**
 * CodeModeSandbox Node VM Fallback Tests
 *
 * Tests the fallback path when isolated-vm is broken or missing.
 */
import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  beforeAll,
  afterAll,
  vi,
} from "vitest";

// Mock isolated-vm to throw so the fallback path is triggered
vi.mock("isolated-vm", () => {
  throw new Error("isolated-vm is missing");
});

import { CodeModeSandbox } from "../../src/codemode/sandbox.js";

describe("CodeModeSandbox - Node VM Fallback", () => {
  let sandbox: CodeModeSandbox;
  let originalInsecureEnv: string | undefined;

  beforeAll(() => {
    originalInsecureEnv = process.env["CODEMODE_ISOLATION_INSECURE"];
    process.env["CODEMODE_ISOLATION_INSECURE"] = "1";
  });

  afterAll(() => {
    if (originalInsecureEnv === undefined) {
      delete process.env["CODEMODE_ISOLATION_INSECURE"];
    } else {
      process.env["CODEMODE_ISOLATION_INSECURE"] = originalInsecureEnv;
    }
  });

  beforeEach(() => {
    sandbox = CodeModeSandbox.create();
  });

  afterEach(() => {
    sandbox.dispose();
  });

  it("should execute simple code via node:vm", async () => {
    const result = await sandbox.execute("return 42;", {});
    expect(result.success).toBe(true);
    expect(result.result).toBe(42);
    expect(result.metrics.wallTimeMs).toBeGreaterThanOrEqual(0);
  });

  it("should execute code with API bindings", async () => {
    const bindings = {
      greet: (name: string) => `Hello, ${name}!`,
    };
    const result = await sandbox.execute(
      "return sqlite.greet('World');",
      bindings,
    );
    expect(result.success).toBe(true);
    expect(result.result).toBe("Hello, World!");
  });

  it("should return error for code that throws", async () => {
    const result = await sandbox.execute('throw new Error("test error");', {});
    expect(result.success).toBe(false);
    expect(result.error).toContain("test error");
  });

  it("should capture console output", async () => {
    await sandbox.execute('console.log("hello node:vm");', {});
    const output = sandbox.getConsoleOutput();
    expect(output).toContain("hello node:vm");
  });

  it("should capture all console methods", async () => {
    await sandbox.execute(
      `
      console.log('l');
      console.error('e');
      console.warn('w');
      console.info('i');
      console.debug('d');
    `,
      {},
    );
    const output = sandbox.getConsoleOutput();
    expect(output).toHaveLength(5);
    expect(output).toContain("l");
    expect(output).toContain("[ERROR] e");
    expect(output).toContain("[WARN] w");
    expect(output).toContain("[INFO] i");
    expect(output).toContain("[DEBUG] d");
  });
});
