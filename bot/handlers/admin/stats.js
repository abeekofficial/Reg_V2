// handlers/admin/stats.js — Statistika va tizim ma'lumotlari
const User = require("../../models/User.model");
const Order = require("../../models/Order.model");
const Group = require("../../models/Group.model");
const config = require("../../config");
const logger = require("../../utils/logger");
const { isAdmin, fmtDate, adminMenu } = require("./utils");
const { getActiveListenerCount } = require("../../services/assignService");

function applyAdminStats(bot) {
  // ─── /admin ───────────────────────────────────────────────────────────────
  bot.onText(/\/admin/, async (msg) => {
    if (!isAdmin(msg.chat.id)) return;
    bot.sendMessage(
      msg.chat.id,
      "👑 <b>ADMIN PANEL</b>\n\nXush kelibsiz!",
      adminMenu(),
    );
  });

  // ─── Bosh menyuga qaytish ─────────────────────────────────────────────────
  bot.onText(/⬅️ Bosh menyu/, async (msg) => {
    if (!isAdmin(msg.chat.id)) return;
    const user = await require("../../models/User.model")
      .findOne({ telegramId: Number(msg.chat.id) })
      .lean();
    const isDriver = user?.role === "driver";
    bot.sendMessage(msg.chat.id, "Bosh menyuga qaytdingiz.", {
      reply_markup: {
        keyboard: isDriver
          ? [
              ["🚖 Buyurtma qabul qilishni boshlash"],
              ["📋 Mening buyurtmalarim", "👤 Profilim"],
              ["📊 Statistika", "⭐ Reytingim"],
              ["/admin"],
            ]
          : [
              ["🚖 Buyurtma berish", "📦 Yuk/Pochta"],
              ["👤 Profilim", "📋 Tarixim"],
              ["/admin"],
            ],
        resize_keyboard: true,
      },
    });
  });

  // ─── Statistika ───────────────────────────────────────────────────────────
  bot.onText(/📊 Admin statistika/, async (msg) => {
    const chatId = msg.chat.id;
    if (!isAdmin(chatId)) return;

    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const week = new Date(Date.now() - 7 * 86400000);

      const [
        totalUsers,
        drivers,
        passengers,
        blockedUsers,
        totalOrders,
        pending,
        active,
        completed,
        cancelled,
        todayOrders,
        weekOrders,
        totalGroups,
        activeGroups,
        activeDrivers,
      ] = await Promise.all([
        User.countDocuments(),
        User.countDocuments({ role: "driver" }),
        User.countDocuments({ role: "passenger" }),
        User.countDocuments({ isBlocked: true }),
        Order.countDocuments(),
        Order.countDocuments({ status: "pending" }),
        Order.countDocuments({
          status: {
            $in: [
              "accepted",
              "in_progress",
              "driver_confirmed",
              "passenger_confirmed",
            ],
          },
        }),
        Order.countDocuments({ status: "completed" }),
        Order.countDocuments({ status: "cancelled" }),
        Order.countDocuments({ createdAt: { $gte: today } }),
        Order.countDocuments({ createdAt: { $gte: week } }),
        Group.countDocuments(),
        Group.countDocuments({ isActive: true }),
        User.countDocuments({ role: "driver", isActive: true }),
      ]);

      bot.sendMessage(
        chatId,
        "<pre>📊 ADMIN STATISTIKA</pre>\n\n" +
          "👥 <b>FOYDALANUVCHILAR</b>\n" +
          "Jami: <b>" +
          totalUsers +
          "</b> | 🚗 " +
          drivers +
          " | 🧍 " +
          passengers +
          "\n" +
          "🚫 Bloklangan: <b>" +
          blockedUsers +
          "</b> | 🟢 Aktiv: <b>" +
          activeDrivers +
          "</b>\n\n" +
          "📦 <b>BUYURTMALAR</b>\n" +
          "Jami: <b>" +
          totalOrders +
          "</b>\n" +
          "⏳ " +
          pending +
          " | ⚡ " +
          active +
          " | ✅ " +
          completed +
          " | ❌ " +
          cancelled +
          "\n" +
          "📅 Bugun: <b>" +
          todayOrders +
          "</b> | 📆 7 kun: <b>" +
          weekOrders +
          "</b>\n\n" +
          "📢 <b>GURUHLAR</b>\n" +
          "Jami: <b>" +
          totalGroups +
          "</b> | Faol: <b>" +
          activeGroups +
          "</b>\n\n" +
          "🔄 Listenerlar: <b>" +
          getActiveListenerCount() +
          "</b>\n" +
          "🖥 Muhit: <b>" +
          config.NODE_ENV.toUpperCase() +
          "</b>\n" +
          "🕐 <b>" +
          fmtDate(new Date()) +
          "</b>",
        { parse_mode: "HTML" },
      );
    } catch (err) {
      logger.error("Admin stat error:", err);
      bot.sendMessage(chatId, "❌ Xatolik: " + err.message);
    }
  });

  // ─── Tizim ────────────────────────────────────────────────────────────────
  bot.onText(/🔧 Tizim/, async (msg) => {
    const chatId = msg.chat.id;
    if (!isAdmin(chatId)) return;

    const mem = process.memoryUsage();
    const uptime = Math.floor(process.uptime());
    const h = Math.floor(uptime / 3600);
    const m = Math.floor((uptime % 3600) / 60);

    bot.sendMessage(
      chatId,
      "<pre>🔧 TIZIM</pre>\n\n" +
        "⏱ Uptime: <b>" +
        h +
        "s " +
        m +
        "d</b>\n" +
        "💾 RAM: <b>" +
        Math.round(mem.heapUsed / 1024 / 1024) +
        " MB</b>\n" +
        "📦 Node: <b>" +
        process.version +
        "</b>\n" +
        "🌍 Muhit: <b>" +
        config.NODE_ENV.toUpperCase() +
        "</b>\n" +
        "🔄 Listeners: <b>" +
        getActiveListenerCount() +
        "</b>\n\n" +
        "/cleanup — 30+ kunlik buyurtmalarni tozalash\n" +
        "/fixseats — usedSeats ni qayta hisoblash",
      { parse_mode: "HTML" },
    );
  });

  // ─── /cleanup ─────────────────────────────────────────────────────────────
  bot.onText(/\/cleanup/, async (msg) => {
    const chatId = msg.chat.id;
    if (!isAdmin(chatId)) return;
    try {
      const cutoff = new Date(Date.now() - 30 * 86400000);
      const result = await Order.deleteMany({
        status: { $in: ["pending", "cancelled"] },
        createdAt: { $lt: cutoff },
      });
      bot.sendMessage(
        chatId,
        "✅ " + result.deletedCount + " ta eski buyurtma o'chirildi.",
      );
    } catch (err) {
      bot.sendMessage(chatId, "❌ " + err.message);
    }
  });

  // ─── /fixseats ────────────────────────────────────────────────────────────
  bot.onText(/\/fixseats/, async (msg) => {
    const chatId = msg.chat.id;
    if (!isAdmin(chatId)) return;
    try {
      await User.updateMany({ role: "driver" }, { usedSeats: 0 });
      const active = await Order.find({
        status: {
          $in: [
            "accepted",
            "in_progress",
            "driver_confirmed",
            "passenger_confirmed",
          ],
        },
        orderType: "passenger",
      }).lean();
      for (const o of active) {
        await User.findOneAndUpdate(
          { telegramId: o.driverId },
          { $inc: { usedSeats: o.passengers || 1 } },
        );
      }
      bot.sendMessage(
        chatId,
        "✅ usedSeats qayta hisoblandi.\nAktiv orderlar: <b>" +
          active.length +
          "</b> ta",
        { parse_mode: "HTML" },
      );
    } catch (err) {
      bot.sendMessage(chatId, "❌ " + err.message);
    }
  });
}

module.exports = { applyAdminStats };
