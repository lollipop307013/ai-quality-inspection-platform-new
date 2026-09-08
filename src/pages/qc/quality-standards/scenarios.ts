import { definePageScenarios } from '@/pageScenario'

const pageScenarios = definePageScenarios({
  default: {
    label: '默认',
    description: '维度/大类/小类/标准四级联动表格，支持逐层新增、编辑、删除，以及导入/导出配置。',
  },
})

export type QualityStandardsScenario = keyof typeof pageScenarios

export default pageScenarios
