import { definePageMeta } from '@/page';
import aiAppIcon from '@/assets/platform/zhijilab.svg';
import appListIcon from '@/assets/agent-menu-icon/bot.svg';

export default definePageMeta({
  menu: {
    label: '示例',
    icon: aiAppIcon,
    child: {
      label: '应用管理',
      icon: appListIcon,
    },
  },
});
