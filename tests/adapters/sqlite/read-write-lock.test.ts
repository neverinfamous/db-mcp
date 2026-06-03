import { describe, it, expect } from "vitest";
import { ReadWriteLock } from "../../../src/adapters/sqlite/read-write-lock.js";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("ReadWriteLock", () => {
  it("allows multiple concurrent readers", async () => {
    const lock = new ReadWriteLock({ maxConcurrentReaders: 3 });

    const r1 = await lock.acquireRead();
    const r2 = await lock.acquireRead();
    const r3 = await lock.acquireRead();

    expect(lock.getStats().activeReaders).toBe(3);
    expect(lock.getStats().waitingReaders).toBe(0);

    // 4th reader should be queued
    let r4Acquired = false;
    const r4Promise = lock.acquireRead().then((release) => {
      r4Acquired = true;
      return release;
    });

    await delay(10);
    expect(r4Acquired).toBe(false);
    expect(lock.getStats().waitingReaders).toBe(1);

    // Release one, r4 should acquire
    r1();
    const r4 = await r4Promise;
    expect(r4Acquired).toBe(true);
    expect(lock.getStats().activeReaders).toBe(3);

    r2();
    r3();
    r4();
    expect(lock.getStats().activeReaders).toBe(0);
  });

  it("gives exclusive access to writers", async () => {
    const lock = new ReadWriteLock();

    const w1 = await lock.acquireWrite();
    expect(lock.getStats().isWriting).toBe(true);

    let r1Acquired = false;
    const r1Promise = lock.acquireRead().then((release) => {
      r1Acquired = true;
      return release;
    });

    let w2Acquired = false;
    const w2Promise = lock.acquireWrite().then((release) => {
      w2Acquired = true;
      return release;
    });

    await delay(10);
    expect(r1Acquired).toBe(false);
    expect(w2Acquired).toBe(false);
    expect(lock.getStats().waitingReaders).toBe(1);
    expect(lock.getStats().waitingWriters).toBe(1);

    // Release writer 1
    w1();

    // Writers have priority over readers when waiting
    const w2 = await w2Promise;
    expect(w2Acquired).toBe(true);
    expect(r1Acquired).toBe(false);

    w2();
    const r1 = await r1Promise;
    expect(r1Acquired).toBe(true);
    r1();
  });

  it("prevents writer starvation (fairness)", async () => {
    const lock = new ReadWriteLock();

    const r1 = await lock.acquireRead();

    let w1Acquired = false;
    const w1Promise = lock.acquireWrite().then((release) => {
      w1Acquired = true;
      return release;
    });

    await delay(10);
    expect(w1Acquired).toBe(false);

    // A new reader arrives. Because a writer is waiting, the reader should be queued.
    let r2Acquired = false;
    const r2Promise = lock.acquireRead().then((release) => {
      r2Acquired = true;
      return release;
    });

    await delay(10);
    expect(r2Acquired).toBe(false);
    expect(lock.getStats().waitingReaders).toBe(1);

    // Release first reader. Writer should now acquire.
    r1();
    const w1 = await w1Promise;
    expect(w1Acquired).toBe(true);
    expect(r2Acquired).toBe(false);

    // Release writer. Second reader should now acquire.
    w1();
    const r2 = await r2Promise;
    expect(r2Acquired).toBe(true);
    r2();
  });
});
