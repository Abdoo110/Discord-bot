const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  userId: { type: String, required: true },
  username: { type: String, required: true },
  shulkerType: { type: String, required: true },
  quantity: { type: Number, required: true },
  whenNeeded: { type: String, default: '' },
  totalPrice: { type: Number, required: true },
  formattedPrice: { type: String, required: true },
  status: { type: String, default: 'pending' },
  paid: { type: Boolean, default: false },
  paymentClaimed: { type: Boolean, default: false },
  orderChannelId: { type: String, default: null },
  orderMessageId: { type: String, default: null },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Order', orderSchema);
