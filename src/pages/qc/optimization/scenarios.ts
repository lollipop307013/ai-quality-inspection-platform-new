import { definePageScenarios } from '@/pageScenario'

const pageScenarios = definePageScenarios({
  default: {
    label: '默认',
    description: '当前仅有占位提示，功能暂未还原。',
  },
})

export type OptimizationScenario = keyof typeof pageScenarios

export default pageScenarios
