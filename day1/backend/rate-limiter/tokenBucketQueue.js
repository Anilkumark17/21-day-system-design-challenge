class TokenBucketQueue {
  constructor({ capacity, refillRate, maxQueueSize = 50, maxWaitMs = 5000 }) {
    this.capacity = capacity;
    this.refillRate = refillRate;
    this.maxQueueSize = maxQueueSize;
    this.maxWaitMs = maxWaitMs;

    this.tokens = capacity;
    this.lastRefill = Date.now();
    this.queue = [];
    this.timer = null;
  }

  _refill() {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillRate);
    this.lastRefill = now;
  }

  _processQueue() {
    this._refill();

    while (this.queue.length > 0 && this.tokens >= 1) {
      const next = this.queue.shift();
      this.tokens -= 1;

      const waited = Date.now() - next.enqueuedAt;
      if (waited > this.maxWaitMs) {
        next.reject(new Error("TIMEOUT"));
      } else {
        next.resolve();
      }
    }

    if (this.queue.length > 0) {
      const msPerToken = 1000 / this.refillRate;
      clearTimeout(this.timer);
      this.timer = setTimeout(() => this._processQueue(), msPerToken);
    }
  }

  acquire() {
    this._refill();

    if (this.tokens >= 1) {
      this.tokens -= 1;
      return Promise.resolve();
    }

    if (this.queue.length >= this.maxQueueSize) {
      return Promise.reject(new Error("QUEUE_FULL"));
    }

    return new Promise((resolve, reject) => {
      this.queue.push({ resolve, reject, enqueuedAt: Date.now() });
      this._processQueue();
    });
  }
}

const buckets = new Map();

const getBucket = (key, opts) => {
  if (!buckets.has(key)) {
    buckets.set(key, new TokenBucketQueue(opts));
  }
  return buckets.get(key);
};

module.exports = { getBucket, TokenBucketQueue };
