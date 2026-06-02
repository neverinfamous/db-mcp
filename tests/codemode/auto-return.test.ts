import { describe, it, expect } from "vitest";
import { transformAutoReturn } from "../../src/codemode/auto-return.js";

describe("transformAutoReturn", () => {
  it("should prepend return to a single expression statement", () => {
    expect(transformAutoReturn("42")).toBe("return 42");
    expect(transformAutoReturn("sqlite.help()")).toBe("return sqlite.help()");
    expect(transformAutoReturn("await foo()")).toBe("return await foo()");
  });

  it("should append return to the last expression in a multi-statement block", () => {
    expect(transformAutoReturn("const x = 1;\nx + 1")).toBe("const x = 1;\n\nreturn x + 1");
    expect(transformAutoReturn("foo();\nbar()")).toBe("foo();\n\nreturn bar()");
  });

  it("should ignore trailing whitespace", () => {
    expect(transformAutoReturn("42   ")).toBe("return 42");
    expect(transformAutoReturn("x = 1;\nx   \n")).toBe("x = 1;\n\nreturn x");
  });

  it("should not modify code ending in an explicit return", () => {
    expect(transformAutoReturn("return 42")).toBe("return 42");
    expect(transformAutoReturn("const x = 1;\nreturn x")).toBe("const x = 1;\nreturn x");
  });

  it("should not modify code ending in non-returnable statements", () => {
    expect(transformAutoReturn("if (true) {}")).toBe("if (true) {}");
    expect(transformAutoReturn("for (let i = 0; i < 10; i++) {}")).toBe("for (let i = 0; i < 10; i++) {}");
    expect(transformAutoReturn("const x = 1;")).toBe("const x = 1;");
    expect(transformAutoReturn("let x = 1;")).toBe("let x = 1;");
    expect(transformAutoReturn("function foo() {}")).toBe("function foo() {}");
    expect(transformAutoReturn("throw new Error()")).toBe("throw new Error()");
  });

  it("should correctly identify statement boundaries with nested braces", () => {
    expect(transformAutoReturn("const fn = () => { return 1; }; fn()")).toBe("const fn = () => { return 1; };\nreturn fn()");
    expect(transformAutoReturn("const arr = [1, 2, 3]; arr.map(x => x * 2)")).toBe("const arr = [1, 2, 3];\nreturn arr.map(x => x * 2)");
  });

  it("should return unchanged for empty strings or only semicolons", () => {
    expect(transformAutoReturn("")).toBe("");
    expect(transformAutoReturn("   ")).toBe("   ");
    expect(transformAutoReturn(";")).toBe(";");
    expect(transformAutoReturn(";\n;")).toBe(";\n;");
  });
});
