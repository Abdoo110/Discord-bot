const { Events } = require('discord.js');
const { checkSpam } = require('../handlers/antiAbuse');
const { addSnipe } = require('../commands/moderation/snipe');
const StickyMessage = require('../models/StickyMessage');
const { handleMessage: trackGiveaway } = require('../handlers/giveawayTracker');

module.exports = {
  name: Events.MessageCreate,
  async execute(message) {
    try {
      if (!message.guild || !message.author) return;

      // Bot message → check for giveaways
      if (message.author.bot) {
        await trackGiveaway(message).catch(() => {});
        return;
      }

      // Human message → anti-spam
      await checkSpam(message).catch(() => {});

      // Prefix commands
      const GuildConfig = require('../models/GuildConfig');
      const cfg = await GuildConfig.findOne({ guildId: message.guild.id });
      const prefix = cfg?.prefix || '!';

      if (message.content?.startsWith(prefix)) {
        const args = message.content.slice(prefix.length).trim().split(/ +/);
        const cmd = args.shift()?.toLowerCase();
        if (cmd) {
          const { handlePrefixCommand } = require('./prefixHandler');
          await handlePrefixCommand(message, cmd, args, prefix);
        }
      }
    } catch (err) {
      console.error('[MSG-EVENTS] Error:', err.message);
    }
  },
};

// Snipe handler
const snipeHandler = {
  name: Events.MessageDelete,
  async execute(message) {
    try {
      if (message.author?.bot || !message.guild) return;
      addSnipe(message);
    } catch {}
  },
};

// Sticky messages
const stickyHandler = {
  name: Events.MessageCreate,
  async execute(message) {
    try {
      if (message.author?.bot || !message.guild) return;
      const sticky = await StickyMessage.findOne({ guildId: message.guild.id, channelId: message.channel.id });
      if (!sticky) return;
      try {
        await message.channel.messages.fetch(sticky.messageId);
        return;
      } catch {}
      const { buildEmbed } = require('../utils/embed');
      const newMsg = await message.channel.send({
        embeds: [buildEmbed({ color: 'info', title: '📌 Sticky', description: sticky.content, footer: 'Sticky' })]
      });
      sticky.messageId = newMsg.id;
      await sticky.save();
    } catch {}
  },
};

// Anti-raid
const memberAddHandler = {
  name: Events.GuildMemberAdd,
  async execute(member) {
    try { const { checkRaid } = require('../handlers/antiAbuse'); await checkRaid(member); } catch {}
  },
};

const channelDeleteHandler = {
  name: Events.ChannelDelete,
  async execute(channel) {
    try { if (!channel.guild) return; const { checkAntiNuke } = require('../handlers/antiAbuse'); await checkAntiNuke(channel.guild, 'channelDeletes'); } catch {}
  },
};

const roleDeleteHandler = {
  name: Events.GuildRoleDelete,
  async execute(role) {
    try { const { checkAntiNuke } = require('../handlers/antiAbuse'); await checkAntiNuke(role.guild, 'roleDeletes'); } catch {}
  },
};

const banAddHandler = {
  name: Events.GuildBanAdd,
  async execute(ban) {
    try { const { checkAntiNuke } = require('../handlers/antiAbuse'); await checkAntiNuke(ban.guild, 'banKicks'); } catch {}
  },
};

module.exports.messageHandler = module.exports;
module.exports.snipeHandler = snipeHandler;
module.exports.stickyHandler = stickyHandler;
module.exports.memberAddHandler = memberAddHandler;
module.exports.channelDeleteHandler = channelDeleteHandler;
module.exports.roleDeleteHandler = roleDeleteHandler;
module.exports.banAddHandler = banAddHandler;
