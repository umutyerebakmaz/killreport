import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';

interface RateLimitState {
  remainingRequests: number;
  resetTime: Date | null;
  errorLimitRemaining: number;
  errorResetTime: Date | null;
}

class ESIRateLimiter {
  private state: RateLimitState = {
    remainingRequests: 100,
    resetTime: null,
    errorLimitRemaining: 100,
    errorResetTime: null,
  };

  private queue: Array<{
    resolve: (value: any) => void;
    reject: (reason: any) => void;
    config: AxiosRequestConfig;
  }> = [];

  private processing = false;

  /**
   * ESI API'ye rate limit kurallarına uygun istek gönderir
   */
  async request<T = any>(config: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return new Promise((resolve, reject) => {
      this.queue.push({ resolve, reject, config });
      this.processQueue();
    });
  }

  private async processQueue() {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0) {
      // Error limit kontrolü
      if (this.errorLimitRemaining <= 10) {
        const waitTime = this.getErrorLimitWaitTime();
        if (waitTime > 0) {
          console.log(`ESI error limit reached. Waiting ${waitTime}ms...`);
          await this.sleep(waitTime);
          this.resetErrorLimit();
        }
      }

      // Normal rate limit kontrolü
      if (this.remainingRequests <= 5) {
        const waitTime = this.getRateLimitWaitTime();
        if (waitTime > 0) {
          console.log(`ESI rate limit reached. Waiting ${waitTime}ms...`);
          await this.sleep(waitTime);
          this.resetRateLimit();
        }
      }

      const item = this.queue.shift();
      if (!item) break;

      try {
        const response = await axios(item.config);
        this.updateLimitsFromResponse(response);
        item.resolve(response);
      } catch (error: any) {
        if (error.response) {
          this.updateLimitsFromResponse(error.response);

          // 420 Error Limited durumunda bekle
          if (error.response.status === 420) {
            const retryAfter = parseInt(error.response.headers['x-esi-error-limit-reset'] || '60');
            console.log(`ESI Error Limited (420). Retrying after ${retryAfter}s...`);
            await this.sleep(retryAfter * 1000);
            // İsteği tekrar kuyruğa ekle
            this.queue.unshift(item);
            continue;
          }
        }
        item.reject(error);
      }

      // Her istek arasında küçük bir gecikme
      await this.sleep(100);
    }

    this.processing = false;
  }

  private updateLimitsFromResponse(response: AxiosResponse) {
    const headers = response.headers;

    // Rate limit bilgileri
    if (headers['x-esi-error-limit-remain']) {
      this.errorLimitRemaining = parseInt(headers['x-esi-error-limit-remain']);
    }
    if (headers['x-esi-error-limit-reset']) {
      const resetSeconds = parseInt(headers['x-esi-error-limit-reset']);
      this.errorResetTime = new Date(Date.now() + resetSeconds * 1000);
    }

    // Normal rate limit (bazı endpoint'lerde mevcut)
    if (headers['x-pages']) {
      // Paginated request
      this.remainingRequests = Math.max(0, this.remainingRequests - 1);
    }
  }

  private getRateLimitWaitTime(): number {
    if (!this.resetTime) {
      return 0;
    }
    return Math.max(0, this.resetTime.getTime() - Date.now());
  }

  private getErrorLimitWaitTime(): number {
    if (!this.errorResetTime) {
      return 0;
    }
    return Math.max(0, this.errorResetTime.getTime() - Date.now());
  }

  private resetRateLimit() {
    this.remainingRequests = 100;
    this.resetTime = null;
  }

  private resetErrorLimit() {
    this.errorLimitRemaining = 100;
    this.errorResetTime = null;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  get remainingRequests(): number {
    return this.state.remainingRequests;
  }

  set remainingRequests(value: number) {
    this.state.remainingRequests = value;
  }

  get errorLimitRemaining(): number {
    return this.state.errorLimitRemaining;
  }

  set errorLimitRemaining(value: number) {
    this.state.errorLimitRemaining = value;
  }

  get resetTime(): Date | null {
    return this.state.resetTime;
  }

  set resetTime(value: Date | null) {
    this.state.resetTime = value;
  }

  get errorResetTime(): Date | null {
    return this.state.errorResetTime;
  }

  set errorResetTime(value: Date | null) {
    this.state.errorResetTime = value;
  }

  /**
   * Mevcut rate limit durumunu döndürür
   */
  getStatus() {
    return {
      remainingRequests: this.state.remainingRequests,
      resetTime: this.state.resetTime,
      errorLimitRemaining: this.state.errorLimitRemaining,
      errorResetTime: this.state.errorResetTime,
      queueLength: this.queue.length,
    };
  }
}

// Singleton instance
export const esiRateLimiter = new ESIRateLimiter();
