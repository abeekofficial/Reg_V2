// models/Group.model.js
const mongoose = require("mongoose");

const groupSchema = new mongoose.Schema(
  {
    groupId: { type: Number, required: true, unique: true },
    title: { type: String, default: "Noma'lum guruh" },
    username: { type: String, default: null },
    inviteLink: { type: String, default: null },
    isActive: { type: Boolean, default: true, index: true },
    totalOrders: { type: Number, default: 0 },
    lastActivity: { type: Date, default: Date.now },
    addedBy: { type: Number, default: null }, // admin telegramId
    orderTypes: {
      type: [String],
      enum: ["passenger", "cargo", "all"],
      default: ["all"], // "all" = ikkalasi ham, yoki ["passenger"], ["cargo"]
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Group", groupSchema);
