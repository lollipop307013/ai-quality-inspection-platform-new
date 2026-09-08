import { definePageMeta } from '@/page';
import operationsIcon from '@/assets/platform/p_system.svg';
import careIcon from '@/assets/agent-menu-icon/heart.svg';

export default definePageMeta({
  menu: {
    label: '运营工具',
    icon: operationsIcon,
    child: {
      label: '主动关怀',
      icon: careIcon,
      child: {
        label: '效果看板',
      },
    },
  },
});
