/**
 * Model schema regression tests.
 * Catch missing fields, wrong defaults, or removed indexes.
 */

describe('Giveaway Model Schema', () => {
  let Giveaway;

  beforeAll(() => {
    Giveaway = require('../src/models/Giveaway');
  });

  test('has all required giveaway fields', () => {
    const paths = Giveaway.schema.paths;
    expect(paths.guildId).toBeDefined();
    expect(paths.messageId).toBeDefined();
    expect(paths.channelId).toBeDefined();
    expect(paths.hostId).toBeDefined();
    expect(paths.hostName).toBeDefined();
    expect(paths.prize).toBeDefined();
    expect(paths.prizeValue).toBeDefined();
    expect(paths.winners).toBeDefined();
    expect(paths.durationMs).toBeDefined();
    expect(paths.endsAt).toBeDefined();
    expect(paths.ended).toBeDefined();
    expect(paths.entrants).toBeDefined();
    expect(paths.winnerIds).toBeDefined();
    expect(paths.createdAt).toBeDefined();
  });

  test('has claim-related fields (BUG#1 regression)', () => {
    const paths = Giveaway.schema.paths;
    expect(paths.claimTimeMs).toBeDefined();
    expect(paths.claimTimeMs.options.default).toBe(0);

    expect(paths.claimedBy).toBeDefined();
    expect(paths.claimedBy.options.type[0].type).toBe(String);

    expect(paths.claimIGNs).toBeDefined();
    expect(paths.claimIGNs.options.type).toBe(Map);

    expect(paths.claimMessageId).toBeDefined();
    expect(paths.claimMessageId.options.type).toBe(String);
    expect(paths.claimMessageId.options.default).toBe('');
  });

  test('has re-roll field (BUG#4 regression)', () => {
    const paths = Giveaway.schema.paths;
    expect(paths.rerolled).toBeDefined();
  });

  test('prizeValue defaults to 0', () => {
    expect(Giveaway.schema.paths.prizeValue.options.default).toBe(0);
  });

  test('has correct indexes for query performance', () => {
    const indexes = Giveaway.schema.indexes();
    const indexKeys = indexes.map(i => Object.keys(i[0]).sort().join(','));
    expect(indexKeys).toContain('ended,guildId');
    expect(indexKeys).toContain('guildId,hostId');
    expect(indexKeys).toContain('createdAt,guildId');
  });
});

describe('GuildConfig Model Schema', () => {
  let GuildConfig;

  beforeAll(() => {
    GuildConfig = require('../src/models/GuildConfig');
  });

  test('has claimIGNsChannel field', () => {
    const paths = GuildConfig.schema.paths;
    expect(paths['channels.claimIGNsChannel']).toBeDefined();
  });

  test('has all standard channel configs', () => {
    const channels = GuildConfig.schema.paths;
    const expected = [
      'modLogs', 'messageLogs', 'warningLogs', 'vouchLogs',
      'staffLogs', 'giveawayLogs', 'partnerChannel', 'ordersChannel',
      'claimIGNsChannel', 'bugReports', 'activityChannel', 'stickyChannel',
    ];
    for (const key of expected) {
      expect(channels[`channels.${key}`]).toBeDefined();
    }
  });

  test('prefix defaults to !', () => {
    expect(GuildConfig.schema.paths.prefix.options.default).toBe('!');
  });
});
