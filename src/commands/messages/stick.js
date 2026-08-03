const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { success, error } = require('../../utils/embed');
const StickyMessage = require('../../models/StickyMessage');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stick')
    .setDescription('Stick a message to the bottom of the current channel')
    .addStringOption(o => o.setName('message').setDescription('The message to stick').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .setDMPermission(false),

  async execute(interaction) {
    const content = interaction.options.getString('message');

    // Delete existing sticky message if any
    const existing = await StickyMessage.findOne({ guildId: interaction.guild.id, channelId: interaction.channel.id });
    if (existing) {
      try {
        const oldMsg = await interaction.channel.messages.fetch(existing.messageId);
        if (oldMsg) await oldMsg.delete();
      } catch (_) {}
    }

    const msg = await interaction.channel.send({ embeds: [
      require('../../utils/embed').buildEmbed({ color: 'info', title: '📌 Sticky Message', description: content, footer: `Sticky by ${interaction.user.tag}` })
    ]});

    await StickyMessage.findOneAndUpdate(
      { guildId: interaction.guild.id, channelId: interaction.channel.id },
      { messageId: msg.id, content },
      { upsert: true, new: true }
    );

    await interaction.reply({ embeds: [
      require('../../utils/embed').buildEmbed({ color: 'success', title: '✅ Message Stuck', description: 'The message has been pinned at the bottom of this channel.' })
    ], flags: MessageFlags.Ephemeral });
  },
};
