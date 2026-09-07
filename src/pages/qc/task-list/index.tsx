import { useEffect, useMemo, useState } from 'react';
import { Input, MessagePlugin, Select } from 'tdesign-react';
import type { SelectValue } from 'tdesign-react';
import { usePageScenario } from '@/pageScenario';
import { useCurrentBusiness } from '@/prototypeContext';
import { getTasksByGame, TASK_STATUS_LABELS } from './mock';
import type { QcTask, TaskStatus } from './mock';
import TaskDownloadDialog from './components/TaskDownloadDialog';
import TaskGrid from './components/TaskGrid';
import type { ListLoadState } from './components/TaskGrid';
import type { TaskListScenario } from './scenarios';
import styles from './index.module.less';

const STATUS_FILTER_OPTIONS = [
  { label: '全部状态', value: 'all' },
  ...(Object.entries(TASK_STATUS_LABELS) as [TaskStatus, string][]).map(([value, label]) => ({ label, value })),
];

const PAGE_SIZE = 9;

/** 人工质检任务：按当前业务展示质检任务卡片，支持状态筛选、搜索、进入任务与下载任务信息。 */
export default function TaskListPage() {
  const previewScenario = usePageScenario<TaskListScenario>();
  const { game_id } = useCurrentBusiness();

  const [tasks, setTasks] = useState<QcTask[]>(() => (
    previewScenario === 'empty' ? [] : getTasksByGame(game_id)
  ));
  const [listLoadState, setListLoadState] = useState<ListLoadState>(() => {
    if (previewScenario === 'loading') return 'loading';
    if (previewScenario === 'error') return 'error';
    return 'ready';
  });
  const [statusFilter, setStatusFilter] = useState<SelectValue>('all');
  const [keyword, setKeyword] = useState(previewScenario === 'no-result' ? '不存在的任务名称' : '');
  const [current, setCurrent] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [downloadTarget, setDownloadTarget] = useState<QcTask | null>(null);

  useEffect(() => {
    setTasks(previewScenario === 'empty' ? [] : getTasksByGame(game_id));
    setListLoadState(previewScenario === 'loading' ? 'loading' : previewScenario === 'error' ? 'error' : 'ready');
    setStatusFilter('all');
    setKeyword(previewScenario === 'no-result' ? '不存在的任务名称' : '');
    setCurrent(1);
    setDownloadTarget(null);
  }, [game_id, previewScenario]);

  const filteredTasks = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();

    return tasks.filter((task) => {
      const matchStatus = statusFilter === 'all' || task.status === statusFilter;
      const matchKeyword = !normalizedKeyword || task.name.toLowerCase().includes(normalizedKeyword);
      return matchStatus && matchKeyword;
    });
  }, [tasks, statusFilter, keyword]);

  const pagedTasks = useMemo(() => {
    const start = (current - 1) * pageSize;
    return filteredTasks.slice(start, start + pageSize);
  }, [filteredTasks, current, pageSize]);

  const hasAppliedFilters = statusFilter !== 'all' || Boolean(keyword.trim());

  const reset = () => {
    setStatusFilter('all');
    setKeyword('');
    setCurrent(1);
  };

  const retry = () => {
    setListLoadState('loading');
    window.setTimeout(() => {
      setTasks(getTasksByGame(game_id));
      setListLoadState('ready');
      MessagePlugin.success('任务列表已重新加载');
    }, 360);
  };

  const enterTask = (task: QcTask) => {
    MessagePlugin.info(`「${task.name}」的标注工作台正在按新版视觉迁移中，敬请期待`);
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1>人工质检任务</h1>
          <p>当前业务范围：{game_id}</p>
        </div>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.filters}>
          <Select
            value={statusFilter}
            options={STATUS_FILTER_OPTIONS}
            style={{ width: 160 }}
            onChange={(value) => {
              setStatusFilter(value);
              setCurrent(1);
            }}
          />
          <Input
            value={keyword}
            placeholder="搜索任务名称"
            clearable
            style={{ width: 240 }}
            onChange={(value) => {
              setKeyword(String(value));
              setCurrent(1);
            }}
          />
        </div>
      </div>

      <TaskGrid
        tasks={pagedTasks}
        total={filteredTasks.length}
        hasRawTasks={tasks.length > 0}
        listLoadState={listLoadState}
        hasAppliedFilters={hasAppliedFilters}
        current={current}
        pageSize={pageSize}
        onPageChange={(nextCurrent, nextPageSize) => {
          setCurrent(nextCurrent);
          setPageSize(nextPageSize);
        }}
        onReset={reset}
        onRetry={retry}
        onEnter={enterTask}
        onDownload={setDownloadTarget}
      />

      <TaskDownloadDialog target={downloadTarget} onClose={() => setDownloadTarget(null)} />
    </div>
  );
}
