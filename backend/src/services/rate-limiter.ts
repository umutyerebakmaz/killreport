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
  private readonly maxRequestsPerSecond = 50; // Conservative limit (ESI allows 150)
  private readonly minDelayBetweenRequests = 20; // 20ms minimum delay between requests

  /**
   * Execute a function with rate limiting
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        }
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
      // Check if we need to reset the window
      const now = Date.now();
      const elapsed = now - this.windowStart;

      if (elapsed >= 1000) {
        // Reset window
        this.requestCount = 0;
        this.windowStart = now;
      }

      // Check if we're at the limit
      if (this.requestCount >= this.maxRequestsPerSecond) {
        // Wait until the next window
        const waitTime = 1000 - elapsed;
        await this.sleep(waitTime);
        this.requestCount = 0;
        this.windowStart = Date.now();
      }

      // Process next item
      const fn = this.queue.shift();
      if (fn) {
        this.requestCount++;
        await fn();

        // Wait minimum delay between requests
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
