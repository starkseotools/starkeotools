const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    telegramId: { type: String, required: true, unique: true },
    username: String,
    first_name: String,
    photo_url: String,
    credits: { type: Number, default: 0.00 },
    hasK12: { type: Boolean, default: false },
    referredBy: String,
    referralCount: { type: Number, default: 0 },
    lastDailyClaim: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
