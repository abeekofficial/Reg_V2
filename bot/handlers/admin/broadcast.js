// handlers/admin/broadcast.js — Post yuborish (broadcast)
const User = require("../../models/User.model");
const Group = require("../../models/Group.model");
const logger = require("../../utils/logger");
const { isAdmin } = require("./utils");

// ─── Broadcast yordamchi ─────────────────────────────────────────────────────
async function doBroadcast(bot, chatId, text, filter = {}) {
  const users = await User.find(filter).lean();
  bot.sendMessage(chatId, "📤 Yuborilmoqda... (" + users.length + " ta)");

  let ok = 0,
    fail = 0;
  for (const u of users) {
    try {
      await bot.sendMessage(u.telegramId, text, { parse_mode: "HTML" });
      ok++;
      await new Promise((r) => setTimeout(r, 50)); // Telegram rate limit
    } catch (e) {
      fail++;
    }
  }
  bot.sendMessage(
    chatId,
    "✅ <b>" + ok + "</b> ta yuborildi | ❌ <b>" + fail + "</b> ta xato",
    { parse_mode: "HTML" },
  );
}

function applyAdminBroadcast(bot) {
  // ─── 📣 Post yuborish — menyu ─────────────────────────────────────────────
  bot.onText(/📣 Post yuborish/, async (msg) => {
    const chatId = msg.chat.id;
    if (!isAdmin(chatId)) return;
    bot.sendMessage(
      chatId,
      "<b>📣 POST YUBORISH</b>\n\n" +
        "Barcha:\n/broadcast <code>matn</code>\n\n" +
        "Haydovchilar:\n/broadcast_drivers <code>matn</code>\n\n" +
        "Yo'lovchilar:\n/broadcast_passengers <code>matn</code>\n\n" +
        "Guruhlar:\n/broadcast_groups <code>matn</code>",
      { parse_mode: "HTML" },
    );
  });

  bot.onText(/\/broadcast (.+)/, async (msg, match) => {
    if (!isAdmin(msg.chat.id)) return;
    await doBroadcast(bot, msg.chat.id, "📢 <b>XABAR</b>\n\n" + match[1]);
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
      "✅ " + ok + " ta guruhga | ❌ " + fail + " ta xato",
      { parse_mode: "HTML" },
    );
  });
}

module.exports = { applyAdminBroadcast };
