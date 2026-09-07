import { Dialog, MessagePlugin } from 'tdesign-react';
import type { QcTask } from '../mock';
import { TASK_STATUS_LABELS } from '../mock';
import styles from '../index.module.less';

interface TaskDownloadDialogProps {
  /** 当前待下载的任务，为空时对话框关闭 */
  target: QcTask | null;
  /** 关闭对话框 */
  onClose: () => void;
}

function buildTaskCsv(task: QcTask): string {
  const rows = [
    ['任务ID', task.id],
    ['任务名称', task.name],
    ['任务状态', TASK_STATUS_LABELS[task.status]],
    ['来源', `${task.sourceScene} / ${task.sourceEvent} / ${task.channel}`],
    ['创建时间', task.createdAt],
    ['任务进度', `${task.progressDone}/${task.progressTotal}`],
  ];

  return rows.map(([label, value]) => `${label},${value}`).join('\n');
}

function downloadCsv(filename: string, content: string) {
  const blob = new Blob([`\ufeff${content}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** 任务下载确认弹窗：展示任务摘要信息，确认后导出任务信息 CSV。 */
export default function TaskDownloadDialog({ target, onClose }: TaskDownloadDialogProps) {
  const confirmDownload = () => {
    if (!target) return;
    downloadCsv(`任务导出_${target.id}.csv`, buildTaskCsv(target));
    MessagePlugin.success(`导出成功：任务导出_${target.id}.csv`);
    onClose();
  };

  return (
    <Dialog
      visible={Boolean(target)}
      header="导出任务信息"
      confirmBtn="导出 .csv"
      cancelBtn="取消"
      onConfirm={confirmDownload}
      onClose={onClose}
    >
      {target ? (
        <div className={styles.downloadSummary}>
          <div className={styles.downloadRow}>
            <span>任务名称</span>
            <span>{target.name}</span>
          </div>
          <div className={styles.downloadRow}>
            <span>任务状态</span>
            <span>{TASK_STATUS_LABELS[target.status]}</span>
          </div>
          <div className={styles.downloadRow}>
            <span>来源</span>
            <span>{target.sourceScene} / {target.sourceEvent} / {target.channel}</span>
          </div>
          <div className={styles.downloadRow}>
            <span>创建时间</span>
            <span>{target.createdAt}</span>
          </div>
          <div className={styles.downloadRow}>
            <span>任务进度</span>
            <span>{target.progressDone}/{target.progressTotal}</span>
          </div>
        </div>
      ) : null}
    </Dialog>
  );
}
