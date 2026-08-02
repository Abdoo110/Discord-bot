const { SlashCommandBuilder } = require('discord.js');
const { success, error } = require('../../utils/embed');
const Staff = require('../../models/Staff');
const { buildEmbed } = require('../../utils/embed');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('staffinfo')
    .setDescription('Register or update your staff information')
    .addStringOption(o => o.setName('ign').setDescription('Your in-game name').setRequired(true))
    .addStringOption(o => o.setName('timezone').setDescription('Your timezone (e.g. EST, GMT+2)').setRequired(true))
    .setDMPermission(false),

  async execute(interaction) {
    const ign = interaction.options.getString('ign');
    const timezone = interaction.options.getString('timezone');

    let staff = await Staff.findOne({ guildId: interaction.guild.id, userId: interaction.user.id });
    if (!staff) {
      staff = await Staff.create({
        guildId: interaction.guild.id,
        userId: interaction.user.id,
        ign,
        timezone,
        position: 'Staff',
      });
      await success(interaction, '📝 Staff Registered',
        `**User:** ${interaction.user.tag}\n**IGN:** ${ign}\n**Timezone:** ${timezone}\n**Position:** Staff`);
    } else {
      staff.ign = ign;
      staff.timezone = timezone;
      await staff.save();
      await success(interaction, '📝 Staff Info Updated',
        `**User:** ${interaction.user.tag}\n**IGN:** ${ign}\n**Timezone:** ${timezone}\n**Position:** ${staff.position}`);
    }
  },
};
