const config = require('../config');
const GuildConfig = require('../models/GuildConfig');

const COMMAND_PERMISSIONS = Object.freeze({
  ban: 'BanMembers',
  kick: 'KickMembers',
  timeout: 'ModerateMembers',
  purge: 'ManageMessages',
  lock: 'ManageChannels',
  unlock: 'ManageChannels',
  antiraid: 'ManageGuild',
  strike: 'ModerateMembers',
  strikesremove: 'ModerateMembers',
  clearwarnings: 'ModerateMembers',
});
const OWNER_CONTROLLED_COMMANDS = Object.freeze(Object.keys(COMMAND_PERMISSIONS));

function getCommandRoleIds(guildConfig, commandName) {
  if (!guildConfig?.commandRoles) return [];
  const configured = typeof guildConfig.commandRoles.get === 'function'
    ? guildConfig.commandRoles.get(commandName)
    : guildConfig.commandRoles[commandName];
  return Array.isArray(configured) ? configured : [];
}

function isModerator(member, guildConfig) {
  if (!member) return false;
  if (member.permissions.has('Administrator')) return true;
  if (member.permissions.has('ManageGuild')) return true;
  if (member.permissions.has('BanMembers')) return true;
  if (member.permissions.has('KickMembers')) return true;
  if (member.permissions.has('ModerateMembers')) return true;

  if (guildConfig) {
    const { adminRole, moderatorRole, staffRole } = guildConfig.roles || {};
    if (adminRole && member.roles.cache.has(adminRole)) return true;
    if (moderatorRole && member.roles.cache.has(moderatorRole)) return true;
    if (staffRole && member.roles.cache.has(staffRole)) return true;
  }

  return false;
}

function isOwner(member) {
  return member && member.guild.ownerId === member.id;
}

function hasCommandAccess(member, guildConfig, commandName) {
  if (!member) return false;
  if (isOwner(member)) return true;

  const configuredRoleIds = getCommandRoleIds(guildConfig, commandName);
  if (configuredRoleIds.length > 0) {
    return configuredRoleIds.some(roleId => member.roles?.cache?.has(roleId));
  }

  const requiredPermission = COMMAND_PERMISSIONS[commandName];
  return !requiredPermission || member.permissions.has(requiredPermission);
}

function isOwnerOrMod(member, guildConfig) {
  return isOwner(member) || isModerator(member, guildConfig);
}

module.exports = { COMMAND_PERMISSIONS, OWNER_CONTROLLED_COMMANDS, getCommandRoleIds, hasCommandAccess, isModerator, isOwner, isOwnerOrMod };
