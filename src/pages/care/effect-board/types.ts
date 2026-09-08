// 主动关怀 - 效果看板 类型定义

export type ChannelName = '小程序' | '企微' | '手Q';

export type ChannelFilterValue = ChannelName | 'all';

export type StrategyStatusKey =
  | 'active'
  | 'paused'
  | 'completed'
  | 'pending'
  | 'testing'
  | 'launch_failed'
  | 'draft';

export type BlockReasonKey =
  | 'freq_limited'
  | 'silent_blocked'
  | 'no_available_channel'
  | 'service_disabled'
  | 'other';

export interface StrategyChannelMetric {
  name: ChannelName;
  send: number;
  reach: number;
}

export interface CareStrategy {
  id: string;
  name: string;
  careTag: string;
  channels: ChannelName[];
  status: StrategyStatusKey;
  /** end 为空表示至今 */
  effective: { start: string; end: string };
  metric: {
    send: number;
    reach: number;
    channels: StrategyChannelMetric[];
  };
}

export type TimeRangePreset = 'today' | 'yesterday' | 'past7' | 'past30' | 'custom';

export interface TimeRange {
  preset: TimeRangePreset;
  start: string;
  end: string;
  days: number;
  label: string;
}

export interface UserReachRecord {
  time: string;
  strategyName: string;
  channel: ChannelName;
  success: boolean;
  reason: BlockReasonKey | null;
}
