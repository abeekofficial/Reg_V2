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

const User = require("../models/User.model");
const { getRegionName, REGIONS } = require("../utils/regionOptions");
const {
  isValidName,
  isValidPhone,
  normalizePhone,
  validateCarNumber,
} = require("../utils/validators");
const { createSession, deleteSession } = require("../cache/sessionCache");

// ─── Region inline keyboard (edit uchun) ─────────────────────────────────────
function regionKeyboard(prefix) {
  const rows = [];
  for (let i = 0; i < REGIONS.length; i += 2) {
    const row = [
      { text: REGIONS[i].name, callback_data: prefix + REGIONS[i].code },
    ];
    if (REGIONS[i + 1])
      row.push({
        text: REGIONS[i + 1].name,
        callback_data: prefix + REGIONS[i + 1].code,
      });
    rows.push(row);
  }
  return { inline_keyboard: rows };
}

// ─── Profil ko'rsatish (edit menu) ───────────────────────────────────────────
async function showProfileEdit(bot, chatId, user) {
  if (user.role === "driver") {
    await bot.sendMessage(
      chatId,
      "<pre>✏️ PROFILNI TAHRIRLASH</pre>\n\n" +
        "👤 Ism: <b>" +
        user.name +
        "</b>\n" +
        "📱 Telefon: <b>" +
        user.phone +
        "</b>\n" +
        "🚗 Mashina: <b>" +
        (user.carModel || "—") +
        "</b>\n" +
        "🔢 Raqam: <b>" +
        (user.carNumber || "—") +
        "</b>\n" +
        "📍 Yo'nalish: <b>" +
        (user.from ? getRegionName(user.from) : "—") +
        " → " +
        (user.to ? getRegionName(user.to) : "—") +
        "</b>\n\n" +
        "Nimani o'zgartirmoqchisiz?",
      {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [
              { text: "👤 Ism", callback_data: "edit_name" },
              { text: "📱 Telefon", callback_data: "edit_phone" },
            ],
            [
              { text: "🚗 Mashina", callback_data: "edit_car_model" },
              { text: "🔢 Raqam", callback_data: "edit_car_number" },
            ],
            [
              { text: "📍 Qayerdan", callback_data: "edit_from" },
              { text: "🏁 Qayerga", callback_data: "edit_to" },
            ],
            [{ text: "📸 Rasm", callback_data: "edit_photo" }],
            [{ text: "❌ Bekor", callback_data: "edit_cancel" }],
          ],
        },
      },
    );
  } else {
    await bot.sendMessage(
      chatId,
      "<pre>✏️ PROFILNI TAHRIRLASH</pre>\n\n" +
        "👤 Ism: <b>" +
        user.name +
        "</b>\n" +
        "📱 Telefon: <b>" +
        user.phone +
        "</b>\n\n" +
        "Nimani o'zgartirmoqchisiz?",
      {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [
              { text: "👤 Ism", callback_data: "edit_name" },
              { text: "📱 Telefon", callback_data: "edit_phone" },
            ],
            [{ text: "❌ Bekor", callback_data: "edit_cancel" }],
          ],
        },
      },
    );
  }
}

function applyCallbackRouter(bot) {
  bot.on("callback_query", async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;

    if (query.message.chat.type !== "private") return;

    logger.debug("Callback query:", { user: chatId, data });

    try {
      // ── Noop ─────────────────────────────────────────────────────────────
      if (data === "noop") {
        return bot.answerCallbackQuery(query.id, { text: "⏳ Kutilmoqda..." });
      }

      // ── Driver: zakaz ─────────────────────────────────────────────────────
      if (data.startsWith("accept_")) return handleAcceptOrder(bot, query);
      if (data.startsWith("reject_")) return handleRejectOrder(bot, query);
      if (data.startsWith("start_trip_")) return handleStartTrip(bot, query);
      if (data.startsWith("cancel_trip_")) return handleCancelTrip(bot, query);
      if (data.startsWith("complete_order_"))
        return handleCompleteOrder(bot, query);

      // ── Passenger: zakaz ──────────────────────────────────────────────────
      if (data.startsWith("cancel_order_"))
        return handleCancelOrder(bot, query);
      if (data.startsWith("confirm_complete_btn_"))
        return handleConfirmComplete(bot, query);
      if (data.startsWith("dispute_")) return handleDispute(bot, query);

      // ── Buyurtma yaratish ─────────────────────────────────────────────────
      if (data.startsWith("region_")) return handleRegionSelect(bot, query);
      if (data.startsWith("pcount_")) return handlePassengerCount(bot, query);
      if (data.startsWith("driver_region_"))
        return handleDriverRouteSelect(bot, query);

      // ── Rating ────────────────────────────────────────────────────────────
      if (data.startsWith("drate_")) return handleRateDriver(bot, query);
      if (data.startsWith("prate_")) return handleRatePassenger(bot, query);

      // ── PROFIL TAHRIRLASH ─────────────────────────────────────────────────
      if (data === "open_profile_edit") {
        await bot.answerCallbackQuery(query.id);
        const user = await User.findOne({ telegramId: chatId });
        if (!user) return;
        return showProfileEdit(bot, chatId, user);
      }

      if (data === "edit_cancel") {
        await bot.answerCallbackQuery(query.id);
        await deleteSession(chatId);
        return bot.sendMessage(chatId, "❌ Tahrirlash bekor qilindi.");
      }

      if (data === "edit_name") {
        await bot.answerCallbackQuery(query.id);
        await createSession(chatId, "EDIT_NAME", {});
        return bot.sendMessage(chatId, "👤 Yangi ismingizni kiriting:");
      }

      if (data === "edit_phone") {
        await bot.answerCallbackQuery(query.id);
        await createSession(chatId, "EDIT_PHONE_WAIT", {});
        return bot.sendMessage(
          chatId,
          "📱 Yangi telefon raqamingizni yuboring:",
          {
            reply_markup: {
              keyboard: [
                [
                  {
                    text: "📱 Telefon raqamni yuborish",
                    request_contact: true,
                  },
                ],
              ],
              resize_keyboard: true,
              one_time_keyboard: true,
            },
          },
        );
      }

      if (data === "edit_car_model") {
        await bot.answerCallbackQuery(query.id);
        await createSession(chatId, "EDIT_CAR_MODEL", {});
        return bot.sendMessage(
          chatId,
          "🚗 Yangi mashina modelini kiriting:\n(Masalan: Chevrolet Lacetti)",
        );
      }

      if (data === "edit_car_number") {
        await bot.answerCallbackQuery(query.id);
        await createSession(chatId, "EDIT_CAR_NUMBER", {});
        return bot.sendMessage(
          chatId,
          "🔢 Yangi mashina raqamini kiriting:\n\n• <code>01 A 777 AA</code>\n• <code>01 777 AAA</code>",
          { parse_mode: "HTML" },
        );
      }

      if (data === "edit_photo") {
        await bot.answerCallbackQuery(query.id);
        await createSession(chatId, "EDIT_PHOTO", {});
        return bot.sendMessage(
          chatId,
          "📸 O'zingiz va mashinangiz bilan bitta yangi rasm yuboring:",
        );
      }

      if (data === "edit_from") {
        await bot.answerCallbackQuery(query.id);
        await createSession(chatId, "EDIT_FROM", {});
        return bot.sendMessage(chatId, "📍 Qayerdan yo'lga chiqasiz?", {
          reply_markup: regionKeyboard("editfrom_"),
        });
      }

      if (data === "edit_to") {
        await bot.answerCallbackQuery(query.id);
        await createSession(chatId, "EDIT_TO", {});
        return bot.sendMessage(chatId, "🏁 Qayerga ketasiz?", {
          reply_markup: regionKeyboard("editto_"),
        });
      }

      if (data.startsWith("editfrom_")) {
        await bot.answerCallbackQuery(query.id);
        const regionCode = data.replace("editfrom_", "");
        const user = await User.findOneAndUpdate(
          { telegramId: chatId },
          { from: regionCode },
          { new: true },
        );
        await deleteSession(chatId);
        return bot.sendMessage(
          chatId,
          "✅ <b>Qayerdan yangilandi:</b> " +
            getRegionName(regionCode) +
            "\n\n📍 Yo'nalish: <b>" +
            getRegionName(regionCode) +
            " → " +
            (user.to ? getRegionName(user.to) : "—") +
            "</b>",
          { parse_mode: "HTML" },
        );
      }

      if (data.startsWith("editto_")) {
        await bot.answerCallbackQuery(query.id);
        const regionCode = data.replace("editto_", "");
        const user = await User.findOneAndUpdate(
          { telegramId: chatId },
          { to: regionCode },
          { new: true },
        );
        await deleteSession(chatId);
        return bot.sendMessage(
          chatId,
          "✅ <b>Qayerga yangilandi:</b> " +
            getRegionName(regionCode) +
            "\n\n📍 Yo'nalish: <b>" +
            (user.from ? getRegionName(user.from) : "—") +
            " → " +
            getRegionName(regionCode) +
            "</b>",
          { parse_mode: "HTML" },
        );
      }
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
