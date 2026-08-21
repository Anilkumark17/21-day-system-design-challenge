const { getBucket } = require("./tokenBucketQueue");

const rateLimit = ({
  capacity = 10,
  refillRate = 2,
  maxQueueSize = 50,
  maxWaitMs = 5000,
  keyFn,
}) => {
  return async (req, res, next) => {
    const key = keyFn ? keyFn(req) : req.ip;
    const bucket = getBucket(key, {
      capacity,
      refillRate,
      maxQueueSize,
      maxWaitMs,
    });

    try {
      await bucket.acquire();
      next();
    } catch (err) {
      if (err.message === "QUEUE_FULL") {
        return res.status(429).json({ error: "Too many requests, queue full" });
      }
      if (err.message === "TIMEOUT") {
        return res
          .status(429)
          .json({ error: "Request timed out waiting for rate limit slot" });
      }
      next(err);
    }
  };
};

module.exports = rateLimit;
