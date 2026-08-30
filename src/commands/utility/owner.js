const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { success, error, buildEmbed } = require('../../utils/embed');
const { getConfig } = require('../../utils/guildConfig');
const { OWNER_CONTROLLED_COMMANDS, getCommandRoleIds } = require('../../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('owner')
    .setDescription('Configure roles allowed to use dangerous moderation commands')
    .addSubcommand(sub => sub
      .setName('set')
      .setDescription('Allow a role to use a dangerous command')
      .addStringOption(o => o.setName('command').setDescription('Command to configure').setRequired(true).addChoices(
          { name: '/ban', value: 'ban' },
          { name: '/kick', value: 'kick' },
          { name: '/timeout', value: 'timeout' },
          { name: '/purge', value: 'purge' },
          { name: '/lock', value: 'lock' },
          { name: '/unlock', value: 'unlock' },
          { name: '/antiraid', value: 'antiraid' },
          { name: '/strike', value: 'strike' },
          { name: '/strikesremove', value: 'strikesremove' },
          { name: '/clearwarnings', value: 'clearwarnings' },
      ))
      .addRoleOption(o => o.setName('role').setDescription('Role to allow').setRequired(true)))
    .addSubcommand(sub => sub
      .setName('remove')
      .setDescription('Remove a role from a dangerous command')
      .addStringOption(o => o.setName('command').setDescription('Command to configure').setRequired(true).addChoices(
          { name: '/ban', value: 'ban' },
          { name: '/kick', value: 'kick' },
          { name: '/timeout', value: 'timeout' },
          { name: '/purge', value: 'purge' },
          { name: '/lock', value: 'lock' },
          { name: '/unlock', value: 'unlock' },
          { name: '/antiraid', value: 'antiraid' },
          { name: '/strike', value: 'strike' },
          { name: '/strikesremove', value: 'strikesremove' },
          { name: '/clearwarnings', value: 'clearwarnings' },
      ))
      .addRoleOption(o => o.setName('role').setDescription('Role to remove').setRequired(true)))
    .addSubcommand(sub => sub
      .setName('list')
      .setDescription('Show the configured roles for dangerous commands'))
    .setDMPermission(false),

  async execute(interaction) {
    if (interaction.guild.ownerId !== interaction.user.id) {
      return error(interaction, '⛔ Owner Only', 'Only the server owner can configure dangerous command roles.');
    }

    const sub = interaction.options.getSubcommand();
    const cfg = await getConfig(interaction.guild.id);

    if (sub === 'list') {
      const lines = OWNER_CONTROLLED_COMMANDS.map(commandName => {
        const ids = getCommandRoleIds(cfg, commandName);
        const roles = ids.map(id => interaction.guild.roles.cache.get(id)?.toString() || 'Deleted role (' + id + ')');
        return '**/' + commandName + '** — ' + (roles.length ? roles.join(', ') : 'Discord permissions');
      });
      return interaction.reply({ embeds: [buildEmbed({
        color: 'info',
        title: '🔐 Dangerous Command Roles',
        description: lines.join('\n'),
        footer: 'Configured roles replace Discord permissions; the server owner always has access.',
      })], flags: MessageFlags.Ephemeral });
    }

    const commandName = interaction.options.getString('command');
    const role = interaction.options.getRole('role');
    if (!OWNER_CONTROLLED_COMMANDS.includes(commandName)) {
      return error(interaction, '❌ Invalid Command', 'That command cannot be configured here.');
    }
    if (role.id === interaction.guild.id) {
      return error(interaction, '❌ Invalid Role', 'The @everyone role cannot be assigned to dangerous commands.');
    }

    const currentIds = getCommandRoleIds(cfg, commandName);
    const nextIds = sub === 'set'
      ? [...new Set([...currentIds, role.id])]
      : currentIds.filter(id => id !== role.id);

    if (sub === 'set' && nextIds.length === currentIds.length) {
      return error(interaction, 'ℹ️ Already Configured', role + ' is already allowed to use /' + commandName + '.');
    }
    if (sub === 'remove' && nextIds.length === currentIds.length) {
      return error(interaction, 'ℹ️ Not Configured', role + ' was not configured for /' + commandName + '.');
    }

    if (typeof cfg.commandRoles?.set === 'function') cfg.commandRoles.set(commandName, nextIds);
    else cfg.commandRoles = { ...(cfg.commandRoles || {}), [commandName]: nextIds };
    await cfg.save();

    return success(interaction, sub === 'set' ? '✅ Role Added' : '✅ Role Removed',
      sub === 'set' ? role + ' can now use /' + commandName + '.' : role + ' can no longer use /' + commandName + '.');
  },
};
