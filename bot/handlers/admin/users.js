// handlers/admin/users.js — Foydalanuvchilar boshqaruvi
const User = require("../../models/User.model");
const Order = require("../../models/Order.model");
const logger = require("../../utils/logger");
const { isAdmin, fmtDate, userCard, userButtons } = require("./utils");
const { freeDriverSeats } = require("../../services/driverService");

function applyAdminUsers(bot) {
  // ─── 👥 Foydalanuvchilar menyu ────────────────────────────────────────────
  bot.onText(/👥 Foydalanuvchilar/, async (msg) => {
    const chatId = msg.chat.id;
    if (!isAdmin(chatId)) return;
    bot.sendMessage(
      chatId,
      "<pre>👥 FOYDALANUVCHILAR</pre>\n\n" +
        "🔍 Qidirish:\n" +
        "/user <code>TELEGRAM_ID</code>\n" +
        "/find <code>ism yoki telefon</code>\n\n" +
        "📋 Ro'yxatlar:\n" +
        "/alldrivers | /allpassengers | /blocked",
      { parse_mode: "HTML" },
    );
  });

  // ─── 🔍 Qidirish ──────────────────────────────────────────────────────────
  bot.onText(/🔍 Qidirish/, async (msg) => {
    const chatId = msg.chat.id;
    if (!isAdmin(chatId)) return;
    bot.sendMessage(
      chatId,
      "<b>🔍 QIDIRISH</b>\n\n" +
        "/user <code>TELEGRAM_ID</code>\n" +
        "/find <code>ism yoki telefon</code>\n" +
        "/order <code>ORDER_ID</code>\n\n" +
        "/alldrivers | /allpassengers | /blocked",
      { parse_mode: "HTML" },
    );
  });

  // ─── /user <id> ───────────────────────────────────────────────────────────
  bot.onText(/\/user (\d+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    if (!isAdmin(chatId)) return;
    try {
      const user = await User.findOne({ telegramId: Number(match[1]) });
      if (!user)
        return bot.sendMessage(chatId, "❌ User topilmadi: " + match[1]);
      const orders = await Order.countDocuments({
        [user.role === "driver" ? "driverId" : "passengerId"]: user.telegramId,
      });
      bot.sendMessage(
        chatId,
        "<pre>👤 USER</pre>\n\n" + userCard(user, orders),
        {
          parse_mode: "HTML",
          reply_markup: { inline_keyboard: userButtons(user) },
        },
      );
    } catch (err) {
      logger.error("Admin /user error:", err);
    }
  });

  // ─── /find <text> ─────────────────────────────────────────────────────────
  bot.onText(/\/find (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    if (!isAdmin(chatId)) return;
    const q = match[1].trim();
    try {
      const users = await User.find({
        $or: [
          { name: { $regex: q, $options: "i" } },
          { phone: { $regex: q, $options: "i" } },
          { username: { $regex: q, $options: "i" } },
        ],
      })
        .limit(5)
        .lean();

      if (!users.length) return bot.sendMessage(chatId, "❌ Topilmadi: " + q);

      for (const user of users) {
        const orders = await Order.countDocuments({
          [user.role === "driver" ? "driverId" : "passengerId"]:
            user.telegramId,
        });
        await bot.sendMessage(
          chatId,
          "<pre>🔍 NATIJA</pre>\n\n" + userCard(user, orders),
          {
            parse_mode: "HTML",
            reply_markup: { inline_keyboard: userButtons(user) },
          },
        );
      }
    } catch (err) {
      logger.error("Admin /find error:", err);
    }
  });

  // ─── /alldrivers ──────────────────────────────────────────────────────────
  bot.onText(/\/alldrivers/, async (msg) => {
    const chatId = msg.chat.id;
    if (!isAdmin(chatId)) return;
    try {
      const list = await User.find({ role: "driver" })
        .sort({ completedOrders: -1 })
        .limit(20)
        .lean();
      if (!list.length) return bot.sendMessage(chatId, "Haydovchi yo'q.");

      let text = "<pre>🚗 HAYDOVCHILAR (" + list.length + " ta)</pre>\n\n";
      list.forEach((d, i) => {
        text +=
          i +
          1 +
          ". <b>" +
          d.name +
          "</b>" +
          " | ⭐" +
          (d.rating?.toFixed(1) || "5.0") +
          " | ✅" +
          (d.completedOrders || 0) +
          " | " +
          (d.isActive ? "🟢" : "⚪") +
          (d.isBlocked ? " 🚫" : "") +
          "\n   📱 " +
          d.phone +
          " | <code>" +
          d.telegramId +
          "</code>\n";
      });
      bot.sendMessage(chatId, text, { parse_mode: "HTML" });
    } catch (err) {
      logger.error("alldrivers error:", err);
    }
  });

  // ─── /allpassengers ───────────────────────────────────────────────────────
  bot.onText(/\/allpassengers/, async (msg) => {
    const chatId = msg.chat.id;
    if (!isAdmin(chatId)) return;
    try {
      const list = await User.find({ role: "passenger" })
        .sort({ createdAt: -1 })
        .limit(20)
        .lean();
      if (!list.length) return bot.sendMessage(chatId, "Yo'lovchi yo'q.");

      let text = "<pre>🧍 YO'LOVCHILAR (" + list.length + " ta)</pre>\n\n";
      list.forEach((u, i) => {
        text +=
          i +
          1 +
          ". <b>" +
          u.name +
          "</b>" +
          (u.isBlocked ? " 🚫" : "") +
          "\n   📱 " +
          u.phone +
          " | <code>" +
          u.telegramId +
          "</code>\n";
      });
      bot.sendMessage(chatId, text, { parse_mode: "HTML" });
    } catch (err) {
      logger.error("allpassengers error:", err);
    }
  });

  // ─── /blocked ─────────────────────────────────────────────────────────────
  bot.onText(/\/blocked/, async (msg) => {
    const chatId = msg.chat.id;
    if (!isAdmin(chatId)) return;
    try {
      const list = await User.find({ isBlocked: true }).lean();
      if (!list.length) return bot.sendMessage(chatId, "✅ Bloklangan yo'q.");

      let text = "<pre>🚫 BLOKLANGAN (" + list.length + " ta)</pre>\n\n";
      list.forEach((u, i) => {
        text +=
          i +
          1 +
          ". " +
          (u.role === "driver" ? "🚗" : "🧍") +
          " <b>" +
          u.name +
          "</b>\n   <code>" +
          u.telegramId +
          "</code>\n";
      });
      bot.sendMessage(chatId, text, { parse_mode: "HTML" });
    } catch (err) {
      logger.error("blocked error:", err);
    }
  });

  // ─── 🚗 Haydovchilar ──────────────────────────────────────────────────────
  bot.onText(/🚗 Haydovchilar/, async (msg) => {
    const chatId = msg.chat.id;
    if (!isAdmin(chatId)) return;
    try {
      const [total, active, busy] = await Promise.all([
        User.countDocuments({ role: "driver" }),
        User.countDocuments({ role: "driver", isActive: true }),
        Order.countDocuments({ status: { $in: ["accepted", "in_progress"] } }),
      ]);
      bot.sendMessage(
        chatId,
        "<pre>🚗 HAYDOVCHILAR</pre>\n\n" +
          "Jami: <b>" +
          total +
          "</b>\n" +
          "Aktiv: <b>" +
          active +
          "</b>\n" +
          "Safarda: <b>" +
          busy +
          "</b>\n\n" +
          "/alldrivers — ro'yxat\n/user <code>ID</code> — batafsil",
        { parse_mode: "HTML" },
      );
    } catch (err) {
      logger.error("drivers menu error:", err);
    }
  });

  // ─── CALLBACKS: block, orders, finish ─────────────────────────────────────
  bot.on("callback_query", async (query) => {
    if (!isAdmin(query.from.id)) return;
    const { data } = query;
    const chatId = query.from.id;

    // Bloklash / blokdan chiqarish
    if (data.startsWith("adm_block_")) {
      const userId = Number(data.replace("adm_block_", ""));
      const user = await User.findOne({ telegramId: userId });
      if (!user)
        return bot.answerCallbackQuery(query.id, { text: "Topilmadi" });

      user.isBlocked = !user.isBlocked;
      await user.save();

      await bot.answerCallbackQuery(query.id, {
        text: user.isBlocked ? "🚫 Bloklandi" : "✅ Blokdan chiqarildi",
        show_alert: true,
      });
      try {
        await bot.sendMessage(
          userId,
          user.isBlocked
            ? "🚫 Akkauntingiz bloklandi. Admin bilan bog'laning."
            : "✅ Akkauntingiz blokdan chiqarildi. /start bosing.",
        );
      } catch (e) {}
      logger.info(
        "Admin " + (user.isBlocked ? "blocked" : "unblocked") + ": " + userId,
      );
    }

    // Buyurtmalar ro'yxati
    if (data.startsWith("adm_orders_")) {
      const userId = Number(data.replace("adm_orders_", ""));
      const user = await User.findOne({ telegramId: userId }).lean();
      const field = user?.role === "driver" ? "driverId" : "passengerId";
      const orders = await Order.find({ [field]: userId })
        .sort({ createdAt: -1 })
        .limit(10)
        .lean();

      if (!orders.length)
        return bot.answerCallbackQuery(query.id, { text: "Buyurtmalar yo'q" });

      await bot.answerCallbackQuery(query.id);
      const sMap = {
        pending: "⏳",
        accepted: "✅",
        in_progress: "🚕",
        completed: "🏁",
        cancelled: "❌",
      };
      let t = "<pre>📦 BUYURTMALAR</pre>\n\n";
      orders.forEach((o, i) => {
        t +=
          i +
          1 +
          ". " +
          (sMap[o.status] || "?") +
          " " +
          o.from +
          "→" +
          o.to +
          " | " +
          fmtDate(o.createdAt) +
          "\n";
      });
      bot.sendMessage(chatId, t, { parse_mode: "HTML" });
    }

    // Driver aktiv buyurtmalarini force yakunlash
    if (data.startsWith("adm_finish_")) {
      const driverId = Number(data.replace("adm_finish_", ""));
      const orders = await Order.find({
        driverId,
        status: {
          $in: [
            "accepted",
            "in_progress",
            "driver_confirmed",
            "passenger_confirmed",
          ],
        },
      });
      let cnt = 0;
      for (const o of orders) {
        o.status = "completed";
        o.completedAt = new Date();
        await o.save();
        if (o.orderType === "passenger")
          await freeDriverSeats(driverId, o.passengers || 1);
        cnt++;
      }
      bot.answerCallbackQuery(query.id, {
        text: cnt + " ta yakunlandi",
        show_alert: true,
      });
      logger.info("Admin force finished " + cnt + " for driver " + driverId);
    }
  });
}

module.exports = { applyAdminUsers };
