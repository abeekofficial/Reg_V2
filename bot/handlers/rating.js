// handlers/rating.js
// Haydovchi va yo'lovchini baholash — tugmalar orqali
const User = require("../models/User.model");
const Order = require("../models/Order.model");
const logger = require("../utils/logger");

// ── Baholash inline keyboard ─────────────────────────────────────────────────
// prefix: "drate_" (driver rating) | "prate_" (passenger rating)
function ratingKeyboard(prefix, orderId) {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "⭐⭐⭐⭐⭐", callback_data: `${prefix}${orderId}_5` },
          { text: "⭐⭐⭐⭐", callback_data: `${prefix}${orderId}_4` },
        ],
        [
          { text: "⭐⭐⭐", callback_data: `${prefix}${orderId}_3` },
          { text: "⭐⭐", callback_data: `${prefix}${orderId}_2` },
          { text: "⭐", callback_data: `${prefix}${orderId}_1` },
        ],
      ],
    },
  };
}

// ── Haydovchi ratingini driver menu da ko'rsatish ────────────────────────────
function applyRating(bot) {
  // ─── DRIVER RATING CALLBACK: drate_<orderId>_<stars> ────────────────────
  // (callbackRouter.js dan chaqiriladi)
}

// ─── CALLBACK HANDLER: Haydovchini baholash ──────────────────────────────────
async function handleRateDriver(bot, query) {
  const chatId = query.message.chat.id;
  // drate_<orderId>_<stars>
  const parts = query.data.replace("drate_", "").split("_");
  const orderId = parts[0];
  const stars = parseInt(parts[1]);

  try {
    const order = await Order.findById(orderId);

    if (!order) {
      return bot.answerCallbackQuery(query.id, {
        text: "❌ Buyurtma topilmadi!",
        show_alert: true,
      });
    }
    if (order.passengerId !== Number(chatId)) {
      return bot.answerCallbackQuery(query.id, {
        text: "❌ Bu sizning buyurtmangiz emas!",
        show_alert: true,
      });
    }
    if (order.driverRated) {
      return bot.answerCallbackQuery(query.id, {
        text: "✅ Siz allaqachon baholagansiz!",
        show_alert: true,
      });
    }
    if (order.status !== "completed") {
      return bot.answerCallbackQuery(query.id, {
        text: "❌ Buyurtma yakunlanmagan!",
        show_alert: true,
      });
    }

    // Order ga rated bayroq qo'yamiz — takroriy baholash oldini olamiz
    await Order.findByIdAndUpdate(orderId, { driverRated: true });

    // Driver ratingini yangilaymiz
    const driver = await User.findOne({ telegramId: order.driverId });
    if (driver) {
      const newCount = (driver.ratingCount || 0) + 1;
      const newRating = parseFloat(
        (
          (driver.rating * (driver.ratingCount || 0) + stars) /
          newCount
        ).toFixed(2),
      );
      await User.findOneAndUpdate(
        { telegramId: order.driverId },
        { rating: newRating, ratingCount: newCount },
      );
      logger.info(
        `Driver baholandi: ${order.driverId} → ${stars}⭐ (yangi: ${newRating})`,
      );
    }

    await bot.answerCallbackQuery(query.id, {
      text: `✅ ${stars} yulduz berildi! Rahmat!`,
    });

    const starStr = "⭐".repeat(stars);
    await bot.editMessageText(
      `${starStr} <b>Haydovchiga ${stars} yulduz berdingiz!</b>\n\nRahmat! 🙏`,
      {
        chat_id: chatId,
        message_id: query.message.message_id,
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: [] },
      },
    );
  } catch (err) {
    logger.error("handleRateDriver xato:", err);
    bot.answerCallbackQuery(query.id, {
      text: "❌ Xatolik!",
      show_alert: true,
    });
  }
}

// ─── CALLBACK HANDLER: Yo'lovchini baholash ──────────────────────────────────
async function handleRatePassenger(bot, query) {
  const chatId = query.message.chat.id;
  // prate_<orderId>_<stars>
  const parts = query.data.replace("prate_", "").split("_");
  const orderId = parts[0];
  const stars = parseInt(parts[1]);

  try {
    const order = await Order.findById(orderId);

    if (!order) {
      return bot.answerCallbackQuery(query.id, {
        text: "❌ Buyurtma topilmadi!",
        show_alert: true,
      });
    }
    if (order.driverId !== Number(chatId)) {
      return bot.answerCallbackQuery(query.id, {
        text: "❌ Bu sizning buyurtmangiz emas!",
        show_alert: true,
      });
    }
    if (order.passengerRated) {
      return bot.answerCallbackQuery(query.id, {
        text: "✅ Siz allaqachon baholagansiz!",
        show_alert: true,
      });
    }
    if (order.status !== "completed") {
      return bot.answerCallbackQuery(query.id, {
        text: "❌ Buyurtma yakunlanmagan!",
        show_alert: true,
      });
    }

    // Order ga rated bayroq
    await Order.findByIdAndUpdate(orderId, { passengerRated: true });

    // Yo'lovchi ratingini yangilaymiz
    const passenger = await User.findOne({ telegramId: order.passengerId });
    if (passenger) {
      const newCount = (passenger.ratingCount || 0) + 1;
      const newRating = parseFloat(
        (
          (passenger.rating * (passenger.ratingCount || 0) + stars) /
          newCount
        ).toFixed(2),
      );
      await User.findOneAndUpdate(
        { telegramId: order.passengerId },
        { rating: newRating, ratingCount: newCount },
      );
      logger.info(
        `Passenger baholandi: ${order.passengerId} → ${stars}⭐ (yangi: ${newRating})`,
      );
    }

    await bot.answerCallbackQuery(query.id, {
      text: `✅ ${stars} yulduz berildi! Rahmat!`,
    });

    const starStr = "⭐".repeat(stars);
    await bot.editMessageText(
      `${starStr} <b>Yo'lovchiga ${stars} yulduz berdingiz!</b>\n\nRahmat! 🙏`,
      {
        chat_id: chatId,
        message_id: query.message.message_id,
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: [] },
      },
    );
  } catch (err) {
    logger.error("handleRatePassenger xato:", err);
    bot.answerCallbackQuery(query.id, {
      text: "❌ Xatolik!",
      show_alert: true,
    });
  }
}

module.exports = {
  applyRating,
  handleRateDriver,
  handleRatePassenger,
  ratingKeyboard,
};
