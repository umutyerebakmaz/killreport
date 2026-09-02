/**
 * ESI Rate Limiter
 * Ensures we never exceed ESI's rate limits.
 * ESI's limit is 150 requests per second. The ceiling here is per PROCESS and
 * comes from ESI_MAX_RPS (default 50, the project's safety margin). Every
 * worker runs in its own process with its own instance, so the budget is shared
 * by however many are running at once: two at 50 is 100 req/sec, and a single
 * worker with the run to itself can be given the whole 150.
 */

import { config } from '@config/config';

class RateLimiter {
  private queue: Array<() => void> = [];
  private processing = false;
  private requestCount = 0;
  private windowStart = Date.now();
  private inFlight = 0;
  private readonly maxRequestsPerSecond = config.esi.maxRequestsPerSecond;
  // Dispatch spacing that produces the configured rate: 50/sec => 20ms apart.
  private readonly minDelayBetweenRequests = Math.max(
    1,
    Math.floor(1000 / config.esi.maxRequestsPerSecond),
  );
  // In-flight cap has to scale with the rate, or it becomes the real ceiling.
  private readonly maxConcurrent = Math.max(
    50,
    config.esi.maxRequestsPerSecond,
  );

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

        // Space out dispatches at the configured rate.
        await this.sleep(this.minDelayBetweenRequests);
      }
    }

    this.processing = false;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
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
