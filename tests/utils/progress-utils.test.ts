/**
 * Progress Utilities Tests
 *
 * Tests for MCP progress notification utilities.
 * Target: 0% → 90%+ coverage
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  buildProgressContext,
  sendProgress,
  createBatchProgressReporter,
  type ProgressContext,
} from "../../src/utils/progress-utils.js";
import type { RequestContext } from "../../src/types/index.js";

/** Helper to create mock server with notification spy */
function createMockServer() {
  return {
    notification: vi.fn().mockResolvedValue(undefined),
  };
}

/** Helper to create ProgressContext with mock server */
function createTestProgressContext(
  progressToken: string | number,
): ProgressContext & { server: { notification: ReturnType<typeof vi.fn> } } {
  const server = createMockServer();
  return {
    server: server as unknown as ProgressContext["server"],
    progressToken,
  } as ProgressContext & { server: { notification: ReturnType<typeof vi.fn> } };
}

describe("Progress Utilities", () => {
  describe("buildProgressContext", () => {
    it("should return undefined when context is undefined", () => {
      const result = buildProgressContext(undefined);
      expect(result).toBeUndefined();
    });

    it("should return undefined when server is undefined", () => {
      const ctx: RequestContext = {
        timestamp: new Date(),
        requestId: "test-id",
        progressToken: "token-123",
        // server is undefined
      };
      const result = buildProgressContext(ctx);
      expect(result).toBeUndefined();
    });

    it("should return undefined when progressToken is undefined", () => {
      const mockServer = { notification: vi.fn() };
      const ctx: RequestContext = {
        timestamp: new Date(),
        requestId: "test-id",
        server: mockServer as unknown as RequestContext["server"],
        // progressToken is undefined
      };
      const result = buildProgressContext(ctx);
      expect(result).toBeUndefined();
    });

    it("should return ProgressContext when both server and progressToken exist", () => {
      const mockServer = { notification: vi.fn() };
      const ctx: RequestContext = {
        timestamp: new Date(),
        requestId: "test-id",
        server: mockServer as unknown as RequestContext["server"],
        progressToken: "token-456",
      };
      const result = buildProgressContext(ctx);

      expect(result).toBeDefined();
      expect(result!.progressToken).toBe("token-456");
      expect(result!.server).toBe(mockServer);
    });

    it("should handle numeric progressToken", () => {
      const mockServer = { notification: vi.fn() };
      const ctx: RequestContext = {
        timestamp: new Date(),
        requestId: "test-id",
        server: mockServer as unknown as RequestContext["server"],
        progressToken: 12345,
      };
      const result = buildProgressContext(ctx);

      expect(result).toBeDefined();
      expect(result!.progressToken).toBe(12345);
    });
  });

  describe("sendProgress", () => {
    let mockServer: { notification: ReturnType<typeof vi.fn> };

    beforeEach(() => {
      mockServer = { notification: vi.fn().mockResolvedValue(undefined) };
    });

    it("should not send when context is undefined", async () => {
      await sendProgress(undefined, 50, 100, "Processing...");
      // No error thrown, just returns
    });

    it("should not send when progressToken is undefined", async () => {
      const ctx: ProgressContext = {
        server: mockServer,
        progressToken: undefined,
      };
      await sendProgress(ctx, 50, 100, "Processing...");
      expect(mockServer.notification).not.toHaveBeenCalled();
    });

    it("should send progress notification with all parameters", async () => {
      const ctx: ProgressContext = {
        server: mockServer,
        progressToken: "token-789",
      };
      await sendProgress(ctx, 50, 100, "Halfway done");

      expect(mockServer.notification).toHaveBeenCalledWith({
        method: "notifications/progress",
        params: {
          progressToken: "token-789",
          progress: 50,
          total: 100,
          message: "Halfway done",
        },
      });
    });

    it("should omit total when undefined", async () => {
      const ctx: ProgressContext = {
        server: mockServer,
        progressToken: "token-abc",
      };
      await sendProgress(ctx, 25, undefined, "In progress");

      expect(mockServer.notification).toHaveBeenCalledWith({
        method: "notifications/progress",
        params: {
          progressToken: "token-abc",
          progress: 25,
          message: "In progress",
        },
      });
    });

    it("should omit message when undefined", async () => {
      const ctx: ProgressContext = {
        server: mockServer,
        progressToken: "token-def",
      };
      await sendProgress(ctx, 75, 100);

      expect(mockServer.notification).toHaveBeenCalledWith({
        method: "notifications/progress",
        params: {
          progressToken: "token-def",
          progress: 75,
          total: 100,
        },
      });
    });

    it("should omit message when empty string", async () => {
      const ctx: ProgressContext = {
        server: mockServer,
        progressToken: "token-ghi",
      };
      await sendProgress(ctx, 10, 50, "");

      expect(mockServer.notification).toHaveBeenCalledWith({
        method: "notifications/progress",
        params: {
          progressToken: "token-ghi",
          progress: 10,
          total: 50,
        },
      });
    });

    it("should handle notification errors gracefully", async () => {
      mockServer.notification.mockRejectedValue(new Error("Network error"));
      const ctx: ProgressContext = {
        server: mockServer,
        progressToken: "token-err",
      };

      // Should not throw
      await expect(sendProgress(ctx, 50, 100, "Test")).resolves.toBeUndefined();
    });
  });

  describe("createBatchProgressReporter", () => {
    let mockServer: { notification: ReturnType<typeof vi.fn> };

    beforeEach(() => {
      mockServer = { notification: vi.fn().mockResolvedValue(undefined) };
    });

    it("should throttle progress reports", async () => {
      const ctx: ProgressContext = {
        server: mockServer,
        progressToken: "batch-token",
      };
      const reporter = createBatchProgressReporter(ctx, 100, 10);

      // Process items 1-9 (no reports due to throttle)
      for (let i = 1; i <= 9; i++) {
        await reporter(i);
      }
      expect(mockServer.notification).not.toHaveBeenCalled();

      // Item 10 triggers report
      await reporter(10);
      expect(mockServer.notification).toHaveBeenCalledTimes(1);
    });

    it("should always report completion", async () => {
      const ctx: ProgressContext = {
        server: mockServer,
        progressToken: "batch-token-2",
      };
      const reporter = createBatchProgressReporter(ctx, 15, 10);

      // Process item 15 (completion)
      await reporter(15);
      expect(mockServer.notification).toHaveBeenCalled();
    });

    it("should include message in progress report", async () => {
      const ctx: ProgressContext = {
        server: mockServer,
        progressToken: "batch-token-3",
      };
      const reporter = createBatchProgressReporter(ctx, 50, 10);

      await reporter(10, "Processing batch 1");
      expect(mockServer.notification).toHaveBeenCalledWith(
        expect.objectContaining({
          params: expect.objectContaining({
            message: "Processing batch 1",
          }),
        }),
      );
    });

    it("should work with undefined context", async () => {
      const reporter = createBatchProgressReporter(undefined, 100, 10);

      // Should not throw
      await expect(reporter(10)).resolves.toBeUndefined();
    });

    it("should use default throttle of 10", async () => {
      const ctx: ProgressContext = {
        server: mockServer,
        progressToken: "batch-token-4",
      };
      const reporter = createBatchProgressReporter(ctx, 100);

      await reporter(5);
      expect(mockServer.notification).not.toHaveBeenCalled();

      await reporter(10);
      expect(mockServer.notification).toHaveBeenCalledTimes(1);
    });
  });
});
