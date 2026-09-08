import { definePageScenarios } from '@/pageScenario'

const pageScenarios = definePageScenarios({
  default: {
    label: '默认',
    description: '任务卡片列表与触发器列表，进入任务后在同一页面切换到标注工作台。',
  },
})

export type TaskListScenario = keyof typeof pageScenarios

export default pageScenarios
