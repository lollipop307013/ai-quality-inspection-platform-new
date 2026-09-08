export interface MetricItem {
  key: string;
  label: string;
  value: string;
  change: number;
}

export interface TrendItem {
  date: string;
  messageCount: number;
  userUv: number;
  sessionCount: number;
}

export interface QualityTrendItem {
  date: string;
  followUpRate: number;
}

export interface FrequentQuestion {
  rank: number;
  question: string;
  count: number;
  users: number;
  percentage: string;
}

export interface QaDashboardData {
  metrics: MetricItem[];
  trend: TrendItem[];
  qualityTrend: QualityTrendItem[];
  questions: FrequentQuestion[];
}

export const DEFAULT_WEEK_DATE = '2026-06-30';
export const DEFAULT_DETAIL_RANGE: [string, string] = ['2026-07-01', '2026-07-07'];

const metrics: MetricItem[] = [
  { key: 'user-uv', label: '用户 UV', value: '12,847', change: 3.6 },
  { key: 'message-count', label: '用户消息总量', value: '38,206', change: -2.14 },
  { key: 'session-count', label: '会话总量', value: '21,453', change: 5.27 },
  { key: 'messages-per-user', label: '人均消息数', value: '2.97', change: -0.83 },
  { key: 'sessions-per-user', label: '人均会话数', value: '1.67', change: 1.22 },
  { key: 'messages-per-session', label: '会话平均消息数', value: '1.78', change: -3.6 },
  { key: 'follow-up-session-rate', label: '连续追问会话占比', value: '43.2%', change: 2.15 },
];

const trend: TrendItem[] = [
  { date: '06-30', messageCount: 5200, userUv: 1800, sessionCount: 2900 },
  { date: '07-01', messageCount: 5800, userUv: 1950, sessionCount: 3200 },
  { date: '07-02', messageCount: 5500, userUv: 1850, sessionCount: 3050 },
  { date: '07-03', messageCount: 5900, userUv: 2000, sessionCount: 3300 },
  { date: '07-04', messageCount: 4800, userUv: 1600, sessionCount: 2700 },
  { date: '07-05', messageCount: 4500, userUv: 1500, sessionCount: 2500 },
  { date: '07-06', messageCount: 5700, userUv: 1900, sessionCount: 3100 },
];

const qualityTrend: QualityTrendItem[] = [
  { date: '06-30', followUpRate: 42.1 },
  { date: '07-01', followUpRate: 44.3 },
  { date: '07-02', followUpRate: 43.8 },
  { date: '07-03', followUpRate: 45 },
  { date: '07-04', followUpRate: 41.5 },
  { date: '07-05', followUpRate: 40.9 },
  { date: '07-06', followUpRate: 44.8 },
];

const questions: FrequentQuestion[] = [
  { rank: 1, question: '角色数据为什么丢失了', count: 2847, users: 1923, percentage: '7.4%' },
  { rank: 2, question: '充值不到账怎么办', count: 2412, users: 2156, percentage: '6.3%' },
  { rank: 3, question: '如何联系人工客服', count: 1983, users: 1678, percentage: '5.2%' },
  { rank: 4, question: '赛季结算奖励什么时候发放', count: 1564, users: 1402, percentage: '4.1%' },
  { rank: 5, question: '账号被封了怎么申诉', count: 1247, users: 1189, percentage: '3.3%' },
  { rank: 6, question: '游戏闪退怎么解决', count: 1102, users: 987, percentage: '2.9%' },
  { rank: 7, question: '怎么修改绑定的手机号', count: 986, users: 921, percentage: '2.6%' },
  { rank: 8, question: '皮肤购买后没收到', count: 874, users: 812, percentage: '2.3%' },
  { rank: 9, question: '匹配等待时间太长', count: 765, users: 698, percentage: '2.0%' },
  { rank: 10, question: '如何退款', count: 654, users: 601, percentage: '1.7%' },
  { rank: 11, question: '登录时验证码收不到', count: 598, users: 543, percentage: '1.6%' },
  { rank: 12, question: '对局掉线怎么重连', count: 542, users: 498, percentage: '1.4%' },
  { rank: 13, question: '战队如何创建', count: 487, users: 451, percentage: '1.3%' },
  { rank: 14, question: '段位继承规则是什么', count: 432, users: 398, percentage: '1.1%' },
  { rank: 15, question: '好友上限是多少', count: 389, users: 356, percentage: '1.0%' },
  { rank: 16, question: '每日任务在哪里看', count: 345, users: 312, percentage: '0.9%' },
  { rank: 17, question: '如何举报外挂玩家', count: 298, users: 267, percentage: '0.8%' },
  { rank: 18, question: '钻石和金币有什么区别', count: 256, users: 234, percentage: '0.7%' },
  { rank: 19, question: '游戏更新失败怎么办', count: 213, users: 198, percentage: '0.6%' },
  { rank: 20, question: '如何参加锦标赛', count: 187, users: 172, percentage: '0.5%' },
];

const cloneDashboardData = (): QaDashboardData => ({
  metrics: metrics.map((item) => ({ ...item })),
  trend: trend.map((item) => ({ ...item })),
  qualityTrend: qualityTrend.map((item) => ({ ...item })),
  questions: questions.map((item) => ({ ...item })),
});

const getBusinessFactor = (gameId: string) => {
  if (gameId === 'mock-game-ai-platform') return 1.08;
  if (gameId === 'mock-game-content-creation') return 0.91;

  return 1;
};

export const getQaDashboardData = ({
  gameId,
  dateRange,
  granularity,
}: {
  gameId: string;
  dateRange: [string, string];
  granularity: 'day' | 'week';
}): QaDashboardData => {
  const data = cloneDashboardData();
  const daySpan = Math.max(1, Math.round(
    (new Date(`${dateRange[1]}T00:00:00`).getTime()
      - new Date(`${dateRange[0]}T00:00:00`).getTime()) / 86400000,
  ) + 1);
  const spanFactor = Math.min(4.2, Math.max(0.72, daySpan / 7));
  const businessFactor = getBusinessFactor(gameId);

  if (daySpan === 7 && granularity === 'day' && businessFactor === 1) return data;

  const volumeMetricKeys = new Set(['user-uv', 'message-count', 'session-count']);
  data.metrics = data.metrics.map((item) => {
    if (!volumeMetricKeys.has(item.key)) return item;

    const nextValue = Math.round(
      Number(item.value.replace(/,/g, '')) * spanFactor * businessFactor,
    );
    return { ...item, value: nextValue.toLocaleString('zh-CN') };
  });

  data.trend = data.trend.map((item) => ({
    ...item,
    messageCount: Math.round(item.messageCount * businessFactor),
    userUv: Math.round(item.userUv * businessFactor),
    sessionCount: Math.round(item.sessionCount * businessFactor),
  }));

  if (granularity === 'week') {
    const weekCount = Math.max(1, Math.ceil(daySpan / 7));
    data.trend = Array.from({ length: weekCount }, (_, index) => ({
      date: `第${index + 1}周`,
      messageCount: Math.round(35600 * (0.93 + index * 0.035) * businessFactor),
      userUv: Math.round(11600 * (0.95 + index * 0.028) * businessFactor),
      sessionCount: Math.round(18800 * (0.94 + index * 0.031) * businessFactor),
    }));
    data.qualityTrend = Array.from({ length: weekCount }, (_, index) => ({
      date: `第${index + 1}周`,
      followUpRate: Number((42.4 + (index % 3) * 1.1 - (index % 2) * 0.5).toFixed(1)),
    }));
  }

  return data;
};

export const getEmptyQaDashboardData = (): QaDashboardData => ({
  metrics: metrics.map((item) => ({ ...item, value: '--' })),
  trend: [],
  qualityTrend: [],
  questions: [],
});
