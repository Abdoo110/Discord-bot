const { COMMAND_PERMISSIONS, OWNER_CONTROLLED_COMMANDS, getCommandRoleIds, hasCommandAccess } = require('../src/utils/permissions');

function member({ owner = false, roles = [], permissions = [] } = {}) {
  return {
    id: owner ? 'owner-id' : 'member-id',
    guild: { ownerId: 'owner-id' },
    roles: { cache: { has: roleId => roles.includes(roleId) } },
    permissions: { has: permission => permissions.includes(permission) },
  };
}

describe('dangerous command access', () => {
  test('covers moderation commands', () => {
    expect(OWNER_CONTROLLED_COMMANDS).toEqual(Object.keys(COMMAND_PERMISSIONS));
    expect(COMMAND_PERMISSIONS.ban).toBe('BanMembers');
    expect(COMMAND_PERMISSIONS.kick).toBe('KickMembers');
  });

  test('server owner always has access', () => {
    expect(hasCommandAccess(member({ owner: true }), null, 'ban')).toBe(true);
  });

  test('falls back to Discord permissions when no role is configured', () => {
    expect(hasCommandAccess(member({ permissions: ['BanMembers'] }), { commandRoles: {} }, 'ban')).toBe(true);
    expect(hasCommandAccess(member(), { commandRoles: {} }, 'ban')).toBe(false);
  });

  test('configured roles replace the native permission requirement', () => {
    const config = { commandRoles: { ban: ['role-mod'] } };
    expect(getCommandRoleIds(config, 'ban')).toEqual(['role-mod']);
    expect(hasCommandAccess(member({ roles: ['role-mod'] }), config, 'ban')).toBe(true);
    expect(hasCommandAccess(member({ permissions: ['BanMembers'] }), config, 'ban')).toBe(false);
  });
});
