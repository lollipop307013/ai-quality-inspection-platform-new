import type { ReviewItem, ReviewerStat, ReviewTask, ReviewObjectType, ReviewLogEntry, FactReviewRaw } from "./review-types";
import { REVIEW_SOURCE_LABELS } from "./review-types";
import realReviewItems from "./review-real-20260715.json";
import rawFacts from "./review-real-facts-raw.json";
import { mapFactRawListToReviewItems } from "./review-mapper";
import { scenarioReviewItems } from "./review-scenarios-mock";

/** 可模拟切换的审核人员（rtx），用于演示多人协作审核 */
export const MOCK_OPERATORS = ["yzhinan", "zhang.san", "li.si", "wang.wu", "chen.liu"];

/**
 * 任务创建时分配的顺序号。该映射模拟服务端持久化序列：即使任务删除，已占用编号也不会分配给新任务。
 * 原始 taskId 仍仅作为内部批次关联键使用。
 */
/** 原始 taskId 仍保留在 REVIEW_TASK_SEQUENCE 中，供 supersededBy 关联展示使用。 */
export const REVIEW_TASK_SEQUENCE: Record<string, number> = {
  "IMPORT-20260715": 13,
  "IMPORT-ENTITY-20260715": 17,
  "DELETE-20260715": 14,
  "CONFLICT-20260715": 15,
  "DUP-20260715": 16,
  // 按「来源 + 创建日期」归并后的批次键（同来源同时间 = 同一任务）
  "import@2026-07-15": 13,
  "qa-offline@2026-07-15": 14,
};

const runtimeTaskSequences = new Map<string, number>();
const maxKnownTaskSequence = Math.max(...Object.values(REVIEW_TASK_SEQUENCE));

function getStableTaskSequence(taskId: string) {
  const knownSequence = REVIEW_TASK_SEQUENCE[taskId];
  if (knownSequence != null) return knownSequence;
  const existingSequence = runtimeTaskSequences.get(taskId);
  if (existingSequence != null) return existingSequence;
  const sequenceNo = maxKnownTaskSequence + runtimeTaskSequences.size + 1;
  runtimeTaskSequences.set(taskId, sequenceNo);
  return sequenceNo;
}

/**
 * 审核条目数据源（统一经接口原始形态 + 映射层，确保前端对接真实接口时字段一致）：
 *  - 真实事实（111 条）：由 review-real-20260715.json 转换而来的 FactReviewRaw（review-real-facts-raw.json），经 review-mapper 映射
 *  - 真实实体（190 条）：实体接口形态本文档未定义，保留已归一化数据
 *  - 场景演示（6 条）：FactReviewRaw 原始形态，经映射层（与真实事实同一函数）
 */
const realAll = realReviewItems as unknown as ReviewItem[];
const realEntities = realAll.filter((x) => x.objectType === "entity");
const realFacts = mapFactRawListToReviewItems(rawFacts as unknown as FactReviewRaw[]);

/** 场景演示任务（6 条事实 + 1 条实体）：覆盖 新建/覆盖/删除 × 无冲突/冲突/重复，供前端逐场景验证 */
const scenarioDemoEntityItem: ReviewItem = {
  id: 252,
  objectType: "entity",
  objectId: "NEW-252",
  factId: undefined,
  name: "Ray（角色）",
  summary: "PUBG MOBILE 中的角色实体，在语音翻译功能相关事实中被提及，库中暂无匹配。",
  changeType: "new",
  status: "pending",
  priority: undefined,
  source: "import",
  confidence: "low",
  taskId: "import@2026-08-20",
  createdAt: "2026-08-20 10:00",
  pendingVersions: [
    {
      versionId: "v-252-1",
      batchId: "B-2026-08-20",
      source: "import",
      createdAt: "2026-08-20 10:00",
      fields: [
        { field: "name", label: "名称", newValue: "Ray（角色）", oldValue: "" },
        { field: "description", label: "简介", newValue: "PUBG MOBILE 中出现的角色，与语音翻译功能相关。", oldValue: "" },
        { field: "entity_type", label: "实体类型", newValue: "角色", oldValue: "" },
      ],
    },
  ],
};

export const mockReviewItems: ReviewItem[] = [
  ...realEntities,
  ...realFacts,
  ...scenarioReviewItems,
  scenarioDemoEntityItem,
];


/** 审核操作日志 mock：记录每一次提交结论的人员与结果（用于"操作日志"查看入口） */
export const mockReviewLogs: ReviewLogEntry[] = [];

function getTaskTitle(source: ReviewItem["source"]): string {
  if (source === "import") return "批量导入审核";
  if (source === "qa-offline") return "删除审核";
  return `${REVIEW_SOURCE_LABELS[source]}审核任务`;
}

/**
 * 同一来源、同一创建时间（按日期）的审核条目归并为同一批次任务，不按操作类型
 * （导入 / 冲突 / 重复 / 实体）拆分。例如同一次导入产生的「导入」「冲突」「重复」
 * 条目同属一个任务。
 */
function getBatchKey(item: ReviewItem): string {
  const date = String(item.createdAt).slice(0, 10);
  return `${item.source}@${date}`;
}

/** 把条目按 taskId 聚合成任务，并自动计算处理进度、内容类型和审核人分布。 */
export function buildReviewTasks(items: ReviewItem[], logs: ReviewLogEntry[] = []): ReviewTask[] {
  const map = new Map<string, ReviewItem[]>();
  for (const item of items) {
    const groupKey = getBatchKey(item);
    const group = map.get(groupKey) || [];
    group.push(item);
    map.set(groupKey, group);
  }

  const latestLogByItem = new Map<number, ReviewLogEntry>();
  logs.forEach((log) => {
    const previous = latestLogByItem.get(log.itemId);
    if (!previous || log.timestamp >= previous.timestamp) latestLogByItem.set(log.itemId, log);
  });

  // 按 factId 索引被最新通过的版本号，同 factId 的较旧未审核条目自动标记 superseded。
  const latestApprovalByFact = new Map<number, { taskId: string; itemId: number; updatedAt: string; operator?: string }>();
  items.forEach((item) => {
    if (item.factId == null || item.status !== "approved") return;
    const current = latestApprovalByFact.get(item.factId);
    if (!current || item.reviewedAt && item.reviewedAt > current.updatedAt) {
      latestApprovalByFact.set(item.factId, {
        taskId: item.taskId,
        itemId: item.id,
        updatedAt: item.reviewedAt || item.createdAt,
        operator: item.reviewedBy,
      });
    }
  });

  const tasks: ReviewTask[] = [];
  for (const [taskId, group] of map) {
    // 历史任务：同 factId 已在更新任务里通过审核时，将当前条目标记为 superseded。
    const enrichedGroup = group.map((item) => {
      if (item.status !== "pending" || item.factId == null) return item;
      const newer = latestApprovalByFact.get(item.factId);
      if (!newer || newer.taskId === item.taskId) return item;
      return { ...item, supersededBy: { ...newer, displayId: `#${getStableTaskSequence(newer.taskId)}` } };
    });
    const typeCounts: Record<ReviewObjectType, number> = { fact: 0, entity: 0, event: 0 };
    const typeProgress: Record<ReviewObjectType, { reviewed: number; total: number }> = {
      fact: { reviewed: 0, total: 0 },
      entity: { reviewed: 0, total: 0 },
      event: { reviewed: 0, total: 0 },
    };
    const reviewerStatsMap = new Map<string, ReviewerStat>();
    let pending = 0;
    let approved = 0;
    let rejected = 0;
    let createdAt = group[0].createdAt;

    group.forEach((item) => {
      typeCounts[item.objectType]++;
      typeProgress[item.objectType].total++;
      if (item.status === "pending") {
        pending++;
      } else if (item.status === "approved") {
        approved++;
        typeProgress[item.objectType].reviewed++;
      } else {
        rejected++;
        typeProgress[item.objectType].reviewed++;
      }
      if (item.createdAt > createdAt) createdAt = item.createdAt;

      const reviewer = item.reviewedBy || latestLogByItem.get(item.id)?.operator;
      if (item.status === "pending" || !reviewer) return;
      const stat = reviewerStatsMap.get(reviewer) || {
        reviewer,
        reviewed: 0,
        typeCounts: { fact: 0, entity: 0, event: 0 },
      };
      stat.reviewed++;
      stat.typeCounts[item.objectType]++;
      reviewerStatsMap.set(reviewer, stat);
    });

    const reviewerStats = Array.from(reviewerStatsMap.values())
      .sort((a, b) => b.reviewed - a.reviewed || a.reviewer.localeCompare(b.reviewer));

    const sequenceNo = getStableTaskSequence(taskId);
    tasks.push({
      id: taskId,
      sequenceNo,
      displayId: `#${sequenceNo}`,
      title: getTaskTitle(group[0].source),
      source: group[0].source,
      sourceLabel: REVIEW_SOURCE_LABELS[group[0].source],
      createdAt,
      items: enrichedGroup,
      total: enrichedGroup.length,
      pending,
      approved,
      rejected,
      typeCounts,
      typeProgress,
      operators: reviewerStats.map((stat) => stat.reviewer),
      reviewerStats,
      progress: pending > 0 ? "pending" : "done",
      applicationStatus: pending === 0 ? "done" : "reviewing",
    });
  }

  return tasks.sort((a, b) => a.createdAt < b.createdAt ? 1 : -1);
}
