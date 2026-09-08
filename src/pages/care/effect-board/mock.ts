// 主动关怀 - 效果看板 Mock 数据
// 对齐交互设计稿《主动关怀策略_终版_v5》效果看板部分；日期跟随系统今日动态计算。
import type {
  BlockReasonKey,
  CareStrategy,
  ChannelName,
  StrategyStatusKey,
  TimeRange,
  TimeRangePreset,
  UserReachRecord,
} from './types';

// 系统今日：模块加载时计算一次，所有 mock 日期以此为锚点。
const pad = (v: number) => String(v).padStart(2, '0');
const formatYmd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const NOW = new Date();
export const TODAY: string = formatYmd(NOW);

/** 从今日偏移 n 天（负数=过去），返回 YYYY-MM-DD */
export const offsetDays = (n: number): string => {
  const d = new Date(NOW);
  d.setDate(d.getDate() + n);
  return formatYmd(d);
};

/** 在指定日期基础上偏移 n 天 */
const shiftDate = (dateStr: string, n: number): string => {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + n);
  return formatYmd(d);
};

/** 生成 (今日 + daysAgo 天) 当天的指定 HH:MM 时间串 */
export const formatDateTime = (daysAgo: number, hour: number, minute: number): string => {
  const d = new Date(NOW);
  d.setDate(d.getDate() + daysAgo);
  d.setHours(hour, minute, 0, 0);
  return `${formatYmd(d)} ${pad(hour)}:${pad(minute)}`;
};

export const ALL_CHANNELS: ChannelName[] = ['小程序', '企微', '手Q'];

export const CHANNEL_COLOR: Record<ChannelName, string> = {
  小程序: '#5B8FF9',
  企微: '#5AD8A6',
  手Q: '#F6BD16',
};

export const STATUS_LABEL: Record<Exclude<StrategyStatusKey, 'draft'>, string> = {
  active: '生效中',
  paused: '已暂停',
  completed: '已完成',
  pending: '待启动',
  testing: '测试中',
  launch_failed: '启动失败',
};

export const TIME_PRESET_OPTIONS: { label: string; value: TimeRangePreset }[] = [
  { label: '今天', value: 'today' },
  { label: '昨天', value: 'yesterday' },
  { label: '近7天', value: 'past7' },
  { label: '近30天', value: 'past30' },
  { label: '自定义', value: 'custom' },
];

export const CARE_TAG_OPTIONS = ['全部', '失败关怀', '回流关怀', '新用户引导', '活动提醒', '打卡提醒'] as const;

export const STATUS_FILTER_OPTIONS = [
  { label: '全部', value: 'all' },
  { label: '生效中', value: 'active' },
  { label: '已暂停', value: 'paused' },
  { label: '已完成', value: 'completed' },
  { label: '待启动', value: 'pending' },
  { label: '测试中', value: 'testing' },
  { label: '启动失败', value: 'launch_failed' },
];

export const addDays = (date: string, n: number) => shiftDate(date, n);

const dayDiff = (a: string, b: string) => Math.round(
  (new Date(`${b}T00:00:00`).getTime() - new Date(`${a}T00:00:00`).getTime()) / 86400000,
);

export const computeTimeRange = (
  preset: TimeRangePreset,
  customStart: string,
  customEnd: string,
): TimeRange => {
  let start = TODAY;
  let end = TODAY;
  let label = '近7天';

  if (preset === 'today') {
    start = end = TODAY;
    label = TODAY;
  } else if (preset === 'yesterday') {
    start = end = offsetDays(-1);
    label = start;
  } else if (preset === 'past7') {
    start = offsetDays(-6);
    end = TODAY;
    label = '近7天';
  } else if (preset === 'past30') {
    start = offsetDays(-29);
    end = TODAY;
    label = '近30天';
  } else {
    start = customStart || offsetDays(-6);
    end = customEnd || TODAY;
    label = '自定义';
  }

  const days = Math.max(1, dayDiff(start, end) + 1);
  return { preset, start, end, days, label };
};

export const getDayLabels = (range: TimeRange): string[] => {
  const labels: string[] = [];
  for (let i = 0; i < range.days; i += 1) {
    const d = addDays(range.start, i);
    labels.push(`${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`);
  }
  return labels;
};

// 时间范围缩放因子：1 天 = 0.15，7 天 = 1，30 天 = 4.2，自定义按天数折算
export const getScale = (days: number) => (
  days === 1 ? 0.15 : days === 30 ? 4.2 : days === 7 ? 1 : Number((days / 7).toFixed(2))
);

// ===== 策略主数据（对齐设计稿 strategies + strategyMetrics + strategyEffectiveMap）=====
// 生效时间用相对今日的天数偏移表示，确保明天打开 mock 仍然贴近真实日期。
export const CARE_STRATEGIES: CareStrategy[] = [
  {
    id: 'stg_001',
    name: '对局失败关怀',
    careTag: '失败关怀',
    channels: ['小程序', '企微'],
    status: 'active',
    effective: { start: offsetDays(-100), end: '' },
    metric: {
      send: 11054,
      reach: 10102,
      channels: [
        { name: '小程序', send: 7800, reach: 7150 },
        { name: '企微', send: 3254, reach: 2952 },
      ],
    },
  },
  {
    id: 'stg_002',
    name: '福利活动提醒',
    careTag: '活动提醒',
    channels: ['小程序'],
    status: 'active',
    effective: { start: offsetDays(-95), end: '' },
    metric: {
      send: 5500,
      reach: 5050,
      channels: [{ name: '小程序', send: 5500, reach: 5050 }],
    },
  },
  {
    id: 'stg_003',
    name: '17 打卡漏签提醒',
    careTag: '打卡提醒',
    channels: ['小程序', '企微'],
    status: 'active',
    effective: { start: offsetDays(-110), end: '' },
    metric: {
      send: 4872,
      reach: 4220,
      channels: [
        { name: '小程序', send: 3000, reach: 2650 },
        { name: '企微', send: 1872, reach: 1570 },
      ],
    },
  },
  {
    id: 'stg_004',
    name: '段位掉落安抚',
    careTag: '失败关怀',
    channels: ['小程序'],
    status: 'paused',
    effective: { start: offsetDays(-80), end: offsetDays(-90) },
    metric: {
      send: 2986,
      reach: 2621,
      channels: [{ name: '小程序', send: 2986, reach: 2621 }],
    },
  },
  {
    id: 'stg_005',
    name: '段位成长建议',
    careTag: '回流关怀',
    channels: ['小程序', '手Q'],
    status: 'draft',
    effective: { start: offsetDays(-85), end: '' },
    metric: {
      send: 1940,
      reach: 1712,
      channels: [
        { name: '小程序', send: 1200, reach: 1050 },
        { name: '手Q', send: 740, reach: 662 },
      ],
    },
  },
  {
    id: 'stg_006',
    name: '新用户引导关怀',
    careTag: '新用户引导',
    channels: ['小程序', '手Q'],
    status: 'active',
    effective: { start: offsetDays(-105), end: '' },
    metric: {
      send: 1442,
      reach: 1302,
      channels: [
        { name: '小程序', send: 1000, reach: 920 },
        { name: '手Q', send: 442, reach: 382 },
      ],
    },
  },
  {
    id: 'stg_007',
    name: '老用户回流关怀',
    careTag: '回流关怀',
    channels: ['小程序'],
    status: 'completed',
    effective: { start: offsetDays(-200), end: offsetDays(-130) },
    metric: {
      send: 532,
      reach: 460,
      channels: [{ name: '小程序', send: 532, reach: 460 }],
    },
  },
  {
    id: 'stg_008',
    name: '紧急活动推送',
    careTag: '活动提醒',
    channels: ['小程序'],
    status: 'completed',
    effective: { start: offsetDays(-25), end: offsetDays(-15) },
    metric: {
      send: 8621,
      reach: 7992,
      channels: [{ name: '小程序', send: 8621, reach: 7992 }],
    },
  },
  {
    id: 'stg_009',
    name: '赛季结算关怀',
    careTag: '回流关怀',
    channels: ['小程序', '手Q'],
    status: 'testing',
    effective: { start: offsetDays(-25), end: '' },
    metric: {
      send: 3206,
      reach: 2821,
      channels: [
        { name: '小程序', send: 1603, reach: 1411 },
        { name: '手Q', send: 1603, reach: 1410 },
      ],
    },
  },
  {
    id: 'stg_010',
    name: '版本更新提醒',
    careTag: '活动提醒',
    channels: ['企微'],
    status: 'launch_failed',
    effective: { start: offsetDays(-23), end: '' },
    metric: {
      send: 0,
      reach: 0,
      channels: [{ name: '企微', send: 0, reach: 0 }],
    },
  },
];

export const isStrategyInRange = (strategy: CareStrategy, range: TimeRange) => {
  const { start, end } = strategy.effective;
  const effectiveEnd = end || '2099-12-31';
  return start <= range.end && effectiveEnd >= range.start;
};

export const isVisibleInDashboard = (strategy: CareStrategy) => strategy.status !== 'draft';

// ===== 派生指标（对齐设计稿 calc 函数）=====
export const calcReachUsers = (reach: number) => Math.round(reach * 0.92);

export const calcFailRate = (send: number, reach: number) => (
  send > 0 ? Number((((send - reach) / send) * 100).toFixed(1)) : 0
);

export const calcFreqLimited = (send: number, reach: number) => (
  Math.round(Math.max(0, send - reach) * 0.35)
);

// ===== 总览指标 =====
export interface OverviewMetrics {
  runningCount: number;
  totalSend: number;
  totalReach: number;
  failRate: number;
  freqLimited: number;
}

export const getOverviewMetrics = (
  range: TimeRange,
  channel: ChannelName | 'all',
): OverviewMetrics => {
  const scale = getScale(range.days);
  const inRange = CARE_STRATEGIES.filter((s) => isVisibleInDashboard(s) && isStrategyInRange(s, range));

  let totalSend = 0;
  let totalReach = 0;
  if (channel === 'all') {
    inRange.forEach((s) => {
      totalSend += s.metric.send;
      totalReach += s.metric.reach;
    });
  } else {
    inRange.forEach((s) => {
      const ch = s.metric.channels.find((c) => c.name === channel);
      if (ch) {
        totalSend += ch.send;
        totalReach += ch.reach;
      }
    });
  }
  totalSend = Math.round(totalSend * scale);
  totalReach = Math.round(totalReach * scale);

  const runningCount = CARE_STRATEGIES.filter((s) => (
    s.status === 'active'
    && isStrategyInRange(s, range)
    && (channel === 'all' || s.channels.includes(channel))
  )).length;

  return {
    runningCount,
    totalSend,
    totalReach,
    failRate: calcFailRate(totalSend, totalReach),
    freqLimited: Math.max(0, totalSend - totalReach),
  };
};

// ===== 总览趋势（3 张图：推送量 / 触达量 / 超频拦截量）=====
export interface TrendLine {
  name: ChannelName;
  color: string;
  data: number[];
}

export const getTrendLines = (
  range: TimeRange,
  channel: ChannelName | 'all',
  kind: 'send' | 'reach' | 'block',
): TrendLine[] => {
  const inRange = CARE_STRATEGIES.filter((s) => isVisibleInDashboard(s) && isStrategyInRange(s, range));
  const days = range.days;
  const visibleChannels = channel === 'all' ? ALL_CHANNELS : [channel];

  return visibleChannels.map((chName, channelIndex) => {
    const data: number[] = [];
    for (let d = 0; d < days; d += 1) {
      const base = inRange.reduce((sum, s) => {
        const ch = s.metric.channels.find((c) => c.name === chName);
        if (!ch) return sum;
        const raw = kind === 'send' ? ch.send : kind === 'reach' ? ch.reach : (ch.send - ch.reach);
        return sum + Math.round(raw / days);
      }, 0);
      // 确定性噪声，避免每次渲染抖动
      const noise = 0.92 + ((d * 13 + channelIndex * 7) % 17) / 100;
      data.push(Math.max(0, Math.round(base * noise)));
    }
    return { name: chName, color: CHANNEL_COLOR[chName], data };
  });
};

// ===== 拦截原因 Top 5 =====
export interface BlockReasonRow {
  key: BlockReasonKey;
  name: string;
  count: number;
  color: string;
}

const BLOCK_REASON_RATIOS: { key: BlockReasonKey; name: string; ratio: number; color: string }[] = [
  { key: 'freq_limited', name: '超频限制', ratio: 0.35, color: '#5B8FF9' },
  { key: 'silent_blocked', name: '静默拦截', ratio: 0.25, color: '#7FA5F1' },
  { key: 'no_available_channel', name: '无可用渠道', ratio: 0.2, color: '#9DBCF5' },
  { key: 'service_disabled', name: '服务已关闭', ratio: 0.12, color: '#B9D0F8' },
  { key: 'other', name: '其他', ratio: 0.08, color: '#D3E1FB' },
];

export const getBlockReasonRows = (totalBlock: number): BlockReasonRow[] => (
  BLOCK_REASON_RATIOS.map((r) => ({
    key: r.key,
    name: r.name,
    count: Math.round(totalBlock * r.ratio),
    color: r.color,
  }))
);

// ===== 策略列表行数据 =====
export interface StrategyRow {
  id: string;
  name: string;
  careTag: string;
  channels: ChannelName[];
  status: Exclude<StrategyStatusKey, 'draft'>;
  statusLabel: string;
  effectiveDisplay: string;
  inRange: boolean;
  send: number | null;
  reach: number | null;
  reachUsers: number | null;
  failRate: number | null;
  freqLimited: number | null;
  intersectionDays: number;
  totalStrategyDays: number;
  isPartialCoverage: boolean;
}

export interface StrategyListFilter {
  keyword: string;
  careTag: (typeof CARE_TAG_OPTIONS)[number];
  status: string;
  channel: ChannelName | 'all';
  range: TimeRange;
}

export const getStrategyRows = (filter: StrategyListFilter): StrategyRow[] => {
  const { keyword, careTag, status, channel, range } = filter;
  const scale = getScale(range.days);

  const list = CARE_STRATEGIES.filter((s) => {
    if (!isVisibleInDashboard(s)) return false;
    if (status !== 'all' && s.status !== status) return false;
    if (channel !== 'all' && !s.channels.includes(channel)) return false;
    if (careTag !== '全部' && s.careTag !== careTag) return false;
    if (keyword.trim() && !s.name.toLowerCase().includes(keyword.trim().toLowerCase())) return false;
    return true;
  });

  const statusOrder: Record<string, number> = {
    active: 0, completed: 1, paused: 2, pending: 2, testing: 2, launch_failed: 2,
  };
  list.sort((a, b) => {
    const oa = statusOrder[a.status] ?? 3;
    const ob = statusOrder[b.status] ?? 3;
    if (oa !== ob) return oa - ob;
    return a.name.localeCompare(b.name, 'zh-Hans-CN');
  });

  return list.map((s) => {
    const inRange = isStrategyInRange(s, range);
    let send: number | null = null;
    let reach: number | null = null;
    if (inRange) {
      if (channel === 'all') {
        send = Math.round(s.metric.send * scale);
        reach = Math.round(s.metric.reach * scale);
      } else {
        const ch = s.metric.channels.find((c) => c.name === channel);
        send = Math.round((ch ? ch.send : 0) * scale);
        reach = Math.round((ch ? ch.reach : 0) * scale);
      }
    }

    const totalStrategyDays = dayDiff(s.effective.start, s.effective.end || TODAY) + 1;
    const intersectionStart = range.start > s.effective.start ? range.start : s.effective.start;
    const intersectionEnd = range.end < (s.effective.end || TODAY) ? range.end : (s.effective.end || TODAY);
    const intersectionDays = intersectionEnd >= intersectionStart
      ? dayDiff(intersectionStart, intersectionEnd) + 1
      : 0;
    const isPartialCoverage = inRange && intersectionDays < totalStrategyDays;

    return {
      id: s.id,
      name: s.name,
      careTag: s.careTag,
      channels: s.channels,
      status: s.status as Exclude<StrategyStatusKey, 'draft'>,
      statusLabel: STATUS_LABEL[s.status as Exclude<StrategyStatusKey, 'draft'>],
      effectiveDisplay: `${s.effective.start} ~ ${s.effective.end || '至今'}`,
      inRange,
      send,
      reach,
      reachUsers: send !== null && reach !== null ? calcReachUsers(reach) : null,
      failRate: send !== null && reach !== null ? calcFailRate(send, reach) : null,
      freqLimited: send !== null && reach !== null ? calcFreqLimited(send, reach) : null,
      intersectionDays,
      totalStrategyDays,
      isPartialCoverage,
    };
  });
};

// ===== 单策略详情 =====
export interface SingleStrategyDetail {
  strategy: CareStrategy;
  titleScope: string;
  send: number;
  reach: number;
  reachUsers: number;
  failRate: number;
  freqLimited: number;
  blockReasons: BlockReasonRow[];
  showChannelSplit: boolean;
  channelSplit: { name: ChannelName; send: number; reach: number; reachUsers: number; failRate: number; freqLimited: number }[];
  /** 策略生效的总天数 */
  totalStrategyDays: number;
  /** 筛选范围与策略生效范围的实际交集天数 */
  intersectionDays: number;
  /** 是否仅部分覆盖（交集 < 策略总天数） */
  isPartialCoverage: boolean;
  /** 是否在筛选范围内（交集 > 0） */
  inRange: boolean;
}

export const getSingleStrategyDetail = (
  strategyId: string,
  selectedChannel: ChannelName | null,
  globalChannel: ChannelName | 'all',
  range: TimeRange,
): SingleStrategyDetail | null => {
  const s = CARE_STRATEGIES.find((x) => x.id === strategyId);
  if (!s) return null;

  const detailChannel = selectedChannel || (globalChannel !== 'all' ? globalChannel : null);
  const visibleChannels = detailChannel
    ? s.metric.channels.filter((c) => c.name === detailChannel)
    : s.metric.channels;
  const showChannelSplit = !detailChannel && visibleChannels.length >= 2;

  const send = visibleChannels.reduce((sum, c) => sum + c.send, 0);
  const reach = visibleChannels.reduce((sum, c) => sum + c.reach, 0);
  const reachUsers = visibleChannels.reduce((sum, c) => sum + calcReachUsers(c.reach), 0);
  const failRate = calcFailRate(send, reach);
  const freqLimited = calcFreqLimited(send, reach);
  const titleScope = detailChannel || (visibleChannels.length >= 2 ? '聚合' : (visibleChannels[0]?.name ?? '聚合'));

  const blockReasons = getBlockReasonRows(Math.max(0, send - reach));

  // 实际交集天数（用于展示「实际覆盖 X 天」提示）
  const totalStrategyDays = dayDiff(s.effective.start, s.effective.end || TODAY) + 1;
  const intersectionStart = range.start > s.effective.start ? range.start : s.effective.start;
  const intersectionEnd = range.end < (s.effective.end || TODAY) ? range.end : (s.effective.end || TODAY);
  const intersectionDays = intersectionEnd >= intersectionStart
    ? dayDiff(intersectionStart, intersectionEnd) + 1
    : 0;
  const isPartialCoverage = intersectionDays > 0 && intersectionDays < totalStrategyDays;

  return {
    strategy: s,
    titleScope,
    send,
    reach,
    reachUsers,
    failRate,
    freqLimited,
    blockReasons,
    showChannelSplit,
    channelSplit: visibleChannels.map((c) => ({
      name: c.name,
      send: c.send,
      reach: c.reach,
      reachUsers: calcReachUsers(c.reach),
      failRate: calcFailRate(c.send, c.reach),
      freqLimited: calcFreqLimited(c.send, c.reach),
    })),
    totalStrategyDays,
    intersectionDays,
    isPartialCoverage,
    inRange: intersectionDays > 0,
  };
};

// ===== 对比项 =====
export interface CompareItem {
  comboId: string;
  label: string;
  color: string;
  send: number;
  reach: number;
  failRate: number;
  freqLimited: number;
  trend: number[];
  channel: ChannelName | null;
  strategy: CareStrategy;
}

const COMPARE_COLORS = ['#5B8FF9', '#5AD8A6', '#F6BD16'];

// 确定性策略趋势（对齐设计稿 getStrategyTrendByDays）
const strategyTrendCache: Record<string, number[]> = {};
export const getStrategyTrend = (strategyId: string, days: number): number[] => {
  const key = `${strategyId}_${days}`;
  if (strategyTrendCache[key]) return strategyTrendCache[key];
  const s = CARE_STRATEGIES.find((x) => x.id === strategyId);
  const send = s ? s.metric.send : 0;
  const seed = strategyId.split('').reduce((sum, c) => sum + c.charCodeAt(0), 0);
  const ratioBase = [0.11, 0.13, 0.12, 0.16, 0.14, 0.15, 0.19];
  const arr: number[] = [];
  for (let d = 0; d < Math.max(1, days); d += 1) {
    const base = ratioBase[(d + seed) % ratioBase.length];
    const noise = (((seed * (d + 1)) % 7) - 3) * 0.01;
    arr.push(Math.max(0, Math.round(send * (base + noise))));
  }
  strategyTrendCache[key] = arr;
  return arr;
};

export const getCompareItems = (
  comboIds: string[],
  range: TimeRange,
  globalChannel: ChannelName | 'all',
): CompareItem[] => {
  const scale = getScale(range.days);

  return comboIds.map((comboId, index) => {
    const sepIdx = comboId.indexOf('__');
    const sid = sepIdx === -1 ? comboId : comboId.substring(0, sepIdx);
    const channel = sepIdx === -1 ? null : (comboId.substring(sepIdx + 2) as ChannelName);
    const s = CARE_STRATEGIES.find((x) => x.id === sid);
    if (!s) return null;

    const effectiveChannel = channel || (globalChannel !== 'all' ? globalChannel : null);
    let chSend: number;
    let chReach: number;
    if (effectiveChannel) {
      const ch = s.metric.channels.find((c) => c.name === effectiveChannel);
      chSend = ch ? ch.send : 0;
      chReach = ch ? ch.reach : 0;
    } else {
      chSend = s.metric.channels.reduce((sum, c) => sum + c.send, 0) || s.metric.send;
      chReach = s.metric.channels.reduce((sum, c) => sum + c.reach, 0) || s.metric.reach;
    }
    const send = Math.round(chSend * scale);
    const reach = Math.round(chReach * scale);
    const trend = getStrategyTrend(sid, range.days).map((v) => {
      const channelRatio = s.metric.send > 0 ? chSend / s.metric.send : 0;
      return Math.round(v * channelRatio * scale);
    });
    return {
      comboId,
      label: effectiveChannel
        ? `${s.name}·${effectiveChannel}`
        : s.metric.channels.length === 1
          ? `${s.name}·${s.metric.channels[0].name}`
          : `${s.name}（汇总）`,
      color: COMPARE_COLORS[index % 3],
      send,
      reach,
      failRate: calcFailRate(send, reach),
      freqLimited: Math.max(0, send - reach),
      trend,
      channel: effectiveChannel,
      strategy: s,
    };
  }).filter((x): x is CompareItem => x !== null);
};

export const getComboStrategyChannelSplit = (item: CompareItem, scale: number) => {
  if (item.channel) {
    return [{
      color: item.color,
      strategy: item.strategy.name,
      channel: item.channel,
      send: item.send,
      reach: item.reach,
      failRate: item.failRate,
      freqLimited: item.freqLimited,
    }];
  }
  return item.strategy.metric.channels.map((c) => {
    const send = Math.round(c.send * scale);
    const reach = Math.round(c.reach * scale);
    return {
      color: item.color,
      strategy: item.strategy.name,
      channel: c.name,
      send,
      reach,
      failRate: calcFailRate(send, reach),
      freqLimited: Math.max(0, send - reach),
    };
  });
};

// ===== 用户触达 =====
export const BLOCK_REASON_LABEL: Record<BlockReasonKey, string> = {
  freq_limited: '超频限制',
  silent_blocked: '静默拦截',
  no_available_channel: '无可用渠道',
  service_disabled: '服务已关闭',
  other: '其他',
};

const USER_REACH_DB: { userId: string; records: UserReachRecord[] }[] = [
  {
    userId: '10086',
    records: [
      { time: formatDateTime(-1, 16, 30), strategyName: '对局失败关怀', channel: '小程序', success: true, reason: null },
      { time: formatDateTime(-2, 14, 22), strategyName: '福利活动提醒', channel: '企微', success: true, reason: null },
      { time: formatDateTime(-3, 10, 15), strategyName: '对局失败关怀', channel: '小程序', success: false, reason: 'freq_limited' },
    ],
  },
  {
    userId: '10087',
    records: [
      { time: formatDateTime(-1, 9, 0), strategyName: '17 打卡漏签提醒', channel: '小程序', success: true, reason: null },
      { time: formatDateTime(-2, 9, 0), strategyName: '17 打卡漏签提醒', channel: '小程序', success: true, reason: null },
      { time: formatDateTime(-3, 9, 0), strategyName: '17 打卡漏签提醒', channel: '小程序', success: false, reason: 'freq_limited' },
    ],
  },
  {
    userId: '10088',
    records: [
      { time: formatDateTime(-1, 18, 0), strategyName: '段位成长建议', channel: '小程序', success: true, reason: null },
      { time: formatDateTime(-2, 10, 0), strategyName: '段位成长建议', channel: '小程序', success: false, reason: 'silent_blocked' },
    ],
  },
  {
    userId: '10089',
    records: [
      { time: formatDateTime(-1, 14, 0), strategyName: '紧急活动推送', channel: '小程序', success: true, reason: null },
      { time: formatDateTime(-2, 11, 30), strategyName: '新用户引导关怀', channel: '企微', success: false, reason: 'no_available_channel' },
    ],
  },
];

const findStrategyByName = (name: string) => CARE_STRATEGIES.find((s) => s.name === name);

export type UserReachResult =
  | { kind: 'empty' }
  | { kind: 'not-found'; openId: string }
  | { kind: 'no-record'; openId: string; channelLabel: string }
  | { kind: 'records'; openId: string; records: UserReachRecord[] };

export const queryUserReach = (
  openId: string,
  range: TimeRange,
  globalChannel: ChannelName | 'all',
): UserReachResult => {
  const trimmed = openId.trim();
  if (!trimmed) return { kind: 'empty' };

  const found = USER_REACH_DB.find((r) => r.userId === trimmed);
  if (!found) return { kind: 'not-found', openId: trimmed };

  const filtered = found.records.filter((r) => {
    const recordDate = r.time.slice(0, 10);
    if (recordDate < range.start || recordDate > range.end) return false;
    if (globalChannel !== 'all' && r.channel !== globalChannel) return false;
    return true;
  });

  if (filtered.length === 0) {
    const channelLabel = globalChannel === 'all' ? '' : `及渠道：${globalChannel}`;
    return { kind: 'no-record', openId: trimmed, channelLabel };
  }
  return { kind: 'records', openId: trimmed, records: filtered };
};

export const getRecordStrategyMeta = (record: UserReachRecord) => {
  const s = findStrategyByName(record.strategyName);
  return {
    id: s ? s.id : '--',
    careTag: s ? s.careTag : '—',
  };
};
