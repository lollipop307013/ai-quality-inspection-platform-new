import { definePageMeta } from '@/page';
import qualityIcon from '@/assets/platform/quality.svg';

export default definePageMeta({
  menu: {
    label: '质检优化',
    icon: qualityIcon,
    child: {
      label: '人工质检任务',
    },
  },
});
