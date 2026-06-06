import { describe, it, expect } from "vitest";
import { Mutex } from "../../../../src/transports/http/sessions/mutex.js";

describe("Mutex", () => {
  it("should acquire and release lock", async () => {
    const mutex = new Mutex();
    const order: number[] = [];

    const p1 = mutex.acquire().then(release => {
      order.push(1);
      setTimeout(() => {
        order.push(2);
        release();
      }, 10);
    });

    const p2 = mutex.acquire().then(release => {
      order.push(3);
      release();
    });

    await Promise.all([p1, p2]);

    expect(order).toEqual([1, 2, 3]);
  });
});
