// index.js — Bot kirish nuqtasi
const TelegramBot = require("node-telegram-bot-api");
const config = require("./config");
const connectDB = require("./config/database");
const logger = require("./utils/logger");

// ── Middlewares ──────────────────────────────────────────────────────────────
const { applyGuard } = require("./middlewares/botGuard");
const { applyErrorHandler } = require("./middlewares/errorHandler");

// ── Handlers ─────────────────────────────────────────────────────────────────
const { applyStart } = require("./handlers/start");
const { applyRegistration } = require("./handlers/registration");
const { applyDriverMenu } = require("./handlers/driver/menu");
const { applyPassengerMenu } = require("./handlers/passenger/menu");
const { applyCallbackRouter } = require("./handlers/callbackRouter");
const { applyAdmin } = require("./handlers/admin/index");
const { applyHelp } = require("./handlers/help");
const { applyGroupJoin } = require("./handlers/groupJoin");

async function startBot() {
  try {
    await connectDB();

    const rawBot = new TelegramBot(config.bot.token, { polling: true });

    logger.success(
      "🚀 Bot ishga tushdi [" + config.NODE_ENV.toUpperCase() + "]",
    );
    logger.info("Admin IDs: " + config.bot.adminIds.join(", "));

    // 1️⃣ Error handler — eng birinchi
    applyErrorHandler(rawBot);

    // 2️⃣ Global auth guard
    const bot = applyGuard(rawBot);

    // 3️⃣ /start — public
    applyStart(bot);

    // 4️⃣ Registratsiya
    applyRegistration(bot);

    // 5️⃣ Callback router — BITTA callback_query handler
    applyCallbackRouter(bot);

    // 6️⃣ Driver menyu
    applyDriverMenu(bot);

    // 7️⃣ Passenger menyu
    applyPassengerMenu(bot);

    // 8️⃣ Help / bot haqida
    applyHelp(bot);

    // 9️⃣ Guruhga qo'shilish handler
    applyGroupJoin(bot);

    // 🔟 Admin panel
    applyAdmin(bot);

    logger.success("✅ Barcha handler'lar yuklandi");

    process.on("SIGTERM", () => {
      logger.info("SIGTERM olindi, bot to'xtatilmoqda...");
      rawBot.stopPolling();
      process.exit(0);
    });

    process.on("SIGINT", () => {
      logger.info("SIGINT olindi, bot to'xtatilmoqda...");
      rawBot.stopPolling();
      process.exit(0);
    });
  } catch (err) {
    logger.error("BOT START XATOSI:", err);
    process.exit(1);
  }
}

startBot();
