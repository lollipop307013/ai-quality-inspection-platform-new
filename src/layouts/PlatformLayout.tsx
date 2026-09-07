import React, { useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import L2Menu from '../components/L2Menu';
import Header from '../components/Header';
import PrototypeReviewToolbar from '../components/PrototypeReviewToolbar';
import {
  getFirstPageMenuPath,
  pageMenuContainsPath,
  type PageMenuGroup,
} from '../page';
import { PageScenarioBoundary, PageScenarioProvider } from '../pageScenario';
import type { PageScenarioDefinitions } from '../pageScenario';
import { PrototypeContextProvider } from '../prototypeContext';
import zhijiLogo from '../assets/platform/zhiji-logo.png';
import ArrowLeftSvg from '../assets/platform/arrow-left.svg';
import './PlatformLayout.less';

const L2_DEFAULT_COLLAPSED_GROUPS = ['工作台'];

interface PlatformLayoutProps {
  /** 由各页面 meta 自动汇总的菜单树 */
  menu: PageMenuGroup[];
  /** 按页面路由索引的 README 原文 */
  pageReadmes: Record<string, string>;
  /** 按页面路由索引的预览场景声明 */
  pageScenarios: Record<string, PageScenarioDefinitions>;
}

/** 平台 AppShell：顶部栏、一二级菜单、页面容器与原型评审工具入口。 */
const PlatformLayout: React.FC<PlatformLayoutProps> = ({
  menu,
  pageReadmes,
  pageScenarios,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [l1Collapsed, setL1Collapsed] = useState(false);
  const [l2Collapsed, setL2Collapsed] = useState(true);

  const activeGroup = useMemo(() => {
    return menu.find((group) => pageMenuContainsPath(group, location.pathname))
      ?? menu[0];
  }, [location.pathname, menu]);

  useEffect(() => {
    setL2Collapsed(L2_DEFAULT_COLLAPSED_GROUPS.includes(activeGroup?.label ?? ''));
  }, [activeGroup?.label]);

  const currentPath = location.pathname.replace(/\/+$/, '') || '/';
  const defaultPagePath = menu[0] ? getFirstPageMenuPath(menu[0]) : undefined;
  const currentScenarios = pageScenarios[currentPath]
    ?? (defaultPagePath ? pageScenarios[defaultPagePath] : undefined);

  if (!currentScenarios) {
    return null;
  }

  return (
    <PrototypeContextProvider>
      <PageScenarioProvider scenarios={currentScenarios}>
        <div className="platform-container">
          {/* A区: 一级菜单 L1 */}
          <div className={`platform-nav-l1${l1Collapsed ? ' collapsed' : ''}`}>
            <div className="l1-header">
              <div className="l1-logo-area" onClick={() => navigate('/')}>
                <div className="platform-logo">
                  <img src={zhijiLogo} alt="知几" className="logo-image" />
                </div>
              </div>
            </div>

            <div className="l1-list">
              {menu.map((group) => {
                const destination = getFirstPageMenuPath(group);

                return (
                  <div
                    key={group.label}
                    className={`l1-item${activeGroup?.label === group.label ? ' active' : ''}`}
                    onClick={() => destination && navigate(destination)}
                  >
                    <div className="l1-icon-box">
                      <img src={group.icon || zhijiLogo} alt={group.label} />
                    </div>
                    {!l1Collapsed && (
                      <div className="l1-name-box">
                        <div className="l1-name">{group.label}</div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {!l1Collapsed && (
              <div className="l1-footer">
                <div className="collapse-trigger" onClick={() => setL1Collapsed(!l1Collapsed)}>
                  <img src={ArrowLeftSvg} alt="" />
                </div>
              </div>
            )}
          </div>

          {/* 展开按钮（收起时显示） */}
          {l1Collapsed && (
            <div className="expand-l1-trigger" onClick={() => setL1Collapsed(false)}>
              <img src={ArrowLeftSvg} alt="" style={{ transform: 'rotate(180deg)' }} />
            </div>
          )}

          {/* 右侧主容器 */}
          <div className={`platform-main-wrapper${l1Collapsed ? ' full-width' : ''}`}>
            {/* C区: 顶部导航 */}
            <Header activeGroupName={activeGroup?.label || 'ZhijiLab'} />

            <div className="platform-body">
              {/* B区: 二级菜单 L2 */}
              {activeGroup && activeGroup.children.length > 0 && (
                <L2Menu
                  menuItems={activeGroup.children}
                  collapsed={l2Collapsed}
                  onToggle={() => setL2Collapsed((prev) => !prev)}
                />
              )}

              {/* D区: 主内容区 */}
              <div className="platform-content">
                <PageScenarioBoundary>
                  <Outlet />
                </PageScenarioBoundary>
              </div>
            </div>
          </div>

          <PrototypeReviewToolbar
            key={currentPath}
            readmeContent={pageReadmes[currentPath]}
          />
        </div>
      </PageScenarioProvider>
    </PrototypeContextProvider>
  );
};

export default PlatformLayout;
