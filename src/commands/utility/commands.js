const { SlashCommandBuilder } = require('discord.js');
const { buildEmbed } = require('../../utils/embed');
const { getConfig } = require('../../utils/guildConfig');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('commands')
    .setDescription('Show all available commands')
    .setDMPermission(false),
  async execute(interaction) {
    const cfg = await getConfig(interaction.guild.id);
    const prefix = cfg.prefix || '!';
    const embed = buildEmbed({
      color: 'info', title: '📚 Command List',
      description: `**Prefix:** \`/\` (Slash Commands) and \`${prefix}\` (Prefix Commands)`,
      fields: [
        { name: '🛡️ Moderation', value: '`/ban` `/kick` `/timeout` `/purge` `/lock` `/unlock` `/strike` `/snipe`', inline: false },
        { name: '✅ Vouch System', value: '`/vouch` `/scamvouch`', inline: false },
        { name: '⚠️ Warning System', value: '`/warning` `/clearwarnings`', inline: false },
        { name: '👥 Staff Management', value: '`/hire` `/promotion` `/demotion` `/staffinfo` `/loa` `/finfo`', inline: false },
        { name: '📝 Message Tools', value: '`/stick` `/unstick` `/echo` `/activitycheck`', inline: false },
        { name: '🎉 Giveaways', value: '`/gcreate` `/gend` `/greroll` `/gweekly`', inline: false },
        { name: '🤝 Partner System', value: '`/psetup` `/unpsetup` `/pleaderboard` `/resetpartners`', inline: false },
        { name: '⚡ Fun', value: '`/fast`', inline: false },
        { name: '🔧 Utility', value: '`/commands` `!bugreport`', inline: false },
      ],
      footer: `${interaction.guild.name} • Bot by Nexus`, timestamp: Date.now(),
    });
    await interaction.reply({ embeds: [embed] });
  },
};
