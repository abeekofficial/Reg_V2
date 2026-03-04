// handlers/admin/orders.js — Buyurtmalar boshqaruvi
const Order = require("../../models/Order.model");
const User = require("../../models/User.model");
const logger = require("../../utils/logger");
const { isAdmin, fmtDate } = require("./utils");
const { freeDriverSeats } = require("../../services/driverService");
const { getRegionName } = require("../../utils/regionOptions");

const STATUS_MAP = {
  pending: "⏳ Kutilmoqda",
  accepted: "✅ Qabul qilindi",
  in_progress: "🚕 Jarayonda",
  driver_confirmed: "🔄 Driver tasdiqladi",
  passenger_confirmed: "🔄 Passenger tasdiqladi",
  completed: "🏁 Yakunlandi",
  cancelled: "❌ Bekor",
};

const ACTIVE_STATUSES = [
  "accepted",
  "in_progress",
  "driver_confirmed",
  "passenger_confirmed",
];

function applyAdminOrders(bot) {
  // ─── 📦 Buyurtmalar ───────────────────────────────────────────────────────
  bot.onText(/📦 Buyurtmalar/, async (msg) => {
    const chatId = msg.chat.id;
    if (!isAdmin(chatId)) return;
    try {
      const active = await Order.find({
        status: { $in: ["pending", ...ACTIVE_STATUSES] },
      })
        .sort({ createdAt: -1 })
        .limit(10)
        .lean();

      if (!active.length)
        return bot.sendMessage(chatId, "✅ Hozirda aktiv buyurtmalar yo'q.");

      const iMap = {
        pending: "⏳",
        accepted: "✅",
        in_progress: "🚕",
        driver_confirmed: "🔄D",
        passenger_confirmed: "🔄P",
      };
      let text =
        "<pre>📦 AKTIV BUYURTMALAR (" + active.length + " ta)</pre>\n\n";
      for (const o of active) {
        const icon = o.orderType === "cargo" ? "📦" : "👥";
        text +=
          (iMap[o.status] || "?") +
          " " +
          icon +
          " " +
          getRegionName(o.from) +
          "→" +
          getRegionName(o.to) +
          "\n" +
          "   P:<code>" +
          o.passengerId +
          "</code>" +
          (o.driverId
            ? " D:<code>" + o.driverId + "</code>"
            : " [driver yo'q]") +
          "\n" +
          "   /order " +
          o._id.toString().slice(-8) +
          "\n";
      }
      bot.sendMessage(chatId, text, { parse_mode: "HTML" });
    } catch (err) {
      logger.error("orders menu error:", err);
    }
  });

  // ─── /order <id> ──────────────────────────────────────────────────────────
  bot.onText(/\/order (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    if (!isAdmin(chatId)) return;
    try {
      const suffix = match[1].trim();
      // To'liq ID bo'lsa to'g'ridan qidirish, aks holda suffix bo'yicha
      let order = null;
      if (suffix.length === 24) {
        order = await Order.findById(suffix).catch(() => null);
      }
      if (!order) {
        const all = await Order.find({})
          .sort({ createdAt: -1 })
          .limit(200)
          .lean();
        order = all.find((o) => o._id.toString().endsWith(suffix)) || null;
      }
      if (!order) return bot.sendMessage(chatId, "❌ Buyurtma topilmadi.");

      const [passenger, driver] = await Promise.all([
        User.findOne({ telegramId: order.passengerId }).lean(),
        order.driverId
          ? User.findOne({ telegramId: order.driverId }).lean()
          : null,
      ]);

      let text = "<pre>📦 BUYURTMA</pre>\n\n";
      text += "🆔 <code>" + order._id + "</code>\n";
      text +=
        "Holat: <b>" + (STATUS_MAP[order.status] || order.status) + "</b>\n";
      text +=
        "📍 " +
        getRegionName(order.from) +
        " → " +
        getRegionName(order.to) +
        "\n";
      text +=
        (order.orderType === "cargo"
          ? "📦 " + (order.cargoDescription || "—")
          : "👥 " + (order.passengers || 1) + " kishi") + "\n\n";
      text +=
        "👤 <b>" +
        (passenger?.name || "—") +
        "</b> | <code>" +
        order.passengerId +
        "</code>\n";
      if (driver)
        text +=
          "🚗 <b>" +
          driver.name +
          "</b> | <code>" +
          order.driverId +
          "</code>\n";
      text += "\n📅 " + fmtDate(order.createdAt);
      if (order.acceptedAt) text += "\n✅ " + fmtDate(order.acceptedAt);
      if (order.startedAt) text += "\n🚕 " + fmtDate(order.startedAt);
      if (order.completedAt) text += "\n🏁 " + fmtDate(order.completedAt);
      if (order.cancelledAt) text += "\n❌ " + fmtDate(order.cancelledAt);

      const btns = [];
      if (ACTIVE_STATUSES.includes(order.status)) {
        btns.push([
          {
            text: "🏁 Yakunlash",
            callback_data: "adm_force_complete_" + order._id,
          },
          { text: "❌ Bekor", callback_data: "adm_force_cancel_" + order._id },
        ]);
      }
      bot.sendMessage(chatId, text, {
        parse_mode: "HTML",
        reply_markup: btns.length ? { inline_keyboard: btns } : undefined,
      });
    } catch (err) {
      logger.error("admin /order error:", err);
    }
  });

  // ─── CALLBACKS: force complete / cancel ───────────────────────────────────
  bot.on("callback_query", async (query) => {
    if (!isAdmin(query.from.id)) return;
    const { data } = query;
    const chatId = query.from.id;

    const editEmpty = async () => {
      try {
        await bot.editMessageReplyMarkup(
          { inline_keyboard: [] },
          { chat_id: chatId, message_id: query.message.message_id },
        );
      } catch (e) {}
    };

    if (data.startsWith("adm_force_complete_")) {
      const order = await Order.findById(
        data.replace("adm_force_complete_", ""),
      );
      if (!order)
        return bot.answerCallbackQuery(query.id, { text: "Topilmadi" });

      order.status = "completed";
      order.completedAt = new Date();
      await order.save();
      if (order.driverId && order.orderType === "passenger")
        await freeDriverSeats(order.driverId, order.passengers || 1);

      await bot.answerCallbackQuery(query.id, {
        text: "🏁 Yakunlandi",
        show_alert: true,
      });
      await editEmpty();
      logger.info("Admin force completed: " + order._id);
    }

    if (data.startsWith("adm_force_cancel_")) {
      const order = await Order.findById(data.replace("adm_force_cancel_", ""));
      if (!order)
        return bot.answerCallbackQuery(query.id, { text: "Topilmadi" });

      order.status = "cancelled";
      order.cancelledAt = new Date();
      order.cancelledBy = "admin";
      await order.save();
      if (order.driverId && order.orderType === "passenger")
        await freeDriverSeats(order.driverId, order.passengers || 1);

      await bot.answerCallbackQuery(query.id, {
        text: "❌ Bekor qilindi",
        show_alert: true,
      });
      await editEmpty();
      logger.info("Admin force cancelled: " + order._id);
    }
  });
}

module.exports = { applyAdminOrders };
