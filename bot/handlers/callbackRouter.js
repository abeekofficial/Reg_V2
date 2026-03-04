// handlers/callbackRouter.js
const logger = require("../utils/logger");

const {
  handleAcceptOrder,
  handleRejectOrder,
} = require("./driver/orderActions");
const {
  handleStartTrip,
  handleCancelTrip,
  handleCompleteOrder,
} = require("./driver/tripActions");
const {
  handleCancelOrder,
  handleConfirmComplete,
  handleDispute,
} = require("./passenger/orderActions");
const {
  handleRegionSelect,
  handlePassengerCount,
} = require("./passenger/orderCreate");
const { handleDriverRouteSelect } = require("./driver/routeSelect");
const { handleRateDriver, handleRatePassenger } = require("./rating");

function applyCallbackRouter(bot) {
  bot.on("callback_query", async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;

    if (query.message.chat.type !== "private") return;

    logger.debug("Callback query:", { user: chatId, data });

    try {
      // ── Hech narsa qilmaydigan tugma (info) ─────────────────────────────
      if (data === "noop") {
        return bot.answerCallbackQuery(query.id, { text: "⏳ Kutilmoqda..." });
      }

      // ── Driver: zakaz qabul/rad ──────────────────────────────────────────
      if (data.startsWith("accept_")) return handleAcceptOrder(bot, query);
      if (data.startsWith("reject_")) return handleRejectOrder(bot, query);

      // ── Driver: safar boshqaruvi ─────────────────────────────────────────
      if (data.startsWith("start_trip_")) return handleStartTrip(bot, query);
      if (data.startsWith("cancel_trip_")) return handleCancelTrip(bot, query);
      if (data.startsWith("complete_order_"))
        return handleCompleteOrder(bot, query);

      // ── Passenger: zakaz boshqaruvi ──────────────────────────────────────
      if (data.startsWith("cancel_order_"))
        return handleCancelOrder(bot, query);
      if (data.startsWith("confirm_complete_btn_"))
        return handleConfirmComplete(bot, query);
      if (data.startsWith("dispute_")) return handleDispute(bot, query);

      // ── Passenger: buyurtma yaratish ─────────────────────────────────────
      if (data.startsWith("region_")) return handleRegionSelect(bot, query);
      if (data.startsWith("pcount_")) return handlePassengerCount(bot, query);

      // ── Driver: yo'nalish tanlash ────────────────────────────────────────
      if (data.startsWith("driver_region_"))
        return handleDriverRouteSelect(bot, query);

      // ── Rating ───────────────────────────────────────────────────────────
      if (data.startsWith("drate_")) return handleRateDriver(bot, query);
      if (data.startsWith("prate_")) return handleRatePassenger(bot, query);
    } catch (err) {
      logger.error("callbackRouter error:", { data, err: err.message });
      try {
        await bot.answerCallbackQuery(query.id, {
          text: "❌ Xatolik yuz berdi!",
          show_alert: true,
        });
      } catch (e) {
        /* ignore */
      }
    }
  });
}

module.exports = { applyCallbackRouter };
