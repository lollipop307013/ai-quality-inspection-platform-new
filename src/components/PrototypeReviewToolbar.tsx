import { useState } from 'react';
import { CodeOutlined, FileTextOutlined, ToolOutlined } from '@ant-design/icons';
import { Button, Popup, Select } from 'tdesign-react';
import PageReadme from './PageReadme';
import { usePageScenarioController } from '../pageScenario';

interface PrototypeReviewToolbarProps {
  /** 当前页面的 README 原文 */
  readmeContent?: string;
}

/** 原型评审工具入口：切换页面预览场景并查看页面 README。 */
const PrototypeReviewToolbar = ({ readmeContent }: PrototypeReviewToolbarProps) => {
  const [toolVisible, setToolVisible] = useState(false);
  const [readmeVisible, setReadmeVisible] = useState(false);
  const { scenario, scenarios, setScenario } = usePageScenarioController();
  const currentScenario = scenarios[scenario];
  const scenarioOptions = Object.entries(scenarios).map(([value, definition]) => ({
    label: definition.label,
    value,
  }));

  const toolPanel = (
    <div className="prototype-tool-panel">
      <div className="prototype-tool-panel-header">
        <div className="prototype-tool-window-controls" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
        <div className="prototype-tool-panel-title">
          <CodeOutlined />
          <span>PROTOTYPE TOOLS</span>
        </div>
        <span className="prototype-tool-environment">LOCAL</span>
      </div>

      <div className="prototype-tool-panel-body">
        <div className="prototype-tool-section-header">
          <span>预览场景</span>
          <code>{scenario}</code>
        </div>
        <Select
          className="prototype-tool-state-select"
          options={scenarioOptions}
          popupProps={{ zIndex: 6200 }}
          value={scenario}
          onChange={(value) => setScenario(String(value))}
        />
        <p className="prototype-tool-state-description">
          {currentScenario.description}
        </p>

        {readmeContent && (
          <Button
            className="prototype-tool-readme-entry"
            icon={<FileTextOutlined />}
            theme="default"
            variant="outline"
            type="button"
            onClick={() => {
              setToolVisible(false);
              setReadmeVisible(true);
            }}
          >
            查看页面 README
          </Button>
        )}

        <div className="prototype-tool-panel-status">
          <i />
          <span>预览场景已同步到当前链接</span>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {!readmeVisible && (
        <aside className="prototype-review-toolbar" aria-label="原型评审工具">
          <Popup
            content={toolPanel}
            destroyOnClose
            overlayInnerClassName="prototype-tool-popup"
            placement="top-right"
            showArrow={false}
            trigger="click"
            visible={toolVisible}
            zIndex={6100}
            onVisibleChange={setToolVisible}
          >
            <div
              className={`prototype-tool-trigger-wrap${toolVisible ? ' is-open' : ''}`}
              title={`原型工具 · 当前预览场景：${currentScenario.label}`}
            >
              <span className="prototype-tool-scenario-badge">
                <i aria-hidden="true" />
                <span>{currentScenario.label}</span>
              </span>
              <Button
                aria-label={`打开原型工具，当前预览场景：${currentScenario.label}`}
                className="prototype-tool-trigger"
                icon={<ToolOutlined />}
                shape="square"
                size="large"
                type="button"
              />
            </div>
          </Popup>
        </aside>
      )}

      <PageReadme
        content={readmeContent}
        visible={readmeVisible}
        onClose={() => setReadmeVisible(false)}
      />
    </>
  );
};

export default PrototypeReviewToolbar;
