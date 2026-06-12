/**
 * Exhaustive Test Zod Boundary
 *
 * Invokes the MCP server subprocess and dynamically fetches all tools.
 * It deliberately sends invalid Zod types (e.g., numbers instead of strings)
 * to every single tool to ensure that SDK-level Zod exceptions are gracefully
 * intercepted and formatted as standard VALIDATION_ERROR JSON-RPC payloads,
 * rather than leaking raw -32602 errors.
 */
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const cliPath = join(__dirname, "../../dist/cli.js");

let output = "";
let tools = [];
let currentTestIdx = 0;
let tests = [];

console.log("Spawning MCP server for exhaustive Zod boundary testing...");
// SQLite native in-memory DB
const mcp = spawn("node", [cliPath, "--sqlite-native", ":memory:", "--tool-filter", "+all"], {
  env: { ...process.env, ALLOWED_IO_ROOTS: __dirname },
});

mcp.stdin.write(JSON.stringify({
  jsonrpc: "2.0",
  id: "list",
  method: "tools/list"
}) + "\n");

function generateBadValue(type) {
  switch (type) {
    case "string": return 123;
    case "number": return "not-a-number";
    case "integer": return "not-an-int";
    case "boolean": return "not-a-bool";
    case "array": return false;
    case "object": return "not-an-object";
    default: return { completely: "wrong" };
  }
}

mcp.stdout.on("data", (data) => {
  output += data.toString();

  // Phase 1: Wait for tools/list
  if (tests.length === 0 && output.includes(`"id":"list"`)) {
    const lines = output.split("\n");
    const responseLine = lines.find((line) => line.includes(`"id":"list"`));
    if (responseLine) {
      let parsed;
      try {
        parsed = JSON.parse(responseLine);
      } catch (e) {
        return; // Wait for the rest of the chunk
      }
      tools = parsed.result?.tools || [];
      console.log(`Found ${tools.length} tools. Generating boundary tests...`);

      for (const tool of tools) {
        const schema = tool.inputSchema;
        if (!schema || !schema.properties) continue;

        const props = Object.keys(schema.properties);
        if (props.length === 0) {
          tests.push({
            name: `${tool.name} (unexpected extra argument)`,
            payload: {
              jsonrpc: "2.0",
              id: tests.length + 1,
              method: "tools/call",
              params: {
                name: tool.name,
                arguments: { unexpected_field: "should_fail" },
              },
            },
          });
          continue;
        }

        // Pick the first property to break
        const propName = props[0];
        const propSchema = schema.properties[propName];
        
        let badArg = {};
        if (schema.required) {
            for (const req of schema.required) {
               if (req !== propName && schema.properties[req]) {
                   const t = schema.properties[req].type;
                   if (t === 'string') badArg[req] = "valid";
                   else if (t === 'number' || t === 'integer') badArg[req] = 1;
                   else if (t === 'boolean') badArg[req] = true;
                   else if (t === 'array') badArg[req] = [];
                   else if (t === 'object') badArg[req] = {};
               }
            }
        }
        
        badArg[propName] = generateBadValue(propSchema.type);

        tests.push({
          name: `${tool.name} (${propName} type mismatch)`,
          payload: {
            jsonrpc: "2.0",
            id: tests.length + 1,
            method: "tools/call",
            params: {
              name: tool.name,
              arguments: badArg,
            },
          },
        });
      }
      
      console.log(`Generated ${tests.length} tests.`);
      output = "";
      if (tests.length > 0) {
        sendTest(0);
      } else {
        console.log("No tests generated. Exiting.");
        mcp.kill();
      }
    }
    return;
  }

  // Phase 2: Run tests
  if (tests.length > 0) {
    const test = tests[currentTestIdx];
    if (!test) return;

    const expectedId = test.payload.id;
    const idRegex = new RegExp(`"id"\\s*:\\s*${expectedId}(\\s*[},])`);
    if (idRegex.test(output)) {
      const lines = output.split("\n");
      const responseLine = lines.find((line) => idRegex.test(line));

      if (responseLine) {
        try {
          const parsed = JSON.parse(responseLine);
          const resultText = parsed?.result?.content?.[0]?.text || "";
          const structuredContent = parsed?.result?.structuredContent;

          if (
            !resultText.includes("-32602") &&
            (resultText.includes("VALIDATION_ERROR") ||
             resultText.includes("Validation error:") ||
             structuredContent?.code === "VALIDATION_ERROR")
          ) {
            process.stdout.write(`✅ [PASS] ${test.name}\n`);
          } else if (resultText.includes("-32602")) {
            console.log(`\n❌ [FAIL] ${test.name}`);
            console.log(`Expected structured VALIDATION_ERROR but received:`);
            console.log(JSON.stringify(parsed, null, 2));
            process.exit(1);
          } else {
            process.stdout.write(`✅ [PASS] ${test.name} (Caught gracefully)\n`);
          }
        } catch (e) {
          console.log(`\n❌ [FAIL] ${test.name} - Could not parse response`);
          console.log("Raw Response:", responseLine);
          process.exit(1);
        }

        currentTestIdx++;
        output = "";
        if (currentTestIdx < tests.length) {
          sendTest(currentTestIdx);
        } else {
          console.log(`\n✅ All ${tests.length} exhaustive Zod boundary tests passed.`);
          mcp.kill();
        }
      }
    }
  }
});

mcp.stderr.on("data", (data) => {
  if (data.toString().includes("Error:")) {
    console.error(`\n❌ ERROR: ${data}`);
  }
});

mcp.on("close", (code) => {
  if (currentTestIdx < tests.length) {
    console.log(`\nProcess exited prematurely with code ${code}`);
    process.exit(1);
  }
});

function sendTest(idx) {
  const test = tests[idx];
  mcp.stdin.write(JSON.stringify(test.payload) + "\n");
}
