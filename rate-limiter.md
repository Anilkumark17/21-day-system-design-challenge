# Rate Limiter Notes

A beginner-friendly guide to understanding **rate limiting**, the **token bucket algorithm**, how a hold-and-queue approach smooths traffic instead of instantly rejecting bursts, and how this project implements a custom Express middleware with `TokenBucketQueue`.

---

# Table of Contents

- What is Rate Limiting?
- Why Rate Limiting?
- Common Algorithms
- Token Bucket Algorithm
- Hold vs Reject
- Internal Working
- Architecture in This Project
- TokenBucketQueue
- Rate Limit Middleware
- Integration with Express
- Configuration
- Error Responses
- Tradeoffs and Limitations
- File Structure
- How to Test
- Summary
- Key Takeaways

---

# What is Rate Limiting?

**Rate limiting** controls how many requests a client can make to your server within a given time window.

```
Client sends many requests
        │
        ▼
Rate limiter checks: "Are you allowed?"
        │
        ├── Yes → request proceeds
        └── No  → reject (429) or make request wait
```

Without rate limiting, a single client (or attacker) can:

- Overwhelm your server with traffic
- Brute-force login endpoints
- Abuse expensive database queries
- Degrade performance for everyone else

Rate limiting protects your API by enforcing a **maximum throughput** per client.

---

# Why Rate Limiting?

| Problem | Rate limiting helps by… |
|---------|-------------------------|
| DDoS / abuse | Capping requests per IP or user |
| Brute-force attacks | Slowing login attempts |
| Accidental loops | Stopping runaway client retries |
| Resource exhaustion | Keeping DB/CPU usage predictable |

In this project, all `/api/*` routes are protected by a custom token bucket rate limiter.

---

# Common Algorithms

| Algorithm | Behavior | Typical use |
|-----------|----------|-------------|
| **Fixed window** | X requests per minute, reset at window boundary | Simple APIs |
| **Sliding window** | Smoother count over rolling time period | More accurate limits |
| **Token bucket** | Tokens refill over time; burst allowed up to capacity | APIs with burst tolerance |
| **Leaky bucket** | Requests processed at a steady rate (queue) | Traffic shaping |

This project uses a **token bucket with a queue** — a hybrid that allows short bursts, then **holds** excess requests in line instead of rejecting them immediately.

---

# Token Bucket Algorithm

Imagine a bucket that holds **tokens**:

```
Capacity: 5 tokens (max the bucket can hold)
Refill rate: 1 token per second
```

```
┌─────────────────┐
│  ● ● ● ● ○      │  ← 4 tokens available
│     BUCKET      │
└─────────────────┘
        ▲
        │ refills at 1 token/sec
```

Rules:

1. Each **request consumes 1 token**
2. If tokens are available → request proceeds **immediately**
3. If bucket is **empty** → request waits in a **queue**
4. Tokens **refill continuously** over time (not all at once at midnight)
5. Refill never exceeds **capacity** (max burst size)

Example with `capacity: 5`, `refillRate: 1`:

```
t=0s   5 requests arrive → all pass (5 tokens used, bucket empty)
t=0s   6th request       → waits in queue
t=1s   1 token refilled  → 6th request proceeds
t=1s   7th request       → waits again
```

This allows **bursts** up to capacity, then smooths to `refillRate` requests per second.

---

# Hold vs Reject

Two philosophies when the limit is exceeded:

## Instant reject (traditional)

```
Request → no token? → 429 Too Many Requests (immediately)
```

Simple, but harsh on legitimate burst traffic (e.g. page load firing 10 parallel API calls).

## Hold and queue (this project)

```
Request → no token? → wait in queue → proceed when token available
                     → 429 only if queue full or wait too long
```

```
Burst of 20 requests (capacity = 5)
        │
        ▼
5 proceed immediately
15 wait in queue
        │
        ▼
Tokens refill at 1/sec → queued requests proceed one by one
```

**Benefit:** Traffic is **smoothed** to a steady rate instead of dropped.

**Tradeoff:** The HTTP connection stays **open while waiting**, which can exhaust server connection pools under heavy load.

This pattern is conceptually closer to a **leaky bucket** — bursty input is shaped into steady output.

---

# Internal Working

## End-to-end flow

```
HTTP Request → /api/*
        │
        ▼
rateLimit middleware
        │
        ├── keyFn(req) → "user:42" or "ip:127.0.0.1"
        │
        ▼
getBucket(key) → TokenBucketQueue for that key
        │
        ▼
bucket.acquire()
        │
        ├── token available? → consume token → next()
        │
        └── no token?
                ├── queue full? → 429 QUEUE_FULL
                └── enqueue → wait...
                        │
                        ▼
                _processQueue() when token refills
                        │
                        ├── waited > maxWaitMs? → 429 TIMEOUT
                        └── else → next()
```

## Per-key buckets

Each user (or IP) gets their **own bucket**:

```javascript
const buckets = new Map();
// "user:1"  → TokenBucketQueue
// "user:2"  → TokenBucketQueue
// "ip:127.0.0.1" → TokenBucketQueue
```

User A's traffic does not affect User B's limits.

---

# Architecture in This Project

```
backend/index.js
       │
       ▼
app.use("/api", rateLimit({ ... }))
       │
       ▼
rate-limiter/rate-limiter-middleware.js
       │
       ├── keyFn → user ID from JWT, or IP
       │
       ▼
rate-limiter/tokenBucketQueue.js
       │
       ├── getBucket(key) → Map of TokenBucketQueue instances
       │
       └── TokenBucketQueue.acquire()
                │
                ▼
       protectedRoute → contacts, notifications, dashboard
```

Only `/api/*` routes are rate limited. `/auth` and `/` are not (login/register need separate limits in production).

---

# TokenBucketQueue

**File:** `backend/rate-limiter/tokenBucketQueue.js`

## Constructor options

| Option | Default | Meaning |
|--------|---------|---------|
| `capacity` | required | Max tokens (burst size) |
| `refillRate` | required | Tokens added per second |
| `maxQueueSize` | 50 | Max waiting requests |
| `maxWaitMs` | 5000 | Max time a queued request waits |

## State

```javascript
this.tokens = capacity;       // current available tokens
this.lastRefill = Date.now(); // last time tokens were calculated
this.queue = [];              // waiting requests
this.timer = null;            // scheduled queue processor
```

## `_refill()`

Calculates how many tokens to add based on elapsed time:

```javascript
const elapsed = (now - this.lastRefill) / 1000;
this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillRate);
```

Tokens accumulate continuously — if 2 seconds pass at `refillRate: 1`, you gain 2 tokens (capped at capacity).

## `acquire()`

Returns a **Promise** that resolves when a token is granted:

```javascript
// Fast path — token available now
if (this.tokens >= 1) {
  this.tokens -= 1;
  return Promise.resolve();
}

// Queue full — reject immediately
if (this.queue.length >= this.maxQueueSize) {
  return Promise.reject(new Error("QUEUE_FULL"));
}

// Wait in queue
return new Promise((resolve, reject) => {
  this.queue.push({ resolve, reject, enqueuedAt: Date.now() });
  this._processQueue();
});
```

## `_processQueue()`

Runs when tokens may be available:

1. Refill tokens
2. While queue has entries AND tokens ≥ 1:
   - Dequeue next request
   - Consume 1 token
   - If waited > `maxWaitMs` → reject with `TIMEOUT`
   - Else → resolve (request proceeds)
3. If queue still has entries → schedule timer for next token

```javascript
const msPerToken = 1000 / this.refillRate;
setTimeout(() => this._processQueue(), msPerToken);
```

---

# Rate Limit Middleware

**File:** `backend/rate-limiter/rate-limiter-middleware.js`

```javascript
const rateLimit = ({ capacity, refillRate, maxQueueSize, maxWaitMs, keyFn }) => {
  return async (req, res, next) => {
    const key = keyFn ? keyFn(req) : req.ip;
    const bucket = getBucket(key, { capacity, refillRate, maxQueueSize, maxWaitMs });

    try {
      await bucket.acquire();  // may wait here
      next();
    } catch (err) {
      if (err.message === "QUEUE_FULL") {
        return res.status(429).json({ error: "Too many requests, queue full" });
      }
      if (err.message === "TIMEOUT") {
        return res.status(429).json({ error: "Request timed out waiting for rate limit slot" });
      }
      next(err);
    }
  };
};
```

Because `acquire()` returns a Promise, the middleware is `async` — Express waits until a token is granted before calling `next()`.

---

# Integration with Express

**File:** `backend/index.js`

```javascript
const rateLimit = require("./rate-limiter/rate-limiter-middleware");
const { verifyToken } = require("./src/utils/jwt");

const getRateLimitKey = (req) => {
  const authHeader = req.headers.authorization;

  if (authHeader?.startsWith("Bearer ")) {
    try {
      const user = verifyToken(authHeader.split(" ")[1]);
      return `user:${user.userId}`;
    } catch {
      // Invalid token — fall through to IP
    }
  }

  return `ip:${req.ip}`;
};

app.use("/api", rateLimit({
  capacity: 5,
  refillRate: 1,
  maxQueueSize: 20,
  maxWaitMs: 5000,
  keyFn: getRateLimitKey,
}));

app.use("/api", protectedRoute);
```

**Key function logic:**

- Authenticated request → limit per **user ID** (fair per account)
- Unauthenticated / invalid token → limit per **IP address**

Middleware order matters: rate limiter runs **before** route handlers but after `express.json()`.

---

# Configuration

Environment variables (with defaults):

| Variable | Default | Description |
|----------|---------|-------------|
| `RATE_LIMIT_CAPACITY` | `5` | Max burst (bucket size) |
| `RATE_LIMIT_REFILL_RATE` | `1` | Tokens per second |
| `RATE_LIMIT_MAX_QUEUE` | `20` | Max queued requests per key |
| `RATE_LIMIT_MAX_WAIT_MS` | `5000` | Max wait time in queue (ms) |

Example `.env` for stricter limits:

```env
RATE_LIMIT_CAPACITY=3
RATE_LIMIT_REFILL_RATE=0.5
RATE_LIMIT_MAX_QUEUE=10
RATE_LIMIT_MAX_WAIT_MS=3000
```

With these settings: burst of 3, then ~1 request every 2 seconds sustained.

---

# Error Responses

| Condition | Status | Response |
|-----------|--------|----------|
| Queue full | `429` | `{ "error": "Too many requests, queue full" }` |
| Wait timeout | `429` | `{ "error": "Request timed out waiting for rate limit slot" }` |

These differ from instant-reject limiters — you only see 429 when the **queue** is saturated or a request **waited too long**, not on the first request over capacity.

---

# Tradeoffs and Limitations

## 1. Holds HTTP connections open

While waiting for a token, the TCP connection stays alive. Under heavy load this can exhaust your server's max concurrent connections.

```
Many clients waiting in queue
        │
        ▼
Connection pool fills up
        │
        ▼
New clients can't connect at all
```

**Mitigation:** Lower `maxQueueSize`, use shorter `maxWaitMs`, or switch to instant reject for public APIs.

## 2. In-memory, per-process

```javascript
const buckets = new Map();  // lives in one Node.js process
```

If you run **multiple server instances** behind a load balancer, each instance has its own buckets — limits are **not coordinated** across instances.

```
Load balancer
    ├── Instance A (own buckets)
    └── Instance B (own buckets)

User could send 5 req/s to A AND 5 req/s to B
```

**For distributed rate limiting:** use Redis-backed solutions (e.g. `rate-limiter-flexible`, or a job queue like BullMQ for hold-and-queue patterns).

## 3. No persistence across restarts

Server restart → all bucket state and queues are lost. Acceptable for this learning project.

## 4. `/auth` is not rate limited

Login and register routes are outside `/api`. In production, add a separate stricter limiter on `/auth` to prevent brute-force attacks.

---

# File Structure

```
backend/
  index.js                                    ← mounts rate limiter on /api

  rate-limiter/
    tokenBucketQueue.js                       ← TokenBucketQueue class + getBucket()
    rate-limiter-middleware.js                ← Express middleware

  src/routes/protected.route.js               ← rate-limited routes
  src/middleware/auth.middleware.js           ← auth runs after rate limit
```

---

# How to Test

## 1. Start the backend

```bash
cd day1/backend
npm run dev
```

## 2. Burst test with curl

Send 10 rapid requests (capacity = 5):

```bash
for i in {1..10}; do
  curl -s -o /dev/null -w "%{http_code} " \
    -H "Authorization: Bearer YOUR_JWT" \
    http://localhost:5000/api/dashboard
done
echo
```

Expected: first 5 return `200` quickly; remaining wait and return `200` as tokens refill (or `429` if queue fills).

## 3. Queue full test

Lower limits for testing:

```env
RATE_LIMIT_CAPACITY=1
RATE_LIMIT_REFILL_RATE=0.1
RATE_LIMIT_MAX_QUEUE=2
RATE_LIMIT_MAX_WAIT_MS=1000
```

Fire many parallel requests — some should get `429` with `"queue full"`.

## 4. Observe timing

Queued requests should **not** all fail instantly — they should complete over time as tokens refill, demonstrating traffic smoothing.

---

# Summary

| Concept | This project |
|---------|--------------|
| Algorithm | Token bucket with queue |
| Strategy | Hold and wait (not instant reject) |
| Scope | `/api/*` routes |
| Key | User ID (JWT) or IP |
| Default burst | 5 requests |
| Sustained rate | 1 request/second |
| Library | Custom (no express-rate-limit) |
| Storage | In-memory Map (single process) |

| Response | When |
|----------|------|
| `200` | Token granted (immediately or after wait) |
| `429 queue full` | Queue exceeded `maxQueueSize` |
| `429 timeout` | Request waited longer than `maxWaitMs` |

---

# Key Takeaways

- **Rate limiting** protects APIs from abuse and overload by capping request throughput.
- The **token bucket** allows bursts up to `capacity`, then refills at `refillRate` tokens per second.
- This implementation **queues** excess requests instead of instantly returning 429 — smoothing bursty traffic into a steady rate.
- `acquire()` returns a Promise — the middleware **holds the HTTP connection** until a token is available.
- Each user/IP gets an independent bucket via `getBucket(key)`.
- Limits are **in-memory and per-process** — not suitable for multi-instance production without Redis.
- Watch **connection pool exhaustion** under heavy queued load — the core tradeoff of hold vs reject.
- Configure via environment variables: capacity, refill rate, queue size, and max wait time.
