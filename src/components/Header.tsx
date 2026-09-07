import React from 'react';
import { Avatar, Divider, Tooltip } from 'antd';
import { QuestionCircleOutlined, RobotOutlined } from '@ant-design/icons';
import IdentitySelector from './IdentitySelector';
import { useCurrentUser } from '../prototypeContext';

interface HeaderProps {
  /** 当前所处的一级菜单分组名称 */
  activeGroupName: string;
}

/** 平台顶部栏：当前平台名称、业务身份切换与全局工具入口。 */
const Header: React.FC<HeaderProps> = ({ activeGroupName }) => {
  const currentUser = useCurrentUser();

  return (
    <div className="platform-header">
      <div className="header-left">
        <span className="current-platform-name">{activeGroupName}</span>
        <Divider style={{ margin: '0 16px' }} type="vertical" />
        <IdentitySelector />
      </div>
      <div className="header-right">
        <div className="header-icon">
          <Tooltip title="AI 助手">
            <div className="icon-question">
              <RobotOutlined />
            </div>
          </Tooltip>
          <Tooltip title="帮助文档">
            <div className="icon-question">
              <QuestionCircleOutlined />
            </div>
          </Tooltip>
        </div>
        <Divider style={{ margin: '0 8px' }} type="vertical" />
        <div className="header-avatar">
          <Avatar
            alt={currentUser.user_name}
            src={currentUser.avatar}
            style={{ backgroundColor: '#005AFF' }}
            size={32}
          />
        </div>
      </div>
    </div>
  );
};

export default Header;
