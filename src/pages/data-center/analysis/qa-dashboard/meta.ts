import { definePageMeta } from '@/page';
import dataCenterIcon from '@/assets/platform/p_data-analysis.svg';
import qaDashboardIcon from '@/assets/platform/data-analysis.svg';

export default definePageMeta({
  menu: {
    label: '数据中心',
    icon: dataCenterIcon,
    child: {
      label: '数据分析',
      icon: qaDashboardIcon,
      child: {
        label: '问答数据看板',
      },
    },
  },
});
