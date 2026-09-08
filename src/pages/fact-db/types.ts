export type ContentLanguage = "zh" | "en" | "ar" | "tr" | "ru" | "yue";

/** 编辑窗口中的多语言字段；中文主字段继续兼容旧数据结构。 */
export type LocalizedContent = Partial<Record<ContentLanguage, {
  title?: string;
  content?: string;
  description?: string;
  alias?: string;
  timeDesc?: string;
}>>;

export interface Entity {
  id: number;
  title: string;
  tag: string;
  /** 多选分类，tag 保留为兼容旧列表的主分类。 */
  categories?: string[];
  /** 正式线上数据标记；待审核候选仅存在于内容审核任务。 */
  status: "已上线";
  source: string;
  description: string;
  alias?: string;
  /** 多语言别名与描述。 */
  translations?: LocalizedContent;
  /** 是否作为分类节点使用。 */
  isCategory?: boolean;
  logs?: OperationLog[];
}

/** 事件的时间定义方式：时间跨度（有明确起止）/ 固定周期（按星期重复）/ 固定周期+时间跨度（有限期周期）/ 时间未定 */
export type EventTimeType = "span" | "recurring" | "hybrid" | "undetermined";

export interface GameEvent {
  id: number;
  name: string;
  description: string;
  eventType: string;
  /** 多选分类，eventType 保留为兼容旧筛选与列表的主分类。 */
  categories?: string[];
  /** 多语言别名、描述和时间说明。 */
  translations?: LocalizedContent;
  /** 正式线上数据标记；待审核候选仅存在于内容审核任务。 */
  status: "已上线";
  /** 时间定义方式，默认视为 span（兼容旧数据） */
  timeType?: EventTimeType;
  /** timeType=span 时的起止时间；仍保留字符串格式以兼容旧展示，"-" 表示未设置/进行中无结束时间 */
  startTime: string;
  endTime: string;
  /** timeType=recurring 时按星期重复的日期，1=周一...7=周日 */
  recurringWeekdays?: number[];
  /** timeType=recurring/hybrid 时每次持续的起止时刻（HH:mm） */
  recurringTimeRange?: [string, string];
  /** timeType=recurring/hybrid 时单次持续天数（1=当日，2=跨两天） */
  recurringDurationDays?: number;
  /** timeType=recurring/hybrid 的规则文字描述（如"每周三、周五 19:00-21:00"）；timeType=undetermined 时用于说明原因（如"预计Q3上线，具体时间待定"） */
  timeDesc?: string;
  source: string;
  remark: string;
  alias?: string;
  logs?: OperationLog[];
}

/** 事件表单分类值，复用事件数据模型的定义。 */
export type EventTagValue = GameEvent["eventType"];

/** 事实来源环境 */
export type FactEnv = "test" | "prod";

export interface Fact {
  id: number;
  title: string;
  content: string;
  status: FactStatus;
  keywords: string;
  category: string;
  env?: FactEnv;
  sourceType?: string;
  source?: string;
  sourceUrl?: string;
  sourceContent?: string;
  /** 多语言事实内容与时间说明。 */
  translations?: LocalizedContent;
  /** 关联实体 ID；keywords 继续兼容旧列表展示。 */
  relatedEntityIds?: string[];
  conflictReason?: string;
  startTime?: string;
  endTime?: string;
  timeDesc?: string;
  relatedEvents?: string;
  conflict?: string;
  duplicate?: string;
  /** upload_status：后端自动维护的同步状态（pending/need_update/done/failed） */
  uploadStatus?: UploadStatus;
  /** 兼容旧 demo 字段：向量同步状态（success/failed/pending） */
  syncStatus?: SyncStatus;
  /** 同步失败时的错误信息（用于运维排查） */
  syncError?: string;
  /** 最近一次同步时间 */
  syncAt?: string;
  logs?: OperationLog[];
}

/** upload_status：后端自动维护的同步状态 */
export type UploadStatus = "pending" | "need_update" | "done" | "failed";

/** 兼容旧 demo 字段：success 占绝大多数（保存即同步），failed 用于暴露需要关注的异常 */
export type SyncStatus = "success" | "failed" | "pending";

/** 抽取缓冲池条目：提取后先进缓冲池，审核通过才入库 */
export interface ExtractBufferItem {
  bufferId: string;         // 缓冲池唯一ID
  extractedAt: string;      // 提取时间
  content: string;          // 事实内容
  title: string;
  category: string;
  entities: string[];
  newEntities: string[];
  events: string[];
  newEvents: string[];
  startTime: string;
  endTime: string;
  timeDesc: string;
  conflict: {
    detected: boolean;
    reason: string;
    factId: string;
    factContent: string;
  } | null;
  bufferStatus: "待审核" | "已审核" | "已拒绝"; // 缓冲池内的审核状态
}

/** 单条操作日志 */
export interface OperationLog {
  id: number;
  operator: string;
  time: string;
  action: "创建-手动" | "创建-导入" | "编辑" | "状态变更" | "回退" | "同步" | "删除";
  detail: string;
}

/**
 * 正式事实的线上业务状态：
 *   已上线 ⇄ 已下线
 * 待审核、通过、拒绝均由内容审核任务维护，不进入事实管理列表或事实数据模型。
 */
export type FactStatus = "已上线" | "已下线";

/** 正式线上事实可执行的业务状态流转。 */
export const STATUS_TRANSITIONS: Record<FactStatus, FactStatus[]> = {
  "已上线": ["已下线"],
  "已下线": ["已上线"],
};

export interface CategoryNode {
  name: string;
  count: number;
  children?: CategoryNode[];
  expanded?: boolean;
}

export type TabId = "entity" | "event" | "fact" | "extract" | "qa" | "error-detect";
