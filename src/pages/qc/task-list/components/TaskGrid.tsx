import { Button, Empty, Loading, Pagination } from 'tdesign-react';
import type { QcTask } from '../mock';
import TaskCard from './TaskCard';
import styles from '../index.module.less';

export type ListLoadState = 'ready' | 'loading' | 'error';

interface TaskGridProps {
  /** 当前分页内的任务卡片 */
  tasks: QcTask[];
  /** 未分页前的筛选结果总数 */
  total: number;
  /** 是否存在业务下的原始任务（用于区分“暂无任务”与“筛选无结果”） */
  hasRawTasks: boolean;
  /** 列表加载状态 */
  listLoadState: ListLoadState;
  /** 当前是否存在已生效的筛选条件 */
  hasAppliedFilters: boolean;
  /** 当前页码 */
  current: number;
  /** 每页数量 */
  pageSize: number;
  /** 分页变化 */
  onPageChange: (current: number, pageSize: number) => void;
  /** 清空筛选条件 */
  onReset: () => void;
  /** 加载失败后重试 */
  onRetry: () => void;
  /** 进入任务 */
  onEnter: (task: QcTask) => void;
  /** 下载任务信息 */
  onDownload: (task: QcTask) => void;
}

/** 质检任务卡片网格：负责空态、加载态、错误态与分页展示。 */
export default function TaskGrid({
  tasks,
  total,
  hasRawTasks,
  listLoadState,
  hasAppliedFilters,
  current,
  pageSize,
  onPageChange,
  onReset,
  onRetry,
  onEnter,
  onDownload,
}: TaskGridProps) {
  if (listLoadState === 'error') {
    return (
      <div className={styles.tableState}>
        <Empty
          action={<Button theme="primary" onClick={onRetry}>重新加载</Button>}
          description="请检查网络后重试，当前筛选条件已保留"
          title="任务列表加载失败"
          type="network-error"
        />
      </div>
    );
  }

  return (
    <Loading loading={listLoadState === 'loading'} text="任务列表加载中">
      {listLoadState === 'loading' ? (
        <div className={styles.loadingPlaceholder} />
      ) : tasks.length > 0 ? (
        <>
          <div className={styles.cardGrid}>
            {tasks.map((task) => (
              <TaskCard key={task.id} task={task} onEnter={onEnter} onDownload={onDownload} />
            ))}
          </div>
          <div className={styles.pagination}>
            <Pagination
              current={current}
              pageSize={pageSize}
              total={total}
              showJumper
              pageSizeOptions={[9, 18, 36]}
              onChange={(pageInfo) => onPageChange(pageInfo.current, pageInfo.pageSize)}
            />
          </div>
        </>
      ) : (
        <div className={styles.tableState}>
          {hasAppliedFilters ? (
            <Empty
              action={<Button variant="outline" onClick={onReset}>清除筛选条件</Button>}
              description="请调整状态筛选或搜索关键词后重新查询"
              title="未找到符合条件的任务"
            />
          ) : (
            <Empty
              description={hasRawTasks ? '当前业务下暂无匹配任务' : '当前业务下尚未创建人工质检任务'}
              title="暂无任务"
            />
          )}
        </div>
      )}
    </Loading>
  );
}
