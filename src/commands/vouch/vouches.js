const { SlashCommandBuilder } = require('discord.js');
const { buildEmbed } = require('../../utils/embed');
const Vouch = require('../../models/Vouch');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('vouches')
    .setDescription('View vouch stats for a user')
    .addUserOption(o => o.setName('user').setDescription('User to check (defaults to you)'))
    .setDMPermission(false),

  async execute(interaction) {
    const user = interaction.options.getUser('user') || interaction.user;

    const [vouches, scams, recentVouches] = await Promise.all([
      Vouch.countDocuments({ guildId: interaction.guild.id, targetId: user.id, type: 'vouch' }),
      Vouch.countDocuments({ guildId: interaction.guild.id, targetId: user.id, type: 'scam' }),
      Vouch.find({ guildId: interaction.guild.id, targetId: user.id, type: 'vouch' })
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),
    ]);

    const rep = vouches - scams;

    const fields = [
      { name: '👍 Vouches', value: `${vouches}`, inline: true },
      { name: '👎 Scam Reports', value: `${scams}`, inline: true },
      { name: '📊 Reputation', value: `${rep}`, inline: true },
    ];

    if (recentVouches.length > 0) {
      const recentList = recentVouches.map(v => `• From <@${v.authorId}> — ${v.reason?.slice(0, 50) || 'No reason'}`).join('\n');
      fields.push({ name: '🕐 Recent Vouches', value: recentList, inline: false });
    } else {
      fields.push({ name: '🕐 Recent Vouches', value: 'No vouches yet.', inline: false });
    }

    await interaction.reply({
      embeds: [buildEmbed({
        color: 'vouch',
        title: `📋 Vouch Stats — ${user.tag}`,
        description: `${user} has **${rep}** reputation (${vouches} vouches, ${scams} scams).`,
        fields,
        thumbnail: user.displayAvatarURL({ dynamic: true }),
        timestamp: Date.now(),
      })],
    });
  },
};
