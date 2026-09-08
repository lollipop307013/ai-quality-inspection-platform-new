import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Table, Tag, Button, Select, Input, Checkbox, Space, Pagination,
  MessagePlugin, Tabs, Radio, Textarea, Popup,
} from "tdesign-react";
import { ChevronLeftIcon, SearchIcon, InfoCircleIcon, DeleteIcon } from "tdesign-icons-react";
import type {
  ReviewItem, ReviewTask, PendingVersion, ItemReviewStatus, ReviewResolution,
  ReviewLogEntry, FieldDiff, ReviewerStat, ReviewPriority, ReviewObjectType, ChangeType, ReviewCandidate,
  ReviewLanguage, ReviewFieldSnapshot, SuggestedEntity,
} from "../review-types";
import {
  REVIEW_SOURCE_GROUPS, REVIEW_SOURCE_LABELS, RESOLUTION_LABELS,
  CHANGE_TYPE_LABELS, OBJECT_TYPE_LABELS, PRIORITY_LABELS, CONFLICT_TYPE_LABELS, REVIEW_LANGUAGE_OPTIONS,
  isFieldChanged, countChangedFields, diffChars,
} from "../review-types";
import { mockReviewItems, mockReviewLogs, MOCK_OPERATORS, buildReviewTasks } from "../review-mock";
import { parseReviewObjectId } from "../review-bridge";
import type { ReviewLocator } from "../review-bridge";
import "../review.less";

const { TabPanel } = Tabs;

/** 当前登录用户（demo 中固定，实际接入时由登录态注入），用于记录审核操作日志 */
const CURRENT_USER = MOCK_OPERATORS[0];

type TaskProgressFilter = "all" | "pending" | "done";
type DetailViewMode = "simple" | "raw";
/** 任务内对象类型Tab：事实/实体/事件分批，"all"=混合不分 */
type DetailObjectTab = ReviewObjectType | "all";
type DetailInfoRow = { label: string; value: string };
/** 标签组：每个标签可选删除回调（新增/覆盖时可删） */
type DetailTagGroup = { label: string; tags: string[]; deletable?: boolean; onDelete?: (tag: string) => void };
type DetailSection = {
  key: string;
  title: string;
  hint?: string;
  fields?: FieldDiff[];
  rows?: DetailInfoRow[];
  /** 以标签气泡渲染的分组列表，替代 rows 中的纯文本 */
  tagRows?: DetailTagGroup[];
  defaultExpanded?: boolean;
};
type DetailFilters = {
  keyword: string;
  statuses: ItemReviewStatus[];
  changeTypes: ChangeType[];
  priorities: ReviewPriority[];
};
type TaskDetailMemory = {
  activeItemId: number | null;
  activeVersionId: string;
  detailPage: number;
  detailPageSize: number;
  filters: DetailFilters;
  scrollTop: number;
};

const DETAIL_MEMORY_STORAGE_KEY = "fact-db-review-task-memory-v1";
const DETAIL_VIEW_STORAGE_KEY = "fact-db-review-detail-view-v1";
const DEFAULT_DETAIL_FILTERS: DetailFilters = {
  keyword: "",
  statuses: [],
  changeTypes: [],
  priorities: [],
};
const DETAIL_STATUSES: ItemReviewStatus[] = ["pending", "approved", "rejected"];
const DETAIL_CHANGE_TYPES: ChangeType[] = ["new", "update", "delete"];
const DETAIL_PRIORITIES: ReviewPriority[] = ["high", "medium", "low"];

function normalizeDetailFilters(value?: Partial<DetailFilters & { objectTypes?: ReviewObjectType[] }>): DetailFilters {
  return {
    keyword: typeof value?.keyword === "string" ? value.keyword : "",
    statuses: Array.isArray(value?.statuses) ? value!.statuses.filter((s): s is ItemReviewStatus => DETAIL_STATUSES.includes(s)) : [],
    changeTypes: Array.isArray(value?.changeTypes) ? value!.changeTypes.filter((item): item is ChangeType => DETAIL_CHANGE_TYPES.includes(item)) : [],
    priorities: Array.isArray(value?.priorities) ? value!.priorities.filter((item): item is ReviewPriority => DETAIL_PRIORITIES.includes(item)) : [],
  };
}

function readTaskDetailMemories(): Record<string, TaskDetailMemory> {
  try {
    const value = window.localStorage.getItem(DETAIL_MEMORY_STORAGE_KEY);
    const parsed = value ? JSON.parse(value) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function readTaskDetailMemory(taskId: string): TaskDetailMemory | null {
  const memory = readTaskDetailMemories()[taskId];
  if (!memory || typeof memory !== "object") return null;
  return {
    activeItemId: typeof memory.activeItemId === "number" ? memory.activeItemId : null,
    activeVersionId: typeof memory.activeVersionId === "string" ? memory.activeVersionId : "",
    detailPage: Math.max(1, Number(memory.detailPage) || 1),
    detailPageSize: [5, 10, 20, 50].includes(Number(memory.detailPageSize)) ? Number(memory.detailPageSize) : 10,
    filters: normalizeDetailFilters(memory.filters),
    scrollTop: Math.max(0, Number(memory.scrollTop) || 0),
  };
}

function writeTaskDetailMemory(taskId: string, memory: TaskDetailMemory) {
  try {
    const memories = readTaskDetailMemories();
    memories[taskId] = memory;
    window.localStorage.setItem(DETAIL_MEMORY_STORAGE_KEY, JSON.stringify(memories));
  } catch {
    // 本地存储不可用时不阻断审核流程。
  }
}

function getStoredDetailViewMode(): DetailViewMode {
  try {
    return window.localStorage.getItem(DETAIL_VIEW_STORAGE_KEY) === "raw" ? "raw" : "simple";
  } catch {
    return "simple";
  }
}

function matchesDetailFilters(item: ReviewItem, filters: DetailFilters) {
  const keyword = filters.keyword.trim().toLowerCase();
  const textMatched = !keyword || [String(item.id), getObjectId(item), item.name, item.summary]
    .some((value) => value.toLowerCase().includes(keyword));
  return textMatched
    && (filters.statuses.length === 0 || filters.statuses.includes(item.status))
    && (filters.changeTypes.length === 0 || filters.changeTypes.includes(item.changeType))
    && (filters.priorities.length === 0 || filters.priorities.includes(getReviewPriority(item)));
}

function getApprovalResolution(item: ReviewItem): ReviewResolution {
  if (item.changeType === "new") return "create";
  if (item.changeType === "delete") return "delete";
  return "overwrite";
}

function getComparisonTargetLabel(item: ReviewItem, fields: FieldDiff[] = []) {
  const objectLabel = OBJECT_TYPE_LABELS[item.objectType];
  const objectId = getObjectId(item);
  const title = fields.find((field) => /^(title|name|entity_name|event_name)$/i.test(field.field))?.newValue
    || fields.find((field) => /^(title|name|entity_name|event_name)$/i.test(field.field))?.oldValue
    || "";
  const base = objectId === "-" ? `${objectLabel} 无对象ID` : `${objectLabel} ${objectId}`;
  return title && !item.name.includes(title) ? `${base} · ${title}` : base;
}

/** 候选标签文案：冲突/重复/覆盖，原数据等不再出现。 */
function getCandidateTag(candidate: ReviewCandidate) {
  return CONFLICT_TYPE_LABELS[candidate.type as keyof typeof CONFLICT_TYPE_LABELS] || CONFLICT_TYPE_LABELS.cover;
}

/** 统一候选标签：对象类型 + 对象 ID，类型语义以右侧小标签呈现。 */
function getUnifiedCandidateLabel(objectLabel: string, candidate: ReviewCandidate) {
  const objectId = candidate.label.match(/\d+/)?.[0] || candidate.label;
  return `${objectLabel} ${objectId}`.trim();
}

function getCandidatePriority(candidate: ReviewCandidate) {
  if (candidate.type === "cover") return 0;
  if (candidate.type === "conflict") return 1;
  if (candidate.type === "duplicate") return 2;
  return 3;
}

/** 编辑窗口字段中文标签，用于原始视图补齐未在新数据中出现的字段。 */
const FIELD_LABELS: Record<string, string> = {
  title: "标题",
  entity_name: "实体名称",
  event_name: "事件名称",
  fact_text: "事实内容",
  category: "分类",
  priority: "优先级",
  time_description: "时间描述",
  source_content: "来源内容",
  conflict_reason: "矛盾原因",
  source_type: "来源类型",
  source: "来源",
  source_url: "来源 URL",
  start_time: "开始时间",
  end_time: "结束时间",
  related_entities: "关联实体",
  related_events: "关联事件",
  conflict: "矛盾事实 ID",
  duplicate: "重复事实 ID",
  name: "名称",
  alias: "别名",
  description: "描述",
  tags: "标签",
  is_category: "作为分类",
  time_type: "时间类型",
  remark: "备注",
  recurring_weekdays: "周期星期",
  recurring_time_range: "周期时段",
  recurring_duration_days: "单次持续天数",
};

function getFieldLabel(name: string) {
  return FIELD_LABELS[name] || name;
}

/** 仅编辑窗中可多语言维护的字段随审核详情语言切换，其他配置字段保持不变。 */
const MULTILINGUAL_REVIEW_FIELDS: Record<ReviewObjectType, string[]> = {
  entity: ["name", "entity_name", "title", "alias", "aliases", "description", "tags"],
  event: ["name", "event_name", "alias", "aliases", "time_description"],
  fact: ["fact_text", "time_description"],
};

function isMultilingualReviewField(objectType: ReviewObjectType, field: string) {
  const baseField = field.replace(/_(?:en|ar|tr|ru|zh_hk)$/i, "");
  return MULTILINGUAL_REVIEW_FIELDS[objectType].includes(baseField);
}

function isArabicReviewLanguage(language: ReviewLanguage) {
  return language === "ar";
}

/** 保留 URL、数字等原始内容，仅规范阿拉伯语正文中的常用分隔标点。 */
function formatLocalizedReviewValue(language: ReviewLanguage, value: string | undefined) {
  if (value === undefined || !isArabicReviewLanguage(language)) return value;
  return value
    .replace(/,/g, "،")
    .replace(/;/g, "؛")
    .replace(/\?/g, "؟");
}

function getLocalizedFieldDiffValue(
  objectType: ReviewObjectType,
  field: FieldDiff,
  language: ReviewLanguage,
  valueKey: "oldValue" | "newValue",
): string | undefined {
  const value = !isMultilingualReviewField(objectType, field.field) || language === "zh"
    ? field[valueKey]
    : field.translations?.[language]?.[valueKey];
  return formatLocalizedReviewValue(language, value);
}

function getLocalizedSnapshotValue(
  objectType: ReviewObjectType,
  field: ReviewFieldSnapshot,
  language: ReviewLanguage,
): string | undefined {
  const value = !isMultilingualReviewField(objectType, field.field) || language === "zh"
    ? field.value
    : field.translations?.[language];
  return formatLocalizedReviewValue(language, value);
}

/** 把编辑值写回待审版本字段（纯函数），「保存新数据」与「修正并生效」共用。 */
function applyFieldEditsToItem(
  item: ReviewItem,
  versionId: string,
  values: Record<string, string>,
  language: ReviewLanguage,
): ReviewItem {
  return {
    ...item,
    pendingVersions: item.pendingVersions.map((pendingVersion) => pendingVersion.versionId !== versionId ? pendingVersion : {
      ...pendingVersion,
      fields: pendingVersion.fields.map((field) => {
        const inputValue = values[field.field];
        if (inputValue === undefined) return field;
        const nextValue = formatLocalizedReviewValue(language, inputValue) || "";
        if (!isMultilingualReviewField(item.objectType, field.field) || language === "zh") {
          return { ...field, newValue: nextValue };
        }
        return {
          ...field,
          translations: {
            ...field.translations,
            [language]: {
              oldValue: field.translations?.[language]?.oldValue || "",
              newValue: nextValue,
            },
          },
        };
      }),
    }),
  };
}

/** 计算本次编辑中实际发生变化的字段标签（用于「人工修正」标记）。 */
function computeEditedLabels(
  item: ReviewItem,
  versionId: string,
  values: Record<string, string>,
  language: ReviewLanguage,
): string[] {
  const version = item.pendingVersions.find((entry) => entry.versionId === versionId);
  if (!version) return [];
  return version.fields
    .filter((field) => values[field.field] !== undefined
      && values[field.field] !== (getLocalizedFieldDiffValue(item.objectType, field, language, "newValue") ?? ""))
    .map((field) => field.label);
}

function getCandidateStats(item: ReviewItem) {
  const candidates: ReviewCandidate[] = (item.candidates && item.candidates.length > 0)
    ? item.candidates
    : item.conflictType ? [{
        key: item.conflictTargetId || "live",
        label: item.conflictTargetId || `${OBJECT_TYPE_LABELS[item.objectType]} ${getObjectId(item)}`,
        type: item.conflictType,
        reason: item.conflictReason,
        liveVersion: item.liveVersion || { createdAt: item.createdAt, fields: [] },
      } as ReviewCandidate]
    : [];
  const conflictCount = candidates.filter((c) => c.type === "conflict").length;
  const duplicateCount = candidates.filter((c) => c.type === "duplicate").length;
  const coverCount = candidates.filter((c) => c.type === "cover").length;
  return { candidates, conflictCount, duplicateCount, coverCount };
}

function getReviewPriority(item: ReviewItem): ReviewPriority {
  if (item.priority) return item.priority;
  if (item.conflictType || item.changeType === "delete") return "high";
  if (item.changeType === "update") return "medium";
  return "low";
}

function getObjectId(item: ReviewItem) {
  // 新增数据尚未落库，无对应库内条目ID；仅覆盖/删除展示被操作的库内ID
  if (item.changeType === "new") return "-";
  if (item.objectId) return item.objectId;
  if (item.factId != null) return `#${item.factId}`;
  return "-";
}

function isTimeField(field: FieldDiff) {
  return /(time|date|start|end|时间|日期)/i.test(field.field) || /(时间|日期)/.test(field.label);
}

function hasMeaningfulFieldChange(field: FieldDiff) {
  return isFieldChanged(field) && Boolean(`${field.oldValue || ""}${field.newValue || ""}`.trim());
}

function getChangedFieldCount(fields: FieldDiff[] = []) {
  return fields.filter(hasMeaningfulFieldChange).length;
}

function getContentSectionTitle(item: ReviewItem) {
  if (item.objectType === "entity") return "实体信息";
  if (item.objectType === "event") return "事件信息";
  return item.source.startsWith("qa-") ? "待审内容" : "事实正文";
}

function buildDetailSections(item: ReviewItem, fields: FieldDiff[], displayTaskId: string, candidate: ReviewCandidate | null = null): DetailSection[] {
  const timeFields = fields.filter(isTimeField);
  const mainFields = fields.filter((field) => !isTimeField(field));
  const primaryFields = mainFields.length > 0 ? mainFields : fields;
  const isCleanNew = item.changeType === "new" && !item.conflictType;
  const sections: DetailSection[] = [
    {
      key: "content",
      title: getContentSectionTitle(item),
      hint: isCleanNew ? "新增无冲突：仅展示待入库内容，不需要做新旧对比" : "默认展开存在字段差异的区块，无变更可手动展开",
      fields: primaryFields,
      defaultExpanded: true,
    },
  ];

  if (timeFields.length > 0 && mainFields.length > 0) {
    sections.push({
      key: "time",
      title: "时间信息",
      hint: "开始 / 结束 / 时间说明",
      fields: timeFields,
      defaultExpanded: true,
    });
  }

  // 候选/冲突摘要：仅在存在候选时展示，并跟随当前选中的候选对象。
  if (candidate && candidate.type !== "live") {
    sections.push({
      key: "candidate",
      title: "候选摘要",
      hint: "该候选与新数据的关系",
      rows: [
        { label: "候选对象", value: candidate.label },
        { label: "关系", value: CONFLICT_TYPE_LABELS[candidate.type as keyof typeof CONFLICT_TYPE_LABELS] || candidate.type },
        { label: "说明", value: candidate.reason || "请结合差异字段确认处理结论。" },
      ],
      defaultExpanded: false,
    });
  }

  if (item.objectType === "fact") {
    const isDeletable = item.changeType === "new" || item.changeType === "update";
    const tagGroups: DetailTagGroup[] = [];
    if ((item.relatedEntities?.length ?? 0) > 0) {
      tagGroups.push({ label: "关联实体", tags: item.relatedEntities!, deletable: isDeletable });
    }
    if ((item.relatedEvents?.length ?? 0) > 0) {
      tagGroups.push({ label: "关联事件", tags: item.relatedEvents!, deletable: isDeletable });
    }
    sections.push({
      key: "relations",
      title: "关联实体 / 事件",
      hint: isDeletable ? "新增/覆盖时可点 × 移除关联" : "已关联对象",
      tagRows: tagGroups.length > 0 ? tagGroups : undefined,
      rows: tagGroups.length === 0 ? [{ label: "关联信息", value: "暂无关联实体或事件" }] : undefined,
      defaultExpanded: tagGroups.length > 0,
    });
  }

  // 建议新增实体：展示在关联区块之后，支持 √/× 快速结论
  if (item.suggestedEntities?.length) {
    sections.push({
      key: "suggested",
      title: "建议新增实体",
      hint: "AI 识别出库中无匹配实体，可给出快速结论（仅参考），最终须经实体审核分页通过后生效",
      defaultExpanded: true,
    });
  }

  sections.push({
    key: "source",
    title: "来源信息",
    hint: "新数据生成依据（如 QA 原文 / Excel 行 / 同步批次）",
    rows: [
      { label: "审核任务", value: displayTaskId || "--" },
      { label: "来源类型", value: REVIEW_SOURCE_LABELS[item.source] },
      { label: "生成时间", value: item.createdAt },
      { label: "来源说明", value: item.summary },
      { label: "原始片段", value: item.sourceSnippet || item.sourceOriginal || item.summary },
    ],
    defaultExpanded: false,
  });

  if (item.source.startsWith("qa-")) {
    const question = fields.find((field) => field.field === "question")?.newValue || item.qaOriginal?.question || "暂无";
    const answer = fields.find((field) => field.field === "answer")?.newValue || item.qaOriginal?.answer || "暂无";
    sections.push({
      key: "qa",
      title: "QA 原始信息",
      hint: "只读，对照 QA 数据",
      rows: [
        { label: "问题 ID", value: item.qaOriginal?.questionId || "--" },
        { label: "答案 ID", value: item.qaOriginal?.answerId || "--" },
        { label: "语种", value: item.qaOriginal?.language || "zh" },
        { label: "问题", value: question },
        { label: "答案", value: answer },
      ],
      defaultExpanded: false,
    });
  }

  return sections;
}

export default function ReviewTab({ locator }: { locator?: ReviewLocator | null }) {
  const [items, setItems] = useState<ReviewItem[]>(() =>
    JSON.parse(JSON.stringify(mockReviewItems))
  );
  const [logs, setLogs] = useState<ReviewLogEntry[]>(() =>
    JSON.parse(JSON.stringify(mockReviewLogs))
  );
  const [view, setView] = useState<"list" | "detail">("list");
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);

  // 列表页：任务不再归档，统一按审核进度筛选。
  const [taskProgressFilter, setTaskProgressFilter] = useState<TaskProgressFilter>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [keyword, setKeyword] = useState("");

  // 详情页：对象类型单选（事实/实体/事件）
  const [objectTypeTab, setObjectTypeTab] = useState<ReviewObjectType>("fact");
  // 详情页：任务内待审数据、筛选、分页与当前查看位置
  const [detailFilters, setDetailFilters] = useState<DetailFilters>(DEFAULT_DETAIL_FILTERS);
  const [detailPage, setDetailPage] = useState(1);
  const [detailPageSize, setDetailPageSize] = useState(10);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [activeItemId, setActiveItemId] = useState<number | null>(null);
  const [activeVersionId, setActiveVersionId] = useState<string>("");
  const [detailViewMode, setDetailViewMode] = useState<DetailViewMode>(getStoredDetailViewMode);
  const detailListRef = useRef<HTMLDivElement | null>(null);
  const detailScrollTopRef = useRef(0);
  const restoreScrollTopRef = useRef<number | null>(null);
  const lastDetailFiltersRef = useRef<string>(JSON.stringify(detailFilters));

  const tasks = useMemo(() => buildReviewTasks(items, logs), [items, logs]);
  const taskDisplayIds = useMemo(() => tasks.reduce<Record<string, string>>((result, task) => {
    result[task.id] = task.displayId;
    return result;
  }, {}), [tasks]);

  const taskCounts = useMemo(() => {
    const reviewingTasks = tasks.filter((task) => task.applicationStatus === "reviewing").length;
    const doneTasks = tasks.filter((task) => task.applicationStatus === "done").length;
    return { reviewingTasks, doneTasks };
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (taskProgressFilter !== "all" && task.progress !== taskProgressFilter) return false;
      if (sourceFilter !== "all" && task.source !== sourceFilter) return false;
      if (keyword) {
        const value = keyword.toLowerCase();
        if (!task.displayId.toLowerCase().includes(value) && !task.title.toLowerCase().includes(value) && !task.sourceLabel.toLowerCase().includes(value) && !task.id.toLowerCase().includes(value)) return false;
      }
      return true;
    });
  }, [tasks, taskProgressFilter, sourceFilter, keyword]);

  const currentTask = tasks.find((task) => task.id === currentTaskId) || null;
  const allTaskItems = currentTask ? currentTask.items : [];
  // 各对象类型计数（不受其他筛选影响，用于类型Tab数字）
  const objectTypeCounts = useMemo(() => {
    const counts: Record<ReviewObjectType, number> = { fact: 0, entity: 0, event: 0 };
    for (const item of allTaskItems) counts[item.objectType]++;
    return counts;
  }, [allTaskItems]);
  // 当前类型Tab下的全量条目
  const detailItems = useMemo(() => allTaskItems.filter((item) => item.objectType === objectTypeTab), [allTaskItems, objectTypeTab]);
  // 各审核状态计数（仅当前类型，用于列头统计显示）
  const statusCounts = useMemo(() => {
    const filtered = detailItems.filter((item) => matchesDetailFilters(item, { ...detailFilters, statuses: [] }));
    const counts: Record<ItemReviewStatus | "all", number> = { all: 0, pending: 0, approved: 0, rejected: 0 };
    for (const item of filtered) {
      counts[item.status] = (counts[item.status] || 0) + 1;
      counts.all++;
    }
    return counts;
  }, [detailItems, detailFilters]);
  const filteredDetailItems = useMemo(() => detailItems.filter((item) => matchesDetailFilters(item, detailFilters)), [detailItems, detailFilters]);
  const detailTotalPages = Math.max(1, Math.ceil(filteredDetailItems.length / detailPageSize));
  const safeDetailPage = Math.min(detailPage, detailTotalPages);
  const pagedDetailItems = useMemo(() => {
    const start = (safeDetailPage - 1) * detailPageSize;
    return filteredDetailItems.slice(start, start + detailPageSize);
  }, [filteredDetailItems, safeDetailPage, detailPageSize]);
  const activeItem = currentTask?.items.find((item) => item.id === activeItemId) || null;
  const filteredItemIds = filteredDetailItems.map((item) => item.id).join(",");
  const pagedItemIds = pagedDetailItems.map((item) => item.id).join(",");
  const selectedFilteredIds = selectedIds.filter((id) => filteredDetailItems.some((item) => item.id === id));

  useEffect(() => {
    try {
      window.localStorage.setItem(DETAIL_VIEW_STORAGE_KEY, detailViewMode);
    } catch {
      // 视图偏好无法保存时仍可继续审核。
    }
  }, [detailViewMode]);

  useEffect(() => {
    if (detailPage !== safeDetailPage) setDetailPage(safeDetailPage);
  }, [detailPage, safeDetailPage]);

  useEffect(() => {
    const allowed = new Set(filteredDetailItems.map((item) => item.id));
    setSelectedIds((previous) => {
      const next = previous.filter((id) => allowed.has(id));
      return next.length === previous.length ? previous : next;
    });
  }, [filteredItemIds]);

  useEffect(() => {
    if (view !== "detail") return;
    // 筛选条件变化时保持右侧当前数据不动，即使筛选结果中已不再包含该条数据。
    const filterKey = JSON.stringify(detailFilters);
    if (filterKey !== lastDetailFiltersRef.current) {
      lastDetailFiltersRef.current = filterKey;
      return;
    }
    if (activeItemId != null && pagedDetailItems.some((item) => item.id === activeItemId)) return;
    const nextItem = pagedDetailItems[0] || null;
    setActiveItemId(nextItem?.id ?? null);
    setActiveVersionId(nextItem?.pendingVersions[0]?.versionId || "");
  }, [view, currentTaskId, activeItemId, pagedItemIds, detailFilters]);

  useEffect(() => {
    if (view !== "detail" || !currentTaskId) return;
    writeTaskDetailMemory(currentTaskId, {
      activeItemId,
      activeVersionId,
      detailPage: safeDetailPage,
      detailPageSize,
      filters: normalizeDetailFilters(detailFilters),
      scrollTop: detailScrollTopRef.current,
    });
  }, [view, currentTaskId, activeItemId, activeVersionId, safeDetailPage, detailPageSize, detailFilters]);

  useEffect(() => {
    const scrollTop = restoreScrollTopRef.current;
    if (view !== "detail" || scrollTop == null) return;
    const frame = window.requestAnimationFrame(() => {
      if (detailListRef.current) detailListRef.current.scrollTop = scrollTop;
      restoreScrollTopRef.current = null;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [view, currentTaskId, safeDetailPage, pagedItemIds]);

  function saveCurrentTaskMemory() {
    if (!currentTaskId) return;
    writeTaskDetailMemory(currentTaskId, {
      activeItemId,
      activeVersionId,
      detailPage: safeDetailPage,
      detailPageSize,
      filters: normalizeDetailFilters(detailFilters),
      scrollTop: detailListRef.current?.scrollTop ?? detailScrollTopRef.current,
    });
  }

  function enterTask(taskId: string) {
    const task = tasks.find((entry) => entry.id === taskId);
    if (!task) return;
    const memory = readTaskDetailMemory(taskId);
    const restoredFilters = memory?.filters || DEFAULT_DETAIL_FILTERS;
    const restoredPageSize = memory?.detailPageSize || 10;
    // 默认选有数据的第一个类型
    const defaultType: ReviewObjectType = (["fact", "entity", "event"] as ReviewObjectType[]).find((t) => task.items.some((i) => i.objectType === t)) || "fact";
    const restoredType: ReviewObjectType = (["fact", "entity", "event"] as ReviewObjectType[]).includes(memory?.filters?.statuses?.[0] as ReviewObjectType) ? (memory!.filters.statuses[0] as ReviewObjectType) : defaultType;
    const restoredItems = task.items.filter((item) => item.objectType === restoredType && matchesDetailFilters(item, restoredFilters));
    const restoredTotalPages = Math.max(1, Math.ceil(restoredItems.length / restoredPageSize));
    const restoredPage = Math.min(memory?.detailPage || 1, restoredTotalPages);
    const pageStart = (restoredPage - 1) * restoredPageSize;
    const rememberedItem = restoredItems.find((item) => item.id === memory?.activeItemId);
    const nextItem = rememberedItem || restoredItems.slice(pageStart, pageStart + restoredPageSize)[0] || null;

    setCurrentTaskId(taskId);
    setView("detail");
    setObjectTypeTab(defaultType);
    setDetailFilters(normalizeDetailFilters(restoredFilters));
    setDetailPage(restoredPage);
    setDetailPageSize(restoredPageSize);
    setSelectedIds([]);
    setActiveItemId(nextItem?.id ?? null);
    setActiveVersionId(nextItem?.pendingVersions.some((version) => version.versionId === memory?.activeVersionId)
      ? memory!.activeVersionId
      : nextItem?.pendingVersions[0]?.versionId || "");
    detailScrollTopRef.current = memory?.scrollTop || 0;
    restoreScrollTopRef.current = memory?.scrollTop || 0;
  }

  /** 管理页「有待审版本」跳转：进入任务详情并直接定位到指定条目（跳过记忆恢复）。 */
  function enterTaskWithFocus(taskId: string, focusItemId: number) {
    const task = tasks.find((entry) => entry.id === taskId);
    if (!task) return;
    const targetItem = task.items.find((entry) => entry.id === focusItemId);
    if (!targetItem) return;

    const filtered = task.items.filter((item) => item.objectType === targetItem.objectType && matchesDetailFilters(item, DEFAULT_DETAIL_FILTERS));
    const idx = filtered.findIndex((item) => item.id === focusItemId);
    const nextPage = idx < 0 ? 1 : Math.floor(idx / detailPageSize) + 1;

    setCurrentTaskId(taskId);
    setView("detail");
    setObjectTypeTab(targetItem.objectType);
    setDetailFilters(normalizeDetailFilters(DEFAULT_DETAIL_FILTERS));
    setDetailPage(nextPage);
    setDetailPageSize(detailPageSize);
    setSelectedIds([]);
    setActiveItemId(targetItem.id);
    setActiveVersionId(targetItem.pendingVersions[0]?.versionId || "");
    detailScrollTopRef.current = 0;
    restoreScrollTopRef.current = 0;
  }

  // 管理页「有待审版本」标签跳转：定位到覆盖该对象的待审条目
  useEffect(() => {
    if (!locator || !locator.objectType || locator.objectId == null) return;
    const target = items.find((entry) =>
      entry.objectType === locator.objectType
      && parseReviewObjectId(entry.objectId) === locator.objectId
      && entry.changeType === "update",
    );
    if (!target) return;
    const task = tasks.find((entry) => entry.items.some((it) => it.id === target.id));
    if (!task) return;
    enterTaskWithFocus(task.id, target.id);
  }, [locator]);

  function backToList() {
    saveCurrentTaskMemory();
    setView("list");
    setCurrentTaskId(null);
    setSelectedIds([]);
    setActiveItemId(null);
  }

  function selectItem(item: ReviewItem | null, preferredVersionId?: string) {
    setActiveItemId(item?.id ?? null);
    setActiveVersionId(item?.pendingVersions.some((version) => version.versionId === preferredVersionId)
      ? preferredVersionId || ""
      : item?.pendingVersions[0]?.versionId || "");
  }

  function switchObjectTypeTab(type: ReviewObjectType) {
    setObjectTypeTab(type);
    setDetailPage(1);
    setSelectedIds([]);
    const next = (currentTask?.items || []).filter((item) => item.objectType === type && matchesDetailFilters(item, detailFilters))[0] || null;
    selectItem(next);
  }

  function updateDetailFilters(patch: Partial<DetailFilters>) {
    setDetailFilters((previous) => normalizeDetailFilters({ ...previous, ...patch }));
    setDetailPage(1);
    setSelectedIds([]);
    detailScrollTopRef.current = 0;
    restoreScrollTopRef.current = 0;
  }

  function updatePendingFields(itemId: number, versionId: string, values: Record<string, string>, language: ReviewLanguage) {
    const item = items.find((entry) => entry.id === itemId);
    if (!item) return;
    const changedLabels = computeEditedLabels(item, versionId, values, language);
    if (changedLabels.length === 0) return;
    setItems((previous) => previous.map((entry) => entry.id !== itemId
      ? entry
      : applyFieldEditsToItem(entry, versionId, values, language)));
    MessagePlugin.success(`已保存${REVIEW_LANGUAGE_OPTIONS.find((option) => option.value === language)?.label || "当前"}新版本字段：${changedLabels.join("、")}`);
  }

  /**
   * 审核直接生效：通过 → 待审版本立即写入线上成为生效版本；
   * 拒绝 → 放弃该待审版本，线上继续沿用原生效版本。
   * 结论一经提交即生效，不可撤销。
   * options.edits：「修正并生效」时先把编辑写回待审版本，再基于修正后的新值生效。
   */
  function applyReview(
    targetIds: number[],
    next: ItemReviewStatus,
    options?: {
      note?: string;
      edits?: { itemId: number; versionId: string; values: Record<string, string>; language: ReviewLanguage };
    },
  ) {
    const targetIdSet = new Set(targetIds);
    const now = new Date().toLocaleString("zh-CN").replace(/\//g, "-");
    const action: "approved" | "rejected" = next === "rejected" ? "rejected" : "approved";
    const baseItems = options?.edits
      ? items.map((entry) => entry.id === options.edits!.itemId
        ? applyFieldEditsToItem(entry, options.edits!.versionId, options.edits!.values, options.edits!.language)
        : entry)
      : items;
    const targetItems = baseItems.filter((item) => targetIdSet.has(item.id) && item.status === "pending");
    if (targetItems.length === 0) return 0;

    const editsPayload = options?.edits;
    const originalEditedItem = editsPayload
      ? items.find((entry) => entry.id === editsPayload.itemId)
      : undefined;
    const editedLabels = originalEditedItem && editsPayload
      ? computeEditedLabels(
          originalEditedItem,
          editsPayload.versionId,
          editsPayload.values,
          editsPayload.language,
        )
      : [];

    const logsToAppend: ReviewLogEntry[] = targetItems.map((item) => {
      const resolution = next === "approved" ? getApprovalResolution(item) : undefined;
      return {
        id: `log-${item.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        taskId: item.taskId,
        itemId: item.id,
        itemName: item.name,
        objectType: item.objectType,
        action,
        resolution,
        note: options?.note,
        operator: CURRENT_USER,
        timestamp: now,
      };
    });

    setItems((previous) => previous.map((item) => {
      if (!targetIdSet.has(item.id) || item.status !== "pending") return item;
      const effective = targetItems.find((entry) => entry.id === item.id) || item;
      if (next === "rejected") {
        // 拒绝：线上版本不变
        return { ...item, status: next, reviewedAt: now, reviewedBy: CURRENT_USER, reviewNote: options?.note };
      }
      // 通过：待审版本（含人工修正）立即生效，成为新的线上版本快照
      const appliedVersion = effective.pendingVersions[0];
      const liveFields = appliedVersion?.fields.map((field) => ({
        field: field.field,
        label: field.label,
        value: field.newValue,
        translations: Object.fromEntries(
          Object.entries(field.translations || {}).map(([language, entry]) => [language, (entry as { newValue: string }).newValue]),
        ),
      })) || item.liveVersion?.fields || [];
      return {
        ...item,
        status: next,
        resolution: getApprovalResolution(item),
        reviewedAt: now,
        reviewedBy: CURRENT_USER,
        reviewNote: options?.note,
        editedFields: editedLabels.length > 0 ? editedLabels : undefined,
        liveVersion: { createdAt: now, fields: liveFields },
      };
    }));
    setLogs((previous) => [...previous, ...logsToAppend]);
    return targetItems.length;
  }

  function reviewSingle(
    item: ReviewItem,
    next: ItemReviewStatus,
    options?: {
      note?: string;
      edits?: { itemId: number; versionId: string; values: Record<string, string>; language: ReviewLanguage };
    },
  ) {
    // 通过时：将所有未处理的建议新增实体默认设为 approved
    if (next === "approved" && item.suggestedEntities?.some((se) => !se.quickReviewStatus)) {
      setItems((prev) => prev.map((it) => it.id !== item.id ? it : {
        ...it,
        suggestedEntities: it.suggestedEntities?.map((se) => se.quickReviewStatus ? se : { ...se, quickReviewStatus: "approved" as const }),
      }));
    }
    const count = applyReview([item.id], next, options);
    if (count === 0) return;
    const editedCount = options?.edits
      ? computeEditedLabels(item, options.edits.versionId, options.edits.values, options.edits.language).length
      : 0;
    const actionText = next === "rejected"
      ? "已拒绝并放弃该版本，线上继续沿用原生效版本"
      : `${RESOLUTION_LABELS[getApprovalResolution(item)]}，已立即生效${editedCount > 0 ? `（人工修正 ${editedCount} 个字段）` : ""}`;
    MessagePlugin.success(`${actionText}：${item.name}（审核人 ${CURRENT_USER}）`);
    const nextItem = filteredDetailItems.find((entry) => entry.status === "pending" && entry.id !== item.id) || null;
    selectItem(nextItem);
  }

  function batchReview(next: ItemReviewStatus) {
    const targets = filteredDetailItems.filter((item) => item.status === "pending" && selectedIds.includes(item.id));
    if (targets.length < 2) {
      MessagePlugin.warning("请至少选择两条当前筛选结果中的待审核数据");
      return;
    }
    const count = applyReview(targets.map((item) => item.id), next);
    if (count === 0) return;
    MessagePlugin.success(`${next === "rejected" ? "批量拒绝" : "批量通过并生效"} ${count} 条`);
    setSelectedIds([]);
    selectItem(filteredDetailItems.find((item) => item.status === "pending" && !targets.some((target) => target.id === item.id)) || null);
  }

  // ===== 列表页表格列 =====
  const columns = [
    { colKey: "displayId", title: "任务 ID", width: 76,
      cell: ({ row }: { row: ReviewTask }) => <span className="review-task-sequence">{row.displayId}</span> },
    { colKey: "title", title: "任务标题", width: 188,
      cell: ({ row }: { row: ReviewTask }) => <div className="review-task-title-cell">{row.title}</div> },
    { colKey: "sourceLabel", title: "来源类型", width: 124,
      cell: ({ row }: { row: ReviewTask }) => <Tag size="small" className="review-source-tag">{row.sourceLabel}</Tag> },
    { colKey: "typeProgress", title: "类型及审核进度", width: 184,
      cell: ({ row }: { row: ReviewTask }) => (
        <Space size={4} breakLine className="review-type-progress-list">
          {(Object.keys(row.typeProgress) as (keyof typeof row.typeProgress)[])
            .filter((key) => row.typeProgress[key].total > 0)
            .map((key) => {
              const progress = row.typeProgress[key];
              // a/b 含义：a = 已审核数（approved + rejected），b = 总数
              const completed = progress.reviewed === progress.total && progress.total > 0;
              return (
                <Tag
                  key={key}
                  size="small"
                  className={`review-type-progress type-${key}${completed ? " is-completed" : ""}`}
                >
                  {OBJECT_TYPE_LABELS[key]} {progress.reviewed}/{progress.total}
                </Tag>
              );
            })}
        </Space>
      ) },
    { colKey: "reviewers", title: "参与审核人", width: 144,
      cell: ({ row }: { row: ReviewTask }) => (
        <Space size={4} breakLine className="reviewer-tags">
          {row.reviewerStats.length > 0 ? row.reviewerStats.map((stat) => (
            <Popup key={stat.reviewer} trigger="click" placement="bottom-left" showArrow content={<ReviewerStatsPopover stat={stat} />}>
              <Tag size="small" theme="primary" variant="light" className="reviewer-rtx-tag">{stat.reviewer}（{stat.reviewed}）</Tag>
            </Popup>
          )) : <span className="diff-empty">暂无</span>}
        </Space>
      ) },
    { colKey: "createdAt", title: "创建时间", width: 142,
      cell: ({ row }: { row: ReviewTask }) => <time className="review-task-time">{row.createdAt}</time> },
    { colKey: "op", title: "操作", width: 158,
      cell: ({ row }: { row: ReviewTask }) => (
        <Space size={12} className="review-task-actions">
          <Button className="review-task-action" variant="text" theme="primary" onClick={() => enterTask(row.id)}>
            {row.applicationStatus === "done" ? "查看结果" : "进入审核"}
          </Button>
          {row.applicationStatus === "done" && <span className="review-task-done-tag">已全部生效</span>}
        </Space>
      ) },
  ];

  // ================= 列表页 =================
  if (view === "list") {
    return (
      <div className="review-tab">
        <div className="review-desc">
          <InfoCircleIcon />
          <span>
            统一审核平台：只负责<strong>审核</strong>，不负责创建。审核任务由各业务来源（内容同步、QA 联动、相似错误挖掘、Excel 导入、手动录入、勾选待复审等）自动或手动生成后流入本页。<strong>审核结论一经提交即直接生效</strong>：通过的数据立即入库上线，拒绝的数据即被放弃；线上始终沿用<strong>最后一次通过审核的版本</strong>。
          </span>
        </div>

        <div className="review-task-tabs-bar">
          <span className="review-task-tabs-count">审核任务（{tasks.length}）</span>
          <span className="review-task-tabs-count review-task-tabs-count--reviewing">进行中（{taskCounts.reviewingTasks}）</span>
          <span className="review-task-tabs-count review-task-tabs-count--done">已全部生效（{taskCounts.doneTasks}）</span>
        </div>

        <div className="review-filters">
          <Select
            value={taskProgressFilter}
            onChange={(v) => setTaskProgressFilter(v as TaskProgressFilter)}
            style={{ width: 170 }}
            options={[
              { label: "全部审核进度", value: "all" },
              { label: "含待审核条目", value: "pending" },
              { label: "已全部处理", value: "done" },
            ]}
          />
          <Select
            value={sourceFilter}
            onChange={(v) => setSourceFilter(v as string)}
            style={{ width: 200 }}
            options={[
              { label: "全部来源类型", value: "all" },
              ...REVIEW_SOURCE_GROUPS.map((g) => ({
                group: g.group,
                children: g.options.map((o) => ({ label: o.label, value: o.value })),
              })),
            ]}
          />
          <Input
            value={keyword}
            onChange={(v) => setKeyword(v as string)}
            placeholder="搜索任务标题 / 编号 / 来源..."
            prefixIcon={<SearchIcon />}
            style={{ width: 260 }}
            clearable
          />
        </div>

        <Table className="review-task-table" rowKey="id" data={filteredTasks} columns={columns} bordered={false} hover size="medium"
          empty="暂无符合条件的审核任务" />
      </div>
    );
  }

  // ================= 详情页（固定高度左右工作区）=================
  return (
    <div className="review-tab review-detail-page">
      <div className="review-detail-head">
        <Button variant="text" icon={<ChevronLeftIcon />} onClick={backToList}>返回任务列表</Button>
        <span className="review-detail-title">{currentTask?.title}</span>
        <span className="review-detail-code">{currentTask?.displayId}</span>
        <Tag size="small" className="review-source-tag">{currentTask?.sourceLabel}</Tag>
        {(currentTask?.pending || 0) > 0 && <span className="review-detail-pending">{currentTask?.pending} 条待审核</span>}
        {currentTask?.applicationStatus === "done" && <span className="review-detail-ready">全部审核完成，结果已生效</span>}
        <span className="review-detail-meta-inline">创建时间 {currentTask?.createdAt} ｜ 共 {currentTask?.total} 条</span>
      </div>

      <div className="review-detail-workspace">
        <div className="review-split">
          {/* ===== 左：任务内待审核数据列表 ===== */}
          <div className="review-split-left">
            <div className="review-detail-list-title">
              <div className="review-detail-list-title-main">
                <strong>审核数据列表</strong>
                <span>{filteredDetailItems.length}/{detailItems.length} 条</span>
                {selectedFilteredIds.length > 0 && <em>已选 {selectedFilteredIds.length}</em>}
              </div>
            </div>

            {/* 对象类型单选：事实 / 实体 / 事件，接口按类型分批返回，不支持混合 */}
            <div className="review-objtype-tabs">
              {(["fact", "entity", "event"] as ReviewObjectType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  className={`review-objtype-tab${objectTypeTab === type ? " is-active" : ""} type-${type}`}
                  onClick={() => switchObjectTypeTab(type)}
                >
                  {OBJECT_TYPE_LABELS[type]}
                  <span className="review-objtype-tab-count">{objectTypeCounts[type]}</span>
                </button>
              ))}
            </div>

            <div className="review-detail-search">
              <Input
                value={detailFilters.keyword}
                onChange={(value) => updateDetailFilters({ keyword: value as string })}
                placeholder="搜索条目 ID、对象 ID 或标题"
                prefixIcon={<SearchIcon />}
                clearable
                size="small"
              />
              {selectedFilteredIds.length > 1 && filteredDetailItems.some((item) => item.status === "pending" && selectedFilteredIds.includes(item.id)) && (
                <div className="review-batch-actions">
                  <Button size="small" variant="outline" className="btn-minimal" onClick={() => batchReview("approved")}>批量通过</Button>
                  <Button size="small" variant="outline" className="btn-minimal btn-reject" onClick={() => batchReview("rejected")}>批量拒绝</Button>
                </div>
              )}
            </div>

            <div
              className="review-item-list"
              ref={detailListRef}
              onScroll={(event) => { detailScrollTopRef.current = event.currentTarget.scrollTop; }}
            >
              <div className="review-item-grid-head">
                <span className="review-grid-select review-grid-select-all">
                  {filteredDetailItems.some((item) => item.status === "pending") && filteredDetailItems.length > 0 && (
                    <Checkbox
                      title="全选当前筛选结果中的待审条目"
                      checked={selectedFilteredIds.length > 0 && filteredDetailItems.filter((item) => item.status === "pending").every((item) => selectedFilteredIds.includes(item.id))}
                      indeterminate={selectedFilteredIds.length > 0 && !filteredDetailItems.filter((item) => item.status === "pending").every((item) => selectedFilteredIds.includes(item.id))}
                      onChange={(checked) => {
                        const pendingIds = filteredDetailItems.filter((item) => item.status === "pending").map((item) => item.id);
                        setSelectedIds((previous) => checked
                          ? Array.from(new Set([...previous, ...pendingIds]))
                          : previous.filter((id) => !pendingIds.includes(id)));
                      }}
                    />
                  )}
                </span>
                <span>条目 ID</span>
                <span>对象 ID</span>
                <span>类型</span>
                <DetailColumnFilter
                  label="变更"
                  values={detailFilters.changeTypes}
                  options={DETAIL_CHANGE_TYPES.map((value) => ({ value, label: CHANGE_TYPE_LABELS[value] }))}
                  onChange={(values) => updateDetailFilters({ changeTypes: values as ChangeType[] })}
                />
                <DetailColumnFilter
                  label="优先级"
                  values={detailFilters.priorities}
                  options={DETAIL_PRIORITIES.map((value) => ({ value, label: PRIORITY_LABELS[value] }))}
                  onChange={(values) => updateDetailFilters({ priorities: values as ReviewPriority[] })}
                />
                {/* 审核状态筛选：列标题含动态计数，随其他筛选条件联动 */}
                <DetailColumnFilter
                  label="审核状态"
                  values={detailFilters.statuses}
                  options={[
                    { value: "pending", label: `待审核（${statusCounts.pending}）` },
                    { value: "approved", label: `已通过（${statusCounts.approved}）` },
                    { value: "rejected", label: `已拒绝（${statusCounts.rejected}）` },
                  ]}
                  countLabel={`全部（${statusCounts.all}）`}
                  onChange={(values) => updateDetailFilters({ statuses: values as ItemReviewStatus[] })}
                />
              </div>
              {filteredDetailItems.length === 0 && <div className="review-empty">当前筛选条件下暂无数据</div>}
              {pagedDetailItems.map((item, index) => {
                const { candidates, conflictCount, duplicateCount } = getCandidateStats(item);
                // 条目ID为列表序号（从1开始，随分页累加），非库内对象ID
                const displaySeq = (safeDetailPage - 1) * detailPageSize + index + 1;
                return (
                  <div
                    key={item.id}
                    className={`review-list-row review-item-grid-row ${activeItemId === item.id ? "is-active" : ""}`}
                    onClick={() => selectItem(item)}
                  >
                    <span className="review-grid-select">
                      {item.status === "pending" && (
                        <Checkbox
                          checked={selectedFilteredIds.includes(item.id)}
                          onChange={(checked) => setSelectedIds((previous) => checked ? [...previous, item.id] : previous.filter((id) => id !== item.id))}
                          onClick={(context) => context?.e?.stopPropagation?.()}
                        />
                      )}
                    </span>
                    <span className="review-grid-id">
                      <strong>{displaySeq}</strong>
                    </span>
                    <span className="review-grid-object" title={`${getObjectId(item)} · ${item.name}`}>
                      <div className="review-grid-object-id">
                        <strong>{getObjectId(item)}</strong>
                        {(conflictCount > 0 || duplicateCount > 0 || item.changeType === "delete") && (
                          <Popup
                            trigger="hover"
                            placement="bottom-left"
                            showArrow
                            content={
                              <CandidateTooltip
                                candidates={candidates}
                                conflictCount={conflictCount}
                                duplicateCount={duplicateCount}
                                changeType={item.changeType}
                              />
                            }
                          >
                            <span className="review-grid-candidates">
                              {conflictCount > 0 && <em className="type-conflict">冲突 {conflictCount}</em>}
                              {duplicateCount > 0 && <em className="type-duplicate">重复 {duplicateCount}</em>}
                            </span>
                          </Popup>
                        )}
                      </div>
                      <small>{item.name}</small>
                    </span>
                    {/* 对象类型 */}
                    <span className={`rv-tag rv-tag-objtype rv-tag-objtype-${item.objectType}`}>
                      {OBJECT_TYPE_LABELS[item.objectType]}
                    </span>
                    {/* 变更类型 */}
                    <span className={`rv-tag rv-tag-change rv-tag-change-${item.changeType}`}>
                      {CHANGE_TYPE_LABELS[item.changeType]}
                    </span>
                    {/* 优先级 */}
                    <span className={`rv-tag rv-tag-priority rv-tag-priority-${getReviewPriority(item)}`}>
                      {PRIORITY_LABELS[getReviewPriority(item)]}
                    </span>
                    {/* 审核状态 */}
                    <span className={`rv-tag rv-tag-status rv-tag-status-${item.status}`}>
                      {item.status === "approved" ? "已通过" : item.status === "rejected" ? "已拒绝" : "待审核"}
                    </span>
                  </div>
                );
              })}
            </div>

            {filteredDetailItems.length > 0 && (
              <Pagination
                className="review-detail-pagination"
                current={safeDetailPage}
                pageSize={detailPageSize}
                total={filteredDetailItems.length}
                pageSizeOptions={[5, 10, 20, 50]}
                showJumper={false}
                size="small"
                onChange={({ current, pageSize }) => {
                  setDetailPage(current);
                  setDetailPageSize(pageSize);
                  detailScrollTopRef.current = 0;
                  restoreScrollTopRef.current = 0;
                }}
              />
            )}
          </div>

          {/* ===== 右：新旧版本审核详情 ===== */}
          <div className="review-split-right">
            {!activeItem ? (
              <div className="review-empty review-diff-empty">请从左侧选择一条数据查看审核详情</div>
            ) : (
              <DiffPanel
                item={activeItem}
                taskDisplayId={currentTask?.displayId || ""}
                taskDisplayIds={taskDisplayIds}
                activeVersionId={activeVersionId}
                viewMode={detailViewMode}
                onChangeVersion={setActiveVersionId}
                onChangeViewMode={setDetailViewMode}
                onSaveFields={(values, language) => updatePendingFields(activeItem.id, activeVersionId, values, language)}
                onReject={(note) => reviewSingle(activeItem, "rejected", { note })}
                onApprove={(options) => reviewSingle(activeItem, "approved", {
                  note: options.note,
                  edits: options.edits ? { itemId: activeItem.id, ...options.edits } : undefined,
                })}
                onUpdateSuggestedEntity={(entityName, status) => {
                  setItems((prev) => prev.map((it) => it.id !== activeItem.id ? it : {
                    ...it,
                    suggestedEntities: it.suggestedEntities?.map((se) => se.name === entityName ? { ...se, quickReviewStatus: status } : se),
                  }));
                }}
                onJumpToItem={(itemId) => {
                  const inCurrent = (currentTask?.items || []).find((it) => it.id === itemId);
                  if (inCurrent) {
                    setObjectTypeTab(inCurrent.objectType);
                    setDetailPage(1);
                    setSelectedIds([]);
                    selectItem(inCurrent);
                    return;
                  }
                  const targetTask = tasks.find((t) => t.items.some((it) => it.id === itemId));
                  if (targetTask) {
                    enterTaskWithFocus(targetTask.id, itemId);
                  }
                }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function CandidateTooltip({ candidates, conflictCount, duplicateCount, changeType }: { candidates: ReviewCandidate[]; conflictCount: number; duplicateCount: number; changeType?: string }) {
  if (candidates.length === 0) return null;
  const isDelete = changeType === "delete";
  return (
    <div className="review-candidates-tooltip">
      <div className="review-candidates-tooltip-head">
        {isDelete && <em className="type-delete">删除</em>}
        {!isDelete && conflictCount > 0 && <em className="type-conflict">冲突 {conflictCount}</em>}
        {!isDelete && duplicateCount > 0 && <em className="type-duplicate">重复 {duplicateCount}</em>}
      </div>
      <div className="review-candidates-tooltip-list">
        {candidates.map((candidate) => (
          <div key={candidate.key} className={`review-candidates-tooltip-row type-${candidate.type}`}>
            <span>{candidate.label}</span>
            <em>{isDelete ? "删除" : getCandidateTag(candidate)}</em>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReviewerStatsPopover({ stat }: { stat: ReviewerStat }) {
  const types = (Object.keys(stat.typeCounts) as (keyof typeof stat.typeCounts)[])
    .filter((key) => stat.typeCounts[key] > 0);
  return (
    <div className="reviewer-stats-popover">
      <strong>{stat.reviewer} 已审核 {stat.reviewed} 条</strong>
      {types.length > 0 ? types.map((key) => (
        <span key={key}>{OBJECT_TYPE_LABELS[key]} {stat.typeCounts[key]}</span>
      )) : <span>暂无已处理条目</span>}
    </div>
  );
}

function PriorityTag({ priority }: { priority: ReviewPriority }) {
  return <Tag size="small" className={`review-priority priority-${priority}`}>{PRIORITY_LABELS[priority]}</Tag>;
}

function DetailColumnFilter(props: {
  label: string;
  values: string[];
  options: { value: string; label: string }[];
  /** 列标题处额外显示的计数文字，如「全部（120）」 */
  countLabel?: string;
  onChange: (values: string[]) => void;
}) {
  const { label, values, options, countLabel, onChange } = props;
  const selected = new Set(values);
  return (
    <Popup
      trigger="click"
      placement="bottom-left"
      showArrow
      content={(
        <div className="review-column-filter-menu">
          <div className="review-column-filter-menu-head">
            <span>{label}筛选</span>
            {values.length > 0 && <button type="button" onClick={() => onChange([])}>清除</button>}
          </div>
          {options.map((option) => (
            <Checkbox
              key={option.value}
              checked={selected.has(option.value)}
              onChange={(checked) => onChange(checked
                ? [...values, option.value]
                : values.filter((value) => value !== option.value))}
            >
              {option.label}
            </Checkbox>
          ))}
        </div>
      )}
    >
      <button type="button" className={`review-column-filter-trigger ${values.length > 0 ? "has-filter" : ""}`}>
        <span>{label}</span>
        {countLabel && values.length === 0
          ? <em className="review-column-filter-count">{countLabel}</em>
          : <em>{values.length > 0 ? values.length : "⌄"}</em>
        }
      </button>
    </Popup>
  );
}

// ============ 字段级差异渲染：按字符对比新旧文本，只高亮真正变化的片段 ============
function renderFieldDiff(f: FieldDiff, language: ReviewLanguage = "zh"): { oldNode: React.ReactNode; newNode: React.ReactNode } {
  const emptyMark = isArabicReviewLanguage(language) ? "—" : "（空）";
  const deletedMark = isArabicReviewLanguage(language) ? "محذوف" : "（删除）";
  const changed = isFieldChanged(f);
  if (!changed) {
    return {
      oldNode: f.oldValue || <span className="diff-empty">{emptyMark}</span>,
      newNode: f.newValue || <span className="diff-empty">{emptyMark}</span>,
    };
  }
  // 整段删除：不适合逐字符比对，直接整体标记
  if (f.newValue === "（删除）") {
    return {
      oldNode: f.oldValue
        ? <span className="diff-del">{f.oldValue}</span>
        : <span className="diff-empty">{emptyMark}</span>,
      newNode: <span className="diff-del-mark">{deletedMark}</span>,
    };
  }
  const segments = diffChars(f.oldValue, f.newValue);
  const oldSegs = segments.filter((s) => s.type !== "add");
  const newSegs = segments.filter((s) => s.type !== "del");
  return {
    oldNode: oldSegs.length === 0
      ? <span className="diff-empty">{emptyMark}</span>
      : oldSegs.map((s, idx) => s.type === "del"
        ? <span className="diff-del" key={idx}>{s.text}</span>
        : <span key={idx}>{s.text}</span>),
    newNode: newSegs.length === 0
      ? <span className="diff-empty">{emptyMark}</span>
      : newSegs.map((s, idx) => s.type === "add"
        ? <span className="diff-add" key={idx}>{s.text}</span>
        : <span key={idx}>{s.text}</span>),
  };
}

// ============ 右侧对比面板 ============
/** 审核决策入参：备注可选；「修正并生效」时携带编辑值与编辑语言。 */
export interface ReviewDecisionOptions {
  note?: string;
  edits?: { versionId: string; values: Record<string, string>; language: ReviewLanguage };
}

function DiffPanel(props: {
  item: ReviewItem;
  taskDisplayId: string;
  taskDisplayIds: Record<string, string>;
  activeVersionId: string;
  viewMode: DetailViewMode;
  onChangeVersion: (id: string) => void;
  onChangeViewMode: (mode: DetailViewMode) => void;
  onSaveFields: (values: Record<string, string>, language: ReviewLanguage) => void;
  onReject: (note?: string) => void;
  onApprove: (options: ReviewDecisionOptions) => void;
  /** 快速审核建议新增实体的结论（仅提供建议，不直接写库） */
  onUpdateSuggestedEntity?: (entityName: string, status: "approved" | "rejected" | undefined) => void;
  /** 点击「待审核 #N」跳转到该条目 */
  onJumpToItem?: (itemId: number) => void;
}) {
  const {
    item, taskDisplayId, taskDisplayIds, activeVersionId, viewMode,
    onChangeVersion, onChangeViewMode, onReject, onApprove, onUpdateSuggestedEntity, onJumpToItem,
  } = props;
  const activeVersion: PendingVersion | undefined =
    item.pendingVersions.find((version) => version.versionId === activeVersionId) || item.pendingVersions[0];
  const fields = activeVersion?.fields || [];
  const objLabel = OBJECT_TYPE_LABELS[item.objectType];
  const done = item.status !== "pending";
  const isCleanNew = item.changeType === "new" && !item.conflictType;
  const canEdit = !done && item.changeType !== "delete";
  const approvalLabel = RESOLUTION_LABELS[getApprovalResolution(item)];

  const [editing, setEditing] = useState(false);
  const [editFields, setEditFields] = useState<Record<string, string>>({});
  const [expandedSections, setExpandedSections] = useState<string[]>([]);
  const [activeCandidateKey, setActiveCandidateKey] = useState<string | null>(null);
  const [activeLanguage, setActiveLanguage] = useState<ReviewLanguage>("zh");
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState("");

  // 覆盖对象是更新任务的主处理对象：始终置顶；冲突、重复仅作为可切换的其他问题。
  const candidates: ReviewCandidate[] = useMemo(() => {
    const sourceCandidates = (item.candidates || []).filter((candidate) => {
      // 显式下发的覆盖对象不能被“自身事实 ID”过滤掉。
      if (candidate.type === "cover" || !item.factId) return true;
      const candidateFactId = candidate.liveVersion.fields.find((field) => field.field === "fact_id")?.value
        || candidate.label.replace(/^[^#]*#?/, "");
      const candidateNum = Number(candidateFactId);
      return !Number.isFinite(candidateNum) || candidateNum <= 0
        ? !candidate.label.includes(`#${item.factId}`)
        : candidateNum !== item.factId;
    });
    if (isCleanNew) return sourceCandidates;

    const explicitCover = sourceCandidates.find((candidate) => candidate.type === "cover");
    const implicitCover: ReviewCandidate | null = !explicitCover && item.changeType === "update" ? {
      key: `cover-${item.objectId || item.factId || item.id}`,
      label: getObjectId(item),
      type: "cover",
      reason: item.conflictReason,
      liveVersion: item.liveVersion || { createdAt: item.createdAt, fields: [] },
    } : null;

    const fallbackCandidate: ReviewCandidate | null = sourceCandidates.length === 0 && !implicitCover ? {
      key: "live",
      label: `${objLabel} ${getObjectId(item)}`,
      type: item.conflictType || "conflict",
      reason: item.conflictReason,
      liveVersion: item.liveVersion || { createdAt: item.createdAt, fields: [] },
    } : null;

    return [...(implicitCover ? [implicitCover] : []), ...sourceCandidates, ...(fallbackCandidate ? [fallbackCandidate] : [])]
      .sort((left, right) => getCandidatePriority(left) - getCandidatePriority(right));
  }, [item, isCleanNew, objLabel]);

  const activeCandidate = useMemo(
    () => candidates.find((candidate) => candidate.key === activeCandidateKey) || candidates[0] || null,
    [candidates, activeCandidateKey],
  );

  // 根据语言读取候选快照和待审值；非多语言字段始终沿用原值。
  const baseFields: FieldDiff[] = useMemo(() => {
    const oldValues = new Map(
      (activeCandidate?.liveVersion.fields || []).map((entry) => [
        entry.field,
        getLocalizedSnapshotValue(item.objectType, entry, activeLanguage),
      ]),
    );
    return fields.map((field) => ({
      ...field,
      oldValue: getLocalizedFieldDiffValue(item.objectType, field, activeLanguage, "oldValue")
        ?? oldValues.get(field.field)
        ?? "",
      newValue: getLocalizedFieldDiffValue(item.objectType, field, activeLanguage, "newValue") ?? "",
    }));
  }, [activeCandidate, activeLanguage, fields, item.objectType]);

  // 原始视图补齐：与编辑窗口字段一致的字段 + 候选快照字段，未匹配字段以空值占位。
  const rawFieldsByName = useMemo(() => {
    const map = new Map<string, FieldDiff>();
    baseFields.forEach((field) => map.set(field.field, field));
    RAW_FIELD_SECTIONS[item.objectType]?.forEach((section) => {
      section.fields.forEach((name) => {
        if (map.has(name)) return;
        map.set(name, { field: name, label: getFieldLabel(name), oldValue: "", newValue: "" });
      });
    });
    return map;
  }, [baseFields, item.objectType]);

  const changedCount = useMemo(
    () => baseFields.filter((field) => isFieldChanged(field) && (field.oldValue || field.newValue)).length,
    [baseFields],
  );
  const hasContent = useMemo(
    () => baseFields.some((field) => (field.newValue || "").trim().length > 0),
    [baseFields],
  );

  // 实时计算当前编辑窗口中实际改动过的字段标签（用于「人工修正」标记）
  const liveEditedLabels = useMemo(
    () => baseFields
      .filter((field) => (editFields[field.field] ?? field.newValue) !== field.newValue)
      .map((field) => field.label),
    [baseFields, editFields],
  );
  // 展示用修正标记：已处理读条目记录，编辑中实时计算
  const editedLabelsForDisplay = done ? item.editedFields : (editing ? liveEditedLabels : undefined);

  // 冲突/重复/覆盖：默认展开存在真实差异的字段；新增无冲突：默认全部展开供确认。
  const expandedKeys = useMemo(() => {
    const keys: string[] = [];
    if (isCleanNew) {
      // 新增无冲突：默认全部展开各区段
      keys.push("content", "time", "source");
    } else {
      // 冲突/重复/覆盖：仅展开存在真实差异的字段区段
      for (const section of buildDetailSections(item, baseFields, taskDisplayId, activeCandidate)) {
        if (section.fields && getChangedFieldCount(section.fields) > 0) keys.push(section.key);
      }
    }
    return keys;
  }, [item, baseFields, taskDisplayId, activeCandidate, isCleanNew]);

  useEffect(() => {
    if (candidates.length > 0 && !activeCandidateKey) {
      setActiveCandidateKey(candidates[0].key);
    } else if (candidates.length === 0) {
      setActiveCandidateKey(null);
    } else if (activeCandidateKey && !candidates.some((candidate) => candidate.key === activeCandidateKey)) {
      setActiveCandidateKey(candidates[0].key);
    }
  }, [candidates, activeCandidateKey]);

  useEffect(() => {
    setActiveLanguage("zh");
  }, [item.id]);

  function buildEditFields() {
    return baseFields.reduce<Record<string, string>>((result, field) => {
      result[field.field] = field.newValue;
      return result;
    }, {});
  }

  const fieldsSignature = baseFields.map((field) => `${field.field}|${field.oldValue}|${field.newValue}`).join("\u0001");
  useEffect(() => {
    setEditFields(buildEditFields());
    setEditing(false);
    setExpandedSections(expandedKeys);
    setNote("");
    setNoteOpen(false);
  }, [item.id, activeVersion?.versionId, fieldsSignature, activeCandidateKey, expandedKeys.join("|")]);

  function toggleSection(key: string) {
    setExpandedSections((previous) => previous.includes(key) ? previous.filter((entry) => entry !== key) : [...previous, key]);
  }

  function cancelEdits() {
    setEditFields(buildEditFields());
    setEditing(false);
  }

  /** 「修正并生效」：编辑值直接生效，一步完成「修正 + 通过」。 */
  function approveWithEdits() {
    onApprove({
      note: note.trim() || undefined,
      edits: {
        versionId: activeVersion?.versionId || "",
        values: editFields,
        language: activeLanguage,
      },
    });
  }

  // 进入编辑态时自动切到原始视图，方便内联编辑与字段对照。
  useEffect(() => {
    if (editing && viewMode !== "raw") onChangeViewMode("raw");
  }, [editing, viewMode, onChangeViewMode]);

  // 简化视图：差异聚焦、相同字段淡化；原始视图：双列完整展示
  const useRaw = viewMode === "raw";
  const showSourceOnly = isCleanNew;

  return (
    <div className="diff-panel">
      {/* 顶栏：标题 + 多语言信息，冻结不参与滚动 */}
      <div className="diff-panel-fixed-head">
        <div className="diff-panel-head">
          <div className="diff-panel-title-group">
            <span className="diff-panel-title">审核详情</span>
            <span className="diff-panel-comparison-target">{getComparisonTargetLabel(item, baseFields)}</span>
            <Tag size="small" className={`type-tag type-${item.objectType}`}>{objLabel}</Tag>
            <span className="review-change-type" data-type={item.changeType}>
              {CHANGE_TYPE_LABELS[item.changeType]}
            </span>
            <PriorityTag priority={getReviewPriority(item)} />
          </div>
          <div className="diff-panel-tools">
            {!showSourceOnly && (
              <div className="diff-view-switch" role="group" aria-label="详情视图">
                <button type="button" className={!useRaw ? "is-active" : ""} onClick={() => onChangeViewMode("simple")}>简化</button>
                <button type="button" className={useRaw ? "is-active" : ""} onClick={() => onChangeViewMode("raw")}>原始</button>
              </div>
            )}
          </div>
        </div>

        <ReviewLanguageSwitcher value={activeLanguage} onChange={setActiveLanguage} />
      </div>

      {/* 从 AI差异分析 开始，以下区域独立滚动 */}
      <div className="diff-panel-scroll">
        <MachineHintCard item={item} candidates={candidates} activeCandidateKey={activeCandidateKey ?? undefined} />

        {item.supersededBy && (
          <div className="review-item-superseded">
            <InfoCircleIcon />
            <span>
              本条同事实已在较新任务 <strong>{item.supersededBy.displayId}</strong>（{item.supersededBy.updatedAt}）中通过处理
              {item.supersededBy.operator ? `，由 ${item.supersededBy.operator} 完成` : ""}。
              当前条目视为“已作废”，仅供查询，不再重复审核。
            </span>
          </div>
        )}

        {showSourceOnly ? (
          <RawConfigCompare
            item={item}
            fields={baseFields}
            language={activeLanguage}
            candidate={null}
            editing={editing}
            editFields={editFields}
            onChangeField={(field, value) => setEditFields((previous) => ({ ...previous, [field]: value }))}
            editedFields={editedLabelsForDisplay}
            sourceOnly
          />
        ) : useRaw ? (
          <RawConfigCompare
            item={item}
            fields={baseFields}
            language={activeLanguage}
            candidate={activeCandidate}
            candidates={candidates}
            onSelectCandidate={setActiveCandidateKey}
            editing={editing}
            editFields={editFields}
            onChangeField={(field, value) => setEditFields((previous) => ({ ...previous, [field]: value }))}
            editedFields={editedLabelsForDisplay}
          />
        ) : (
          <SimpleDiff
            item={item}
            language={activeLanguage}
            candidate={activeCandidate}
            candidates={candidates}
            onSelectCandidate={setActiveCandidateKey}
            sections={buildDetailSections(item, baseFields, taskDisplayId, activeCandidate)}
            expandedSections={expandedSections}
            onToggleSection={toggleSection}
            editing={editing}
            editFields={editFields}
            onChangeField={(field, value) => setEditFields((previous) => ({ ...previous, [field]: value }))}
            editedFields={editedLabelsForDisplay}
            showDifferences={true}
            done={done}
            onUpdateSuggestedEntity={onUpdateSuggestedEntity}
            onJumpToItem={onJumpToItem}
          />
        )}

        {item.liveVersion && !showSourceOnly && (
          <div className="diff-live-info">当前线上生效版本快照时间：{item.liveVersion.createdAt}（拒绝后继续沿用此版本）</div>
        )}
      </div>

      <div className="diff-action-dock">
        {done ? (
          <div className="diff-actions-done">
            <span>
              {item.status === "approved" ? "该条目已通过并立即生效" : "该条目已拒绝，线上继续沿用原生效版本"}
              {item.resolution ? `（${RESOLUTION_LABELS[item.resolution]}）` : ""}
              {item.reviewedAt ? ` ｜ ${item.reviewedAt}` : ""}
              {item.reviewedBy ? ` ｜ 审核人 ${item.reviewedBy}` : ""}
            </span>
            {item.editedFields && item.editedFields.length > 0 && (
              <span className="diff-done-meta">人工修正：{item.editedFields.join("、")}</span>
            )}
            {item.reviewNote && <span className="diff-done-meta">备注：{item.reviewNote}</span>}
            <em>审核结论已生效，不可撤销</em>
          </div>
        ) : item.supersededBy ? (
          <div className="diff-actions-done">已在较新任务中处理，重复审核已锁定</div>
        ) : (
          <div className="diff-note-area">
            <div className="diff-note-input">
              {noteOpen ? (
                <Textarea
                  value={note}
                  onChange={(value) => setNote(value as string)}
                  placeholder="审核备注（可选，随结论一并记录）"
                  autosize={{ minRows: 1, maxRows: 3 }}
                />
              ) : (
                <Button variant="text" size="small" className="diff-note-toggle" onClick={() => setNoteOpen(true)}>
                  + 添加备注
                </Button>
              )}
            </div>
            {/* 审核操作按钮：转移到右侧 */}
            <div className="diff-actions">
              {editing ? (
                <>
                  <Button className="btn-minimal btn-primary-dark" onClick={approveWithEdits}>修正并生效</Button>
                  <Button variant="outline" className="btn-minimal" onClick={cancelEdits}>取消编辑</Button>
                </>
              ) : (
                <>
                  <Button className="btn-minimal btn-primary-dark" onClick={() => onApprove({ note: note.trim() || undefined })}>{approvalLabel}</Button>
                  <Button variant="outline" className="btn-minimal btn-reject" onClick={() => onReject(note.trim() || undefined)}>拒绝</Button>
                  {canEdit && <Button variant="outline" className="btn-minimal" onClick={() => setEditing(true)}>编辑修正</Button>}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** 建议新增实体区块：紧凑行内 √/× 快速结论，嵌入对比区域下方 */
function SuggestedEntitySection({
  entities,
  itemDone,
  onUpdate,
}: {
  entities: SuggestedEntity[];
  itemDone: boolean;
  onUpdate?: (entityName: string, status: "approved" | "rejected" | undefined) => void;
}) {
  return (
    <div className="suggested-entity-section">
      <div className="suggested-entity-head">
        <span className="suggested-entity-title">建议新增实体</span>
        <span className="suggested-entity-hint">
          AI 识别出以下实体在库中无匹配，可给出快速结论（仅参考），最终须经实体审核分页通过后生效
        </span>
      </div>
      <div className="suggested-entity-list">
        {entities.map((entity) => {
          const status = entity.quickReviewStatus;
          return (
            <span
              key={entity.name}
              className={`suggested-entity-chip${status === "approved" ? " is-approved" : status === "rejected" ? " is-rejected" : ""}`}
            >
              <span className="suggested-entity-name">{entity.name}</span>
              {entity.linkedItemId && (
                <span className="suggested-entity-link" title={`审核条目 #${entity.linkedItemId}${entity.linkedTaskId ? `（任务 ${entity.linkedTaskId}）` : ""}`}>
                  待审核 #{entity.linkedItemId}
                </span>
              )}
              {status === "approved" && <em className="suggested-entity-verdict is-approved">✓ 已通过</em>}
              {status === "rejected" && <em className="suggested-entity-verdict is-rejected">✕ 已拒绝</em>}
              {!itemDone && status !== "approved" && (
                <button type="button" className="suggested-entity-btn approve" title="确认新增" onClick={() => onUpdate?.(entity.name, "approved")}>✓</button>
              )}
              {!itemDone && status !== "rejected" && (
                <button type="button" className="suggested-entity-btn reject" title="拒绝新增" onClick={() => onUpdate?.(entity.name, "rejected")}>✕</button>
              )}
              {!itemDone && status !== undefined && (
                <button type="button" className="suggested-entity-btn reset" title="撤销结论" onClick={() => onUpdate?.(entity.name, undefined)}>↩</button>
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
}

/** AI差异分析提示卡：冲突 / 重复 / 术语参考结构化展示。冲突说明联动「库内数据」选中项。 */
function MachineHintCard({
  item,
  candidates,
  activeCandidateKey,
}: {
  item: ReviewItem;
  candidates: ReviewCandidate[];
  activeCandidateKey?: string;
}) {
  const hints = item.machineHints;
  if (!hints) return null;
  const hasConflict = Boolean(item.conflictType);
  const hasTermRefs = Boolean(hints.termRefs?.length);

  // 冲突 / 重复说明联动「库内数据」选中项：
  // - 一对多（多个候选）：说明保持一致，不随选择切换；
  // - 一对一 / 单候选：取当前选中候选的 reason，与库内数据选择项一致。
  const isOneToMany = candidates.length > 1;
  const activeCandidate =
    candidates.find((candidate) => candidate.key === activeCandidateKey) ?? candidates[0];
  const predictionBody = hasConflict
    ? isOneToMany
      ? hints.conflictReason || ""
      : activeCandidate?.reason || hints.conflictReason || ""
    : "";

  // 正文（冲突说明）为空则不展示。
  if (!predictionBody && !hasTermRefs) return null;

  return (
    <div className="machine-hint-card">
      <div className="machine-hint-head">
        <span className="machine-hint-title">AI差异分析</span>
        <span className="machine-hint-sub">由同步 / 导入流水线自动分析，供审核决策参考</span>
      </div>
      {predictionBody && (
        <div className="machine-hint-row machine-hint-row--conflict">
          <span className="machine-hint-text">
            <em className={`machine-hint-target machine-hint-target--${item.conflictType === "duplicate" ? "duplicate" : "conflict"}`}>
              与 {activeCandidate?.label || ""} {item.conflictType === "duplicate" ? "重复" : "冲突"}
            </em>
            {" "}{predictionBody}
          </span>
        </div>
      )}
      {hints.termRefs && hints.termRefs.length > 0 && (
        <div className="machine-hint-row">
          <em className="machine-hint-badge machine-hint-badge--term">术语</em>
          <div className="machine-hint-terms">
            {hints.termRefs.map((ref) => (
              <span className="machine-hint-term" key={ref.term}>
                <b>{ref.term}</b> → {ref.reference}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ReviewLanguageSwitcher({ value, onChange }: { value: ReviewLanguage; onChange: (language: ReviewLanguage) => void }) {
  return (
    <div className="review-language-switcher" role="group" aria-label="多语言信息">
      <span>多语言信息</span>
      <div className="review-language-options">
        {REVIEW_LANGUAGE_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            className={value === option.value ? "is-active" : ""}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function LocalizedReviewFieldValue({
  language,
  className,
  children,
}: {
  language: ReviewLanguage;
  className: string;
  children: React.ReactNode;
}) {
  const rtl = isArabicReviewLanguage(language);
  return (
    <div
      className={`${className} review-localized-field-value${rtl ? " is-rtl" : ""}`}
      dir={rtl ? "rtl" : "ltr"}
      lang={rtl ? "ar" : undefined}
    >
      {children}
    </div>
  );
}

function CandidateTabs(props: {
  candidates: ReviewCandidate[];
  activeKey: string;
  onChange: (key: string) => void;
}) {
  const { candidates, activeKey, onChange } = props;
  if (candidates.length <= 1) return null;
  return (
    <div className="review-candidate-tabs" role="tablist">
      {candidates.map((candidate) => (
        <button
          key={candidate.key}
          type="button"
          role="tab"
          aria-selected={activeKey === candidate.key}
          className={`review-candidate-tab type-${candidate.type}`}
          onClick={() => onChange(candidate.key)}
        >
          <span className="review-candidate-tab-label">{candidate.label}</span>
        </button>
      ))}
    </div>
  );
}

function SimpleDiff(props: {
  item: ReviewItem;
  language: ReviewLanguage;
  candidate: ReviewCandidate | null;
  candidates?: ReviewCandidate[];
  onSelectCandidate?: (key: string) => void;
  sections: ReturnType<typeof buildDetailSections>;
  expandedSections: string[];
  onToggleSection: (key: string) => void;
  editing: boolean;
  editFields: Record<string, string>;
  onChangeField: (field: string, value: string) => void;
  showDifferences: boolean;
  editedFields?: string[];
  done?: boolean;
  onUpdateSuggestedEntity?: (entityName: string, status: "approved" | "rejected" | undefined) => void;
  /** 点击「待审核 #N」跳转到该条目 */
  onJumpToItem?: (itemId: number) => void;
}) {
  const { item, language, candidate, candidates, onSelectCandidate, sections, editing, editFields, onChangeField, editedFields } = props;
  const objectLabel = OBJECT_TYPE_LABELS[item.objectType];
  // 简化视图：按候选分组，所有存在差异的字段聚合成单一扁平列表。
  // 1 个候选：单组对比；
  // 2+ 个候选：不再下拉切换，改为下方依次并排 n 组对比。
  const candidateList = (candidates && candidates.length > 0)
    ? candidates
    : (candidate ? [candidate] : []);

  // 收集所有差异字段，并按候选快照替换 oldValue；新数据列使用原始 newValue。
  const collectChangedFields = (): FieldDiff[] => {
    const result: FieldDiff[] = [];
    sections.forEach((section) => {
      if (!section.fields) return;
      section.fields.forEach((field) => {
        if (isFieldChanged(field) && (field.newValue || field.oldValue)) result.push(field);
      });
    });
    return result;
  };
  const allChangedFields = collectChangedFields();

  const buildGroupFields = (snapshot: ReviewCandidate | null): FieldDiff[] => {
    const oldMap = new Map((snapshot?.liveVersion.fields || []).map((entry) => [
      entry.field,
      getLocalizedSnapshotValue(item.objectType, entry, language),
    ]));
    return allChangedFields
      .map((field) => ({
        ...field,
        oldValue: getLocalizedFieldDiffValue(item.objectType, field, language, "oldValue")
          ?? oldMap.get(field.field)
          ?? "",
        newValue: getLocalizedFieldDiffValue(item.objectType, field, language, "newValue") ?? "",
      }))
      .filter((field) => field.oldValue || field.newValue);
  };

  // 关联实体「标记删除」状态（点 × 置灰划删除线，再点撤销）
  const [removedEntities, setRemovedEntities] = React.useState<Set<string>>(new Set());
  const toggleRemoveEntity = (tag: string) => {
    setRemovedEntities((prev) => {
      const next = new Set(prev);
      next.has(tag) ? next.delete(tag) : next.add(tag);
      return next;
    });
  };

  const renderTable = (snap: ReviewCandidate | null, key: string) => {
    const groupFields = buildGroupFields(snap);
    if (groupFields.length === 0) return null;
    return (
      <div className="diff-table" key={key}>
        <div className="diff-row diff-head">
          <div className="diff-cell diff-field">字段</div>
          <div className="diff-cell diff-old">线上 / {snap?.label || "候选数据"}</div>
          <div className="diff-cell diff-new">新数据（待审）</div>
        </div>
        {groupFields.map((field) => {
          const { oldNode, newNode } = renderFieldDiff(field, language);
          const isDeletable = item.changeType === "new" || item.changeType === "update";

          // 关联实体字段：在新数据列内嵌标签化展示 + 建议新增区域
          if (field.field === "related_entities") {
            const existingTags = item.relatedEntities ?? [];
            const suggested = item.suggestedEntities ?? [];
            return (
              <div className="diff-row is-changed" key={`${key}-${field.field}`}>
                <div className="diff-cell diff-field">
                  {field.label}
                  <span className="diff-field-dot" title="该字段有变化" />
                </div>
                <LocalizedReviewFieldValue language={language} className="diff-cell diff-old">
                  {oldNode}
                </LocalizedReviewFieldValue>
                <div className="diff-cell diff-new diff-entity-cell">
                  {/* 已有关联实体标签 */}
                  {existingTags.length > 0 && (
                    <div className="diff-entity-existing">
                      {existingTags.map((tag) => {
                        const removed = removedEntities.has(tag);
                        return (
                          <span key={tag} className={`diff-entity-tag${removed ? " is-removed" : ""}`}>
                            {tag}
                            {isDeletable && (
                              <button
                                type="button"
                                className="diff-entity-tag-del"
                                title={removed ? `撤销移除 ${tag}` : `移除 ${tag}`}
                                onClick={() => toggleRemoveEntity(tag)}
                              >×</button>
                            )}
                          </span>
                        );
                      })}
                    </div>
                  )}
                  {/* 建议新增实体：独立框，「建议新增」单独一行 */}
                  {suggested.length > 0 && (
                    <div className="diff-entity-suggested-box">
                      <div className="diff-entity-suggested-heading">建议新增</div>
                      <div className="diff-entity-suggested-chips">
                        {suggested.map((entity) => {
                          const status = entity.quickReviewStatus;
                          const isApproved = status === "approved";
                          const isRejected = status === "rejected";
                          return (
                            <span
                              key={entity.name}
                              className={`suggested-entity-chip${isApproved ? " is-approved" : isRejected ? " is-rejected" : ""}`}
                            >
                              <span className="suggested-entity-name">{entity.name}</span>
                              {entity.linkedItemId && (
                                <button
                                  type="button"
                                  className={`suggested-entity-link${isApproved ? " is-resolved" : ""}`}
                                  title="跳转到对应审核条目"
                                  onClick={() => props.onJumpToItem?.(entity.linkedItemId!)}
                                >
                                  待审核 #{entity.linkedItemId}
                                </button>
                              )}
                              {/* √ 和 × 始终显示，选中的高亮，未选的降透明度 */}
                              {!props.done && !isApproved && !isRejected ? (
                                <>
                                  <button type="button" className="suggested-entity-btn approve" title="确认新增" onClick={() => props.onUpdateSuggestedEntity?.(entity.name, "approved")}>✓</button>
                                  <button type="button" className="suggested-entity-btn reject" title="拒绝" onClick={() => props.onUpdateSuggestedEntity?.(entity.name, "rejected")}>✕</button>
                                </>
                              ) : !props.done && (
                                <>
                                  <button type="button" className={`suggested-entity-btn approve${isApproved ? " is-selected" : " is-dimmed"}`} title="确认新增" onClick={() => props.onUpdateSuggestedEntity?.(entity.name, isApproved ? undefined : "approved")}>✓</button>
                                  <button type="button" className={`suggested-entity-btn reject${isRejected ? " is-selected" : " is-dimmed"}`} title="拒绝" onClick={() => props.onUpdateSuggestedEntity?.(entity.name, isRejected ? undefined : "rejected")}>✕</button>
                                </>
                              )}
                              {props.done && isApproved && <em className="suggested-entity-verdict is-approved">✓ 已通过</em>}
                              {props.done && isRejected && <em className="suggested-entity-verdict is-rejected">✕ 已拒绝</em>}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {existingTags.length === 0 && suggested.length === 0 && newNode}
                </div>
              </div>
            );
          }

          return (
            <div className="diff-row is-changed" key={`${key}-${field.field}`}>
              <div className="diff-cell diff-field">
                {field.label}
                <span className="diff-field-dot" title="该字段有变化" />
              </div>
              <LocalizedReviewFieldValue language={language} className="diff-cell diff-old">
                {oldNode}
              </LocalizedReviewFieldValue>
              <LocalizedReviewFieldValue language={language} className="diff-cell diff-new">
                {editedFields?.includes(field.label) && (
                  <span className="diff-edited-mark">人工修正</span>
                )}
                {editing ? (
                  <div className="review-localized-editor" dir={isArabicReviewLanguage(language) ? "rtl" : "ltr"} lang={isArabicReviewLanguage(language) ? "ar" : undefined}>
                    <Textarea
                      value={editFields[field.field] ?? field.newValue}
                      onChange={(value) => onChangeField(field.field, value as string)}
                      autosize={{ minRows: 1, maxRows: 6 }}
                    />
                  </div>
                ) : newNode}
              </LocalizedReviewFieldValue>
            </div>
          );
        })}
      </div>
    );
  };

  if (item.changeType === "delete") {
    const deleteExisting = item.liveVersion?.fields || candidate?.liveVersion.fields || [];
    return (
      <div className="simple-diff-flat delete-mode">
        <div className="delete-mode-layout">
          <section className="delete-mode-existing">
            <div className="delete-mode-title">线上生效版本（待删除）</div>
            {deleteExisting.map((entry) => (
              <div className="delete-mode-field" key={entry.field}>
                <span className="delete-mode-label">{getFieldLabel(entry.field)}</span>
                <span className="delete-mode-value">
                  <LocalizedReviewFieldValue language={language} className="delete-mode-localized">
                    {getLocalizedSnapshotValue(item.objectType, entry, language)}
                  </LocalizedReviewFieldValue>
                </span>
              </div>
            ))}
          </section>
          <section className="delete-mode-trash">
            <DeleteIcon size="56px" />
            <p>该{objectLabel}将被删除</p>
          </section>
        </div>
      </div>
    );
  }

  const currentChangeType = item.changeType;
  return (
    <div className="simple-diff-flat">
      {candidateList.length >= 1 && (
        <div className="simple-diff-summary">
          <em className="review-section-tag has-change">差异</em>
          <span>新修订与线上相关数据（差异、冲突、重复）的对比一览信息</span>
        </div>
      )}
      {candidateList.length > 1 ? (
        <div className="simple-diff-multi">
          {candidateList.map((item, index) => (
            <section className="simple-diff-group" key={item.key}>
              <header className="simple-diff-group-head">
                <div className="simple-diff-group-tabs">
                  <CandidateTabsBar
                    candidates={[item]}
                    activeKey={item.key}
                    objectLabel={objectLabel}
                    changeType={currentChangeType}
                  />
                </div>
                <span className="simple-diff-group-meta">对比 {index + 1} / {candidateList.length}</span>
              </header>
              {renderTable(item, item.key)}
            </section>
          ))}
        </div>
      ) : candidate ? (
        renderTable(candidate, "single")
      ) : (
        <div className="diff-empty-state">当前无可对比的候选数据。</div>
      )}
    </div>
  );
}



// 原始视图按各类型编辑窗口（实体管理-新建实体 / 编辑实体 / 事实管理 / 事件管理）的字段结构展示。
const RAW_FIELD_SECTIONS: Record<ReviewObjectType, { title: string; fields: string[] }[]> = {
  fact: [
    { title: "事实信息", fields: ["title", "category", "fact_text", "time_description", "source_content", "conflict_reason"] },
    { title: "来源信息", fields: ["source_type", "source", "source_url", "start_time", "end_time"] },
    { title: "关联信息", fields: ["related_entities", "related_events", "conflict", "duplicate"] },
  ],
  entity: [
    { title: "实体信息", fields: ["entity_name", "category", "tags", "description", "is_category"] },
  ],
  event: [
    { title: "事件信息", fields: ["event_name", "category", "alias", "description", "time_description", "source", "remark"] },
    { title: "时间信息", fields: ["time_type", "start_time", "end_time", "recurring_weekdays", "recurring_time_range", "recurring_duration_days"] },
  ],
};

function RawConfigCompare(props: {
  item: ReviewItem;
  fields: FieldDiff[];
  language: ReviewLanguage;
  candidate: ReviewCandidate | null;
  candidates?: ReviewCandidate[];
  onSelectCandidate?: (key: string) => void;
  editing: boolean;
  editFields: Record<string, string>;
  onChangeField: (field: string, value: string) => void;
  onEdit?: () => void;
  sourceOnly?: boolean;
  editedFields?: string[];
}) {
  const { item, fields, language, candidate, candidates, onSelectCandidate, editing, editFields, onChangeField, onEdit, sourceOnly, editedFields } = props;
  // 关联实体标记删除状态（原始视图独立维护）
  const [removedEntities, setRemovedEntities] = React.useState<Set<string>>(new Set());
  const toggleRemoveEntity = (tag: string) => setRemovedEntities((prev) => {
    const next = new Set(prev);
    next.has(tag) ? next.delete(tag) : next.add(tag);
    return next;
  });
  const isDeletable = item.changeType === "new" || item.changeType === "update";
  const sections = RAW_FIELD_SECTIONS[item.objectType] || RAW_FIELD_SECTIONS.fact;
  // 原始视图按编辑窗字段全量展示：基础数据 + 候选快照，补齐未在两边出现的字段。
  const fieldByName = new Map(fields.map((field) => [field.field, field]));
  const liveByName = new Map((candidate?.liveVersion.fields || []).map((entry) => [
    entry.field,
    getLocalizedSnapshotValue(item.objectType, entry, language),
  ]));
  const mergedFieldsByName = new Map<string, FieldDiff>();
  sections.forEach((section) => {
    section.fields.forEach((name) => {
      const fromNew = fieldByName.get(name);
      if (fromNew) {
        mergedFieldsByName.set(name, fromNew);
        return;
      }
      const fromLive = liveByName.get(name);
      mergedFieldsByName.set(name, { field: name, label: getFieldLabel(name), oldValue: fromLive || "", newValue: "" });
    });
  });
  const sourceRows = [
    { label: "来源类型", value: REVIEW_SOURCE_LABELS[item.source] },
    { label: "生成时间", value: item.createdAt },
    { label: "来源说明", value: item.summary },
    { label: "原始片段", value: item.sourceSnippet || item.sourceOriginal || item.summary },
  ];
  // 原始视图：按各类型编辑窗字段全量展示，所有差异 / 相同字段一起呈现，由用户控制阅读。
  // 顶部展示候选标签（左侧泳道标题），右泳道固定为“待审核新数据”。
  const sectionFieldNames = new Set(sections.flatMap((section) => section.fields));
  // 后端新增但暂未列入前台字段配置的待审字段也必须展示，且可在编辑态保存。
  const extraPendingFields = fields.filter((field) => !sectionFieldNames.has(field.field));
  const mergedFields: FieldDiff[] = [
    ...sections.flatMap((section) => section.fields
      .map((name) => mergedFieldsByName.get(name))
      .filter((field): field is FieldDiff => Boolean(field))),
    ...extraPendingFields,
  ];
  const displayFields = mergedFields.map((field) => ({
    ...field,
    oldValue: getLocalizedFieldDiffValue(item.objectType, field, language, "oldValue") ?? field.oldValue,
    newValue: getLocalizedFieldDiffValue(item.objectType, field, language, "newValue") ?? field.newValue,
  }));
  return (
    <div className="raw-config-compare">
      <div className={`raw-config-swimlanes ${sourceOnly ? "is-source-only" : ""}`}>
        {!sourceOnly && (
          <section className="raw-config-column raw-config-column-old">
            <header className="raw-config-swimlane-head">
              <div className="raw-config-swimlane-title">
                <span className="raw-config-swimlane-label">库内数据</span>
                <CandidateTabsBar
                  candidates={candidates}
                  activeKey={candidate?.key}
                  onChange={onSelectCandidate}
                  objectLabel={OBJECT_TYPE_LABELS[item.objectType]}
                  changeType={item.changeType}
                />
              </div>
              <small className="raw-config-swimlane-meta">
                {candidate?.liveVersion.createdAt ? `快照 ${candidate.liveVersion.createdAt}` : "无线上版本"}
              </small>
            </header>
            <div className="raw-config-swimlane-body">
              {displayFields.map((field) => {
                const oldLiveValue = liveByName.get(field.field) || field.oldValue || "";
                const oldDisplay = oldLiveValue || <span className="diff-empty">（空）</span>;
                const oldRendered = isFieldChanged(field) ? renderFieldDiff({ ...field, oldValue: oldLiveValue }, language).oldNode : oldDisplay;
                return (
                  <div className={`raw-config-field ${isFieldChanged(field) ? "is-changed" : ""}`} key={`old-${field.field}`}>
                    <label>{field.label}</label>
                    <LocalizedReviewFieldValue language={language} className="raw-config-value">
                      {oldRendered}
                    </LocalizedReviewFieldValue>
                  </div>
                );
              })}
            </div>
          </section>
        )}
        <section className="raw-config-column raw-config-column-new">
          <header className="raw-config-swimlane-head">
            <div className="raw-config-swimlane-title">
              <span className="raw-config-swimlane-label">新数据</span>
              <strong>
                {item.changeType === "new"
                  ? <span className="raw-config-swimlane-id-empty">- (暂无ID)</span>
                  : getObjectId(item)}
              </strong>
            </div>
            <small className="raw-config-swimlane-meta">
              {item.changeType === "delete" ? "待删除" : item.changeType === "update" ? "待更新" : item.changeType === "new" ? "待入库" : "待处理"}
            </small>
          </header>
          <div className="raw-config-swimlane-body">
            {item.changeType === "delete" ? (
              <div className="raw-config-delete-hint">
                <DeleteIcon size="48px" />
                <span>该{OBJECT_TYPE_LABELS[item.objectType]}将被删除</span>
              </div>
            ) : displayFields.map((field) => {
              const newRendered = isFieldChanged(field)
                ? renderFieldDiff(field, language).newNode
                : (field.newValue || <span className="diff-empty">{isArabicReviewLanguage(language) ? "—" : "（空）"}</span>);
              const canEditField = fieldByName.has(field.field);

              // 关联实体字段：渲染为标签
              if (field.field === "related_entities") {
                const tags = item.relatedEntities ?? [];
                return (
                  <div className={`raw-config-field ${isFieldChanged(field) ? "is-changed" : ""}`} key={`new-${field.field}`}>
                    <label>{field.label}</label>
                    <div className="raw-config-value diff-entity-existing" style={{ paddingTop: 4 }}>
                      {tags.length > 0
                        ? tags.map((tag) => {
                            const removed = removedEntities.has(tag);
                            return (
                              <span key={tag} className={`diff-entity-tag${removed ? " is-removed" : ""}`}>
                                {tag}
                                {isDeletable && (
                                  <button
                                    type="button"
                                    className="diff-entity-tag-del"
                                    title={removed ? `撤销移除 ${tag}` : `移除 ${tag}`}
                                    onClick={() => toggleRemoveEntity(tag)}
                                  >×</button>
                                )}
                              </span>
                            );
                          })
                        : <span className="diff-empty">（空）</span>
                      }
                    </div>
                  </div>
                );
              }

              return (
                <div className={`raw-config-field ${isFieldChanged(field) ? "is-changed" : ""}`} key={`new-${field.field}`}>
                  <label>{field.label}</label>
                  {editedFields?.includes(field.label) && (
                    <span className="diff-edited-mark">人工修正</span>
                  )}
                  {editing && canEditField ? (
                    <div className="review-localized-editor" dir={isArabicReviewLanguage(language) ? "rtl" : "ltr"} lang={isArabicReviewLanguage(language) ? "ar" : undefined}>
                      <Textarea
                        value={editFields[field.field] ?? field.newValue}
                        onChange={(value) => onChangeField(field.field, value as string)}
                        autosize={{ minRows: 2, maxRows: 8 }}
                      />
                    </div>
                  ) : (
                    <LocalizedReviewFieldValue language={language} className="raw-config-value">
                      {newRendered}
                    </LocalizedReviewFieldValue>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <section className="raw-config-source">
        <header>来源信息（新数据生成依据）</header>
        <div>
          {sourceRows.map((row) => (
            <div className="raw-config-source-row" key={row.label}>
              <span>{row.label}</span>
              <p
                className={isArabicReviewLanguage(language) ? "review-localized-field-value is-rtl" : ""}
                dir={isArabicReviewLanguage(language) ? "rtl" : "ltr"}
                lang={isArabicReviewLanguage(language) ? "ar" : undefined}
              >
                {formatLocalizedReviewValue(language, row.value) || "--"}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function CandidateTabsBar(props: {
  candidates?: ReviewCandidate[];
  activeKey?: string;
  onChange?: (key: string) => void;
  objectLabel?: string;
  changeType?: string;
}) {
  const { candidates, activeKey, onChange, objectLabel = "", changeType } = props;
  if (!candidates || candidates.length === 0) return null;

  if (candidates.length === 1) {
    return <CandidateChip candidate={candidates[0]} active objectLabel={objectLabel} changeType={changeType} />;
  }
  return (
    <CandidateSelectBar
      candidates={candidates}
      activeKey={activeKey || ""}
      onChange={onChange || (() => undefined)}
      objectLabel={objectLabel}
      changeType={changeType}
    />
  );
}

/** 统一的单一候选选择器：选中项展示在最前，其余问题以 +n 小圈计数，右侧为下拉箭头。 */
function CandidateSelectBar(props: {
  candidates: ReviewCandidate[];
  activeKey: string;
  onChange: (key: string) => void;
  objectLabel: string;
  changeType?: string;
}) {
  const { candidates, activeKey, onChange, objectLabel, changeType } = props;
  const isDelete = changeType === "delete";
  const activeCandidate = candidates.find((candidate) => candidate.key === activeKey) || candidates[0];
  const rest = candidates.filter((candidate) => candidate.key !== activeCandidate.key);
  return (
    <div className="raw-config-candidate-bar">
      <Popup
        trigger="click"
        placement="bottom-left"
        showArrow
        content={(
          <div className="raw-config-candidate-menu">
            {candidates.map((candidate) => (
              <button
                key={candidate.key}
                type="button"
                className={`raw-config-candidate-chip type-${candidate.type} is-menu ${activeKey === candidate.key ? "is-active" : ""}`}
                onClick={() => onChange(candidate.key)}
              >
                <span>{getUnifiedCandidateLabel(objectLabel, candidate)}</span>
                <em>{isDelete ? "删除" : getCandidateTag(candidate)}</em>
              </button>
            ))}
          </div>
        )}
      >
        <button
          type="button"
          className={`raw-config-unified-trigger type-${activeCandidate.type}`}
          aria-haspopup="listbox"
          title={rest.length > 0 ? `另有 ${rest.length} 个待处理问题` : undefined}
        >
          <span className="raw-config-unified-label">{getUnifiedCandidateLabel(objectLabel, activeCandidate)}</span>
          <em className="raw-config-unified-type">{isDelete ? "删除" : getCandidateTag(activeCandidate)}</em>
          {rest.length > 0 && <span className="raw-config-unified-more">+{rest.length}</span>}
          <i className="raw-config-candidate-arrow">▾</i>
        </button>
      </Popup>
    </div>
  );
}

function CandidateChip({ candidate, active, objectLabel, changeType }: { candidate: ReviewCandidate; active?: boolean; objectLabel: string; changeType?: string }) {
  const isDelete = changeType === "delete";
  return (
    <span className={`raw-config-candidate-chip type-${candidate.type} ${active ? "is-active" : ""} is-static`}>
      <span>{getUnifiedCandidateLabel(objectLabel, candidate)}</span>
      <em>{isDelete ? "删除" : getCandidateTag(candidate)}</em>
    </span>
  );
}
