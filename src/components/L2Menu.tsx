import React, { useEffect, useMemo, useState } from 'react';
import { Menu } from 'antd';
import type { MenuProps } from 'antd';
import { MenuFoldOutlined, MenuUnfoldOutlined } from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import type { PageMenuItem } from '../page';

interface L2MenuProps {
  /** 当前一级分组下的菜单树，可含多级目录 */
  menuItems: PageMenuItem[];
  /** 是否处于折叠状态 */
  collapsed: boolean;
  /** 切换折叠状态 */
  onToggle: () => void;
}

/** 二级菜单侧边栏，按页面 meta 生成并支持折叠。 */
const L2Menu: React.FC<L2MenuProps> = ({ menuItems, collapsed, onToggle }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const getItemKey = (item: PageMenuItem, ancestors: string[]) => (
    item.children?.length
      ? `submenu:${[...ancestors, item.label].join('/')}`
      : item.path || `item:${[...ancestors, item.label].join('/')}`
  );

  const createItems = (
    source: PageMenuItem[],
    ancestors: string[] = [],
  ): NonNullable<MenuProps['items']> => source.map((item) => ({
    key: getItemKey(item, ancestors),
    icon: item.icon ? (
      <img src={item.icon} alt={item.label} style={{ width: 16, height: 16 }} />
    ) : undefined,
    label: item.label,
    children: item.children?.length
      ? createItems(item.children, [...ancestors, item.label])
      : undefined,
  }));

  const findOpenKeys = (
    source: PageMenuItem[],
    path: string,
    ancestors: string[] = [],
    parentKeys: string[] = [],
  ): string[] | undefined => {
    for (const item of source) {
      if (item.path === path) {
        return parentKeys;
      }

      if (item.children?.length) {
        const itemKey = getItemKey(item, ancestors);
        const match = findOpenKeys(
          item.children,
          path,
          [...ancestors, item.label],
          [...parentKeys, itemKey],
        );

        if (match) {
          return match;
        }
      }
    }

    return undefined;
  };

  const items = useMemo(() => createItems(menuItems), [menuItems]);
  const activeOpenKeys = useMemo(
    () => findOpenKeys(menuItems, location.pathname) || [],
    [location.pathname, menuItems],
  );
  const [openKeys, setOpenKeys] = useState<string[]>(activeOpenKeys);

  useEffect(() => {
    setOpenKeys((current) => Array.from(new Set([...current, ...activeOpenKeys])));
  }, [activeOpenKeys]);

  const onClick: MenuProps['onClick'] = (e) => {
    if (e.key.startsWith('/')) {
      navigate(e.key);
    }
  };

  return (
    <div className={`platform-menu-l2${collapsed ? ' collapsed' : ''}`}>
      <div className="l2-menu-wrapper">
        <Menu
          mode="inline"
          inlineCollapsed={collapsed}
          items={items}
          onClick={onClick}
          openKeys={openKeys}
          onOpenChange={setOpenKeys}
          selectedKeys={[location.pathname]}
        />
      </div>
      <div className="l2-footer" onClick={onToggle}>
        {collapsed ? <MenuUnfoldOutlined style={{ color: '#BCC4D6' }} /> : <MenuFoldOutlined style={{ color: '#BCC4D6' }} />}
        {!collapsed && <span>折叠导航栏</span>}
      </div>
    </div>
  );
};

export default L2Menu;
