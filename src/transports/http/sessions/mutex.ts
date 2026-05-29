export class Mutex {
  private queue: (() => void)[] = [];
  private locked = false;

  async acquire(): Promise<() => void> {
    return new Promise((resolve) => {
      const lock = (): void => {
        this.locked = true;
        resolve(() => {
          this.locked = false;
          if (this.queue.length > 0) {
            const next = this.queue.shift();
            next?.();
          }
        });
      };
      if (this.locked) {
        this.queue.push(lock);
      } else {
        lock();
      }
    });
  }
}
