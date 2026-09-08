export const PUBGM_DEFAULT_WEEK_DATE = '2026-07-21';

export interface PubgmMetricItem {
  key: string;
  label: string;
  value: string;
  grayOnlyLabel?: string;
  tooltip: string;
}

export interface PubgmLanguageItem {
  code: string;
  name: string;
  count: number;
  percentage: number;
}

export interface PubgmFeedbackItem {
  key: string;
  label: string;
  value: string;
}

export interface PubgmDashboardData {
  weekRange: [string, string];
  grayOnly: boolean;
  metrics: PubgmMetricItem[];
  languageTotal: number;
  languageCount: number;
  top3Share: number;
  top4Share: number;
  languages: PubgmLanguageItem[];
  feedback: PubgmFeedbackItem[];
}

const baseMetrics: PubgmMetricItem[] = [
  {
    key: 'question-message-count',
    label: '提问对话量',
    value: '1,095,971',
    grayOnlyLabel: '全量灰度 1,095,971',
    tooltip: '周期内用户侧提问消息总条数；统计对象为 sender_type=1 的消息。',
  },
  {
    key: 'question-user-uv',
    label: '提问用户量 UV',
    value: '488,193',
    grayOnlyLabel: '全量灰度 488,193',
    tooltip: '周期内发起提问的去重用户数；按 open_id 去重，限定 sender_type=1。',
  },
  {
    key: 'session-count',
    label: '会话数',
    value: '740,940',
    grayOnlyLabel: '全量灰度 740,940',
    tooltip: '周期内去重 e2e_session_id 数；跨天会话按最早消息日期归属。',
  },
  {
    key: 'follow-up-rate',
    label: '追问率(session)',
    value: '21.59%',
    tooltip: '追问 session 数 / 总 session 数；反映用户多轮提问的活跃度。',
  },
];

const baseLanguages: PubgmLanguageItem[] = [
  { code: 'EN', name: '英语', count: 267703, percentage: 41.06 },
  { code: 'AR', name: '阿拉伯语', count: 218044, percentage: 33.45 },
  { code: 'TR', name: '土耳其语', count: 57401, percentage: 8.8 },
  { code: 'RU', name: '俄语', count: 46308, percentage: 7.1 },
  { code: 'UZ', name: '乌兹别克语', count: 15583, percentage: 2.39 },
  { code: 'ID', name: '印尼语', count: 14886, percentage: 2.28 },
  { code: 'ZH', name: '中文', count: 9825, percentage: 1.51 },
  { code: 'TH', name: '泰语', count: 8118, percentage: 1.25 },
  { code: 'ES', name: '西班牙语', count: 4533, percentage: 0.7 },
  { code: 'FR', name: '法语', count: 3082, percentage: 0.47 },
  { code: 'MS', name: '马来语', count: 1533, percentage: 0.24 },
  { code: 'DE', name: '德语', count: 1440, percentage: 0.22 },
  { code: 'ZH-HK', name: '繁中', count: 1431, percentage: 0.22 },
  { code: 'PT', name: '葡萄牙语', count: 1346, percentage: 0.21 },
  { code: 'UY', name: '乌尔都语', count: 713, percentage: 0.11 },
];

const baseFeedback: PubgmFeedbackItem[] = [
  { key: 'feedback-conversation-rate', label: '反馈对话占比', value: '9.82%' },
  { key: 'like-rate', label: '点赞率', value: '8.85%' },
  { key: 'dislike-rate', label: '点踩率', value: '0.97%' },
  { key: 'positive-rate', label: '正反馈率', value: '90.10%' },
  { key: 'positive-negative-ratio', label: '正负比', value: '9.10 : 1' },
];

const DAY_MS = 86400000;

const pad = (value: number) => String(value).padStart(2, '0');

const formatDate = (date: Date) => (
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
);

const parseDate = (value: string) => new Date(`${value}T00:00:00`);

const getNaturalWeek = (dateValue: string): [string, string] => {
  const date = parseDate(dateValue);
  const day = date.getDay() || 7;
  const start = new Date(date.getTime() - (day - 1) * DAY_MS);
  const end = new Date(start.getTime() + 6 * DAY_MS);
  return [formatDate(start), formatDate(end)];
};

const getWeekFactor = (dateRange: [string, string]) => {
  const start = parseDate(dateRange[0]).getTime();
  const end = parseDate(dateRange[1]).getTime();
  const days = Math.max(1, Math.round((end - start) / DAY_MS) + 1);
  if (days !== 7) return 1;
  const startDate = parseDate(dateRange[0]);
  return startDate >= parseDate('2026-07-20') && startDate <= parseDate('2026-07-27')
    ? 1
    : 0.78 + ((startDate.getTime() % 5) / 100);
};

const buildMetrics = (factor: number): PubgmMetricItem[] => baseMetrics.map((item) => {
  if (item.key === 'follow-up-rate') {
    const rate = 21.59 * factor;
    return { ...item, value: `${rate.toFixed(2)}%` };
  }
  const numeric = Math.round(Number(item.value.replace(/,/g, '')) * factor);
  const formatted = numeric.toLocaleString('en-US');
  return {
    ...item,
    value: formatted,
    grayOnlyLabel: `全量灰度 ${formatted}`,
  };
});

const buildLanguages = (factor: number): PubgmLanguageItem[] => baseLanguages.map((item) => {
  const count = Math.round(item.count * factor);
  return { ...item, count };
});

const buildFeedback = (factor: number): PubgmFeedbackItem[] => baseFeedback.map((item) => {
  if (item.key === 'positive-negative-ratio') {
    const ratio = 9.1 * factor;
    return { ...item, value: `${ratio.toFixed(2)} : 1` };
  }
  const numeric = Number(item.value.replace('%', '')) * factor;
  return { ...item, value: `${numeric.toFixed(2)}%` };
});

export const getPubgmDashboardData = ({
  dateRange,
  grayOnly = true,
}: {
  dateRange: [string, string];
  grayOnly?: boolean;
}): PubgmDashboardData => {
  const factor = getWeekFactor(dateRange);
  const languages = buildLanguages(factor);
  const total = languages.reduce((sum, item) => sum + item.count, 0);
  const updatedLanguages = languages.map((item) => ({
    ...item,
    percentage: total === 0 ? 0 : Number(((item.count / total) * 100).toFixed(2)),
  }));

  return {
    weekRange: dateRange,
    grayOnly,
    metrics: buildMetrics(factor),
    languageTotal: total,
    languageCount: languages.length,
    top3Share: Number(
      updatedLanguages.slice(0, 3).reduce((sum, item) => sum + item.percentage, 0).toFixed(2),
    ),
    top4Share: Number(
      updatedLanguages.slice(0, 4).reduce((sum, item) => sum + item.percentage, 0).toFixed(2),
    ),
    languages: updatedLanguages,
    feedback: buildFeedback(factor),
  };
};

export const getEmptyPubgmDashboardData = (
  dateRange: [string, string],
): PubgmDashboardData => ({
  weekRange: dateRange,
  grayOnly: true,
  metrics: baseMetrics.map((item) => ({ ...item, value: '--' })),
  languageTotal: 0,
  languageCount: 0,
  top3Share: 0,
  top4Share: 0,
  languages: [],
  feedback: baseFeedback.map((item) => ({ ...item, value: '--' })),
});

export const getInitialPubgmWeekRange = (): [string, string] => (
  getNaturalWeek(PUBGM_DEFAULT_WEEK_DATE)
);
