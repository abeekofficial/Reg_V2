// cache/redis.js
const Redis  = require("ioredis");
const config = require("../config");
const logger = require("../utils/logger");

let client = null;

function getRedis() {
  if (client) return client;

  const redisUrl  = process.env.REDIS_URL;
  const redisHost = process.env.REDIS_HOST;

  // Redis sozlanmagan bo'lsa — stub qaytarish (in-memory session ishlaydi)
  if (!redisUrl && !redisHost) {
    logger.warn("Redis sozlanmagan — in-memory session ishlatiladi");
    client = {
      status: "end",
      get:   async () => null,
      set:   async () => null,
      setex: async () => null,
      del:   async () => null,
      on:    () => {},
    };
    return client;
  }

  const retryStrategy = (times) => {
    if (times > 5) {
      logger.warn("Redis: ulanib bo'lmadi, in-memory ishlatiladi");
      return null;
    }
    return Math.min(times * 500, 3000);
  };

  client = redisUrl
    ? new Redis(redisUrl, {
        lazyConnect:          false,
        enableReadyCheck:     true,
        keyPrefix:            "regbot:",
        maxRetriesPerRequest: 2,
        retryStrategy,
      })
    : new Redis({
        host:                 config.redis.host,
        port:                 config.redis.port,
        password:             config.redis.password || undefined,
        db:                   0,
        keyPrefix:            "regbot:",
        maxRetriesPerRequest: 2,
        enableReadyCheck:     true,
        lazyConnect:          false,
        retryStrategy,
      });

  client.on("connect",      () => logger.info("✅ Redis ulandi"));
  client.on("error",        (err) => logger.warn("Redis: " + err.message));
  client.on("reconnecting", () => logger.warn("Redis qayta ulanmoqda..."));

  return client;
}

module.exports = { getRedis };
