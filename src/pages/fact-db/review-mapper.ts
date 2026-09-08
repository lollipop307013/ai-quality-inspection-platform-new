// 接口原始形态 → 前端审核视图模型（ReviewItem）映射层
// 数据源（FactReviewRaw）直接使用接口返回；本文件负责派生前端需要的
// changeType / conflictType / candidates / pendingVersions / liveVersion / machineHints。
import type {
  FactReviewRaw,
  RawFactCandidate,
  FactAction,
  ReviewItem,
  ReviewCandidate,
  ReviewConflictType,
  ReviewFieldSnapshot,
  FieldDiff,
  PendingVersion,
  ReviewMachineHints,
  ReviewSource,
  ChangeType,
  ItemReviewStatus,
  ReviewPriority,
  ReviewLanguage,
  SuggestedEntity,
} from "./review-types";

/** 非中文的支持语言（接口 fact_text_* 后缀） */
const NON_ZH_LANGS: Exclude<ReviewLanguage, "zh">[] = ["en", "ar", "tr", "ru", "zh-hk"];

/** 读取某一语言的事实文本（zh 取 fact_text，其余取 fact_text_<lang>） */
function getLangText(
  obj: { fact_text: string; fact_text_en?: string; fact_text_ar?: string; fact_text_tr?: string; fact_text_ru?: string; fact_text_zh_hk?: string },
  lang: Exclude<ReviewLanguage, "zh">,
): string {
  if (lang === "zh-hk") return obj.fact_text_zh_hk || "";
  return (obj as Record<string, string | undefined>)[`fact_text_${lang}`] || "";
}

/** 接口 source_type + action → 前端 ReviewSource */
function mapSourceType(sourceType: string, action?: FactAction): ReviewSource {
  switch (sourceType) {
    case "import":
      return "import";
    case "sync":
      return action === "update" ? "sync-delta" : "sync-new";
    case "qa":
      return action === "delete" ? "qa-offline" : action === "update" ? "qa-update" : "qa-new";
    case "mining":
      return "mining";
    default:
      return "import";
  }
}

/** 接口 review_status → 前端 ItemReviewStatus（deleted 即软删除=rejected） */
function mapReviewStatus(status: FactReviewRaw["review_status"]): ItemReviewStatus {
  if (status === "approved") return "approved";
  if (status === "deleted") return "rejected";
  return "pending";
}

/** 派生变更类型：优先用 action；缺失时按是否关联已有事实推断（覆盖/新增） */
function deriveChangeType(action?: FactAction, raw?: FactReviewRaw): ChangeType {
  if (action === "create") return "new";
  if (action === "update") return "update";
  if (action === "delete") return "delete";
  if (raw && (raw.contradicting_fact_ids.length || raw.duplicate_fact_ids.length)) return "update";
  return "new";
}

/** 扁平多语言 → 字段差异 translations（oldValue/newValue） */
function buildFactTextField(raw: FactReviewRaw): FieldDiff {
  const live = raw.live_fact;
  const translations: FieldDiff["translations"] = {};
  for (const lang of NON_ZH_LANGS) {
    translations[lang] = {
      oldValue: live ? getLangText(live, lang) : "",
      newValue: getLangText(raw, lang),
    };
  }
  return {
    field: "fact_text",
    label: "事实文本",
    oldValue: live?.fact_text || "",
    newValue: raw.fact_text,
    translations,
  };
}

/** 扁平多语言 → 线上/候选快照 fields（value） */
function buildSnapshotFields(
  obj: { fact_text: string; fact_text_en?: string; fact_text_ar?: string; fact_text_tr?: string; fact_text_ru?: string; fact_text_zh_hk?: string },
): ReviewFieldSnapshot[] {
  const translations: ReviewFieldSnapshot["translations"] = {};
  for (const lang of NON_ZH_LANGS) {
    translations[lang] = getLangText(obj, lang);
  }
  return [{ field: "fact_text", label: "事实文本", value: obj.fact_text, translations }];
}

/** 单条候选 → ReviewCandidate */
function buildCandidate(detail: RawFactCandidate, type: ReviewConflictType | "live"): ReviewCandidate {
  return {
    key: `c-${detail.fact_id}`,
    label: `事实 #${detail.fact_id}`,
    type,
    reason: detail.reason,
    liveVersion: { createdAt: "", fields: buildSnapshotFields(detail) },
  };
}

/** 规则生成变更说明（非 AI） */
function buildSummary(changeType: ChangeType, conflictType: ReviewConflictType | undefined, raw: FactReviewRaw): string {
  const related = (raw.related_entity_names || []).join("、");
  const base = changeType === "delete" ? "删除线上事实" : changeType === "update" ? "覆盖更新已有事实" : "新增事实";
  const tail =
    conflictType === "conflict"
      ? "（与已有事实冲突）"
      : conflictType === "duplicate"
        ? "（与已有事实重复）"
        : related
          ? `（关联 ${related}）`
          : "";
  return base + tail;
}

/** 单条原始事实 → ReviewItem */
export function mapFactRawToReviewItem(raw: FactReviewRaw): ReviewItem {
  const action = raw.action;
  const changeType = deriveChangeType(action, raw);
  const isUpdate = changeType === "update";

  // 冲突/重复类型：来自 contradicting_fact_ids / duplicate_fact_ids
  let conflictType: ReviewConflictType | undefined;
  if (raw.contradicting_fact_ids.length) conflictType = "conflict";
  else if (raw.duplicate_fact_ids.length) conflictType = "duplicate";

  // 候选：优先用 check-contradiction 详情；仅有 ID 时补最小候选
  const candidates: ReviewCandidate[] = [];
  for (const c of raw.contradicting_facts || []) candidates.push(buildCandidate(c, "conflict"));
  for (const c of raw.duplicate_facts || []) candidates.push(buildCandidate(c, "duplicate"));
  for (const id of raw.contradicting_fact_ids) {
    if (!candidates.some((c) => c.label === `事实 #${id}`)) candidates.push(buildCandidate({ fact_id: id, fact_text: "" }, "conflict"));
  }
  for (const id of raw.duplicate_fact_ids) {
    if (!candidates.some((c) => c.label === `事实 #${id}`)) candidates.push(buildCandidate({ fact_id: id, fact_text: "" }, "duplicate"));
  }
  // 删除类型：以线上生效版本作为被删候选，详情芯片展示「事实 #id 删除」
  if (changeType === "delete" && raw.live_fact) {
    const deleted = buildCandidate(
      {
        fact_id: raw.fact_id,
        fact_text: raw.live_fact.fact_text,
        fact_text_en: raw.live_fact.fact_text_en,
        fact_text_ar: raw.live_fact.fact_text_ar,
        fact_text_tr: raw.live_fact.fact_text_tr,
        fact_text_ru: raw.live_fact.fact_text_ru,
        fact_text_zh_hk: raw.live_fact.fact_text_zh_hk,
      },
      "live",
    );
    deleted.reason = "待删除的线上事实";
    candidates.push(deleted);
  }

  // 待审版本：扁平多语 → 嵌套字段差异
  const pendingVersions: PendingVersion[] = [
    {
      versionId: `v-${raw.task_id || raw.fact_id}`,
      batchId: raw.task_id || "IMPORT",
      source: mapSourceType(raw.source_type, action),
      createdAt: raw.created_at || "",
      fields: [
        buildFactTextField(raw),
        { field: "title", label: "标题", oldValue: "", newValue: raw.title },
        { field: "related_entities", label: "关联实体", oldValue: "", newValue: (raw.related_entity_names || []).join("、") },
      ],
    },
  ];

  // 线上生效版本：仅覆盖场景
  let liveVersion: ReviewItem["liveVersion"];
  if (isUpdate && raw.live_fact) {
    liveVersion = { createdAt: "", fields: buildSnapshotFields(raw.live_fact) };
  }

  // 机器预判：由候选与术语参考派生
  const machineHints: ReviewMachineHints = {};
  if (candidates.length) {
    machineHints.conflictObjects = candidates
      .filter((c) => c.type === "conflict")
      .map((c) => ({ id: c.label.replace("事实 ", "#"), note: c.reason }));
    machineHints.duplicateObjects = candidates
      .filter((c) => c.type === "duplicate")
      .map((c) => ({ id: c.label.replace("事实 ", "#"), note: c.reason }));
    const reasons = candidates.map((c) => c.reason).filter(Boolean);
    if (reasons.length) machineHints.conflictReason = reasons.join("；");
  }
  if (raw.term_refs?.length) machineHints.termRefs = raw.term_refs;

  const source = mapSourceType(raw.source_type, action);
  const priority = (raw.review_priority as ReviewPriority) || "low";

  // 建议新增实体：接口原始字段映射到前端视图模型
  const suggestedEntities: SuggestedEntity[] | undefined = raw.suggested_new_entities?.length
    ? raw.suggested_new_entities.map((s) => ({
        name: s.name,
        linkedItemId: s.linked_item_id,
        linkedTaskId: s.linked_task_id,
        reason: s.reason,
      }))
    : undefined;

  return {
    id: raw.fact_id,
    taskId: raw.task_id || "IMPORT",
    objectType: "fact",
    changeType,
    // 名称展示标题（可读），避免与「对象ID」列重复展示同一个 fact_id
    name: raw.title || `事实 #${raw.fact_id}`,
    // 新增数据尚未落库，无库内对象ID；仅覆盖/删除时展示被操作的库内条目ID
    objectId: changeType === "new" ? undefined : `#${raw.fact_id}`,
    factId: raw.fact_id,
    priority,
    summary: buildSummary(changeType, conflictType, raw),
    source,
    confidence: raw.confidence || "low",
    createdAt: raw.created_at || "",
    status: mapReviewStatus(raw.review_status),
    conflictType,
    conflictTargetId: candidates[0]?.label.replace("事实 #", ""),
    conflictReason: machineHints.conflictReason,
    relatedEntities: raw.related_entity_names || [],
    sourceOriginal: raw.source_original,
    liveVersion,
    pendingVersions,
    candidates: candidates.length ? candidates : undefined,
    machineHints: Object.keys(machineHints).length ? machineHints : undefined,
    suggestedEntities,
  };
}

/** 批量映射 */
export function mapFactRawListToReviewItems(rawList: FactReviewRaw[]): ReviewItem[] {
  return rawList.map((raw) => mapFactRawToReviewItem(raw));
}
