import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  streamResultRows,
  STREAM_CHUNK_SIZE,
} from "../../src/utils/stream-utils.js";
import type { ProgressContext } from "../../src/utils/progress-utils.js";
import * as progressUtils from "../../src/utils/progress-utils.js";

// Mock the sendProgress function
vi.mock("../../src/utils/progress-utils.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../src/utils/progress-utils.js")>();
  return {
    ...actual,
    sendProgress: vi.fn().mockResolvedValue(undefined),
  };
});

describe("streamResultRows", () => {
  let mockCtx: ProgressContext;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCtx = {
      progressToken: "test-token",
      server: { notification: vi.fn() } as any,
    };
  });

  it("should return 0 when rows is empty", async () => {
    const emitted = await streamResultRows(mockCtx, []);
    expect(emitted).toBe(0);
    expect(progressUtils.sendProgress).not.toHaveBeenCalled();
  });

  it("should stream exactly one chunk when rows <= chunk size", async () => {
    const rows = Array.from({ length: 5 }, (_, i) => ({ id: i }));
    const emitted = await streamResultRows(mockCtx, rows, 10);

    expect(emitted).toBe(1);
    expect(progressUtils.sendProgress).toHaveBeenCalledTimes(1);
    expect(progressUtils.sendProgress).toHaveBeenCalledWith(
      mockCtx,
      1,
      1,
      JSON.stringify(rows),
    );
  });

  it("should stream multiple chunks correctly", async () => {
    const rows = Array.from({ length: 25 }, (_, i) => ({ id: i }));
    const emitted = await streamResultRows(mockCtx, rows, 10);

    expect(emitted).toBe(3);
    expect(progressUtils.sendProgress).toHaveBeenCalledTimes(3);

    // Check first chunk (10 rows)
    expect(progressUtils.sendProgress).toHaveBeenNthCalledWith(
      1,
      mockCtx,
      1,
      3,
      JSON.stringify(rows.slice(0, 10)),
    );

    // Check second chunk (10 rows)
    expect(progressUtils.sendProgress).toHaveBeenNthCalledWith(
      2,
      mockCtx,
      2,
      3,
      JSON.stringify(rows.slice(10, 20)),
    );

    // Check third chunk (5 rows)
    expect(progressUtils.sendProgress).toHaveBeenNthCalledWith(
      3,
      mockCtx,
      3,
      3,
      JSON.stringify(rows.slice(20, 25)),
    );
  });

  it("should use STREAM_CHUNK_SIZE default", async () => {
    const rows = Array.from({ length: STREAM_CHUNK_SIZE + 2 }, (_, i) => ({
      id: i,
    }));
    const emitted = await streamResultRows(mockCtx, rows);

    expect(emitted).toBe(2);
    expect(progressUtils.sendProgress).toHaveBeenCalledTimes(2);
  });

  it("should handle invalid chunk size gracefully (min 1)", async () => {
    const rows = [{ id: 1 }, { id: 2 }];
    const emitted = await streamResultRows(mockCtx, rows, -5);

    // Should default to 1
    expect(emitted).toBe(2);
    expect(progressUtils.sendProgress).toHaveBeenCalledTimes(2);
  });
});
