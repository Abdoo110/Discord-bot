const mongoose = require('mongoose');

const stickyMessageSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  channelId: { type: String, required: true, unique: true },
  messageId: { type: String, required: true },
  content: { type: String, required: true },
  embedJSON: { type: Object, default: null },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('StickyMessage', stickyMessageSchema);
