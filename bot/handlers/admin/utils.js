// handlers/admin/utils.js — Admin umumiy yordamchi funksiyalar
const User = require("../../models/User.model");
const Order = require("../../models/Order.model");
const config = require("../../config");
const { getRegionName } = require("../../utils/regionOptions");

// ─── Admin tekshiruvi ────────────────────────────────────────────────────────
function isAdmin(chatId) {
  return config.bot.adminIds.includes(Number(chatId));
}

// ─── Vaqt formatlash ─────────────────────────────────────────────────────────
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

// ─── User ma'lumot kartasi ───────────────────────────────────────────────────
function userCard(user, orders = 0) {
  const role = user.role === "driver" ? "🚗 Haydovchi" : "🧍 Yo'lovchi";

  const nameLink = user.username
    ? '<b><a href="https://t.me/' +
      user.username +
      '">' +
      user.name +
      "</a></b>"
    : '<b><a href="tg://user?id=' +
      user.telegramId +
      '">' +
      user.name +
      "</a></b>";

  let t = role + " | " + nameLink + "\n";
  t += "📱 " + user.phone + "\n";
  t += "🆔 <code>" + user.telegramId + "</code>";
  if (user.username)
    t +=
      ' | <a href="https://t.me/' +
      user.username +
      '">@' +
      user.username +
      "</a>";
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

// ─── User inline tugmalari ───────────────────────────────────────────────────
function userButtons(user) {
  const id = user.telegramId;
  const btns = [
    [
      {
        text: user.isBlocked ? "✅ Blokdan chiqarish" : "🚫 Bloklash",
        callback_data: "adm_block_" + id,
      },
      { text: "📋 Buyurtmalar", callback_data: "adm_orders_" + id },
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

module.exports = { isAdmin, fmtDate, adminMenu, userCard, userButtons };
