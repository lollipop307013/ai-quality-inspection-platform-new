import { definePageMeta } from '@/page'
import qualityIcon from '@/assets/platform/quality.svg'

export default definePageMeta({
  menu: {
    label: '质检优化',
    icon: qualityIcon,
    child: {
      label: '质检标准配置',
    },
  },
})
