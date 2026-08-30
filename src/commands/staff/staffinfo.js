const { SlashCommandBuilder } = require('discord.js');
const { success } = require('../../utils/embed');
const Staff = require('../../models/Staff');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('staffinfo')
    .setDescription('Register or update your staff information')
    .addStringOption(o => o.setName('ign').setDescription('Your in-game name').setRequired(true))
    .addStringOption(o => o.setName('timezone').setDescription('Your timezone (e.g. EST, GMT+2)').setRequired(true))
    .setDMPermission(false),

  async execute(interaction) {
    const ign = interaction.options.getString('ign').trim();
    const timezone = interaction.options.getString('timezone').trim();

    const staff = await Staff.findOneAndUpdate(
      { guildId: interaction.guild.id, userId: interaction.user.id },
      {
        $set: { ign, timezone },
        $setOnInsert: { position: 'Staff', hiredAt: new Date() },
      },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );

    await success(interaction, '📝 Staff Info Saved',
      '**User:** ' + interaction.user.tag + '\n**IGN:** ' + ign + '\n**Timezone:** ' + timezone + '\n**Position:** ' + staff.position);
  },
};
