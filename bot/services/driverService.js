// services/driverService.js
const User = require("../models/User.model");
const Order = require("../models/Order.model");

const MAX_SEATS = 4;

/**
 * Driver hozir to'liq band mi tekshirish.
 * Yuk/cargo buyurtmalari uchun seats logikasi ishlamaydi — alohida tekshiriladi.
 * @param {number} driverTelegramId
 * @param {string} orderType - "passenger" | "cargo" — yangi buyurtma turi
 */
async function isDriverBusy(driverTelegramId, orderType = "passenger") {
  const driver = await User.findOne({
    telegramId: Number(driverTelegramId),
  }).lean();
  if (!driver) return true;

  // Cargo/yuk bo'lsa — oddiy band tekshiruvi (aktiv order bormi)
  if (orderType === "cargo") {
    const active = await Order.findOne({
      driverId: Number(driverTelegramId),
      status: {
        $in: [
          "accepted",
          "in_progress",
          "driver_confirmed",
          "passenger_confirmed",
        ],
      },
    })
      .select("_id orderType")
      .lean();
    return !!active;
  }

  // Passenger buyurtmasi uchun — o'rinlar to'ldimi?
  // in_progress yoki undan keyingi holatda bo'lsa yangi qabul qilib bo'lmaydi
  const inProgressOrder = await Order.findOne({
    driverId: Number(driverTelegramId),
    status: { $in: ["in_progress", "driver_confirmed", "passenger_confirmed"] },
  })
    .select("_id")
    .lean();

  if (inProgressOrder) return true;

  // Accepted holat — o'rinlar to'ldimi?
  return driver.usedSeats >= MAX_SEATS;
}

/**
 * Driver nechta bo'sh o'rni borligini qaytaradi
 */
async function getDriverFreeSeats(driverTelegramId) {
  const driver = await User.findOne({
    telegramId: Number(driverTelegramId),
  }).lean();
  if (!driver) return 0;
  return Math.max(0, MAX_SEATS - (driver.usedSeats || 0));
}

/**
 * Driver o'rinlarini yangilash (qo'shish yoki kamaytirish)
 * @param {number} driverTelegramId
 * @param {number} seats - qo'shiladigan o'rinlar soni (manfiy = bo'shatish)
 */
async function updateDriverSeats(driverTelegramId, seats) {
  const driver = await User.findOne({ telegramId: Number(driverTelegramId) });
  if (!driver) return;

  driver.usedSeats = Math.min(
    MAX_SEATS,
    Math.max(0, (driver.usedSeats || 0) + seats),
  );
  await driver.save();
  return driver;
}

/**
 * Safar yakunlanganda yoki bekor qilinganda o'rinlarni bo'shatish
 */
async function freeDriverSeats(driverTelegramId, passengers) {
  return updateDriverSeats(driverTelegramId, -passengers);
}

/**
 * Zakaz uchun bo'sh driverlarni priority tartibda olish
 * Passenger buyurtmasi uchun — kerakli o'rinlar bo'lgan driverlar
 * @param {string} from
 * @param {string} to
 * @param {number} limit
 * @param {number} neededSeats - kerakli o'rinlar soni
 * @param {string} orderType
 */
async function getAvailableDrivers(
  from,
  to,
  limit = 10,
  neededSeats = 1,
  orderType = "passenger",
) {
  if (orderType === "cargo") {
    // Cargo uchun — oddiy bo'sh driver
    return User.find({
      role: "driver",
      isActive: true,
      isBlocked: false,
      from,
      to,
    })
      .sort({ referralCount: -1, rating: -1 })
      .limit(limit)
      .lean();
  }

  // Passenger uchun — bo'sh o'rinlar yetarli bo'lgan driverlar
  // usedSeats + neededSeats <= MAX_SEATS va in_progress emas
  const busyDriverIds = await Order.distinct("driverId", {
    status: { $in: ["in_progress", "driver_confirmed", "passenger_confirmed"] },
  });

  return User.find({
    role: "driver",
    isActive: true,
    isBlocked: false,
    from,
    to,
    telegramId: { $nin: busyDriverIds },
    $expr: { $lte: [{ $add: ["$usedSeats", neededSeats] }, MAX_SEATS] },
  })
    .sort({ referralCount: -1, rating: -1 })
    .limit(limit)
    .lean();
}

/**
 * Driver ratingini yangilash
 */
async function updateDriverRating(driverTelegramId, newRating) {
  const driver = await User.findOne({ telegramId: Number(driverTelegramId) });
  if (!driver) return;

  const totalRating = driver.rating * driver.ratingCount + newRating;
  driver.ratingCount += 1;
  driver.rating = parseFloat((totalRating / driver.ratingCount).toFixed(2));
  await driver.save();
  return driver;
}

/**
 * Driver yo'nalishini yangilash
 */
async function updateDriverRoute(telegramId, from, to) {
  return User.findOneAndUpdate(
    { telegramId: Number(telegramId) },
    { from, to, isActive: true },
    { new: true },
  );
}

module.exports = {
  isDriverBusy,
  getDriverFreeSeats,
  updateDriverSeats,
  freeDriverSeats,
  getAvailableDrivers,
  updateDriverRating,
  updateDriverRoute,
  MAX_SEATS,
};
