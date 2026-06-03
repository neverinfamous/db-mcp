import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

describe("CLI Configuration & Dumping", () => {
  const tempDir = path.join(process.cwd(), "temp-cli-tests");
  const yamlConfigPath = path.join(tempDir, "test-config.yaml");
  const jsonConfigPath = path.join(tempDir, "test-config.json");
  const cliPath = path.join(process.cwd(), "dist", "cli.js");

  beforeAll(() => {
    // Ensure dist/cli.js exists
    if (!fs.existsSync(cliPath)) {
      throw new Error(
        "dist/cli.js not found. Please run 'npm run build' before testing.",
      );
    }

    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir);
    }

    // Write a sample YAML config
    fs.writeFileSync(
      yamlConfigPath,
      `
name: "yaml-server-name"
port: 4567
authToken: "super-secret-yaml-token"
metricsExport: "prometheus"
databases:
  - type: "sqlite"
    connectionString: "yaml-db.sqlite"
`.trim(),
    );

    // Write a sample JSON config
    fs.writeFileSync(
      jsonConfigPath,
      JSON.stringify({
        name: "json-server-name",
        port: 8910,
        authToken: "super-secret-json-token",
        metricsExport: "prometheus",
      }),
    );
  });

  afterAll(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  function runDumpConfig(
    args: string[] = [],
    env: Record<string, string> = {},
  ): Record<string, any> {
    const output = execFileSync("node", [cliPath, "--dump-config", ...args], {
      encoding: "utf-8",
      env: { ...process.env, ...env },
    });
    return JSON.parse(output);
  }

  it("should load configuration from a YAML file", () => {
    const config = runDumpConfig(["--config", yamlConfigPath]);
    expect(config.name).toBe("yaml-server-name");
    expect(config.port).toBe(4567);
    expect(config.metricsExport).toBe("prometheus");
    expect(config.databases).toBeDefined();
    expect(config.databases[0].connectionString).toBe("yaml-db.sqlite");
  });

  it("should load configuration from a JSON file", () => {
    const config = runDumpConfig(["--config", jsonConfigPath]);
    expect(config.name).toBe("json-server-name");
    expect(config.port).toBe(8910);
    expect(config.metricsExport).toBe("prometheus");
  });

  it("should enforce precedence: CLI flags > File Config", () => {
    // Port 9999 from CLI should override Port 4567 from YAML
    const config = runDumpConfig([
      "--config",
      yamlConfigPath,
      "--port",
      "9999",
    ]);
    expect(config.port).toBe(9999);
    expect(config.name).toBe("yaml-server-name"); // Fallback to YAML
  });

  it("should enforce precedence: Env Vars > File Config", () => {
    // HOST 127.0.0.1 from Env should override HOST from YAML
    const config = runDumpConfig(["--config", yamlConfigPath], {
      HOST: "127.0.0.1",
    });
    expect(config.host).toBe("127.0.0.1");
    expect(config.name).toBe("yaml-server-name"); // Fallback to YAML
  });

  it("should enforce precedence: CLI flags > Env Vars", () => {
    // Host from CLI should override HOST from Env
    const config = runDumpConfig(["--server-host", "192.168.1.1"], {
      HOST: "127.0.0.1",
    });
    expect(config.host).toBe("192.168.1.1");
  });

  it("should safely redact sensitive auth tokens when dumping config", () => {
    const config = runDumpConfig(["--config", yamlConfigPath]);
    expect(config.authToken).toBe("***REDACTED***");
    expect(config.authToken).not.toBe("super-secret-yaml-token");
  });

  it("should safely redact sensitive oauth JWKS URIs when dumping config", () => {
    const output = execFileSync(
      "node",
      [
        cliPath,
        "--dump-config",
        "--oauth-enabled",
        "--oauth-jwks-uri",
        "secret-jwks-uri",
      ],
      { encoding: "utf-8" },
    );
    const config = JSON.parse(output);
    expect(config.oauth).toBeDefined();
    expect(config.oauth.jwksUri).toBe("***REDACTED***");
    expect(config.oauth.jwksUri).not.toBe("secret-jwks-uri");
  });
});
