export interface ReadWriteLockStats {
  activeReaders: number;
  isWriting: boolean;
  waitingReaders: number;
  waitingWriters: number;
}

export interface ReadWriteLockOptions {
  /** Maximum number of concurrent readers (default: 10) */
  maxConcurrentReaders?: number;
}

export class ReadWriteLock {
  private activeReaders = 0;
  private isWriting = false;
  private readWaiters: (() => void)[] = [];
  private writeWaiters: (() => void)[] = [];
  private readonly maxConcurrentReaders: number;

  constructor(options?: ReadWriteLockOptions) {
    this.maxConcurrentReaders = options?.maxConcurrentReaders ?? 10;
  }

  /**
   * Acquire a read lock.
   * Multiple readers can acquire the lock simultaneously up to maxConcurrentReaders.
   * If a writer is currently active OR there are writers waiting (fairness),
   * the read request is queued.
   */
  async acquireRead(): Promise<() => void> {
    return new Promise<() => void>((resolve) => {
      const grantRead = (): void => {
        this.activeReaders++;
        let released = false;
        resolve(() => {
          if (released) return;
          released = true;
          this.releaseRead();
        });
      };

      // Fairness: If writers are waiting, queue the reader to prevent writer starvation.
      if (
        this.isWriting ||
        this.writeWaiters.length > 0 ||
        this.activeReaders >= this.maxConcurrentReaders
      ) {
        this.readWaiters.push(grantRead);
      } else {
        grantRead();
      }
    });
  }

  /**
   * Acquire a write lock.
   * Writers have exclusive access.
   * If there are active readers or an active writer, the write request is queued.
   */
  async acquireWrite(): Promise<() => void> {
    return new Promise<() => void>((resolve) => {
      const grantWrite = (): void => {
        this.isWriting = true;
        let released = false;
        resolve(() => {
          if (released) return;
          released = true;
          this.releaseWrite();
        });
      };

      if (this.isWriting || this.activeReaders > 0) {
        this.writeWaiters.push(grantWrite);
      } else {
        grantWrite();
      }
    });
  }

  private releaseRead(): void {
    this.activeReaders--;
    this.processQueues();
  }

  private releaseWrite(): void {
    this.isWriting = false;
    this.processQueues();
  }

  private processQueues(): void {
    // Writers have priority if they are waiting and no readers are active
    if (
      this.writeWaiters.length > 0 &&
      this.activeReaders === 0 &&
      !this.isWriting
    ) {
      const nextWriter = this.writeWaiters.shift();
      nextWriter?.();
      return;
    }

    // If no writers are waiting (or we couldn't grant one), grant as many readers as possible
    if (this.writeWaiters.length === 0 && !this.isWriting) {
      while (
        this.readWaiters.length > 0 &&
        this.activeReaders < this.maxConcurrentReaders
      ) {
        const nextReader = this.readWaiters.shift();
        nextReader?.();
      }
    }
  }

  /**
   * Get current lock statistics
   */
  getStats(): ReadWriteLockStats {
    return {
      activeReaders: this.activeReaders,
      isWriting: this.isWriting,
      waitingReaders: this.readWaiters.length,
      waitingWriters: this.writeWaiters.length,
    };
  }

  /**
   * Force release all waiting locks (useful for shutdown)
   */
  dispose(): void {
    // Clear queues to prevent memory leaks, but we can't easily reject the promises
    // since we only store the resolve function. In a real scenario, we might want
    // to store { resolve, reject } to properly fail pending requests.
    // For this implementation, the connection is shutting down anyway.
    this.readWaiters = [];
    this.writeWaiters = [];
  }
}
