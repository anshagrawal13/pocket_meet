import httpStatus from "http-status";

// Tiny in-memory limiter (no extra dependency). Good enough to slow down
// password guessing on a single server instance.
export const rateLimit = ({ windowMs, max, keyFn }) => {
  const hits = new Map();
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of hits) if (v.reset <= now) hits.delete(k);
  }, windowMs).unref();

  return (req, res, next) => {
    const key = keyFn(req);
    const now = Date.now();
    let entry = hits.get(key);
    if (!entry || entry.reset <= now) {
      entry = { count: 0, reset: now + windowMs };
      hits.set(key, entry);
    }
    entry.count += 1;
    if (entry.count > max) {
      return res
        .status(httpStatus.TOO_MANY_REQUESTS)
        .json({ message: "Too many attempts. Please try again later." });
    }
    next();
  };
};
