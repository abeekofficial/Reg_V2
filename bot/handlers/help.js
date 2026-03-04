// handlers/help.js
// /botinfo va /help — barcha foydalanuvchilar uchun

const User = require("../models/User.model");

const HELP_DRIVER = `
<pre>🚖 HAYDOVCHI UCHUN QO'LLANMA</pre>

<b>📋 RO'YXATDAN O'TISH</b>
/start bosing → "🚕 Haydovchi" tanlang
Ism, telefon, mashina ma'lumotlarini kiriting
Yo'nalishni tanlang (qayerdan → qayerga)

<b>🚗 MASHINA O'RINLARI TIZIMI</b>
Mashinada maksimal <b>4 ta o'rin</b> bor
Har bir qabul qilgan yo'lovchi buyurtmasida o'rinlar band bo'ladi
Misol: 2 kishilik buyurtma qabul qilsangiz → 2 o'rin band
Safar yakunlanganda yoki bekor qilinganda o'rinlar bo'shaydi
Mashina to'lganda yangi buyurtma kelmaydi

<b>📦 YUK/CARGO BUYURTMALAR</b>
Yuk buyurtmalari o'rin tizimiga bog'liq emas
Har doim alohida qabul qilinadi

<b>🔄 BUYURTMA JARAYONI</b>
1️⃣ Botga "🚖 Buyurtma qabul qilishni boshlash" bosing
2️⃣ Yo'nalishni tanlang
3️⃣ Yangi buyurtma kelganda bildirishnoma olasiz
4️⃣ "✅ Qabul qilish" yoki "❌ Rad etish" bosing
5️⃣ Qabul qilsangiz — yo'lovchi ma'lumotlari ko'rinadi
6️⃣ Yo'lovchini olgach → "🚕 Safar boshlash"
7️⃣ Manzilga yetgach → "✅ Safar yakunlandi"
8️⃣ Yo'lovchi tasdiqlaydi → safar tugaydi

<b>📋 MENING BUYURTMALARIM</b>
Barcha holatdagi buyurtmalarni ko'rish:
• ⚡ Aktiv (qabul qilingan, jarayonda)
• 📋 Tarix (yakunlangan, bekor qilingan)
Vaqt, davomiylik, kim bekor qilgani ko'rinadi

<b>📊 STATISTIKA</b>
Umumiy raqamlar: yakunlangan, bekor, reyting

<b>⭐ REYTING TIZIMI</b>
Har bir safardan keyin yo'lovchi baholaydi (1-5 yulduz)
Reyting: A'lo (4.8+) | Yaxshi (4.5+) | O'rta (4.0+)

<b>🌍 GURUHDAN BUYURTMA</b>
Guruhda chiqgan buyurtmani ko'rsangiz
"✅ Qabul qilaman" tugmasini bosing
Bot sizga to'g'ridan-to'g'ri yozadi

<b>👥 REFERAL TIZIMI</b>
Referal havolangizni do'stlarga yuboring
Har bir ro'yxatdan o'tgan kishi uchun ball

<b>❓ KOMANDALAR</b>
/start — bosh menyu
/help — ushbu qo'llanma
/myorders — mening buyurtmalarim
`.trim();

const HELP_PASSENGER = `
<pre>🧍 YO'LOVCHI UCHUN QO'LLANMA</pre>

<b>📋 RO'YXATDAN O'TISH</b>
/start bosing → "🧍 Yo'lovchi" tanlang
Ism va telefon raqamingizni kiriting

<b>🚖 BUYURTMA BERISH</b>
"🚖 Buyurtma berish" — yo'lovchi sifatida
"📦 Yuk/Pochta" — yuk jo'natish uchun

<b>🔄 BUYURTMA JARAYONI</b>
1️⃣ "🚖 Buyurtma berish" bosing
2️⃣ Qayerdan va qayerga ketishni tanlang
3️⃣ Nechta kishi ekanini kiriting (1-4)
4️⃣ Sistema haydovchi qidiradi
5️⃣ Haydovchi topilganda — ma'lumotlari keladi
6️⃣ Safar boshlanishi haqida xabar olasiz
7️⃣ Manzilga yetgach haydovchi yakunlashni so'raydi
8️⃣ "✅ Ha, yakunlandi" bosing → reyting bering

<b>📦 YUK/POCHTA JO'NATISH</b>
Yukni tavsiflab yozing
Rasm yuklash ixtiyoriy
Haydovchi topilganda xabar keladi

<b>📋 TARIXIM</b>
Barcha buyurtmalar tarixi:
• ⚡ Aktiv buyurtmalar (bekor qilish tugmasi)
• 📋 O'tgan buyurtmalar (vaqt, holat)

<b>⭐ BAHOLASH</b>
Safar tugagach haydovchini baholang (1-5 yulduz)
Yaxshi reyting — yaxshi haydovchilar!

<b>❌ BEKOR QILISH</b>
Safar boshlanmagan bo'lsa bekor qilish mumkin
Safar boshlangandan keyin bekor bo'lmaydi

<b>👥 REFERAL TIZIMI</b>
Referal havolangiz "👤 Profilim" da
Do'stlarni taklif qiling

<b>❓ KOMANDALAR</b>
/start — bosh menyu
/help — ushbu qo'llanma
`.trim();

const HELP_NEW = `
<pre>👋 BOT HAQIDA</pre>

<b>🚖 Taxi & Yuk Tashish Boti</b>

Ushbu bot orqali:
• 🚕 Taksi buyurtma bering
• 📦 Yuk/pochta jo'nating
• 🚗 Haydovchi sifatida daromad toping

<b>BOSHLASH UCHUN:</b>
/start — ro'yxatdan o'ting

<b>ROLLAR:</b>
🚕 <b>Haydovchi</b> — buyurtma qabul qiling
🧍 <b>Yo'lovchi</b> — buyurtma bering
`.trim();

function applyHelp(bot) {
  bot.onText(/\/help|📋 Bot haqida/, async (msg) => {
    const chatId = msg.chat.id;
    if (msg.chat.type !== "private") return;

    try {
      const user = await User.findOne({ telegramId: Number(chatId) });

      let text;
      if (!user) {
        text = HELP_NEW;
      } else if (user.role === "driver") {
        text = HELP_DRIVER;
      } else {
        text = HELP_PASSENGER;
      }

      bot.sendMessage(chatId, text, { parse_mode: "HTML" });
    } catch (err) {
      bot.sendMessage(chatId, HELP_NEW, { parse_mode: "HTML" });
    }
  });

  bot.onText(/\/myorders/, async (msg) => {
    const chatId = msg.chat.id;
    if (msg.chat.type !== "private") return;
    // driver/menu.js yoki passenger/menu.js trigger qiladi
    // Bu yerda faqat redirect
    bot.sendMessage(
      chatId,
      "📋 Buyurtmalaringizni ko'rish uchun menyudagi tugmani bosing:",
      {
        reply_markup: {
          keyboard: [["📋 Mening buyurtmalarim"], ["📋 Tarixim"]],
          resize_keyboard: true,
          one_time_keyboard: true,
        },
      },
    );
  });
}

module.exports = { applyHelp, HELP_DRIVER, HELP_PASSENGER };
