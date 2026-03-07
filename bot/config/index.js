// config/index.js
const path = require("path");
const dotenv = require("dotenv");

const botDir = __dirname.includes("config")
  ? path.join(__dirname, "..")
  : __dirname;

// Local .env yuklash (Render da bu fayllar bo'lmaydi — env vars dashboard da)
dotenv.config({ path: path.join(botDir, ".env") });
if (process.env.NODE_ENV) {
  dotenv.config({ path: path.join(botDir, ".env." + process.env.NODE_ENV) });
}

const config = {
  NODE_ENV: process.env.NODE_ENV || "development",
  isDev: process.env.NODE_ENV !== "production",
  isProd: process.env.NODE_ENV === "production",

  bot: {
    token: process.env.BOT_TOKEN,
    adminIds: (process.env.ADMIN_IDS || "")
      .split(",")
      .map((id) => Number(id.trim()))
      .filter(Boolean),
    testUsers: (process.env.TEST_USERS || "")
      .split(",")
      .map((id) => Number(id.trim()))
      .filter(Boolean),
  },

  mongo: {
    uri: process.env.MONGO_URI,
    options: {
      maxPoolSize: 10,
      socketTimeoutMS: 30000,
      connectTimeoutMS: 10000,
    },
  },

  redis: {
    host: process.env.REDIS_HOST || "127.0.0.1",
    port: Number(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    db: 0,
    keyPrefix: "regbot:",
    maxRetriesPerRequest: 3,
  },

  session: { ttl: 60 * 60 * 2 }, // 2 soat

  order: {
    offerTimeoutMs: 30_000,
    maxDriversPerOrder: 10,
  },

  webhook: {
    url: process.env.WEBHOOK_URL || "",
    port: Number(process.env.PORT) || 3000,
    secret: process.env.WEBHOOK_SECRET || "regbot_secret_2024",
  },
};

// Majburiy env tekshiruvi
const missing = ["BOT_TOKEN", "MONGO_URI"].filter((k) => !process.env[k]);
if (missing.length) {
  console.error("\n❌ MUHIT O'ZGARUVCHILARI TOPILMADI:");
  missing.forEach((k) => console.error("   • " + k + " = bo'sh!"));
  console.error("\nRender.com: Dashboard → Environment da qo'shing\n");
  process.exit(1);
}

if (config.isProd && !config.webhook.url) {
  console.warn("⚠️  WEBHOOK_URL yo'q — polling rejimida ishlaydi");
}

module.exports = config;
