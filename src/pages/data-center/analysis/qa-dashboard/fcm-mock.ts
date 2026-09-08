export const FCM_DEFAULT_WEEK_DATE = '2026-07-21';

export interface FcmMetricItem {
  key: string;
  label: string;
  value: string;
  tooltip: string;
  tone: 'default' | 'accent' | 'positive';
}

export interface FcmDailyMessageItem {
  date: string;
  count: number;
}

export interface FcmActiveUserItem {
  rank: number;
  openId: string;
  count: number;
  percentage: number;
  conversations: FcmConversationItem[];
}

export interface FcmConversationItem {
  time: string;
  category: string;
  question: string;
  answer: string;
}

export interface FcmL1Category {
  key: string;
  label: string;
  total: number;
  percentage: number;
  l2: FcmL2Category[];
}

export interface FcmL2Category {
  key: string;
  label: string;
  count: number;
  percentage: number;
  shareInL1: number;
  description: string;
}

export interface FcmCategoryDetailItem {
  id: string;
  l1Key: string;
  l1Label: string;
  l2Key: string;
  l2Label: string;
  description: string;
  count: number;
  percentage: number;
}

export interface FcmTopQuestionItem {
  rank: number;
  question: string;
  count: number;
  category: string;
  categoryKey: string;
  questionDetail: FcmConversationItem[];
}

export interface FcmDashboardData {
  weekRange: [string, string];
  metrics: FcmMetricItem[];
  dailyMessages: FcmDailyMessageItem[];
  activeUsers: FcmActiveUserItem[];
  l1Categories: FcmL1Category[];
  totalL1Percentage: number;
  categoryDetails: FcmCategoryDetailItem[];
  topQuestions: FcmTopQuestionItem[];
  svipPercentage: number;
}

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

const baseMetrics: FcmMetricItem[] = [
  {
    key: 'user-uv',
    label: '用户 UV',
    value: '304',
    tone: 'default',
    tooltip: '周期内发起提问的去重用户数；COUNT(DISTINCT open_id) WHERE sender_type=\'user\'。',
  },
  {
    key: 'message-count',
    label: '用户消息数',
    value: '329',
    tone: 'default',
    tooltip: '周期内用户侧提问消息总条数；COUNT(*) WHERE sender_type=\'user\'。',
  },
  {
    key: 'session-count',
    label: '会话总量',
    value: '822',
    tone: 'default',
    tooltip: '周期内去重 e2e_session_id 数；COUNT(DISTINCT e2e_session_id)。',
  },
  {
    key: 'messages-per-user',
    label: '人均消息数',
    value: '2.70',
    tone: 'accent',
    tooltip: '平均每个用户发出的用户消息数；用户消息数 / 用户 UV。',
  },
  {
    key: 'messages-per-session',
    label: '单次咨询平均消息数',
    value: '2.50',
    tone: 'accent',
    tooltip: '平均每个会话包含的用户消息数；用户消息数 / 会话总量。',
  },
  {
    key: 'follow-up-rate',
    label: '连续追问会话占比',
    value: '50.46%',
    tone: 'positive',
    tooltip: '用户消息数 >= 2 的会话 / 全部会话；反映用户多轮提问的活跃度。',
  },
];

const baseDailyMessages: FcmDailyMessageItem[] = [
  { date: '07-20', count: 190 },
  { date: '07-21', count: 130 },
  { date: '07-22', count: 100 },
  { date: '07-23', count: 120 },
  { date: '07-24', count: 140 },
  { date: '07-25', count: 80 },
  { date: '07-26', count: 65 },
];

const buildConversations = (openId: string): FcmConversationItem[] => [
  {
    time: '07/20 22:21',
    category: '球员',
    question: '焦点 147 姆巴佩，分一下',
    answer: '福宝儿在呢~队长的问题已经收到了😊根据查找到的官方资料，147 姆巴佩（世界焦点）的详细数据如下：…基础信息**-位置：前锋-总评：147-身高：182cm-体重：75kg-国籍：法国-惯用脚：右脚-逆足：5星-花式动作：高级油炸丸子-进攻效率：高-防守效率：低-**六维属性**-速度：92-射门：91-3 传球：86-8 盘带：90-7 防守：65-7 性格：89-9 **关键特性**：铁人、反越位大师、精准射门、天赋异禀、远射大师、盘带大师、外脚背射门、铁肺…从数据上看，这张姆巴佩是典型的顶级速度型前锋。他的双速和射门能力非常突出，配合反越位大师特性，非常适合打快速反击和直塞身后球。5 星逆足和高级油炸丸子花式也保证了他的终结和摆脱能力。队长可以把他当作前场的爆点来使用。',
  },
  {
    time: '07/20 22:24',
    category: '球员卡',
    question: '特性有啥用',
    answer: '福宝儿在呢~队长的问题已经收到了😊球员特性是赋予球员专属赛场表现的被动标签，会在对应场景自动生效，无需手动触发。下面我为你解析一下 147 姆巴佩的几个核心特性作用：-1.**反越位大师**：提升无球跑位和门前嗅觉，接直塞球时跑位更合理，更容易形成单刀机会。-2.**精准射门**：增加射门的弧度和准确率，提升射门得分效率。-3.**天赋异禀**：提升球员在特定情况下的表现，使他更适合现实中的顶级球星风格。-4.**远射大师**：提升远距离射门的精度和力量。-5.**盘带大师**：提升球员的盘球速度，让盘带突破更犀利。-6.**铁肺**：减缓球员在比赛中的耐力值下降速度，可以更长时间保持高强度跑动。-7.**铁人**：增强球员的身体对抗能力，使其在对抗中更稳定。-8.**外脚背射门**：擅长外脚背射门，增加着力的精度和弧度。-简单来说，这些特性让姆巴佩在游戏中成为一个跑位鬼魅、射术精湛、突破犀利且体能充沛的顶级前锋，非常契合他现实中踢球风格。',
  },
  {
    time: '07/20 22:24',
    category: '球员卡',
    question: '145 大马丁呢特性',
    answer: '福宝儿在呢~队长的问题已经收到了😊根据查找到的官方资料，145 能力值的"乔治-马尔蒂什维利（26 欧冠荣耀）"球员卡特性如下：-1.**团队领袖**：提升周围队友的士气，在球队落后时能起到稳定军心的作用。-2.**长传大师**：提升门将手抛球和开大脚的精准度，能快速策动反击。-3.**角球进攻**：在获得角球时，门将也会参与进攻，增加禁区内争顶人数。-4.**铁肺**：减缓耐力下降，让门将能在比赛中更长时间保持高专注度。-5.**铁人**：增强门将的身体对抗能力，在出击和争抢高空球时更稳定。-这张门将卡身高 199cm，模型优势明显，特性组合也让他兼具了稳定的门线技术、出色的传发和反击能力，以及在定位球中的战术价值。-队长还想了解其他内容吗？',
  },
];

const baseActiveUsers: Omit<FcmActiveUserItem, 'conversations'>[] = [
  { rank: 1, openId: '1057E492B3B0AF6F59FE37F3CE2F37C4', count: 26, percentage: 3.16 },
  { rank: 2, openId: 'o5KxB0y8yuCd09yK55MGskqNRa2E', count: 24, percentage: 2.92 },
  { rank: 3, openId: 'o5KxB00g7zascpRhwXagTzT7dQHs', count: 21, percentage: 2.55 },
  { rank: 4, openId: 'o5KxB0xwaPFTpkUcHik2k0UH17Is', count: 15, percentage: 1.82 },
  { rank: 5, openId: 'o5KxB09VKkQ8AwnJMCyZ2acI0LI', count: 15, percentage: 1.82 },
  { rank: 6, openId: 'o5KxB01IzFxLYsXDrw3pMDdW9MwI', count: 14, percentage: 1.7 },
  { rank: 7, openId: 'o5KxB043bWtqtfjhoJd_6dcTr4Fk', count: 14, percentage: 1.7 },
  { rank: 8, openId: 'E65E8447EF8E5E455BCE0CB5DED6BB1C', count: 14, percentage: 1.7 },
  { rank: 9, openId: '711C1BA0C9FA47E4B2E87EB32847F377', count: 13, percentage: 1.58 },
  { rank: 10, openId: '0612FF6FA625A206B2956A298B02417C', count: 12, percentage: 1.46 },
  { rank: 11, openId: 'o5KxB00qrWw-mqL7oJRo9em557Zk', count: 11, percentage: 1.34 },
  { rank: 12, openId: '57BB30DBEA9BF0560C39452F984A6C18', count: 11, percentage: 1.34 },
];

const baseL1Categories: FcmL1Category[] = [
  {
    key: 'chat',
    label: '闲聊',
    total: 350,
    percentage: 41.61,
    l2: [
      { key: 'meaningless', label: '无意义', count: 342, percentage: 40.66, shareInL1: 97.71, description: '问候、闲聊、情绪宣泄等无实质游戏诉求的内容' },
      { key: 'persona', label: '人设', count: 7, percentage: 0.83, shareInL1: 2.0, description: '与 AI 助手身份、名字、能力等相关的对话' },
      { key: 'comment', label: '评价', count: 1, percentage: 0.12, shareInL1: 0.29, description: '对游戏本身的评价、与竞品对比、是否值得玩' },
    ],
  },
  {
    key: 'player',
    label: '球员与球员卡',
    total: 324,
    percentage: 38.55,
    l2: [
      { key: 'player', label: '球员', count: 197, percentage: 23.43, shareInL1: 60.8, description: '具体球员的推荐、对比、获取与养成' },
      { key: 'player-card', label: '球员卡', count: 86, percentage: 10.23, shareInL1: 26.54, description: '球员卡属性、能力值、强化进阶、特性技能等卡片养成' },
      { key: 'lineup', label: '阵容', count: 41, percentage: 4.88, shareInL1: 12.66, description: '整体阵容搭配、阵型套路、球队组建与推荐' },
    ],
  },
  {
    key: 'mechanism',
    label: '玩法机制问题',
    total: 85,
    percentage: 10.11,
    l2: [
      { key: 'game-mode', label: '玩法模式', count: 37, percentage: 4.4, shareInL1: 43.53, description: '游戏模式、操作技巧、战术阵型、机制规则等玩法' },
      { key: 'real-football', label: '现实足球', count: 27, percentage: 3.21, shareInL1: 31.76, description: '现实足球赛事、规则、球员与球星历史等游戏外的足球知识' },
      { key: 'item', label: '道具', count: 16, percentage: 1.9, shareInL1: 18.82, description: '点券、金币、卡包、礼包、代币兑换等道具与货币的使用' },
      { key: 'currency', label: '货币', count: 2, percentage: 0.24, shareInL1: 2.35, description: '转会市场行情、点券金币价格、经济系统与保值问题' },
      { key: 'settings', label: '设置', count: 2, percentage: 0.24, shareInL1: 2.35, description: '帧率、卡顿、延迟、闪退、黑屏、机型适配等性能与设备问题' },
      { key: 'match', label: '匹配', count: 1, percentage: 0.12, shareInL1: 1.18, description: '匹配机制、段位、保星、排位赛规则等' },
    ],
  },
  {
    key: 'event',
    label: '版本活动问题',
    total: 59,
    percentage: 7.18,
    l2: [
      { key: 'event', label: '活动', count: 59, percentage: 7.18, shareInL1: 100, description: '版本活动、签到任务、赛季手册、限时福利等活动相关' },
    ],
  },
  {
    key: 'service',
    label: '服务类问题',
    total: 4,
    percentage: 0.48,
    l2: [
      { key: 'risk', label: '合规风险场景', count: 2, percentage: 0.24, shareInL1: 50, description: '投诉退款、封号解封、实名反洗、外挂作弊、敏感或违规言论等合规与风险问题' },
      { key: 'reward', label: '赏金', count: 1, percentage: 0.12, shareInL1: 25, description: '充值、月卡、通行证、首充、VIP 等付费相关' },
      { key: 'overtime', label: '超核', count: 1, percentage: 0.12, shareInL1: 25, description: '超粒超核/破解版、超核账号相关的咨询' },
    ],
  },
];

const baseTopQuestions: Omit<FcmTopQuestionItem, 'questionDetail'>[] = [
  { rank: 1, question: '福利', count: 6, category: '活动', categoryKey: 'event' },
  { rank: 2, question: '你好', count: 6, category: '无意义', categoryKey: 'meaningless' },
  { rank: 3, question: '梅西', count: 4, category: '球员', categoryKey: 'player' },
  { rank: 4, question: '内马尔', count: 3, category: '无意义', categoryKey: 'meaningless' },
  { rank: 5, question: '怎么查看我的阵容', count: 3, category: '阵容', categoryKey: 'lineup' },
  { rank: 6, question: '好的', count: 2, category: '无意义', categoryKey: 'meaningless' },
  { rank: 7, question: '加点', count: 2, category: '无意义', categoryKey: 'meaningless' },
  { rank: 8, question: '你能看到我的阵容吗？', count: 2, category: '阵容', categoryKey: 'lineup' },
  { rank: 9, question: '148 佩德罗波罗怎么样', count: 2, category: '球员', categoryKey: 'player' },
  { rank: 10, question: '领奖励', count: 1, category: '无意义', categoryKey: 'meaningless' },
  { rank: 11, question: 'c 罗一共出了几张卡', count: 1, category: '球员', categoryKey: 'player' },
  { rank: 12, question: '爱你福宝', count: 1, category: '人设', categoryKey: 'persona' },
  { rank: 13, question: '他和 147 世界之巅 C 罗怎么选', count: 1, category: '球员', categoryKey: 'player' },
  { rank: 14, question: '生日积分', count: 1, category: '无意义', categoryKey: 'meaningless' },
  { rank: 15, question: '一阵位置，然后 147 的拖地和 147 的落地丝只能留一个的话，应该留哪个球员？', count: 1, category: '无意义', categoryKey: 'meaningless' },
  { rank: 16, question: '147 左边锋内马尔世界之巅特性是什么？', count: 1, category: '无意义', categoryKey: 'meaningless' },
  { rank: 17, question: '145-147 左前卫荐', count: 1, category: '无意义', categoryKey: 'meaningless' },
];

const baseQuestionDetail = (category: string): FcmConversationItem[] => [
  {
    time: '07/22 15:30',
    category,
    question: '需要看一下这款球员卡的特性',
    answer: '福宝儿在呢~关于您问到的球员卡，从能力值、特性、可用比赛场景三个维度为您拆解如下：…',
  },
  {
    time: '07/23 09:12',
    category,
    question: '和同位置的球员相比值得练吗',
    answer: '福宝儿在呢~队长可以从稀缺度、版本适配、性价比三方面来评估这张卡是否值得培养：…',
  },
  {
    time: '07/24 21:05',
    category,
    question: '需要怎么搭配阵容',
    answer: '福宝儿在呢~按当前主流的阵容套路，这张卡比较适合放在以下阵型位置：…',
  },
];

const getWeekFactor = (dateRange: [string, string]) => {
  const start = parseDate(dateRange[0]).getTime();
  const end = parseDate(dateRange[1]).getTime();
  const days = Math.max(1, Math.round((end - start) / DAY_MS) + 1);
  if (days !== 7) return 1;
  const startDate = parseDate(dateRange[0]);
  return startDate >= parseDate('2026-07-20') && startDate <= parseDate('2026-07-26')
    ? 1
    : 0.72 + ((startDate.getTime() % 7) / 100);
};

const scaleCount = (value: number, factor: number) => Math.max(1, Math.round(value * factor));

const buildMetrics = (factor: number): FcmMetricItem[] => baseMetrics.map((item) => {
  if (item.key === 'follow-up-rate') {
    const rate = 50.46 * factor;
    return { ...item, value: `${rate.toFixed(2)}%` };
  }
  if (item.key === 'messages-per-user' || item.key === 'messages-per-session') {
    const numeric = Number(item.value) * factor;
    return { ...item, value: numeric.toFixed(2) };
  }
  const numeric = scaleCount(Number(item.value), factor);
  return { ...item, value: numeric.toLocaleString('en-US') };
});

const buildDailyMessages = (factor: number): FcmDailyMessageItem[] => (
  baseDailyMessages.map((item) => ({ ...item, count: scaleCount(item.count, factor) }))
);

const buildActiveUsers = (factor: number): FcmActiveUserItem[] => baseActiveUsers.map((item) => ({
  ...item,
  count: scaleCount(item.count, factor),
  percentage: Number((item.percentage * factor).toFixed(2)),
  conversations: buildConversations(item.openId),
}));

const buildL1Categories = (factor: number): FcmL1Category[] => baseL1Categories.map((l1) => {
  const scaledL2 = l1.l2.map((l2) => ({
    ...l2,
    count: scaleCount(l2.count, factor),
  }));
  const total = scaledL2.reduce((sum, item) => sum + item.count, 0);
  return {
    ...l1,
    total,
    percentage: Number(((total / 822) * 100).toFixed(2)),
    l2: scaledL2.map((l2) => ({
      ...l2,
      percentage: Number(((l2.count / 822) * 100).toFixed(2)),
      shareInL1: total === 0 ? 0 : Number(((l2.count / total) * 100).toFixed(2)),
    })),
  };
});

const buildCategoryDetails = (categories: FcmL1Category[]): FcmCategoryDetailItem[] => (
  categories.flatMap((l1) => l1.l2.map((l2) => ({
    id: `${l1.key}-${l2.key}`,
    l1Key: l1.key,
    l1Label: l1.label,
    l2Key: l2.key,
    l2Label: l2.label,
    description: l2.description,
    count: l2.count,
    percentage: l2.percentage,
  })))
);

const buildTopQuestions = (factor: number): FcmTopQuestionItem[] => baseTopQuestions.map((item) => ({
  ...item,
  count: scaleCount(item.count, factor),
  questionDetail: baseQuestionDetail(item.category),
}));

export const getFcmDashboardData = ({
  dateRange,
}: {
  dateRange: [string, string];
}): FcmDashboardData => {
  const factor = getWeekFactor(dateRange);
  const l1Categories = buildL1Categories(factor);
  const totalL1Percentage = Number(
    l1Categories.reduce((sum, item) => sum + item.percentage, 0).toFixed(2),
  );

  return {
    weekRange: dateRange,
    metrics: buildMetrics(factor),
    dailyMessages: buildDailyMessages(factor),
    activeUsers: buildActiveUsers(factor),
    l1Categories,
    totalL1Percentage,
    categoryDetails: buildCategoryDetails(l1Categories),
    topQuestions: buildTopQuestions(factor),
    svipPercentage: Number((60.34 * factor).toFixed(2)),
  };
};

export const getEmptyFcmDashboardData = (
  dateRange: [string, string],
): FcmDashboardData => ({
  weekRange: dateRange,
  metrics: baseMetrics.map((item) => ({ ...item, value: '--' })),
  dailyMessages: [],
  activeUsers: baseActiveUsers.map((item) => ({ ...item, count: 0, conversations: [] })),
  l1Categories: [],
  totalL1Percentage: 0,
  categoryDetails: [],
  topQuestions: [],
  svipPercentage: 0,
});

export const getInitialFcmWeekRange = (): [string, string] => (
  getNaturalWeek(FCM_DEFAULT_WEEK_DATE)
);
