const config = require('../config');
const GuildConfig = require('../models/GuildConfig');

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

function isOwnerOrMod(member, guildConfig) {
  return isOwner(member) || isModerator(member, guildConfig);
}

module.exports = { isModerator, isOwner, isOwnerOrMod };
