// handlers/profile/edit.js
// Faqat matn/rasm xabarlarni ushlaydi (callback lar callbackRouter.js da)
const User = require("../../models/User.model");
const logger = require("../../utils/logger");
const {
  isValidName,
  isValidPhone,
  normalizePhone,
  validateCarNumber,
} = require("../../utils/validators");
const { getSession, deleteSession } = require("../../cache/sessionCache");

const EDIT_STEPS = new Set([
  "EDIT_NAME",
  "EDIT_PHONE_WAIT",
  "EDIT_CAR_MODEL",
  "EDIT_CAR_NUMBER",
  "EDIT_PHOTO",
  "EDIT_FROM",
  "EDIT_TO",
]);

async function handleEditMessage(bot, msg, session) {
  const chatId = Number(msg.chat.id);
  const text = (msg.text || "").trim();
  const step = session.step;

  if (step === "EDIT_NAME") {
    if (!msg.text)
      return bot.sendMessage(chatId, "❌ Matn ko'rinishida yuboring!");
    if (!isValidName(text))
      return bot.sendMessage(
        chatId,
        "❌ Ism noto'g'ri!\n• Kamida 3 ta harf\n• Faqat harflar",
      );
    await User.findOneAndUpdate({ telegramId: chatId }, { name: text });
    await deleteSession(chatId);
    return bot.sendMessage(chatId, "✅ <b>Ism yangilandi:</b> " + text, {
      parse_mode: "HTML",
    });
  }

  if (step === "EDIT_PHONE_WAIT") {
    const rawPhone = msg.contact ? msg.contact.phone_number : text;
    if (!rawPhone || !isValidPhone(rawPhone)) {
      return bot.sendMessage(
        chatId,
        "❌ Noto'g'ri telefon!\nFormat: <code>+998901234567</code>",
        { parse_mode: "HTML" },
      );
    }
    const phone = normalizePhone(rawPhone);
    await User.findOneAndUpdate({ telegramId: chatId }, { phone });
    await deleteSession(chatId);
    return bot.sendMessage(chatId, "✅ <b>Telefon yangilandi:</b> " + phone, {
      parse_mode: "HTML",
      reply_markup: { remove_keyboard: true },
    });
  }

  if (step === "EDIT_CAR_MODEL") {
    if (!msg.text || text.length < 3)
      return bot.sendMessage(chatId, "❌ Kamida 3 ta belgi kiriting!");
    await User.findOneAndUpdate({ telegramId: chatId }, { carModel: text });
    await deleteSession(chatId);
    return bot.sendMessage(chatId, "✅ <b>Mashina yangilandi:</b> " + text, {
      parse_mode: "HTML",
    });
  }

  if (step === "EDIT_CAR_NUMBER") {
    if (!msg.text) return bot.sendMessage(chatId, "❌ Raqam kiriting!");
    const result = validateCarNumber(text);
    if (!result.valid)
      return bot.sendMessage(chatId, result.message, { parse_mode: "HTML" });
    await User.findOneAndUpdate(
      { telegramId: chatId },
      { carNumber: result.formatted },
    );
    await deleteSession(chatId);
    return bot.sendMessage(
      chatId,
      "✅ <b>Mashina raqami yangilandi:</b> " + result.formatted,
      { parse_mode: "HTML" },
    );
  }

  if (step === "EDIT_PHOTO") {
    if (!msg.photo)
      return bot.sendMessage(
        chatId,
        "❌ Rasm yuboring! (faqat rasm formatida)",
      );
    const fileId = msg.photo[msg.photo.length - 1].file_id;
    await User.findOneAndUpdate(
      { telegramId: chatId },
      { driverPhoto: fileId },
    );
    await deleteSession(chatId);
    return bot.sendMessage(chatId, "✅ <b>Rasm yangilandi!</b>", {
      parse_mode: "HTML",
    });
  }
}

function applyProfileEdit(bot) {
  // Faqat matn/rasm xabarlarni ushlaydi
  // Callback lar (open_profile_edit, edit_name, edit_phone va h.k.) callbackRouter.js da
  bot.on("message", async (msg) => {
    if (msg.chat.type !== "private") return;
    const chatId = msg.chat.id;
    const session = await getSession(chatId);
    if (!session || !EDIT_STEPS.has(session.step)) return;
    await handleEditMessage(bot, msg, session);
  });
}

module.exports = { applyProfileEdit, EDIT_STEPS };
