const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { buildEmbed, success, error } = require('../../utils/embed');
const { getConfig } = require('../../utils/guildConfig');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('activitycheck')
    .setDescription('Send an activity check ping to a role')
    .addRoleOption(o => o.setName('role').setDescription('Role to ping').setRequired(true))
    .addStringOption(o => o.setName('message').setDescription('Custom message to include'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setDMPermission(false),

  async execute(interaction) {
    const role = interaction.options.getRole('role');
    const customMsg = interaction.options.getString('message') || 'Please react to confirm your activity!';

    let wasMentionable = role.mentionable;
    if (!role.mentionable) {
      try { await role.setMentionable(true); } catch (_) {}
    }

    const embed = buildEmbed({
      color: 'info',
      title: '📢 Activity Check',
      description: `${customMsg}\n\nReact with ✅ to confirm your activity!`,
      footer: `Activity check by ${interaction.user.tag}`,
      timestamp: Date.now(),
    });

    const msg = await interaction.channel.send({ content: `${role}`, embeds: [embed] });
    await msg.react('✅');

    if (!wasMentionable) {
      try { await role.setMentionable(false); } catch (_) {}
    }

    await interaction.reply({ embeds: [
      buildEmbed({ color: 'success', title: '✅ Activity Check Sent', description: 'The activity check has been posted.' })
    ], flags: MessageFlags.Ephemeral });
  },
};
