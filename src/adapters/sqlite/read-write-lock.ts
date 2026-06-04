import { ConnectionError } from "../../utils/errors/index.js";

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

interface LockRequest {
  resolve: (release: () => void) => void;
  reject: (err: Error) => void;
}

export class ReadWriteLock {
  private activeReaders = 0;
  private isWriting = false;
  
  private readWaiters: LockRequest[] = [];
  private readHead = 0;
  
  private writeWaiters: LockRequest[] = [];
  private writeHead = 0;
  
  private readonly maxConcurrentReaders: number;
  private consecutiveWriters = 0;
  private readonly MAX_CONSECUTIVE_WRITERS = 5;

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
    return new Promise<() => void>((resolve, reject) => {
      const grantRead = (): void => {
        this.activeReaders++;
        let released = false;
        resolve(() => {
          if (released) return;
          released = true;
          this.releaseRead();
        });
      };

      // Fairness: If writers are waiting and we haven't hit the consecutive writers limit, queue the reader.
      const writersWaiting = this.writeWaiters.length - this.writeHead > 0;
      if (
        this.isWriting ||
        (writersWaiting && this.consecutiveWriters < this.MAX_CONSECUTIVE_WRITERS) ||
        this.activeReaders >= this.maxConcurrentReaders
      ) {
        this.readWaiters.push({ resolve: grantRead, reject });
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
    return new Promise<() => void>((resolve, reject) => {
      const grantWrite = (): void => {
        this.isWriting = true;
        this.consecutiveWriters++;
        let released = false;
        resolve(() => {
          if (released) return;
          released = true;
          this.releaseWrite();
        });
      };

      if (this.isWriting || this.activeReaders > 0) {
        this.writeWaiters.push({ resolve: grantWrite, reject });
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

  private popReader(): LockRequest | undefined {
    if (this.readHead >= this.readWaiters.length) return undefined;
    const req = this.readWaiters[this.readHead++];
    if (this.readHead > 100) {
      this.readWaiters = this.readWaiters.slice(this.readHead);
      this.readHead = 0;
    }
    return req;
  }

  private popWriter(): LockRequest | undefined {
    if (this.writeHead >= this.writeWaiters.length) return undefined;
    const req = this.writeWaiters[this.writeHead++];
    if (this.writeHead > 100) {
      this.writeWaiters = this.writeWaiters.slice(this.writeHead);
      this.writeHead = 0;
    }
    return req;
  }

  private processQueues(): void {
    const writersWaiting = this.writeWaiters.length - this.writeHead > 0;
    const readersWaiting = this.readWaiters.length - this.readHead > 0;

    // Reset consecutive writers if no writers are waiting, or if we force a reader to prevent starvation
    if (!writersWaiting || (readersWaiting && this.consecutiveWriters >= this.MAX_CONSECUTIVE_WRITERS)) {
      this.consecutiveWriters = 0;
    }

    // Writers have priority if they are waiting, no readers are active, and fairness allows it
    if (
      writersWaiting &&
      this.activeReaders === 0 &&
      !this.isWriting &&
      this.consecutiveWriters < this.MAX_CONSECUTIVE_WRITERS
    ) {
      const nextWriter = this.popWriter();
      nextWriter?.resolve(() => undefined); // resolve is actually the grantWrite closure which handles the arg internally
      // Wait, grantWrite doesn't take an arg, but we typed resolve as taking a release function.
      // Let's just call it. The grantWrite closure in the Promises handles everything.
      return;
    }

    // Grant as many readers as possible
    if (!this.isWriting && (!writersWaiting || this.consecutiveWriters >= this.MAX_CONSECUTIVE_WRITERS)) {
      while (
        this.readWaiters.length - this.readHead > 0 &&
        this.activeReaders < this.maxConcurrentReaders
      ) {
        const nextReader = this.popReader();
        nextReader?.resolve(() => undefined);
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
      waitingReaders: this.readWaiters.length - this.readHead,
      waitingWriters: this.writeWaiters.length - this.writeHead,
    };
  }

  /**
   * Force release all waiting locks (useful for shutdown)
   */
  dispose(): void {
    const cancelError = new ConnectionError("Database connection shutting down", "CONNECTION_CLOSED");
    
    for (let i = this.readHead; i < this.readWaiters.length; i++) {
      this.readWaiters[i]?.reject(cancelError);
    }
    
    for (let i = this.writeHead; i < this.writeWaiters.length; i++) {
      this.writeWaiters[i]?.reject(cancelError);
    }

    this.readWaiters = [];
    this.readHead = 0;
    this.writeWaiters = [];
    this.writeHead = 0;
  }
}
