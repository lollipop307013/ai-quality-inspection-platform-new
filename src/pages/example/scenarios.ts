import { definePageScenarios } from '@/pageScenario';

const pageScenarios = definePageScenarios({
  default: {
    label: '正常有数据',
    description: '默认筛选条件下展示可管理的应用列表。',
  },
  loading: {
    label: '列表加载中',
    description: '首次进入页面，列表尚未返回数据，仅保留页面结构和加载反馈。',
  },
  empty: {
    label: '暂无应用',
    description: '当前空间尚未创建应用，可直接进入新建流程。',
  },
  'no-result': {
    label: '筛选无结果',
    description: '应用数据存在，但当前筛选条件没有匹配结果。',
  },
  error: {
    label: '列表加载失败',
    description: '应用列表请求失败，保留筛选上下文并提供重试入口。',
  },
  boundary: {
    label: '边界内容',
    description: '使用长应用名称和负责人姓名检查表格内容承载能力。',
  },
});

export type ExamplePageScenario = keyof typeof pageScenarios;

export default pageScenarios;
