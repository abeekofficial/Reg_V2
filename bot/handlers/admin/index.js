// handlers/admin.js
// Professional admin panel — faqat adminlar uchun

const User = require("../../models/User.model");
const Order = require("../../models/Order.model");
const Group = require("../../models/Group.model");
const config = require("../../config");
const logger = require("../../utils/logger");
const { getActiveListenerCount } = require("../../services/assignService");
const { freeDriverSeats } = require("../../services/driverService");
const { getRegionName } = require("../../utils/regionOptions");

// ─── Admin tekshiruvi ────────────────────────────────────────────────────────
function isAdmin(chatId) {
  return config.bot.adminIds.includes(Number(chatId));
}

// ─── Vaqt formatlash ────────────────────────────────────────────────────────
function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleString("uz-UZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── Admin asosiy menyu ──────────────────────────────────────────────────────
function adminMenu() {
  return {
    parse_mode: "HTML",
    reply_markup: {
      keyboard: [
        ["📊 Admin statistika", "👥 Foydalanuvchilar"],
        ["🚗 Haydovchilar", "📦 Buyurtmalar"],
        ["📢 Guruhlar", "📣 Post yuborish"],
        ["🔧 Tizim", "🔍 Qidirish"],
        ["⬅️ Bosh menyu"],
      ],
      resize_keyboard: true,
    },
  };
}

// ─── User card ───────────────────────────────────────────────────────────────
function userCard(user, orders = 0) {
  const role = user.role === "driver" ? "🚗 Haydovchi" : "🧍 Yo'lovchi";
  let t = role + " | <b>" + user.name + "</b>\n";
  t += "📱 " + user.phone + "\n";
  t += "🆔 <code>" + user.telegramId + "</code>";
  if (user.username) t += " | @" + user.username;
  t += "\n";
  if (user.role === "driver") {
    t +=
      "🚙 " + (user.carModel || "—") + " | " + (user.carNumber || "—") + "\n";
    t +=
      "📍 " +
      (user.from ? getRegionName(user.from) : "—") +
      " → " +
      (user.to ? getRegionName(user.to) : "—") +
      "\n";
    t +=
      "⭐ " +
      (user.rating?.toFixed(1) || "5.0") +
      " | ✅ " +
      (user.completedOrders || 0) +
      " ta\n";
    t += "🔘 " + (user.isActive ? "Aktiv" : "Nofaol") + "\n";
  }
  t += "📦 Jami buyurtmalar: " + orders + "\n";
  t += "📅 " + fmtDate(user.createdAt) + "\n";
  t += user.isBlocked ? "🚫 <b>BLOKLANGAN</b>\n" : "✅ Faol\n";
  return t;
}

function userButtons(user) {
  const id = user.telegramId;
  const btns = [
    [
      {
        text: user.isBlocked ? "✅ Blokdan chiqarish" : "🚫 Bloklash",
        callback_data: "adm_block_" + id,
      },
      {
        text: "📋 Buyurtmalar",
        callback_data: "adm_orders_" + id,
      },
    ],
  ];
  if (user.role === "driver") {
    btns.push([
      {
        text: "🔄 Aktiv buyurtmalarni yakunlash",
        callback_data: "adm_finish_" + id,
      },
    ]);
  }
  return btns;
}

function applyAdmin(bot) {
  // ─── /admin — panel kirish ─────────────────────────────────────────────
  bot.onText(/\/admin/, async (msg) => {
    if (!isAdmin(msg.chat.id)) return;
    bot.sendMessage(
      msg.chat.id,
      "👑 <b>ADMIN PANEL</b>\n\nXush kelibsiz!",
      adminMenu(),
    );
  });

  // ─── Admin menyu tugmalari ─────────────────────────────────────────────
  bot.onText(/⬅️ Bosh menyu/, async (msg) => {
    if (!isAdmin(msg.chat.id)) return;
    bot.sendMessage(msg.chat.id, "Bosh menyuga qaytdingiz.", {
      reply_markup: {
        keyboard: [
          ["🚖 Buyurtma qabul qilishni boshlash"],
          ["📋 Mening buyurtmalarim", "👤 Profilim"],
          ["📊 Statistika", "⭐ Reytingim"],
          ["/admin"],
        ],
        resize_keyboard: true,
      },
    });
  });

  // ─── Admin Statistika ──────────────────────────────────────────────────
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

      const text =
        "<pre>📊 ADMIN STATISTIKA</pre>\n\n" +
        "👥 <b>FOYDALANUVCHILAR</b>\n" +
        "Jami: <b>" +
        totalUsers +
        "</b> | 🚗 Driver: <b>" +
        drivers +
        "</b> | 🧍 Passenger: <b>" +
        passengers +
        "</b>\n" +
        "🚫 Bloklangan: <b>" +
        blockedUsers +
        "</b> | 🟢 Aktiv driverlar: <b>" +
        activeDrivers +
        "</b>\n\n" +
        "📦 <b>BUYURTMALAR</b>\n" +
        "Jami: <b>" +
        totalOrders +
        "</b>\n" +
        "⏳ Kutilmoqda: <b>" +
        pending +
        "</b> | ⚡ Jarayonda: <b>" +
        active +
        "</b>\n" +
        "✅ Yakunlangan: <b>" +
        completed +
        "</b> | ❌ Bekor: <b>" +
        cancelled +
        "</b>\n" +
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
        "🔄 Aktiv listenerlar: <b>" +
        getActiveListenerCount() +
        "</b>\n" +
        "🖥 Muhit: <b>" +
        config.NODE_ENV.toUpperCase() +
        "</b>\n" +
        "🕐 Vaqt: <b>" +
        fmtDate(new Date()) +
        "</b>";

      bot.sendMessage(chatId, text, { parse_mode: "HTML" });
    } catch (err) {
      logger.error("Admin stat error:", err);
      bot.sendMessage(chatId, "❌ Xatolik: " + err.message);
    }
  });

  // ─── Foydalanuvchilar ro'yxati ─────────────────────────────────────────
  bot.onText(/👥 Foydalanuvchilar/, async (msg) => {
    const chatId = msg.chat.id;
    if (!isAdmin(chatId)) return;

    try {
      const [drivers, passengers] = await Promise.all([
        User.find({ role: "driver" }).sort({ createdAt: -1 }).limit(5).lean(),
        User.find({ role: "passenger" })
          .sort({ createdAt: -1 })
          .limit(5)
          .lean(),
      ]);

      bot.sendMessage(
        chatId,
        "<pre>👥 FOYDALANUVCHILAR</pre>\n\n" +
          "So'nggi 5 ta haydovchi va yo'lovchi ko'rsatilgan.\n\n" +
          "🔍 Qidirish uchun:\n" +
          "/user <code>TELEGRAM_ID</code>\n" +
          "/find <code>ism yoki telefon</code>\n\n" +
          "📋 Hammasini ko'rish:\n" +
          "/alldrivers — barcha haydovchilar\n" +
          "/allpassengers — barcha yo'lovchilar\n" +
          "/blocked — bloklangan foydalanuvchilar",
        { parse_mode: "HTML" },
      );
    } catch (err) {
      logger.error("Admin users error:", err);
    }
  });

  // ─── /user <id> — User profil ──────────────────────────────────────────
  bot.onText(/\/user (\d+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    if (!isAdmin(chatId)) return;

    try {
      const userId = Number(match[1]);
      const user = await User.findOne({ telegramId: userId });
      if (!user) return bot.sendMessage(chatId, "❌ User topilmadi: " + userId);

      const orders = await Order.countDocuments({
        [user.role === "driver" ? "driverId" : "passengerId"]: userId,
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
      logger.error("Admin user error:", err);
    }
  });

  // ─── /find <text> — Ism yoki telefon bo'yicha qidirish ────────────────
  bot.onText(/\/find (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    if (!isAdmin(chatId)) return;

    const query = match[1].trim();
    try {
      const users = await User.find({
        $or: [
          { name: { $regex: query, $options: "i" } },
          { phone: { $regex: query, $options: "i" } },
          { username: { $regex: query, $options: "i" } },
        ],
      })
        .limit(5)
        .lean();

      if (!users.length)
        return bot.sendMessage(chatId, "❌ Topilmadi: " + query);

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
      logger.error("Admin find error:", err);
    }
  });

  // ─── 🔍 Qidirish — menyu orqali ───────────────────────────────────────
  bot.onText(/🔍 Qidirish/, async (msg) => {
    const chatId = msg.chat.id;
    if (!isAdmin(chatId)) return;
    bot.sendMessage(
      chatId,
      "<b>🔍 QIDIRISH</b>\n\n" +
        "Foydalanuvchi qidirish:\n" +
        "/user <code>TELEGRAM_ID</code>\n" +
        "/find <code>ism yoki telefon</code>\n\n" +
        "Buyurtma qidirish:\n" +
        "/order <code>ORDER_ID</code>\n\n" +
        "Ro'yxatlar:\n" +
        "/alldrivers | /allpassengers | /blocked",
      { parse_mode: "HTML" },
    );
  });

  // ─── /alldrivers — barcha haydovchilar ────────────────────────────────
  bot.onText(/\/alldrivers/, async (msg) => {
    const chatId = msg.chat.id;
    if (!isAdmin(chatId)) return;

    try {
      const drivers = await User.find({ role: "driver" })
        .sort({ completedOrders: -1 })
        .limit(20)
        .lean();

      if (!drivers.length) return bot.sendMessage(chatId, "Haydovchi yo'q.");

      let text = "<pre>🚗 HAYDOVCHILAR (" + drivers.length + " ta)</pre>\n\n";
      drivers.forEach((d, i) => {
        text +=
          i +
          1 +
          ". <b>" +
          d.name +
          "</b> | ⭐" +
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

  // ─── /allpassengers ────────────────────────────────────────────────────
  bot.onText(/\/allpassengers/, async (msg) => {
    const chatId = msg.chat.id;
    if (!isAdmin(chatId)) return;

    try {
      const users = await User.find({ role: "passenger" })
        .sort({ createdAt: -1 })
        .limit(20)
        .lean();

      if (!users.length) return bot.sendMessage(chatId, "Yo'lovchi yo'q.");

      let text = "<pre>🧍 YO'LOVCHILAR (" + users.length + " ta)</pre>\n\n";
      users.forEach((u, i) => {
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

  // ─── /blocked — bloklangan foydalanuvchilar ────────────────────────────
  bot.onText(/\/blocked/, async (msg) => {
    const chatId = msg.chat.id;
    if (!isAdmin(chatId)) return;

    try {
      const users = await User.find({ isBlocked: true }).lean();
      if (!users.length)
        return bot.sendMessage(chatId, "✅ Bloklangan foydalanuvchi yo'q.");

      let text = "<pre>🚫 BLOKLANGAN (" + users.length + " ta)</pre>\n\n";
      users.forEach((u, i) => {
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

  // ─── 🚗 Haydovchilar menyu ─────────────────────────────────────────────
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
          "Aktiv (ishlayotgan): <b>" +
          active +
          "</b>\n" +
          "Hozir safarda: <b>" +
          busy +
          "</b>\n\n" +
          "Komandalar:\n" +
          "/alldrivers — ro'yxat\n" +
          "/user <code>ID</code> — batafsil",
        { parse_mode: "HTML" },
      );
    } catch (err) {
      logger.error("drivers menu error:", err);
    }
  });

  // ─── 📦 Buyurtmalar ────────────────────────────────────────────────────
  bot.onText(/📦 Buyurtmalar/, async (msg) => {
    const chatId = msg.chat.id;
    if (!isAdmin(chatId)) return;

    try {
      const active = await Order.find({
        status: {
          $in: [
            "pending",
            "accepted",
            "in_progress",
            "driver_confirmed",
            "passenger_confirmed",
          ],
        },
      })
        .sort({ createdAt: -1 })
        .limit(10)
        .lean();

      if (!active.length) {
        return bot.sendMessage(chatId, "✅ Hozirda aktiv buyurtmalar yo'q.");
      }

      const statusMap = {
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
          statusMap[o.status] +
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
          o._id.toString().slice(-6) +
          "\n";
      }

      bot.sendMessage(chatId, text, { parse_mode: "HTML" });
    } catch (err) {
      logger.error("orders menu error:", err);
    }
  });

  // ─── /order <id_suffix> — buyurtma batafsil ───────────────────────────
  bot.onText(/\/order (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    if (!isAdmin(chatId)) return;

    try {
      const suffix = match[1].trim();
      const order =
        (await Order.findOne({
          _id: { $regex: suffix + "$" },
        })) || (await Order.findById(suffix).catch(() => null));

      if (!order) return bot.sendMessage(chatId, "❌ Buyurtma topilmadi.");

      const [passenger, driver] = await Promise.all([
        User.findOne({ telegramId: order.passengerId }).lean(),
        order.driverId
          ? User.findOne({ telegramId: order.driverId }).lean()
          : null,
      ]);

      const statusMap = {
        pending: "⏳ Kutilmoqda",
        accepted: "✅ Qabul qilindi",
        in_progress: "🚕 Jarayonda",
        driver_confirmed: "🔄 Driver tasdiqladi",
        passenger_confirmed: "🔄 Passenger tasdiqladi",
        completed: "✅ Yakunlandi",
        cancelled: "❌ Bekor",
      };

      let text = "<pre>📦 BUYURTMA</pre>\n\n";
      text += "🆔 <code>" + order._id + "</code>\n";
      text +=
        "Holat: <b>" + (statusMap[order.status] || order.status) + "</b>\n";
      text +=
        "📍 " +
        getRegionName(order.from) +
        " → " +
        getRegionName(order.to) +
        "\n";
      text +=
        (order.orderType === "cargo"
          ? "📦 Yuk: " + (order.cargoDescription || "—")
          : "👥 " + (order.passengers || 1) + " kishi") + "\n\n";
      text +=
        "👤 Yo'lovchi: <b>" +
        (passenger?.name || "—") +
        "</b> | <code>" +
        order.passengerId +
        "</code>\n";
      if (driver)
        text +=
          "🚗 Haydovchi: <b>" +
          driver.name +
          "</b> | <code>" +
          order.driverId +
          "</code>\n";
      text += "\n📅 Yaratildi: " + fmtDate(order.createdAt);
      if (order.acceptedAt) text += "\n✅ Qabul: " + fmtDate(order.acceptedAt);
      if (order.startedAt)
        text += "\n🚕 Boshlandi: " + fmtDate(order.startedAt);
      if (order.completedAt)
        text += "\n🏁 Yakunlandi: " + fmtDate(order.completedAt);
      if (order.cancelledAt)
        text += "\n❌ Bekor: " + fmtDate(order.cancelledAt);

      const btns = [];
      if (
        [
          "accepted",
          "in_progress",
          "driver_confirmed",
          "passenger_confirmed",
        ].includes(order.status)
      ) {
        btns.push([
          {
            text: "🏁 Majburiy yakunlash",
            callback_data: "adm_force_complete_" + order._id,
          },
          {
            text: "❌ Majburiy bekor",
            callback_data: "adm_force_cancel_" + order._id,
          },
        ]);
      }

      bot.sendMessage(chatId, text, {
        parse_mode: "HTML",
        reply_markup: btns.length ? { inline_keyboard: btns } : undefined,
      });
    } catch (err) {
      logger.error("admin order error:", err);
    }
  });

  // ─── 📢 Guruhlar ──────────────────────────────────────────────────────
  bot.onText(/📢 Guruhlar/, async (msg) => {
    const chatId = msg.chat.id;
    if (!isAdmin(chatId)) return;

    try {
      const groups = await Group.find()
        .sort({ totalOrders: -1 })
        .limit(20)
        .lean();
      if (!groups.length) return bot.sendMessage(chatId, "❌ Guruhlar yo'q.");

      let text = "<pre>📢 GURUHLAR (" + groups.length + " ta)</pre>\n\n";
      const groupBtns = [];

      groups.forEach((g, i) => {
        const types =
          g.orderTypes && g.orderTypes.length ? g.orderTypes.join("+") : "all";
        const typeLabel =
          types === "all"
            ? "👥+📦 Hammasi"
            : types === "passenger"
              ? "👥 Yo'lovchi"
              : types === "cargo"
                ? "📦 Yuk"
                : "👥+📦 Hammasi";

        text +=
          i +
          1 +
          ". <b>" +
          g.title +
          "</b>\n" +
          "   " +
          (g.isActive ? "✅ Faol" : "❌ Nofaol") +
          " | " +
          typeLabel +
          " | 📦 " +
          g.totalOrders +
          " ta\n" +
          "   <code>" +
          g.groupId +
          "</code>\n";

        // Har bir guruh uchun tugmalar
        groupBtns.push([
          {
            text: i + 1 + ". " + g.title.slice(0, 18) + " 📋",
            callback_data: "adm_group_info_" + g.groupId,
          },
          {
            text: "🔧 Tur",
            callback_data: "adm_group_type_" + g.groupId,
          },
        ]);
      });

      groupBtns.push([
        {
          text: "🔄 Hammasini faollashtirish",
          callback_data: "adm_groups_activate",
        },
        {
          text: "❌ Hammasini o'chirish",
          callback_data: "adm_groups_deactivate",
        },
      ]);

      bot.sendMessage(chatId, text, {
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: groupBtns },
      });
    } catch (err) {
      logger.error("Admin groups error:", err);
    }
  });

  // ─── 📣 Post yuborish ─────────────────────────────────────────────────
  bot.onText(/📣 Post yuborish/, async (msg) => {
    const chatId = msg.chat.id;
    if (!isAdmin(chatId)) return;

    bot.sendMessage(
      chatId,
      "<b>📣 POST YUBORISH</b>\n\n" +
        "Barcha foydalanuvchilarga:\n" +
        "/broadcast <code>matn</code>\n\n" +
        "Faqat haydovchilarga:\n" +
        "/broadcast_drivers <code>matn</code>\n\n" +
        "Faqat yo'lovchilarga:\n" +
        "/broadcast_passengers <code>matn</code>\n\n" +
        "Barcha guruhlarga:\n" +
        "/broadcast_groups <code>matn</code>",
      { parse_mode: "HTML" },
    );
  });

  // ─── Broadcast komandalar ──────────────────────────────────────────────
  async function doBroadcast(bot, chatId, text, filter = {}) {
    const users = await User.find(filter).lean();
    let ok = 0,
      fail = 0;
    bot.sendMessage(
      chatId,
      "📤 Yuborish boshlandi... (" + users.length + " ta user)",
    );

    for (const u of users) {
      try {
        await bot.sendMessage(u.telegramId, text, { parse_mode: "HTML" });
        ok++;
        await new Promise((r) => setTimeout(r, 50)); // rate limit
      } catch (e) {
        fail++;
      }
    }
    bot.sendMessage(
      chatId,
      "✅ Yuborildi: <b>" + ok + "</b> ta\n❌ Xato: <b>" + fail + "</b> ta",
      { parse_mode: "HTML" },
    );
  }

  bot.onText(/\/broadcast (.+)/, async (msg, match) => {
    if (!isAdmin(msg.chat.id)) return;
    await doBroadcast(bot, msg.chat.id, "📢 <b>XABAR</b>\n\n" + match[1], {});
  });

  bot.onText(/\/broadcast_drivers (.+)/, async (msg, match) => {
    if (!isAdmin(msg.chat.id)) return;
    await doBroadcast(
      bot,
      msg.chat.id,
      "🚗 <b>HAYDOVCHILAR UCHUN</b>\n\n" + match[1],
      { role: "driver" },
    );
  });

  bot.onText(/\/broadcast_passengers (.+)/, async (msg, match) => {
    if (!isAdmin(msg.chat.id)) return;
    await doBroadcast(
      bot,
      msg.chat.id,
      "🧍 <b>YO'LOVCHILAR UCHUN</b>\n\n" + match[1],
      { role: "passenger" },
    );
  });

  bot.onText(/\/broadcast_groups (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    if (!isAdmin(chatId)) return;
    const groups = await Group.find({ isActive: true }).lean();
    let ok = 0,
      fail = 0;
    for (const g of groups) {
      try {
        await bot.sendMessage(g.groupId, "📢 <b>E'LON</b>\n\n" + match[1], {
          parse_mode: "HTML",
        });
        ok++;
        await new Promise((r) => setTimeout(r, 100));
      } catch (e) {
        fail++;
      }
    }
    bot.sendMessage(
      chatId,
      "✅ " + ok + " ta guruhga yuborildi | ❌ " + fail + " ta xato",
      { parse_mode: "HTML" },
    );
  });

  // ─── 🔧 Tizim ─────────────────────────────────────────────────────────
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
        "Komandalar:\n" +
        "/cleanup — 30+ kunlik buyurtmalarni tozalash\n" +
        "/fixseats — barcha driver usedSeats ni tuzatish",
      { parse_mode: "HTML" },
    );
  });

  // ─── /cleanup — eski pending buyurtmalarni tozalash ────────────────────
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
        { parse_mode: "HTML" },
      );
    } catch (err) {
      bot.sendMessage(chatId, "❌ " + err.message);
    }
  });

  // ─── /fixseats — usedSeats ni qayta hisoblash ─────────────────────────
  bot.onText(/\/fixseats/, async (msg) => {
    const chatId = msg.chat.id;
    if (!isAdmin(chatId)) return;

    try {
      // Barcha driverlarni 0 ga qaytarish, so'ng aktiv orderlardan qayta hisoblash
      await User.updateMany({ role: "driver" }, { usedSeats: 0 });

      const activeOrders = await Order.find({
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

      for (const o of activeOrders) {
        await User.findOneAndUpdate(
          { telegramId: o.driverId },
          { $inc: { usedSeats: o.passengers || 1 } },
        );
      }

      bot.sendMessage(
        chatId,
        "✅ usedSeats qayta hisoblandi.\n" +
          "Aktiv orderlar: <b>" +
          activeOrders.length +
          "</b> ta",
        { parse_mode: "HTML" },
      );
    } catch (err) {
      bot.sendMessage(chatId, "❌ " + err.message);
    }
  });

  // ─── ADMIN CALLBACK QUERYLAR ────────────────────────────────────────────
  bot.on("callback_query", async (query) => {
    if (!isAdmin(query.from.id)) return;
    const data = query.data;
    const chatId = query.from.id;

    // Bloklash/blokdan chiqarish
    if (data.startsWith("adm_block_")) {
      const userId = Number(data.replace("adm_block_", ""));
      const user = await User.findOne({ telegramId: userId });
      if (!user)
        return bot.answerCallbackQuery(query.id, { text: "User topilmadi" });

      user.isBlocked = !user.isBlocked;
      await user.save();

      await bot.answerCallbackQuery(query.id, {
        text: user.isBlocked ? "🚫 Bloklandi" : "✅ Blokdan chiqarildi",
        show_alert: true,
      });

      // Bloklanganiga xabar
      try {
        if (user.isBlocked) {
          await bot.sendMessage(
            userId,
            "🚫 Sizning akkauntingiz administrator tomonidan bloklandi.",
          );
        } else {
          await bot.sendMessage(
            userId,
            "✅ Sizning akkauntingiz bloklandan chiqarildi. /start bosing.",
          );
        }
      } catch (e) {
        /* user boti to'sgan */
      }

      logger.info(
        "Admin " + (user.isBlocked ? "blocked" : "unblocked") + ": " + userId,
      );
    }

    // User buyurtmalari
    if (data.startsWith("adm_orders_")) {
      const userId = Number(data.replace("adm_orders_", ""));
      const user = await User.findOne({ telegramId: userId }).lean();
      const field = user?.role === "driver" ? "driverId" : "passengerId";

      const orders = await Order.find({ [field]: userId })
        .sort({ createdAt: -1 })
        .limit(10)
        .lean();

      if (!orders.length) {
        return bot.answerCallbackQuery(query.id, { text: "Buyurtmalar yo'q" });
      }

      await bot.answerCallbackQuery(query.id);

      const statusMap = {
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
          (statusMap[o.status] || "?") +
          " " +
          getRegionName(o.from) +
          "→" +
          getRegionName(o.to) +
          " | " +
          fmtDate(o.createdAt) +
          "\n";
      });

      bot.sendMessage(chatId, t, { parse_mode: "HTML" });
    }

    // Driver aktiv buyurtmalarini yakunlash
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
        await freeDriverSeats(driverId, o.passengers || 1);
        cnt++;
      }

      await bot.answerCallbackQuery(query.id, {
        text: cnt + " ta buyurtma yakunlandi",
        show_alert: true,
      });
      logger.info(
        "Admin force finished " + cnt + " orders for driver " + driverId,
      );
    }

    // Majburiy yakunlash (order)
    if (data.startsWith("adm_force_complete_")) {
      const orderId = data.replace("adm_force_complete_", "");
      const order = await Order.findById(orderId);
      if (!order)
        return bot.answerCallbackQuery(query.id, { text: "Topilmadi" });

      order.status = "completed";
      order.completedAt = new Date();
      await order.save();
      if (order.driverId && order.orderType === "passenger") {
        await freeDriverSeats(order.driverId, order.passengers || 1);
      }

      await bot.answerCallbackQuery(query.id, {
        text: "✅ Yakunlandi",
        show_alert: true,
      });
      try {
        await bot.editMessageReplyMarkup(
          { inline_keyboard: [] },
          { chat_id: chatId, message_id: query.message.message_id },
        );
      } catch (e) {}
      logger.info("Admin force completed: " + orderId);
    }

    // Majburiy bekor qilish
    if (data.startsWith("adm_force_cancel_")) {
      const orderId = data.replace("adm_force_cancel_", "");
      const order = await Order.findById(orderId);
      if (!order)
        return bot.answerCallbackQuery(query.id, { text: "Topilmadi" });

      order.status = "cancelled";
      order.cancelledAt = new Date();
      order.cancelledBy = "admin";
      await order.save();
      if (order.driverId && order.orderType === "passenger") {
        await freeDriverSeats(order.driverId, order.passengers || 1);
      }

      await bot.answerCallbackQuery(query.id, {
        text: "❌ Bekor qilindi",
        show_alert: true,
      });
      try {
        await bot.editMessageReplyMarkup(
          { inline_keyboard: [] },
          { chat_id: chatId, message_id: query.message.message_id },
        );
      } catch (e) {}
      logger.info("Admin force cancelled: " + orderId);
    }

    // Guruhlarni faollashtirish/o'chirish
    if (data === "adm_groups_activate") {
      await Group.updateMany({}, { isActive: true });
      bot.answerCallbackQuery(query.id, {
        text: "✅ Barcha guruhlar faollashtirildi",
        show_alert: true,
      });
    }
    if (data === "adm_groups_deactivate") {
      await Group.updateMany({}, { isActive: false });
      bot.answerCallbackQuery(query.id, {
        text: "❌ Barcha guruhlar o'chirildi",
        show_alert: true,
      });
    }

    // Guruh batafsil ma'lumot + invite link
    if (data.startsWith("adm_group_info_")) {
      const groupId = Number(data.replace("adm_group_info_", ""));
      const group = await Group.findOne({ groupId });
      if (!group)
        return bot.answerCallbackQuery(query.id, { text: "Guruh topilmadi" });

      await bot.answerCallbackQuery(query.id);

      const types =
        group.orderTypes && group.orderTypes.length
          ? group.orderTypes.join("+")
          : "all";
      const typeLabel =
        types === "all"
          ? "👥+📦 Hammasi"
          : types === "passenger"
            ? "👥 Faqat yo'lovchi"
            : "📦 Faqat yuk/cargo";

      let inviteLink = "";
      try {
        inviteLink = await bot.exportChatInviteLink(groupId);
      } catch (e) {
        inviteLink = null;
      }

      const fmtDate = (d) =>
        d
          ? new Date(d).toLocaleString("uz-UZ", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })
          : "—";

      let text =
        "<pre>📢 GURUH MA'LUMOTLARI</pre>\n\n" +
        "📌 Nom: <b>" +
        group.title +
        "</b>\n" +
        "🆔 ID: <code>" +
        group.groupId +
        "</code>\n" +
        "🔘 Holat: " +
        (group.isActive ? "✅ Faol" : "❌ Nofaol") +
        "\n" +
        "📦 Buyurtma turi: <b>" +
        typeLabel +
        "</b>\n" +
        "📊 Jami buyurtmalar: <b>" +
        group.totalOrders +
        " ta</b>\n" +
        "👤 Qo'shgan: <code>" +
        (group.addedBy || "—") +
        "</code>\n" +
        "📅 Qo'shilgan: <b>" +
        fmtDate(group.createdAt) +
        "</b>\n" +
        "🕐 So'nggi faollik: <b>" +
        fmtDate(group.lastActivity) +
        "</b>";

      const btns = [
        [
          {
            text: group.isActive ? "❌ O'chirish" : "✅ Faollashtirish",
            callback_data: "adm_group_toggle_" + groupId,
          },
          {
            text: "🔧 Tur o'zgartirish",
            callback_data: "adm_group_type_" + groupId,
          },
        ],
      ];

      if (inviteLink) {
        btns.push([{ text: "🔗 Guruhga kirish havolasi", url: inviteLink }]);
      }

      bot.sendMessage(chatId, text, {
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: btns },
      });
    }

    // Guruhni faol/nofaol qilish (toggle)
    if (data.startsWith("adm_group_toggle_")) {
      const groupId = Number(data.replace("adm_group_toggle_", ""));
      const group = await Group.findOne({ groupId });
      if (!group)
        return bot.answerCallbackQuery(query.id, { text: "Topilmadi" });

      group.isActive = !group.isActive;
      await group.save();

      await bot.answerCallbackQuery(query.id, {
        text: group.isActive ? "✅ Faollashtirildi" : "❌ O'chirildi",
        show_alert: true,
      });

      try {
        await bot.editMessageReplyMarkup(
          { inline_keyboard: [] },
          { chat_id: chatId, message_id: query.message.message_id },
        );
      } catch (e) {}

      logger.info("Admin guruh toggle: " + groupId + " → " + group.isActive);
    }

    // Guruh buyurtma turini o'zgartirish
    if (data.startsWith("adm_group_type_")) {
      const groupId = Number(data.replace("adm_group_type_", ""));
      const group = await Group.findOne({ groupId });
      if (!group)
        return bot.answerCallbackQuery(query.id, { text: "Guruh topilmadi" });

      await bot.answerCallbackQuery(query.id);
      await bot.sendMessage(
        chatId,
        "📢 <b>" +
          group.title +
          "</b>\n\n" +
          "Hozirgi tur: <b>" +
          ((group.orderTypes && group.orderTypes.join("+")) || "all") +
          "</b>\n\n" +
          "Qaysi buyurtmalar kelsin?",
        {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "👥+📦 Hammasi (default)",
                  callback_data: "adm_gtype_all_" + groupId,
                },
              ],
              [
                {
                  text: "👥 Faqat yo'lovchi",
                  callback_data: "adm_gtype_passenger_" + groupId,
                },
              ],
              [
                {
                  text: "📦 Faqat yuk/cargo",
                  callback_data: "adm_gtype_cargo_" + groupId,
                },
              ],
            ],
          },
        },
      );
    }

    // Guruh turini saqlash
    if (data.startsWith("adm_gtype_")) {
      const parts = data.replace("adm_gtype_", "").split("_");
      const groupId = Number(parts[parts.length - 1]);
      const type = parts.slice(0, -1).join("_"); // "all" | "passenger" | "cargo"

      const orderTypes =
        type === "all"
          ? ["all"]
          : type === "passenger"
            ? ["passenger"]
            : ["cargo"];

      await Group.findOneAndUpdate({ groupId }, { orderTypes });

      const label =
        type === "all"
          ? "👥+📦 Hammasi"
          : type === "passenger"
            ? "👥 Faqat yo'lovchi"
            : "📦 Faqat yuk/cargo";

      await bot.answerCallbackQuery(query.id, {
        text: "✅ " + label + " qilib o'rnatildi",
        show_alert: true,
      });

      try {
        await bot.editMessageReplyMarkup(
          { inline_keyboard: [] },
          { chat_id: chatId, message_id: query.message.message_id },
        );
      } catch (e) {}

      logger.info("Admin guruh turi o'zgartirdi: " + groupId + " → " + type);
    }
  });
}

module.exports = { applyAdmin, isAdmin };
