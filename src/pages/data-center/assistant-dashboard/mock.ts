export interface GameOption {
  gameId: string;
  name: string;
}

export interface ChannelOption {
  channelId: string;
  name: string;
}

export interface DashboardMetrics {
  dau?: number;
  newUsers?: number;
  sessionsPerUser?: number;
  turnsPerSession?: number;
  messagesPerUser?: number;
  roleBindingRate?: number;
}

export interface DashboardData {
  metrics: DashboardMetrics;
  trend: {
    dates: string[];
    dau: number[];
    newUsers: number[];
    sessionsPerUser: number[];
  };
  heatmap: Array<[number, number, number]>;
  heatmapMax: number;
}

interface GameConfig {
  channels: ChannelOption[];
  metrics: Required<DashboardMetrics>;
  dailyDau: number[];
  dailyNewUsers: number[];
  dailySessionsPerUser: number[];
}

export const GAMES: GameOption[] = [
  { gameId: 'gbot-waso', name: '瓦手智能助手' },
  { gameId: 'gbot-fcm', name: 'FCM 智能小助手' },
  { gameId: 'gbot-fco', name: 'FCO 智能助手' },
  { gameId: 'gbot-pubgm', name: 'PUBGM 智能助手' },
];

export const DEFAULT_GAME_ID = GAMES[0].gameId;
export const DEFAULT_DATE = '2026-08-05';

const CHANNELS = {
  game: { channelId: 'game', name: '游戏' },
  qq: { channelId: 'qq', name: '手Q' },
  wecom: { channelId: 'wecom', name: '企微' },
  miniProgram: { channelId: 'mini-program', name: '小程序' },
};

const GAME_CONFIGS: Record<string, GameConfig> = {
  'gbot-waso': {
    channels: [CHANNELS.game, CHANNELS.qq, CHANNELS.wecom, CHANNELS.miniProgram],
    metrics: {
      dau: 2720,
      newUsers: 323,
      sessionsPerUser: 2.02,
      turnsPerSession: 1.04,
      messagesPerUser: 3.64,
      roleBindingRate: 0.63,
    },
    dailyDau: [396, 371, 418, 432, 389, 406, 427],
    dailyNewUsers: [48, 43, 51, 46, 39, 45, 51],
    dailySessionsPerUser: [1.92, 2.04, 1.98, 2.11, 2.06, 2.01, 2.03],
  },
  'gbot-fcm': {
    channels: [CHANNELS.game, CHANNELS.wecom, CHANNELS.miniProgram],
    metrics: {
      dau: 5780,
      newUsers: 697,
      sessionsPerUser: 2.18,
      turnsPerSession: 1.04,
      messagesPerUser: 4.06,
      roleBindingRate: 0.72,
    },
    dailyDau: [812, 768, 846, 901, 823, 798, 832],
    dailyNewUsers: [102, 94, 108, 116, 89, 91, 97],
    dailySessionsPerUser: [2.08, 2.14, 2.21, 2.23, 2.18, 2.17, 2.25],
  },
  'gbot-fco': {
    channels: [CHANNELS.game, CHANNELS.qq],
    metrics: {
      dau: 1864,
      newUsers: 241,
      sessionsPerUser: 1.86,
      turnsPerSession: 1.12,
      messagesPerUser: 3.18,
      roleBindingRate: 0.584,
    },
    dailyDau: [251, 264, 278, 271, 255, 268, 277],
    dailyNewUsers: [31, 34, 39, 36, 32, 33, 36],
    dailySessionsPerUser: [1.79, 1.85, 1.91, 1.88, 1.84, 1.92, 1.83],
  },
  'gbot-pubgm': {
    channels: [CHANNELS.game, CHANNELS.qq, CHANNELS.wecom],
    metrics: {
      dau: 4386,
      newUsers: 512,
      sessionsPerUser: 2.31,
      turnsPerSession: 1.16,
      messagesPerUser: 4.48,
      roleBindingRate: 0.761,
    },
    dailyDau: [611, 624, 647, 669, 638, 586, 611],
    dailyNewUsers: [68, 74, 81, 78, 71, 66, 74],
    dailySessionsPerUser: [2.24, 2.31, 2.35, 2.39, 2.32, 2.26, 2.3],
  },
};

export const getChannelsByGameId = (gameId: string): ChannelOption[] => (
  GAME_CONFIGS[gameId]?.channels.map((channel) => ({ ...channel })) ?? []
);

export const fetchChannelsByGameId = (gameId: string): Promise<ChannelOption[]> => (
  new Promise((resolve) => {
    window.setTimeout(() => resolve(getChannelsByGameId(gameId)), 260);
  })
);

const round = (value: number, digits = 2) => Number(value.toFixed(digits));

const getWeekFactor = (weekStart: string) => {
  const baseDate = new Date('2026-08-03T00:00:00');
  const selectedDate = new Date(`${weekStart}T00:00:00`);
  const weekOffset = Math.round((selectedDate.getTime() - baseDate.getTime()) / 604800000);

  return Math.min(1.12, Math.max(0.86, 1 + weekOffset * 0.018));
};

const getBusinessFactor = (businessGameId: string) => {
  if (businessGameId === 'mock-game-ai-platform') return 1.08;
  if (businessGameId === 'mock-game-content-creation') return 0.91;

  return 1;
};

const buildHeatmap = (
  baseDau: number,
  channelFactor: number,
  weekFactor: number,
): Array<[number, number, number]> => {
  const dayWeights = [0.96, 0.94, 0.98, 1.03, 1.08, 0.91, 0.86];

  return dayWeights.flatMap((dayWeight, dayIndex) => (
    Array.from({ length: 24 }, (_, hour) => {
      const hourWeight = hour < 6
        ? 0.2 + hour * 0.035
        : hour < 10
          ? 0.58 + (hour - 6) * 0.08
          : hour < 18
            ? 0.82 + ((hour + dayIndex) % 4) * 0.045
            : 1.08 + Math.max(0, 4 - Math.abs(21 - hour)) * 0.16;
      const value = Math.round(
        (baseDau / 29) * channelFactor * weekFactor * dayWeight * hourWeight,
      );

      return [hour, dayIndex, value] as [number, number, number];
    })
  ));
};

export const getDashboardData = ({
  businessGameId,
  gameId,
  weekStart,
  channelIds,
}: {
  businessGameId: string;
  gameId: string;
  weekStart: string;
  channelIds: string[];
}): DashboardData => {
  const config = GAME_CONFIGS[gameId] ?? GAME_CONFIGS[DEFAULT_GAME_ID];
  const validChannelCount = channelIds.filter((channelId) => (
    config.channels.some((channel) => channel.channelId === channelId)
  )).length;
  const weekStartDate = new Date(`${weekStart}T00:00:00`);
  const trendDates = Array.from({ length: 7 }, (_, dayIndex) => {
    const date = new Date(weekStartDate.getTime() + dayIndex * 86400000);
    return `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  });

  if (validChannelCount === 0) {
    return {
      metrics: {},
      trend: {
        dates: trendDates,
        dau: [],
        newUsers: [],
        sessionsPerUser: [],
      },
      heatmap: [],
      heatmapMax: 1,
    };
  }

  const channelRatio = config.channels.length === 0
    ? 0
    : validChannelCount / config.channels.length;
  const channelFactor = 0.56 + channelRatio * 0.44;
  const weekFactor = getWeekFactor(weekStart);
  const businessFactor = getBusinessFactor(businessGameId);
  const volumeFactor = channelFactor * weekFactor * businessFactor;
  const metrics = config.metrics;
  const heatmap = buildHeatmap(metrics.dau, channelFactor, weekFactor);

  return {
    metrics: {
      dau: Math.round(metrics.dau * volumeFactor),
      newUsers: Math.round(metrics.newUsers * volumeFactor * 0.97),
      sessionsPerUser: round(metrics.sessionsPerUser * (0.93 + channelRatio * 0.07)),
      turnsPerSession: round(metrics.turnsPerSession * (0.96 + channelRatio * 0.04)),
      messagesPerUser: round(metrics.messagesPerUser * (0.92 + channelRatio * 0.08)),
      roleBindingRate: round(metrics.roleBindingRate * (0.97 + channelRatio * 0.03), 3),
    },
    trend: {
      dates: trendDates,
      dau: config.dailyDau.map((value) => Math.round(value * volumeFactor)),
      newUsers: config.dailyNewUsers.map((value) => Math.round(value * volumeFactor * 0.97)),
      sessionsPerUser: config.dailySessionsPerUser.map((value) => (
        round(value * (0.93 + channelRatio * 0.07))
      )),
    },
    heatmap,
    heatmapMax: Math.max(1, ...heatmap.map(([, , value]) => value)),
  };
};
