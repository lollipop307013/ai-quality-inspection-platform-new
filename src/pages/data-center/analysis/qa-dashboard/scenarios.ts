import { definePageScenarios } from '@/pageScenario';

const pageScenarios = definePageScenarios({
  default: {
    label: '周报正常有数据',
    description: '默认展示上一自然周的指标环比、按日趋势和高频问题。',
  },
  detailed: {
    label: '详细数据筛选',
    description: '默认进入近 7 天详细视图，可切换日期快捷项和按日、按周统计粒度。',
  },
  business: {
    label: '业务看板',
    description: '切换到业务看板，展示按当前业务（game_id）定制的看板，当前业务未配置时展示空态。',
  },
  loading: {
    label: '看板加载中',
    description: '统计请求处理中，保留当前页面结构并显示统一加载反馈。',
  },
  empty: {
    label: '统计周期无数据',
    description: '筛选条件有效但没有问答记录，指标、趋势和高频问题展示对应空态。',
  },
  error: {
    label: '看板加载失败',
    description: '统计请求失败，保留视图与筛选条件并支持重新加载。',
  },
});

export type QaDashboardScenario = keyof typeof pageScenarios;

export default pageScenarios;
