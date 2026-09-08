import { definePageScenarios } from '@/pageScenario';

const pageScenarios = definePageScenarios({
  default: {
    label: '正常有数据',
    description: '默认助理、自然周和全部渠道下展示完整指标与图表。',
  },
  loading: {
    label: '看板加载中',
    description: '首次进入看板，指标与图表尚未返回数据，仅保留页面结构和加载反馈。',
  },
  empty: {
    label: '当前范围无数据',
    description: '筛选条件有效，但当前自然周和渠道范围内尚无统计数据。',
  },
  error: {
    label: '看板加载失败',
    description: '核心指标与图表请求失败，保留筛选条件并支持重试。',
  },
});

export type AssistantDashboardScenario = keyof typeof pageScenarios;

export default pageScenarios;
