const { Events, Collection } = require('discord.js');
const { checkSpam } = require('../handlers/antiAbuse');
const { addSnipe } = require('../commands/moderation/snipe');
const StickyMessage = require('../models/StickyMessage');
const { handleMessage: trackGiveaway } = require('../handlers/giveawayTracker');

module.exports = {
  name: Events.MessageCreate,
  async execute(message) {
    if (!message.guild) return;

    // Track giveaways from bot messages
    if (message.author.bot) {
      console.log(`[MSG-EVENTS] Bot message: ${message.author.username} | hasEmbeds=${!!message.embeds?.length} | hasContent=${!!message.content} | content="${(message.content||'').slice(0,100)}"`);
      await trackGiveaway(message);
      return;
    }

    // Anti-spam
    await checkSpam(message);

    // Prefix command handler
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

// Message Delete — Snipe
const snipeHandler = {
  name: Events.MessageDelete,
  async execute(message) {
    if (message.author?.bot || !message.guild) return;
    addSnipe(message);
  },
};

// Sticky Message reposting
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

// Guild Member Add — Anti-raid
const memberAddHandler = {
  name: Events.GuildMemberAdd,
  async execute(member) {
    const { checkRaid } = require('../handlers/antiAbuse');
    await checkRaid(member);
  },
};

// Channel Delete — Anti-nuke
const channelDeleteHandler = {
  name: Events.ChannelDelete,
  async execute(channel) {
    if (!channel.guild) return;
    const { checkAntiNuke } = require('../handlers/antiAbuse');
    await checkAntiNuke(channel.guild, 'channelDeletes');
  },
};

// Role Delete — Anti-nuke
const roleDeleteHandler = {
  name: Events.GuildRoleDelete,
  async execute(role) {
    const { checkAntiNuke } = require('../handlers/antiAbuse');
    await checkAntiNuke(role.guild, 'roleDeletes');
  },
};

// Ban/Kick — Anti-nuke
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
