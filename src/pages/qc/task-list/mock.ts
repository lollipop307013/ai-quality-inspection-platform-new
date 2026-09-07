export type TaskStatus = 'in_progress' | 'pending_assign' | 'pending_process';

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  in_progress: '进行中',
  pending_assign: '待分配',
  pending_process: '待处理',
};

export interface QcTask {
  id: string;
  gameId: string;
  name: string;
  status: TaskStatus;
  sourceScene: string;
  sourceEvent: string;
  channel: string;
  createdAt: string;
  progressDone: number;
  progressTotal: number;
}

export const QC_TASKS: QcTask[] = [
  {
    id: 'task-delta-sdk',
    gameId: 'mock-game-delta',
    name: '三角洲行动 · SDK 质检',
    status: 'in_progress',
    sourceScene: '三角洲行动',
    sourceEvent: '测量行动',
    channel: 'SDK',
    createdAt: '2026-07-22',
    progressDone: 216,
    progressTotal: 587,
  },
  {
    id: 'task-delta-weixin',
    gameId: 'mock-game-delta',
    name: '三角洲行动 · 微信质检',
    status: 'pending_process',
    sourceScene: '三角洲行动',
    sourceEvent: '测量行动',
    channel: '微信',
    createdAt: '2026-07-22',
    progressDone: 0,
    progressTotal: 587,
  },
  {
    id: 'task-delta-app',
    gameId: 'mock-game-delta',
    name: '三角洲行动 · App 质检',
    status: 'pending_assign',
    sourceScene: '三角洲行动',
    sourceEvent: '离线回归',
    channel: 'App',
    createdAt: '2026-04-14',
    progressDone: 0,
    progressTotal: 518,
  },
  {
    id: 'task-zhijilab-web',
    gameId: 'mock-game-zhijilab',
    name: 'ZhijiLab 默认项目组 · Web 质检',
    status: 'pending_assign',
    sourceScene: 'ZhijiLab 默认项目组',
    sourceEvent: '线上灰度',
    channel: 'Web',
    createdAt: '2026-04-14',
    progressDone: 0,
    progressTotal: 430,
  },
  {
    id: 'task-aiplatform-sdk',
    gameId: 'mock-game-ai-platform',
    name: 'AI 平台项目组 · SDK 质检',
    status: 'in_progress',
    sourceScene: 'AI 平台项目组',
    sourceEvent: '常规巡检',
    channel: 'SDK',
    createdAt: '2026-06-02',
    progressDone: 342,
    progressTotal: 400,
  },
];

export function getTasksByGame(gameId: string): QcTask[] {
  return QC_TASKS.filter((task) => task.gameId === gameId);
}
