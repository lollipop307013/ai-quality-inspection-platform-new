// 二期「审核任务」模块类型定义
// 对齐 PRD（子1内容同步审核 / 子2已入库改动审核 / 子3合并）与线上 demo（统一审核平台）

/**
 * 审核来源类型（决定任务标签与分组）
 * 注：手动新增/编辑（内容同学在实体管理/事件管理/事实管理等页面直接操作）不经过统一审核，直接生效；
 * 只有未经过人工 review 的内容（自动同步、QA 导入、挖掘发现、批量导入等）才会进入审核任务。
 */
export type ReviewSource =
  | "sync-delta"   // 内容同步-增量变动（覆盖更新）
  | "sync-new"     // 内容同步-新增事实
  | "qa-new"       // QA 新建（事实新增）
  | "qa-update"    // QA 更新（事实变更）
  | "qa-offline"   // QA 下线（事实删除）
  | "mining"       // 相似错误挖掘
  | "recheck"      // 勾选待复审
  | "import";      // Excel 批量导入

/** 来源分组（筛选器用） */
export const REVIEW_SOURCE_GROUPS: { group: string; options: { label: string; value: ReviewSource }[] }[] = [
  {
    group: "内容同步",
    options: [
      { label: "增量变动", value: "sync-delta" },
      { label: "新增事实", value: "sync-new" },
    ],
  },
  {
    group: "QA 联动",
    options: [
      { label: "QA 新建（事实新增）", value: "qa-new" },
      { label: "QA 更新（事实变更）", value: "qa-update" },
      { label: "QA 下线（事实删除）", value: "qa-offline" },
    ],
  },
  {
    group: "其他来源",
    options: [
      { label: "勾选待复审", value: "recheck" },
      { label: "相似错误挖掘", value: "mining" },
      { label: "Excel 导入", value: "import" },
    ],
  },
];

export const REVIEW_SOURCE_LABELS: Record<ReviewSource, string> = {
  "sync-delta": "同步增量变动",
  "sync-new": "同步新增事实",
  "qa-new": "QA 新建（事实新增）",
  "qa-update": "QA 更新（事实变更）",
  "qa-offline": "QA 下线（事实删除）",
  "mining": "相似错误挖掘",
  "recheck": "勾选待复审",
  "import": "Excel 批量导入",
};

/** 来源标签配色（TDesign tag theme / 或自定义色） */
export const REVIEW_SOURCE_THEME: Record<ReviewSource, string> = {
  "sync-delta": "#0052d9",
  "sync-new": "#0052d9",
  "qa-new": "#722ed1",
  "qa-update": "#722ed1",
  "qa-offline": "#722ed1",
  "mining": "#fa8c16",
  "recheck": "#13c2c2",
  "import": "#52c41a",
};

/** 变更类型 */
export type ChangeType = "new" | "update" | "delete";

export const CHANGE_TYPE_LABELS: Record<ChangeType, string> = {
  new: "新增",
  update: "覆盖",
  delete: "删除",
};

/** 审核对象类型（内容类型仅事实/实体/事件三类；QA 导入等最终落地为事实） */
export type ReviewObjectType = "fact" | "entity" | "event";

export const OBJECT_TYPE_LABELS: Record<ReviewObjectType, string> = {
  fact: "事实",
  entity: "实体",
  event: "事件",
};

/** 审核优先级 */
export type ReviewPriority = "high" | "medium" | "low";

export const PRIORITY_LABELS: Record<ReviewPriority, string> = {
  high: "高",
  medium: "中",
  low: "低",
};

/** 候选/冲突/重复/覆盖关系类型，原始视图统一使用同一组标签颜色。 */
export type ReviewConflictType = "conflict" | "contradiction" | "duplicate" | "cover";

export const CONFLICT_TYPE_LABELS: Record<ReviewConflictType, string> = {
  conflict: "冲突",
  contradiction: "冲突",
  duplicate: "重复",
  cover: "覆盖",
};

/** 机器预判涉及的具体对象 */
export interface MachineHintObject {
  /** 对象 ID，如 "#10118" */
  id: string;
  /** 与待审数据的对比说明 */
  note?: string;
}

/**
 * 机器预判提示：来自同步 / 导入流水线的结构化分析结果，
 * 在审核详情顶部集中展示，供审核员决策参考（不直接决定结论）。
 */
export interface ReviewMachineHints {
  /** 冲突判定原因 */
  conflictReason?: string;
  /** 判定为冲突的对象 */
  conflictObjects?: MachineHintObject[];
  /** 判定为语义重复的候选对象 */
  duplicateObjects?: MachineHintObject[];
  /** 术语翻译参考：待审内容中的专有名词及建议译名 */
  termRefs?: { term: string; reference: string }[];
}

/** 条目审核状态 */
export type ItemReviewStatus = "pending" | "approved" | "rejected";

/** 来源置信度：高置信度入库即 ready，低置信度进审核池 */
export type SourceConfidence = "high" | "low";

/** 审核详情支持的内容语言，与接口 language 参数保持一致。 */
export type ReviewLanguage = "zh" | "en" | "ar" | "tr" | "ru" | "zh-hk";

export const REVIEW_LANGUAGE_OPTIONS: { value: ReviewLanguage; label: string }[] = [
  { value: "zh", label: "中文" },
  { value: "en", label: "English" },
  { value: "ar", label: "العربية" },
  { value: "tr", label: "Türkçe" },
  { value: "ru", label: "Русский" },
  { value: "zh-hk", label: "粤语" },
];

/** 指定语言下同一字段的线上与待审值。 */
export interface FieldTranslationDiff {
  oldValue: string;
  newValue: string;
}

/** 一个字段的新旧版本对比 */
export interface FieldDiff {
  field: string;        // 字段名（fact_text / time_description / title ...）
  label: string;        // 中文展示名
  oldValue: string;     // 旧版内容（空表示无）
  newValue: string;     // 新版内容
  /** 非中文内容的字段差异；未下发时该语言展示为空。 */
  translations?: Partial<Record<Exclude<ReviewLanguage, "zh">, FieldTranslationDiff>>;
}

/** 线上或候选对象的字段快照。 */
export interface ReviewFieldSnapshot {
  field: string;
  label: string;
  value: string;
  /** 非中文字段值，用于与待审版本按同一语言对比。 */
  translations?: Partial<Record<Exclude<ReviewLanguage, "zh">, string>>;
}

/** 判断字段是否发生变化 */
export function isFieldChanged(f: FieldDiff): boolean {
  return (f.oldValue || "").trim() !== (f.newValue || "").trim();
}

/** 统计一组字段中发生变化的数量 */
export function countChangedFields(fields: FieldDiff[]): number {
  return fields.filter(isFieldChanged).length;
}

/**
 * 待审版本：同一条数据可能同时存在多个待审版本（来自不同批次/来源），
 * 需要在对比面板里切换查看。始终以最后一次通过审核的版本为线上生效版本。
 */
export interface PendingVersion {
  versionId: string;       // 版本唯一 ID
  batchId: string;         // 所属批次/任务 ID
  source: ReviewSource;    // 来源
  createdAt: string;       // 生成时间
  fields: FieldDiff[];     // 相对「线上生效版本」的字段差异
}

/** 单条审核条目 */
export interface ReviewItem {
  id: number;
  taskId: string;                    // 所属任务 ID（同 taskId 聚合为一个任务）
  objectType: ReviewObjectType;
  changeType: ChangeType;
  name: string;                      // 显示名，如「事实 #10042」
  /** 已存在对象的 ID；新增未分配 ID 时为空 */
  objectId?: string;
  factId?: number;                   // 关联事实 ID（用于跨批次同步判断）
  priority?: ReviewPriority;
  summary: string;                   // 变更说明（规则生成，非 AI）
  source: ReviewSource;
  confidence: SourceConfidence;
  createdAt: string;
  status: ItemReviewStatus;          // 本条在任务内的审核状态
  reviewedAt?: string;
  /** 最终审核人（rtx），单条数据只保留最后一次提交结论的人 */
  reviewedBy?: string;
  /** 审核结论：通过并覆盖、通过并新增或通过并删除。 */
  resolution?: ReviewResolution;
  /** 新增数据命中已有数据时的关系；无该字段即为新增无冲突 */
  conflictType?: ReviewConflictType;
  conflictTargetId?: string;
  conflictReason?: string;
  /** 审核详情的关联与溯源信息 */
  relatedEntities?: string[];
  relatedEvents?: string[];
  sourceOriginal?: string;
  qaOriginal?: { questionId?: string; answerId?: string; question?: string; answer?: string; language?: string };
  // 版本对比：线上生效版本 + 一个或多个待审版本
  liveVersion?: { createdAt: string; fields: ReviewFieldSnapshot[] };
  pendingVersions: PendingVersion[]; // 一个及以上
  // 跨批次同步：该 factId 还出现在哪些其它任务里
  alsoInTasks?: string[];
  /**
   * 一对多候选：同一新数据命中多条已有事实/实体/事件时，每个候选独立成为一个对比组。
   * 默认展示第一个候选，详情页可切换查看不同候选的字段差异。
   */
  candidates?: ReviewCandidate[];
  /**
   * 跨任务覆盖状态：同 factId 在更新任务中已通过时，历史任务中的同条目会被自动标记为 superseded，
   * 详情页给出提示“已在更新的版本中处理”，允许仅供查询，不再重复审核。
   */
  supersededBy?: { taskId: string; displayId: string; itemId: number; updatedAt: string; operator?: string };
  /** 来源快照：QA 原文、原始片段等，原始视图末尾使用 */
  sourceSnippet?: string;
  /** 机器预判提示：冲突 / 重复 / 术语参考等结构化信息 */
  machineHints?: ReviewMachineHints;
  /** 审核备注（随结论一并提交，可回溯） */
  reviewNote?: string;
  /** 人工修正过的字段标签列表（「修正并生效」时自动记录） */
  editedFields?: string[];
  /**
   * AI 建议新建的实体列表（库中无匹配，由审核流水线推断）。
   * 在事实/事件详情中展示，支持快速审核给出结论；最终生效须经实体审核分页。
   */
  suggestedEntities?: SuggestedEntity[];
}

/** 审核通过时的处置方式 */
export type ReviewResolution =
  | "overwrite"   // 通过并覆盖：新版本覆盖旧记录，成为线上生效版本
  | "create"      // 通过并新增：新数据作为独立记录入库
  | "delete";     // 通过并删除：确认删除线上已有记录

export const RESOLUTION_LABELS: Record<ReviewResolution, string> = {
  overwrite: "通过并覆盖",
  create: "通过并新增",
  delete: "通过并删除",
};

/**
 * AI 建议新建的实体（库中未找到匹配，审核流水线自动推断）
 * - 同任务内如果实体页已有该实体的审核条目，通过 linkedItemId 关联，状态随之同步
 * - 审核人可在事实/事件详情中对该建议给出快速结论（不直接写库），
 *   最终须在实体审核分页通过该实体条目才生效
 */
export interface SuggestedEntity {
  /** 建议的实体名称 */
  name: string;
  /** 对应的审核条目 ID（同任务内或跨任务），有值表示已有待审记录 */
  linkedItemId?: number;
  /** 快速审核结论：undefined = 未处理，"approved" = 快速通过，"rejected" = 快速拒绝 */
  quickReviewStatus?: "approved" | "rejected";
  /** 所在的任务 displayId（用于跨任务关联展示） */
  linkedTaskId?: string;
  /** 建议原因（如来自 AI 实体识别结果） */
  reason?: string;
}

/** 一条新数据对应的一个候选/冲突/重复对象 */
export interface ReviewCandidate {
  key: string;
  /** 候选对象类型标签，如"事件 #10285"。 */
  label: string;
  /** 候选与新数据的关系：冲突、重复或新增无冲突的旧版本。 */
  type: ReviewConflictType | "live";
  /** 候选对象的描述/相似度/原因。 */
  reason?: string;
  /** 候选对象的快照，作为对比中“线上/候选数据”列的来源。 */
  liveVersion: { createdAt: string; fields: ReviewFieldSnapshot[] };
}

/** 单个审核人的任务内处理统计 */
export interface ReviewerStat {
  reviewer: string;
  reviewed: number;
  typeCounts: Record<ReviewObjectType, number>;
}

/** 任务生命周期：审核中 → 已完成。审核结论一经提交即直接生效，无“应用结果/归档”环节。 */
export type ReviewTaskApplicationStatus = "reviewing" | "done";

/** 审核任务（由条目按 taskId 聚合而来，运行时计算 total/pending 等统计） */
export interface ReviewTask {
  /** 内部聚合键，保持原始批次标识，供关联、日志和详情定位使用。 */
  id: string;
  /** 任务创建时分配且永不复用的顺序号。 */
  sequenceNo: number;
  /** 面向用户展示的任务号，如 #1。 */
  displayId: string;
  title: string;
  source: ReviewSource;
  sourceLabel: string;
  createdAt: string;
  items: ReviewItem[];
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  typeCounts: Record<ReviewObjectType, number>;
  /** 每种内容类型的已审核 / 总数，用于任务列表的审核进度标签（a/b，a=已审核，b=总数）。 */
  typeProgress: Record<ReviewObjectType, { reviewed: number; total: number }>;
  /** 该批次内所有提交过审核结论的人员（rtx），去重后的列表 */
  operators: string[];
  /** 按人员自动聚合的审核数量与对象类型分布 */
  reviewerStats: ReviewerStat[];
  progress: "pending" | "done"; // 有待审 / 已全部处理
  /** 条目结论直接生效：有待审条目为 reviewing，全部处理完即 done。 */
  applicationStatus: ReviewTaskApplicationStatus;
}

/** ============ 审核操作日志 ============ */
/** 一条审核操作日志：每次对单条数据提交结论（通过/拒绝）都会追加一条 */
export interface ReviewLogEntry {
  id: string;
  taskId: string;
  itemId: number;
  itemName: string;
  objectType: ReviewObjectType;
  action: "approved" | "rejected";
  resolution?: ReviewResolution;
  /** 审核备注（可选，随结论提交） */
  note?: string;
  operator: string;      // 提交结论的人员 rtx
  timestamp: string;
}

/** ============ 文本差异（字符级，用于新旧对比时高亮变化片段） ============ */
export interface DiffSegment {
  text: string;
  type: "same" | "add" | "del";
}

/**
 * 基于最长公共子序列（LCS）的字符级文本差异。
 * 用于在字段对比时，不再整段标记新旧值，而是只高亮真正发生变化的片段
 * （类似代码差异对比中的行内高亮）。
 */
export function diffChars(oldStr: string, newStr: string): DiffSegment[] {
  const a = oldStr || "";
  const b = newStr || "";
  if (a === b) return a ? [{ text: a, type: "same" }] : [];
  const n = a.length;
  const m = b.length;
  // 文本过长时跳过逐字符 DP（避免 O(n*m) 开销过大），退化为整体替换
  if (n * m > 200000) {
    const segments: DiffSegment[] = [];
    if (a) segments.push({ text: a, type: "del" });
    if (b) segments.push({ text: b, type: "add" });
    return segments;
  }
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const segments: DiffSegment[] = [];
  const push = (type: DiffSegment["type"], ch: string) => {
    const last = segments[segments.length - 1];
    if (last && last.type === type) last.text += ch;
    else segments.push({ text: ch, type });
  };
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { push("same", a[i]); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { push("del", a[i]); i++; }
    else { push("add", b[j]); j++; }
  }
  while (i < n) { push("del", a[i]); i++; }
  while (j < m) { push("add", b[j]); j++; }
  return segments;
}

// ============ 接口原始形态（审核数据源） ============
// 数据源应直接使用接口返回，而非前端自造的 ReviewItem 视图模型，
// 以免前端联调时字段对不上。下面类型与「接口对照-Gbot事实库管理.md §5.1」对齐。
//
// 基础字段（来自 /api/facts 返回）：
//   fact_id / fact_text / fact_text_*（en/ar/tr/ru/zh_hk） / title /
//   source_type / source / source_url / start_time / end_time / time_description /
//   entity_ids[] / event_ids[] / category_id / review_status(pending|approved|deleted) /
//   review_priority(high|medium|low) / contradicting_fact_ids[] / duplicate_fact_ids[]
//
// 审核流水线扩展（基础 facts 接口不含，由审核/导入接口或 /api/facts/check-contradiction 返回）：
//   action / live_fact / contradicting_facts / duplicate_facts / term_refs / related_entity_names

/** 进入审核的处置类型（接口基础 facts 无此字段，由审核/导入流程写入） */
export type FactAction = "create" | "update" | "delete";

/** 矛盾/重复候选的详情（来自 /api/facts/check-contradiction 返回的事实列表） */
export interface RawFactCandidate {
  fact_id: number;
  fact_text: string;
  fact_text_en?: string;
  fact_text_ar?: string;
  fact_text_tr?: string;
  fact_text_ru?: string;
  fact_text_zh_hk?: string;
  /** 与待审内容的冲突/重复判定原因 */
  reason?: string;
}

/** 接口原始形态：单条待审事实 */
export interface FactReviewRaw {
  fact_id: number;
  fact_text: string;
  fact_text_en?: string;
  fact_text_ar?: string;
  fact_text_tr?: string;
  fact_text_ru?: string;
  fact_text_zh_hk?: string;
  title: string;
  /** 来源类型：qa / sync / import / mining ... */
  source_type: string;
  source?: string;
  source_url?: string;
  start_time?: string;
  end_time?: string;
  time_description?: string;
  entity_ids: number[];
  event_ids: number[];
  category_id?: number;
  review_status: "pending" | "approved" | "deleted";
  review_priority: "high" | "medium" | "low";
  /** 冲突事实 ID 列表（矛盾检测写入） */
  contradicting_fact_ids: number[];
  /** 重复事实 ID 列表（矛盾检测写入） */
  duplicate_fact_ids: number[];
  // —— 审核流水线扩展字段 ——
  /** 进入审核的处置类型：create=新增 / update=覆盖 / delete=删除 */
  action?: FactAction;
  /** 覆盖场景的线上生效版本基线（来自已 approved 事实） */
  live_fact?: {
    fact_text: string;
    fact_text_en?: string;
    fact_text_ar?: string;
    fact_text_tr?: string;
    fact_text_ru?: string;
    fact_text_zh_hk?: string;
  };
  /** check-contradiction 返回的冲突事实详情 */
  contradicting_facts?: RawFactCandidate[];
  /** check-contradiction 返回的重复事实详情 */
  duplicate_facts?: RawFactCandidate[];
  /** 机器预判：术语翻译参考 */
  term_refs?: { term: string; reference: string }[];
  /** 关联实体展示名（由 entity_ids 经 /api/entities/batch 解析后回填） */
  related_entity_names?: string[];
  /**
   * AI 建议新建的实体（库中无匹配，由事实导入/同步流水线推断）
   * 每条为 { name: string; reason?: string; linked_item_id?: number }
   */
  suggested_new_entities?: { name: string; reason?: string; linked_item_id?: number; linked_task_id?: string }[];
  confidence?: SourceConfidence;
  task_id?: string;
  created_at?: string;
  source_original?: string;
}
