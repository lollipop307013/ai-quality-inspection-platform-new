import { Button, Card, Progress, Tag } from 'tdesign-react';
import type { TaskStatus, QcTask } from '../mock';
import { TASK_STATUS_LABELS } from '../mock';
import styles from '../index.module.less';

const STATUS_TAG_THEME: Record<TaskStatus, 'primary' | 'success' | 'default'> = {
  in_progress: 'primary',
  pending_assign: 'success',
  pending_process: 'default',
};

interface TaskCardProps {
  /** 待展示的质检任务 */
  task: QcTask;
  /** 点击进入任务标注工作台 */
  onEnter: (task: QcTask) => void;
  /** 点击下载任务信息 */
  onDownload: (task: QcTask) => void;
}

/** 单个质检任务卡片：展示任务基础信息、进度，并提供进入任务与下载入口。 */
export default function TaskCard({ task, onEnter, onDownload }: TaskCardProps) {
  const percentage = task.progressTotal > 0
    ? Math.round((task.progressDone / task.progressTotal) * 100)
    : 0;

  return (
    <Card bordered hoverShadow className={styles.taskCard}>
      <div className={styles.cardTop}>
        <div className={styles.cardTitle}>
          <span title={task.name}>{task.name}</span>
        </div>
        <Tag theme={STATUS_TAG_THEME[task.status]} variant="light">
          {TASK_STATUS_LABELS[task.status]}
        </Tag>
      </div>

      <div className={styles.cardMeta}>
        <span>源自：{task.sourceScene} / {task.sourceEvent} / {task.channel}</span>
        <span>创建时间：{task.createdAt}</span>
      </div>

      <div className={styles.cardProgress}>
        <Progress percentage={percentage} label size="small" />
        <span>{task.progressDone}/{task.progressTotal}</span>
      </div>

      <div className={styles.cardActions}>
        <Button theme="primary" variant="text" onClick={() => onEnter(task)}>进入任务</Button>
        <Button theme="default" variant="text" onClick={() => onDownload(task)}>下载</Button>
      </div>
    </Card>
  );
}
