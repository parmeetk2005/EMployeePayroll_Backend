// middleware/cache.js
const { getRedis } = require('../services/redisClient');

function cache(keyPrefix) {
  return async (req, res, next) => {
    try {
      const redis = getRedis();
      const key = `${keyPrefix}:${req.originalUrl || req.url}`;
      const cached = await redis.get(key);
      if (cached) return res.status(200).json(JSON.parse(cached));
      res.locals.cacheKey = key;
      next();
    } catch (e) {
      console.error('Cache middleware error', e);
      next();
    }
  };
}

module.exports = { cache };
