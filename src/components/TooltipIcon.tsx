import React from 'react';
import { Tooltip } from 'tdesign-react';
import { QuestionCircleOutlined } from '@ant-design/icons';

interface TooltipIconProps {
  /** 提示内容，用于解释字段口径或操作影响 */
  content: string;
  /** 覆盖图标的默认样式 */
  style?: React.CSSProperties;
}

/** 字段或操作旁的问号提示图标，承载简短说明。 */
const TooltipIcon: React.FC<TooltipIconProps> = ({ content, style }) => {
  return (
    <Tooltip content={content}>
      <QuestionCircleOutlined
        style={{
          color: 'var(--td-text-color-placeholder)',
          cursor: 'pointer',
          marginLeft: 4,
          fontSize: 14,
          ...style,
        }}
      />
    </Tooltip>
  );
};

export default TooltipIcon;
