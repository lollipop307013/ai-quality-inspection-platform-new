import { definePageMeta } from '@/page';
import knowledgeIcon from '@/assets/platform/p_data-analysis.svg';

export default definePageMeta({
  menu: {
    label: '知识库',
    icon: knowledgeIcon,
    child: { label: '内容库', child: { label: '内容库管理' } },
  },
});
