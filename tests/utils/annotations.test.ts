/**
 * Annotation Utilities Tests
 *
 * Tests for tool and resource annotation presets and helper functions.
 * Target: improve coverage for annotations.ts (90%) and resourceAnnotations.ts (66%)
 */

import { describe, it, expect } from "vitest";
import {
  READ_ONLY,
  WRITE,
  DESTRUCTIVE,
  IDEMPOTENT,
  ADMIN,
  withTitle,
  readOnly,
  write,
  destructive,
  idempotent,
  admin,
} from "../../src/utils/annotations.js";
import {
  HIGH_PRIORITY,
  MEDIUM_PRIORITY,
  LOW_PRIORITY,
  ASSISTANT_FOCUSED,
  withPriority,
  withTimestamp,
} from "../../src/utils/resourceAnnotations.js";

describe("Tool Annotations", () => {
  describe("Preset constants", () => {
    it("should define READ_ONLY with correct hints", () => {
      expect(READ_ONLY.readOnlyHint).toBe(true);
      expect(READ_ONLY.destructiveHint).toBe(false);
    });

    it("should define WRITE with correct hints", () => {
      expect(WRITE.readOnlyHint).toBe(false);
      expect(WRITE.destructiveHint).toBe(false);
    });

    it("should define DESTRUCTIVE with correct hints", () => {
      expect(DESTRUCTIVE.readOnlyHint).toBe(false);
      expect(DESTRUCTIVE.destructiveHint).toBe(true);
    });

    it("should define IDEMPOTENT with correct hints", () => {
      expect(IDEMPOTENT.readOnlyHint).toBe(false);
      expect(IDEMPOTENT.destructiveHint).toBe(false);
      expect(IDEMPOTENT.idempotentHint).toBe(true);
    });

    it("should define ADMIN with correct hints", () => {
      expect(ADMIN.readOnlyHint).toBe(false);
      expect(ADMIN.destructiveHint).toBe(false);
    });
  });

  describe("withTitle helper", () => {
    it("should add title to default READ_ONLY base", () => {
      const result = withTitle("My Custom Tool");
      expect(result.title).toBe("My Custom Tool");
      expect(result.readOnlyHint).toBe(true);
      expect(result.destructiveHint).toBe(false);
    });

    it("should add title to custom base", () => {
      const result = withTitle("Danger Zone", DESTRUCTIVE);
      expect(result.title).toBe("Danger Zone");
      expect(result.destructiveHint).toBe(true);
    });
  });

  describe("readOnly helper", () => {
    it("should create read-only annotations with title", () => {
      const result = readOnly("Query Tool");
      expect(result.title).toBe("Query Tool");
      expect(result.readOnlyHint).toBe(true);
      expect(result.destructiveHint).toBe(false);
    });
  });

  describe("write helper", () => {
    it("should create write annotations with title", () => {
      const result = write("Insert Tool");
      expect(result.title).toBe("Insert Tool");
      expect(result.readOnlyHint).toBe(false);
      expect(result.destructiveHint).toBe(false);
    });
  });

  describe("destructive helper", () => {
    it("should create destructive annotations with title", () => {
      const result = destructive("Delete Tool");
      expect(result.title).toBe("Delete Tool");
      expect(result.readOnlyHint).toBe(false);
      expect(result.destructiveHint).toBe(true);
    });
  });

  describe("idempotent helper", () => {
    it("should create idempotent annotations with title", () => {
      const result = idempotent("Upsert Tool");
      expect(result.title).toBe("Upsert Tool");
      expect(result.idempotentHint).toBe(true);
    });
  });

  describe("admin helper", () => {
    it("should create admin annotations with title", () => {
      const result = admin("Vacuum Tool");
      expect(result.title).toBe("Vacuum Tool");
      expect(result.readOnlyHint).toBe(false);
      expect(result.destructiveHint).toBe(false);
    });
  });
});

describe("Resource Annotations", () => {
  describe("Preset constants", () => {
    it("should define HIGH_PRIORITY with correct values", () => {
      expect(HIGH_PRIORITY.priority).toBe(0.9);
      expect(HIGH_PRIORITY.audience).toContain("user");
      expect(HIGH_PRIORITY.audience).toContain("assistant");
    });

    it("should define MEDIUM_PRIORITY with correct values", () => {
      expect(MEDIUM_PRIORITY.priority).toBe(0.6);
      expect(MEDIUM_PRIORITY.audience).toHaveLength(2);
    });

    it("should define LOW_PRIORITY with correct values", () => {
      expect(LOW_PRIORITY.priority).toBe(0.4);
      expect(LOW_PRIORITY.audience).toHaveLength(2);
    });

    it("should define ASSISTANT_FOCUSED with correct values", () => {
      expect(ASSISTANT_FOCUSED.priority).toBe(0.5);
      expect(ASSISTANT_FOCUSED.audience).toEqual(["assistant"]);
    });
  });

  describe("withPriority helper", () => {
    it("should create annotations with custom priority", () => {
      const result = withPriority(0.75);
      expect(result.priority).toBe(0.75);
      expect(result.audience).toEqual(HIGH_PRIORITY.audience);
    });

    it("should use custom base annotations", () => {
      const result = withPriority(0.3, ASSISTANT_FOCUSED);
      expect(result.priority).toBe(0.3);
      expect(result.audience).toEqual(["assistant"]);
    });
  });

  describe("withTimestamp helper", () => {
    it("should add lastModified timestamp", () => {
      const result = withTimestamp();
      expect(result.lastModified).toBeDefined();
      expect(typeof result.lastModified).toBe("string");
      // Should be ISO format
      expect(result.lastModified).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it("should preserve base annotation properties", () => {
      const result = withTimestamp(HIGH_PRIORITY);
      expect(result.priority).toBe(0.9);
      expect(result.audience).toEqual(HIGH_PRIORITY.audience);
      expect(result.lastModified).toBeDefined();
    });

    it("should use MEDIUM_PRIORITY as default base", () => {
      const result = withTimestamp();
      expect(result.priority).toBe(0.6);
    });
  });
});
