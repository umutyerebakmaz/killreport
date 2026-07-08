/**
 * ESI Rate Limiter
 * Ensures we never exceed ESI's rate limits
 * ESI Limit: 150 requests per second (we use 50 for safety margin)
 */

class RateLimiter {
  private queue: Array<() => void> = [];
  private processing = false;
  private requestCount = 0;
  private windowStart = Date.now();
  private inFlight = 0;
  private readonly maxRequestsPerSecond = 50; // Conservative limit (ESI allows 150)
  private readonly minDelayBetweenRequests = 20; // 20ms minimum delay between dispatches
  private readonly maxConcurrent = 50; // Cap simultaneous in-flight requests

  /**
   * Execute a function with rate limiting.
   * Requests are DISPATCHED at up to `maxRequestsPerSecond` and run concurrently
   * (we do not wait for one request to finish before dispatching the next).
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(() => {
        this.inFlight++;
        (async () => {
          try {
            resolve(await fn());
          } catch (error) {
            reject(error);
          } finally {
            this.inFlight--;
          }
        })();
      });

      this.processQueue();
    });
  }

  private async processQueue() {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0) {
      // Check if we need to reset the rate window
      const now = Date.now();
      const elapsed = now - this.windowStart;

      if (elapsed >= 1000) {
        this.requestCount = 0;
        this.windowStart = now;
      }

      // Respect the per-second dispatch ceiling
      if (this.requestCount >= this.maxRequestsPerSecond) {
        await this.sleep(1000 - elapsed);
        continue;
      }

      // Respect the max concurrent in-flight ceiling
      if (this.inFlight >= this.maxConcurrent) {
        await this.sleep(this.minDelayBetweenRequests);
        continue;
      }

      // Dispatch next item WITHOUT awaiting its completion so requests overlap
      const fn = this.queue.shift();
      if (fn) {
        this.requestCount++;
        fn();

        // Space out dispatches (50/sec => 20ms apart)
        await this.sleep(this.minDelayBetweenRequests);
      }
    }

    this.processing = false;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get current rate limiter stats
   */
  getStats() {
    return {
      queueLength: this.queue.length,
      requestCount: this.requestCount,
      maxRequestsPerSecond: this.maxRequestsPerSecond,
    };
  }
}

// Singleton instance
export const esiRateLimiter = new RateLimiter();
