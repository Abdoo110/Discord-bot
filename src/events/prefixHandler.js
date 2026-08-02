const { buildEmbed } = require('../utils/embed');
const GuildConfig = require('../models/GuildConfig');
const Warning = require('../models/Warning');
const Vouch = require('../models/Vouch');
const { getMuteRole } = require('../utils/guildConfig');
const ms = require('ms');

async function handlePrefixCommand(message, cmd, args, prefix) {
  const cfg = await GuildConfig.findOne({ guildId: message.guild.id });

  switch (cmd) {
    case 'ban': {
      if (!message.member.permissions.has('BanMembers')) return;
      const target = message.mentions.users.first() || await message.guild.members.fetch(args[0]).catch(() => null)?.user;
      if (!target) return message.reply({ embeds: [buildEmbed({ color: 'error', title: '❌ Usage', description: `\`${prefix}ban @user [reason]\`` })] });
      const reason = args.slice(1).join(' ') || 'No reason provided';
      const member = message.guild.members.cache.get(target.id);
      if (member && !member.bannable) return;
      await message.guild.members.ban(target, { reason: `${message.author.tag}: ${reason}` });
      message.channel.send({ embeds: [buildEmbed({ color: 'error', title: '🔨 Banned', description: `**${target.tag}** has been banned.` })] });
      break;
    }

    case 'kick': {
      if (!message.member.permissions.has('KickMembers')) return;
      const target = message.mentions.members.first() || message.guild.members.cache.get(args[0]);
      if (!target) return message.reply({ embeds: [buildEmbed({ color: 'error', title: '❌ Usage', description: `\`${prefix}kick @user [reason]\`` })] });
      if (!target.kickable) return;
      const reason = args.slice(1).join(' ') || 'No reason provided';
      await target.kick(`${message.author.tag}: ${reason}`);
      message.channel.send({ embeds: [buildEmbed({ color: 'warn', title: '👢 Kicked', description: `**${target.user.tag}** has been kicked.` })] });
      break;
    }

    case 'timeout': {
      if (!message.member.permissions.has('ModerateMembers')) return;
      const target = message.mentions.members.first() || message.guild.members.cache.get(args[0]);
      const durStr = args[1];
      if (!target || !durStr) return message.reply({ embeds: [buildEmbed({ color: 'error', title: '❌ Usage', description: `\`${prefix}timeout @user 10m [reason]\`` })] });
      const durationMs = ms(durStr);
      if (!durationMs) return;
      const reason = args.slice(2).join(' ') || 'No reason provided';
      await target.timeout(durationMs, `${message.author.tag}: ${reason}`);
      message.channel.send({ embeds: [buildEmbed({ color: 'mod', title: '⏱️ Timed Out', description: `**${target.user.tag}** timed out for ${durStr}.` })] });
      break;
    }

    case 'snipe': {
      const { getSnipe } = require('../commands/moderation/snipe');
      const snipe = getSnipe(message.channel.id);
      if (!snipe) return message.reply({ embeds: [buildEmbed({ color: 'warn', title: '🔍 Nothing to Snipe', description: 'No deleted messages in this channel.' })] });
      const embed = buildEmbed({ color: 'info', author: snipe.author.tag, authorIcon: snipe.author.displayAvatarURL({ dynamic: true }), description: snipe.content || '*No text*' });
      if (snipe.attachments.length > 0) embed.setImage(snipe.attachments[0].url);
      message.channel.send({ embeds: [embed] });
      break;
    }

    case 'lock': {
      if (!message.member.permissions.has('ManageChannels')) return;
      await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: false });
      message.channel.send({ embeds: [buildEmbed({ color: 'warn', title: '🔒 Channel Locked', description: `Channel locked by ${message.author.tag}.` })] });
      break;
    }

    case 'unlock': {
      if (!message.member.permissions.has('ManageChannels')) return;
      await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: null });
      message.channel.send({ embeds: [buildEmbed({ color: 'success', title: '🔓 Channel Unlocked', description: `Channel unlocked by ${message.author.tag}.` })] });
      break;
    }

    case 'bugreport': {
      const report = args.join(' ');
      if (!report) return message.reply({ embeds: [buildEmbed({ color: 'error', title: '❌ Usage', description: `\`${prefix}bugreport <description>\`` })] });
      if (!cfg?.channels.bugReports) {
        return message.reply({ embeds: [buildEmbed({ color: 'error', title: '❌ Not Configured', description: 'Bug report channel is not set up.' })] });
      }
      const reportChannel = message.guild.channels.cache.get(cfg.channels.bugReports);
      if (!reportChannel) return;
      reportChannel.send({ embeds: [buildEmbed({ color: 'warn', title: '🐛 Bug Report', description: report, fields: [
        { name: 'Reported By', value: `${message.author.tag} (${message.author.id})`, inline: true },
        { name: 'Channel', value: `<#${message.channel.id}>`, inline: true },
      ], timestamp: Date.now() })] });
      message.react('✅');
      break;
    }

    default:
      break;
  }
}

module.exports = { handlePrefixCommand };
