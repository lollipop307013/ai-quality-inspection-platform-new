import { definePageScenarios } from '@/pageScenario';

const pageScenarios = definePageScenarios({
  default: {
    label: '正常有任务',
    description: '当前业务下存在覆盖进行中、待分配、待处理三种状态的质检任务卡片。',
  },
  loading: {
    label: '列表加载中',
    description: '首次进入页面，任务列表尚未返回数据，仅保留页面结构和加载反馈。',
  },
  empty: {
    label: '暂无任务',
    description: '当前业务下尚未创建任何人工质检任务。',
  },
  'no-result': {
    label: '筛选无结果',
    description: '任务数据存在，但当前状态筛选或搜索关键词没有匹配结果。',
  },
  error: {
    label: '列表加载失败',
    description: '任务列表请求失败，保留筛选条件并提供重试入口。',
  },
});

export type TaskListScenario = keyof typeof pageScenarios;

export default pageScenarios;
