const { Events, Collection } = require('discord.js');
const { checkSpam } = require('../handlers/antiAbuse');
const { addSnipe } = require('../commands/moderation/snipe');
const StickyMessage = require('../models/StickyMessage');
const { handleMessage: trackGiveaway } = require('../handlers/giveawayTracker');

module.exports = {
  name: Events.MessageCreate,
  async execute(message) {
    // LOG EVERYTHING
    const authorType = message.author.bot ? 'BOT' : 'HUMAN';
    const webhook = message.webhookId ? ' WEBHOOK' : '';
    console.log(`[MSG] ${authorType}${webhook} | ${message.author.username}#${message.author.discriminator} | embeds=${message.embeds?.length || 0} | content="${(message.content || '').slice(0, 80)}"`);

    if (!message.guild) return;

    if (message.author.bot) {
      await trackGiveaway(message);
      return;
    }

    await checkSpam(message);

    const GuildConfig = require('../models/GuildConfig');
    const cfg = await GuildConfig.findOne({ guildId: message.guild.id });
    const prefix = cfg?.prefix || '!';

    if (message.content.startsWith(prefix)) {
      const args = message.content.slice(prefix.length).trim().split(/ +/);
      const cmd = args.shift()?.toLowerCase();
      if (cmd) {
        const { handlePrefixCommand } = require('./prefixHandler');
        await handlePrefixCommand(message, cmd, args, prefix);
      }
    }
  },
};

const snipeHandler = {
  name: Events.MessageDelete,
  async execute(message) {
    if (message.author?.bot || !message.guild) return;
    addSnipe(message);
  },
};

const stickyHandler = {
  name: Events.MessageCreate,
  async execute(message) {
    if (message.author.bot || !message.guild) return;
    const sticky = await StickyMessage.findOne({ guildId: message.guild.id, channelId: message.channel.id });
    if (!sticky) return;
    try {
      const lastMsg = await message.channel.messages.fetch(sticky.messageId);
      if (lastMsg) return;
    } catch (_) {
      const { buildEmbed } = require('../utils/embed');
      const newMsg = await message.channel.send({ embeds: [
        buildEmbed({ color: 'info', title: '📌 Sticky Message', description: sticky.content, footer: 'Sticky' })
      ]});
      sticky.messageId = newMsg.id;
      await sticky.save();
    }
  },
};

const memberAddHandler = {
  name: Events.GuildMemberAdd,
  async execute(member) {
    const { checkRaid } = require('../handlers/antiAbuse');
    await checkRaid(member);
  },
};

const channelDeleteHandler = {
  name: Events.ChannelDelete,
  async execute(channel) {
    if (!channel.guild) return;
    const { checkAntiNuke } = require('../handlers/antiAbuse');
    await checkAntiNuke(channel.guild, 'channelDeletes');
  },
};

const roleDeleteHandler = {
  name: Events.GuildRoleDelete,
  async execute(role) {
    const { checkAntiNuke } = require('../handlers/antiAbuse');
    await checkAntiNuke(role.guild, 'roleDeletes');
  },
};

const banAddHandler = {
  name: Events.GuildBanAdd,
  async execute(ban) {
    const { checkAntiNuke } = require('../handlers/antiAbuse');
    await checkAntiNuke(ban.guild, 'banKicks');
  },
};

module.exports.messageHandler = module.exports;
module.exports.snipeHandler = snipeHandler;
module.exports.stickyHandler = stickyHandler;
module.exports.memberAddHandler = memberAddHandler;
module.exports.channelDeleteHandler = channelDeleteHandler;
module.exports.roleDeleteHandler = roleDeleteHandler;
module.exports.banAddHandler = banAddHandler;
