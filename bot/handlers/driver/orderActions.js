// handlers/driver/orderActions.js
const Order  = require("../../models/Order.model");
const User   = require("../../models/User.model");
const logger = require("../../utils/logger");
const { getRegionName } = require("../../utils/regionOptions");
const { isDriverBusy, getDriverFreeSeats, updateDriverSeats, MAX_SEATS } = require("../../services/driverService");
const { notifyPassengerDriverFound } = require("../../services/notifyService");

async function handleAcceptOrder(bot, query) {
  const chatId  = Number(query.message.chat.id);
  const orderId = query.data.replace("accept_", "");
  const order   = await Order.findById(orderId);

  if (!order) {
    return bot.answerCallbackQuery(query.id, { text: "❌ Buyurtma topilmadi!", show_alert: true });
  }
  if (order.status !== "pending" || order.driverId) {
    return bot.answerCallbackQuery(query.id, { text: "❌ Buyurtma allaqachon qabul qilingan!", show_alert: true });
  }

  const neededSeats = order.orderType === "passenger" ? (order.passengers || 1) : 0;

  // Jarayondagi safar tekshiruvi
  const busy = await isDriverBusy(chatId, order.orderType);
  if (busy) {
    return bot.answerCallbackQuery(query.id, {
      text: "❌ Sizda yakunlanmagan safar bor!", show_alert: true,
    });
  }

  // O'rin tekshiruvi (passenger)
  if (order.orderType === "passenger") {
    const free = await getDriverFreeSeats(chatId);
    if (free < neededSeats) {
      return bot.answerCallbackQuery(query.id, {
        text: "❌ Mashinangizda " + neededSeats + " ta o'rin yo'q (bo'sh: " + free + ")",
        show_alert: true,
      });
    }
  }

  // Atomic update
  const updated = await Order.findOneAndUpdate(
    { _id: orderId, driverId: null, status: "pending" },
    { driverId: chatId, status: "accepted", acceptedAt: new Date() },
    { new: true },
  );

  if (!updated) {
    return bot.answerCallbackQuery(query.id, { text: "❌ Buyurtma allaqachon qabul qilingan!", show_alert: true });
  }

  if (order.orderType === "passenger") {
    await updateDriverSeats(chatId, neededSeats);
  }

  const passenger = await User.findOne({ telegramId: Number(updated.passengerId) }).lean();
  const from      = getRegionName(updated.from);
  const to        = getRegionName(updated.to);
  const typeEmoji = updated.orderType === "cargo" ? "📦" : "👥";
  const typeText  = updated.orderType === "cargo"
    ? "Yuk: <b>" + updated.cargoDescription + "</b>"
    : "Yo'lovchilar: <b>" + (updated.passengers || 1) + " kishi</b>";

  let seatsLine = "";
  if (updated.orderType === "passenger") {
    const freeAfter = await getDriverFreeSeats(chatId);
    seatsLine = freeAfter > 0
      ? "\n🚗 Bo'sh o'rinlar: <b>" + freeAfter + "/" + MAX_SEATS + "</b>"
      : "\n🚗 Mashina <b>to'ldi</b>";
  }

  let pInfo = "";
  if (passenger) {
    pInfo = "\n\n👤 <b>" + passenger.name + "</b>\n" +
      "📱 <b>" + passenger.phone + "</b>\n" +
      (passenger.username ? "💬 @" + passenger.username + "\n" : "");
  }

  await bot.answerCallbackQuery(query.id, { text: "✅ Buyurtma qabul qilindi!" });
  await bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: chatId, message_id: query.message.message_id });

  await bot.sendMessage(
    chatId,
    "✅ <b>Buyurtma qabul qilindi!</b>\n\n" +
    "📍 " + from + " → " + to + "\n" +
    typeEmoji + " " + typeText +
    pInfo + seatsLine +
    "\n\n💡 Yo'lovchini olgach tugmani bosing:",
    {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [[
          { text: "🚕 Safar boshlash",         callback_data: "start_trip_"  + orderId },
          { text: "❌ Buyurtmani bekor qilish", callback_data: "cancel_trip_" + orderId },
        ]],
      },
    },
  );

  const driver = await User.findOne({ telegramId: chatId }).lean();
  if (driver && passenger) {
    await notifyPassengerDriverFound(bot, passenger, driver, updated);
  }

  logger.success("Driver qabul qildi: " + orderId, { driverId: chatId });
}

async function handleRejectOrder(bot, query) {
  await bot.answerCallbackQuery(query.id, { text: "❌ Buyurtma rad etildi!" });
  await bot.editMessageReplyMarkup(
    { inline_keyboard: [] },
    { chat_id: query.message.chat.id, message_id: query.message.message_id },
  );
}

module.exports = { handleAcceptOrder, handleRejectOrder };
