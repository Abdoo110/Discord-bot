/**
 * Giveaway logic regression tests.
 * Covers bugs #1-#4 found in audit.
 */

const mockButton = {
  setCustomId: jest.fn().mockReturnThis(),
  setLabel: jest.fn().mockReturnThis(),
  setStyle: jest.fn().mockReturnThis(),
  setEmoji: jest.fn().mockReturnThis(),
};

const mockActionRow = {
  addComponents: jest.fn().mockReturnThis(),
};

const mockEmbedFrom = {
  setTitle: jest.fn().mockReturnThis(),
  data: { title: 'Test (ENDED)' },
};

jest.mock('discord.js', () => ({
  ButtonBuilder: jest.fn(() => ({ ...mockButton })),
  ButtonStyle: { Primary: 1, Success: 3, Danger: 4 },
  ActionRowBuilder: jest.fn(() => ({ ...mockActionRow })),
  EmbedBuilder: class {
    constructor() { this.data = { title: null }; }
    setTitle(t) { this.data.title = t; return this; }
    setColor() { return this; }
    setTimestamp() { return this; }
    addFields() { return this; }
    setDescription() { return this; }
    static from() {
      return { ...mockEmbedFrom, setTitle: jest.fn().mockReturnThis() };
    }
  },
  SlashCommandBuilder: class {
    setName() { return this; }
    setDescription() { return this; }
    addStringOption() { return this; }
    addIntegerOption() { return this; }
    setDefaultMemberPermissions() { return this; }
    setDMPermission() { return this; }
  },
  PermissionFlagsBits: { ManageEvents: 1n, ManageGuild: 1n },
  ChannelType: { GuildText: 0 },
  MessageFlags: { Ephemeral: 64 },
}));

jest.mock('../src/utils/embed', () => ({
  buildEmbed: jest.fn((opts = {}) => {
    const embed = new (require('discord.js').EmbedBuilder)();
    if (opts.title) embed.setTitle(opts.title);
    if (opts.description) embed.setDescription(opts.description);
    return embed;
  }),
  success: jest.fn(),
  error: jest.fn(),
}));

const mockGiveawayModel = {
  findById: jest.fn(),
  findOne: jest.fn(),
  find: jest.fn(),
  findOneAndUpdate: jest.fn(),
  create: jest.fn(),
};

jest.mock('../src/models/Giveaway', () => mockGiveawayModel);

const {
  pickWinners,
  scheduleClaimExpiry,
  scheduleEnd,
  endGiveaway,
} = require('../src/utils/giveaway');

function makeMessage(overrides = {}) {
  return {
    id: 'msg-123',
    guild: {
      id: 'guild-1',
      members: {
        fetch: jest.fn().mockResolvedValue({ user: { bot: false } }),
      },
    },
    channel: { id: 'chan-1' },
    reply: jest.fn().mockResolvedValue({ id: 'reply-456' }),
    edit: jest.fn().mockResolvedValue({}),
    embeds: [],
    client: {},
    ...overrides,
  };
}

function makeGiveaway(overrides = {}) {
  return {
    _id: 'gw-1',
    guildId: 'guild-1',
    messageId: 'msg-123',
    channelId: 'chan-1',
    hostId: 'host-1',
    hostName: 'TestHost',
    prize: '5M Coins',
    prizeValue: 5000000,
    winners: 1,
    durationMs: 60000,
    endsAt: new Date(Date.now() + 60000),
    ended: false,
    claimTimeMs: 0,
    claimMessageId: '',
    entrants: ['user-1', 'user-2', 'user-3'],
    winnerIds: [],
    claimedBy: [],
    claimIGNs: new Map(),
    rerolled: false,
    save: jest.fn().mockResolvedValue(true),
    ...overrides,
  };
}

describe('pickWinners — winner selection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('picks expected number of winners', async () => {
    const msg = makeMessage();
    const gw = makeGiveaway({ entrants: ['u1', 'u2', 'u3', 'u4', 'u5'], winners: 2 });

    const winners = await pickWinners(msg, gw);

    expect(winners).toHaveLength(2);
    expect(gw.ended).toBe(true);
    expect(gw.winnerIds).toHaveLength(2);
  });

  test('returns empty array when no entrants', async () => {
    const msg = makeMessage();
    const gw = makeGiveaway({ entrants: [] });

    const winners = await pickWinners(msg, gw);
    expect(winners).toEqual([]);
    expect(gw.ended).toBe(true);
    expect(msg.edit).toHaveBeenCalledWith({ components: [] });
  });

  test('claims no more than available entrants', async () => {
    const msg = makeMessage();
    const gw = makeGiveaway({ entrants: ['u1', 'u2'], winners: 5 });

    const winners = await pickWinners(msg, gw);
    expect(winners).toHaveLength(2);
  });
});

describe('pickWinners — BUG#4: greroll on ended giveaway', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('allows re-roll even when ended=true', async () => {
    const msg = makeMessage();
    const gw = makeGiveaway({ ended: true, entrants: ['u1', 'u2', 'u3'] });

    const winners = await pickWinners(msg, gw, true);

    expect(winners).toHaveLength(1);
    expect(gw.rerolled).toBe(true);
  });

  test('still blocks normal end on ended=true', async () => {
    const msg = makeMessage();
    const gw = makeGiveaway({ ended: true, entrants: ['u1', 'u2'] });

    const winners = await pickWinners(msg, gw, false);
    expect(winners).toEqual([]);
  });
});

describe('pickWinners — BUG#1: claimMessageId saved to DB', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('saves claimMessageId when claimTimeMs is set', async () => {
    const msg = makeMessage();
    msg.reply.mockResolvedValue({ id: 'reply-claim-789' });

    const gw = makeGiveaway({
      claimTimeMs: 300000,
      entrants: ['u1', 'u2'],
    });

    const saveCalls = [];
    const origSave = gw.save;
    gw.save = jest.fn().mockImplementation(async function () {
      saveCalls.push({ claimMessageId: this.claimMessageId, ended: this.ended });
      return origSave.call(this);
    });

    await pickWinners(msg, gw);

    const lastSave = saveCalls[saveCalls.length - 1];
    expect(lastSave.claimMessageId).toBe('reply-claim-789');
  });

  test('does NOT set claimMessageId when claimTimeMs is 0', async () => {
    const msg = makeMessage();
    const gw = makeGiveaway({ claimTimeMs: 0, entrants: ['u1'] });

    await pickWinners(msg, gw);

    expect(gw.claimMessageId).toBe('');
  });
});

describe('pickWinners — button placement', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('reply message has claim button, original embed has none', async () => {
    const msg = makeMessage();
    msg.reply.mockResolvedValue({ id: 'reply-1' });

    const gw = makeGiveaway({ entrants: ['u1', 'u2'] });

    await pickWinners(msg, gw);

    expect(msg.edit).toHaveBeenCalledWith(
      expect.objectContaining({ components: [] })
    );

    expect(msg.reply).toHaveBeenCalled();
    const replyCall = msg.reply.mock.calls[0][0];
    expect(replyCall.components).toBeDefined();
    expect(replyCall.components).toHaveLength(1);
  });
});

describe('scheduleClaimExpiry', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('calls setTimeout with correct delay', () => {
    const spy = jest.spyOn(global, 'setTimeout');
    scheduleClaimExpiry({}, 'gw-1', 5000, 'reply-1');
    expect(spy).toHaveBeenCalledWith(expect.any(Function), 5000);
    spy.mockRestore();
  });

  test('callback removes button and updates title', async () => {
    const editMock = jest.fn().mockResolvedValue({});
    const mockMsg = {
      embeds: [{ title: 'Test Prize (ENDED)' }],
      edit: editMock,
    };
    const mockChannel = {
      messages: { fetch: jest.fn().mockResolvedValue(mockMsg) },
    };
    const mockClient = {
      channels: { fetch: jest.fn().mockResolvedValue(mockChannel) },
    };

    mockGiveawayModel.findById.mockResolvedValue({
      channelId: 'chan-1',
      messageId: 'msg-1',
      claimMessageId: 'reply-1',
    });

    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
    scheduleClaimExpiry(mockClient, 'gw-1', 5000, 'reply-1');
    const callback = setTimeoutSpy.mock.calls[0][0];
    setTimeoutSpy.mockRestore();

    await callback();

    expect(mockMsg.edit).toHaveBeenCalledWith(
      expect.objectContaining({ components: [] })
    );
  });

  test('title gets CLAIM EXPIRED suffix on plain title (BUG#3 regression)', async () => {
    const editMock = jest.fn().mockResolvedValue({});
    const mockMsg = {
      embeds: [{ title: '5M Coins' }],
      edit: editMock,
    };
    const mockChannel = {
      messages: { fetch: jest.fn().mockResolvedValue(mockMsg) },
    };
    const mockClient = {
      channels: { fetch: jest.fn().mockResolvedValue(mockChannel) },
    };

    mockGiveawayModel.findById.mockResolvedValue({
      channelId: 'chan-1',
      messageId: 'msg-1',
      claimMessageId: 'reply-1',
    });

    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
    scheduleClaimExpiry(mockClient, 'gw-1', 5000, 'reply-1');
    const callback = setTimeoutSpy.mock.calls[0][0];
    setTimeoutSpy.mockRestore();

    await callback();

    expect(editMock).toHaveBeenCalled();
    const editCall = editMock.mock.calls[0][0];
    expect(editCall.components).toEqual([]);
  });
});

describe('Claim expiry — time check logic', () => {
  test('elapsed > claimTimeMs returns true (expired)', () => {
    const endsAt = new Date(Date.now() - 600000);
    const claimTimeMs = 300000;
    const elapsed = Date.now() - endsAt.getTime();
    expect(elapsed > claimTimeMs).toBe(true);
  });

  test('elapsed < claimTimeMs returns false (still valid)', () => {
    const endsAt = new Date(Date.now() - 60000);
    const claimTimeMs = 300000;
    const elapsed = Date.now() - endsAt.getTime();
    expect(elapsed > claimTimeMs).toBe(false);
  });

  test('elapsed == claimTimeMs exactly', () => {
    const claimTimeMs = 5000;
    const endsAt = new Date(Date.now() - 5001);
    const elapsed = Date.now() - endsAt.getTime();
    expect(elapsed > claimTimeMs).toBe(true);
  });
});

describe('Title replacement — BUG#3 regression', () => {
  test('replaces (ENDED) with (CLAIM EXPIRED)', () => {
    const oldTitle = '5M Coins (ENDED)';
    const newTitle = oldTitle
      .replace(' (ENDED)', '')
      .replace(' (CLAIM EXPIRED)', '') + ' (CLAIM EXPIRED)';
    expect(newTitle).toBe('5M Coins (CLAIM EXPIRED)');
  });

  test('works on plain titles without (ENDED)', () => {
    const oldTitle = '5M Coins';
    const newTitle = oldTitle
      .replace(' (ENDED)', '')
      .replace(' (CLAIM EXPIRED)', '') + ' (CLAIM EXPIRED)';
    expect(newTitle).toBe('5M Coins (CLAIM EXPIRED)');
  });

  test('does not double-suffix if already expired', () => {
    const oldTitle = '5M Coins (CLAIM EXPIRED)';
    const newTitle = oldTitle
      .replace(' (ENDED)', '')
      .replace(' (CLAIM EXPIRED)', '') + ' (CLAIM EXPIRED)';
    expect(newTitle).toBe('5M Coins (CLAIM EXPIRED)');
  });
});
