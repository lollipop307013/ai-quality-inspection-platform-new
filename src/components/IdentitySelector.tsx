import React from 'react';
import { Dropdown } from 'antd';
import type { MenuProps } from 'antd';
import { DownOutlined } from '@ant-design/icons';
import { usePrototypeBusinessSwitcher } from '../prototypeContext';

/** 顶部栏的业务选择器，切换当前业务上下文。 */
const IdentitySelector: React.FC = () => {
  const {
    businessOptions,
    currentBusiness,
    selectBusiness,
  } = usePrototypeBusinessSwitcher();

  const items: MenuProps['items'] = businessOptions.map((business) => ({
    key: business.project_id,
    label: business.name,
    onClick: () => selectBusiness(business.project_id),
  }));

  return (
    <Dropdown
      menu={{ items, selectable: true, selectedKeys: [currentBusiness.project_id] }}
      trigger={['click']}
    >
      <div className="identity-selector">
        <span className="identity-selector-text">{currentBusiness.name}</span>
        <span className="identity-selector-icon">
          <DownOutlined />
        </span>
      </div>
    </Dropdown>
  );
};

export default IdentitySelector;
