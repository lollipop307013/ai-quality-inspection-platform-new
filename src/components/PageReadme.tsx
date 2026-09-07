import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Dialog } from 'tdesign-react';

interface PageReadmeProps {
  /** 当前页面的 README 原文，缺省时不渲染 */
  content?: string;
  /** 是否展示弹窗 */
  visible: boolean;
  /** 关闭弹窗 */
  onClose: () => void;
}

/** 页面 README 弹窗，供评审时查看当前页面的交接说明。 */
const PageReadme: React.FC<PageReadmeProps> = ({ content, visible, onClose }) => {
  if (!content) {
    return null;
  }

  return (
    <Dialog
      dialogClassName="page-readme-dialog"
      footer={false}
      header="页面 README"
      placement="center"
      visible={visible}
      width={760}
      onClose={onClose}
    >
      <article className="page-readme-content">
        <ReactMarkdown>{content}</ReactMarkdown>
      </article>
    </Dialog>
  );
};

export default PageReadme;
