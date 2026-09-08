import React, { useLayoutEffect, useState } from "react";
import { Dialog, Tag, Button, Input, MessagePlugin } from "tdesign-react";
import type { ContentLanguage, Entity, LocalizedContent } from "../types";
import { mockEntities, mockFacts, mockEvents } from "../mock";

interface Props {
  /** 是否可见 */
  visible: boolean;
  /** 目标实体（操作列点击「合并」的那条，合并后保留） */
  targetEntity?: Entity | null;
  onClose: () => void;
  /** 合并完成后回调，传入目标实体 ID 与被合并实体 ID 列表 */
  onMerge?: (targetId: number, sourceIds: number[]) => void;
}

type LocalizedDraft = Record<ContentLanguage, { title: string; alias: string; description: string }>;

type FormModel = {
  title: string;
  categories: string[];
  isCategory: boolean;
  localized: LocalizedDraft;
};

const languageCodes: ContentLanguage[] = ["zh", "en", "ar", "tr", "ru", "yue"];

/** 合并预览中的单条字段结果 */
interface MergeFieldPreview {
  key: string;
  label: string;
  targetValue: string;
  sourceValues: Array<{ entityId: string; entityLabel: string; value: string }>;
  mergedValue: string;
  action: "keep_target" | "fill_from_source" | "pick_required";
  pickedSource?: string;
}

function createLocalizedDraft(source?: LocalizedContent, alias = "", description = ""): LocalizedDraft {
  return languageCodes.reduce<LocalizedDraft>((result, language) => {
    result[language] = {
      title: source?.[language]?.title || "",
      alias: source?.[language]?.alias || (language === "zh" ? alias : ""),
      description: source?.[language]?.description || (language === "zh" ? description : ""),
    };
    return result;
  }, {} as LocalizedDraft);
}

function splitCategories(value?: string) {
  return value ? value.split(/[,，]/).map((item) => item.trim()).filter(Boolean) : [];
}

function createFormModel(entity?: Entity | null): FormModel {
  if (!entity) return { title: "", categories: ["角色"], isCategory: false, localized: createLocalizedDraft() };
  return {
    title: entity.title || "",
    categories: entity.categories?.length ? entity.categories : splitCategories(entity.tag),
    isCategory: Boolean(entity.isCategory),
    localized: createLocalizedDraft(entity.translations, entity.alias || "", entity.description || ""),
  };
}

export default function MergeDialog({ visible, targetEntity, onClose, onMerge }: Props) {
  // 目标实体（保留）的表单草稿，用于读取其简介字段
  const [form, setForm] = useState<FormModel>(createFormModel(targetEntity));

  // 合并实体相关状态
  const [mergeSearchValue, setMergeSearchValue] = useState("");
  const [mergeSourceEntities, setMergeSourceEntities] = useState<Entity[]>([]);
  const [mergeSearchResults, setMergeSearchResults] = useState<Entity[]>([]);
  const [showMergeConfirm, setShowMergeConfirm] = useState(false);
  const [isMerging, setIsMerging] = useState(false);
  /** 预览模式：选中目标后进入字段级合并预览 */
  const [mergePreviewMode, setMergePreviewMode] = useState(false);
  /** 字段选择：当目标为空、多源有值时用户需选一个 */
  const [mergeFieldSelections, setMergeFieldSelections] = useState<Record<string, string>>({});

  /** 合并规则：按语种定义简介字段的键和标签 */
  const MERGE_FIELDS = [
    { key: "description_zh", label: "中文简介", lang: "zh" as ContentLanguage },
    { key: "description_en", label: "英文简介", lang: "en" as ContentLanguage },
    { key: "description_ar", label: "阿拉伯语简介", lang: "ar" as ContentLanguage },
    { key: "description_tr", label: "土耳其语简介", lang: "tr" as ContentLanguage },
    { key: "description_ru", label: "俄语简介", lang: "ru" as ContentLanguage },
    { key: "description_yue", label: "粤语简介", lang: "yue" as ContentLanguage },
  ];

  /**
   * 计算合并预览：逐字段按规则判定。
   * 规则（来自需求）：
   *   - 目标某语种简介为空、源有内容 → 填入源值（单源直接填，多源需选）
   *   - 目标已有内容 → 保留目标，源随被合并实体丢弃
   */
  function computeMergePreview(): MergeFieldPreview[] {
    if (!targetEntity) return [];
    return MERGE_FIELDS.map((field) => {
      const targetVal = form.localized[field.lang].description.trim();
      const sourceValues = mergeSourceEntities
        .map((src) => {
          // 中文语种：顶层 description 即中文内容，作为中文简介展示；
          // 其它语种：只取对应语种的值，缺失则留空，不用中文填满
          const raw =
            field.lang === "zh"
              ? (src.translations?.zh?.description || src.description || "")
              : (src.translations?.[field.lang]?.description || "");
          return {
            entityId: String(src.id),
            entityLabel: `#${src.id}${src.title}`,
            value: raw.trim(),
          };
        })
        .filter((s) => s.value);

      if (targetVal) {
        // 目标有值 → 保留目标
        return {
          key: field.key,
          label: field.label,
          targetValue: targetVal,
          sourceValues,
          mergedValue: targetVal,
          action: "keep_target",
        };
      }
      if (sourceValues.length === 0) {
        // 目标空、源也空 → 无操作
        return {
          key: field.key,
          label: field.label,
          targetValue: "",
          sourceValues: [],
          mergedValue: "",
          action: "keep_target",
        };
      }
      if (sourceValues.length === 1) {
        // 单源有值 → 直接填入
        return {
          key: field.key,
          label: field.label,
          targetValue: "",
          sourceValues,
          mergedValue: sourceValues[0].value,
          action: "fill_from_source",
          pickedSource: sourceValues[0].entityId,
        };
      }
      // 多源有值 → 需用户选择
      const picked = mergeFieldSelections[field.key] || sourceValues[0].entityId;
      const pickedItem = sourceValues.find((s) => s.entityId === picked) || sourceValues[0];
      return {
        key: field.key,
        label: field.label,
        targetValue: "",
        sourceValues,
        mergedValue: pickedItem.value,
        action: "pick_required",
        pickedSource: picked,
      };
    });
  }

  /** 关联事实 / 事件变动预览：扫描被合并实体所挂载的事实，及其牵连的事件 */
  interface LinkedFactItem {
    sourceEntityId: number;
    sourceEntityLabel: string;
    factId: number;
    factTitle: string;
    changeDetail: string;
  }
  function computeLinkedData(): { facts: LinkedFactItem[]; events: { eventId: number; eventName: string }[] } {
    if (!targetEntity) return { facts: [], events: [] };
    const targetId = String(targetEntity.id);
    const facts: LinkedFactItem[] = [];
    const eventMap = new Map<number, { eventId: number; eventName: string }>();
    for (const src of mergeSourceEntities) {
      const srcId = String(src.id);
      const bracket = `[${srcId}]`;
      for (const fact of mockFacts) {
        const refsEntity =
          fact.relatedEntityIds?.includes(srcId) || (fact.keywords ? fact.keywords.includes(bracket) : false);
        if (!refsEntity) continue;
        facts.push({
          sourceEntityId: src.id,
          sourceEntityLabel: `#${src.id} ${src.title}`,
          factId: fact.id,
          factTitle: fact.title,
          changeDetail: `实体引用 ${bracket} → [${targetId}]`,
        });
        const evMatches = fact.relatedEvents?.match(/\[(\d+)\]/g) || [];
        for (const m of evMatches) {
          const eid = Number(m.replace(/[[\]]/g, ""));
          const ev = mockEvents.find((e) => e.id === eid);
          if (ev && !eventMap.has(eid)) eventMap.set(eid, { eventId: eid, eventName: ev.name });
        }
      }
    }
    return { facts, events: [...eventMap.values()] };
  }

  // 打开 / 切换目标实体时重置所有合并状态
  useLayoutEffect(() => {
    if (!visible) return;
    setForm(createFormModel(targetEntity));
    setMergeSearchValue("");
    setMergeSourceEntities([]);
    setMergeSearchResults([]);
    setShowMergeConfirm(false);
    setIsMerging(false);
    setMergePreviewMode(false);
    setMergeFieldSelections({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, targetEntity]);

  // 合并实体相关函数
  const handleMergeSearch = (value: string) => {
    setMergeSearchValue(value);
    if (!value.trim()) {
      setMergeSearchResults([]);
      return;
    }
    // 过滤掉目标实体和已选择的被合并实体
    const excludeIds = new Set([targetEntity?.id, ...mergeSourceEntities.map((e => e.id))].filter(Boolean));
    const results = mockEntities.filter(
      (e) =>
        !excludeIds.has(e.id) &&
        (e.title.toLowerCase().includes(value.toLowerCase()) ||
          e.id.toString().includes(value) ||
          e.alias?.toLowerCase().includes(value.toLowerCase()))
    ).slice(0, 10);
    setMergeSearchResults(results);
  };

  const handleSelectMergeSource = (sourceEntity: Entity) => {
    setMergeSourceEntities((prev) => [...prev, sourceEntity]);
    setMergeSearchValue("");
    setMergeSearchResults([]);
  };

  const handleRemoveMergeSource = (sourceId: number) => {
    setMergeSourceEntities((prev) => prev.filter((e) => e.id !== sourceId));
  };

  const handleMergeConfirm = async () => {
    if (!targetEntity) return;
    setIsMerging(true);
    // 模拟合并操作
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setIsMerging(false);
    setShowMergeConfirm(false);
    setMergePreviewMode(false);
    setMergeSourceEntities([]);
    setMergeSearchValue("");
    setMergeFieldSelections({});
    const sourceIds = mergeSourceEntities.map((e) => e.id);
    onMerge?.(targetEntity.id, sourceIds);
    MessagePlugin.success(`实体 "${targetEntity.title}" 已成功合并到目标实体，被合并实体将被删除`);
    onClose();
  };

  /** 进入预览模式 */
  const handleEnterPreview = () => {
    setMergePreviewMode(true);
    // 初始化字段选择：多源字段默认选第一个
    const initialSelections: Record<string, string> = {};
    const preview = computeMergePreview();
    for (const field of preview) {
      if (field.action === "pick_required" && field.sourceValues.length > 0) {
        initialSelections[field.key] = field.sourceValues[0].entityId;
      }
    }
    setMergeFieldSelections(initialSelections);
  };

  /** 退出预览模式 */
  const handleExitPreview = () => {
    setMergePreviewMode(false);
    setMergeFieldSelections({});
  };

  /** 用户在预览中选择了某字段的来源 */
  const handlePickFieldSource = (fieldKey: string, sourceEntityId: string) => {
    setMergeFieldSelections((prev) => ({ ...prev, [fieldKey]: sourceEntityId }));
  };

  // 合并确认对话框
  const mergeConfirmDialog = showMergeConfirm ? (
    <Dialog
      visible={showMergeConfirm}
      header="确认合并实体"
      width={520}
      placement="center"
      className="factdb-merge-confirm-dialog"
      confirmBtn={{ content: "确认合并", theme: "danger", loading: isMerging }}
      cancelBtn={{ content: "返回预览", variant: "outline" }}
      onConfirm={handleMergeConfirm}
      onCancel={() => setShowMergeConfirm(false)}
    >
      <div className="factdb-merge-confirm-content">
        <p className="factdb-merge-confirm-title">合并操作将执行以下变更：</p>
        <ol className="factdb-merge-confirm-list">
          <li>将各被合并实体的事实 / 事件关联迁移至目标实体（目标实体 #{targetEntity?.id}）</li>
          <li>按合并规则将被合并实体的简介等字段值合并到目标实体</li>
          <li>更新所有引用被合并实体的事实与事件</li>
          <li><strong>被合并实体将被删除</strong></li>
        </ol>
        <div className="factdb-merge-confirm-warning">
          <strong>⚠ 此操作不可撤销！</strong>
          <p>确认后，被合并的 {mergeSourceEntities.length} 个实体将被删除，其数据已合并到目标实体「#{targetEntity?.id} {targetEntity?.title}」。</p>
        </div>
      </div>
    </Dialog>
  ) : null;

  return (
    <>
      <Dialog
        visible={visible}
        header={
          <div className="factdb-dialog-header">
            <span>{mergePreviewMode ? "合并预览" : "合并实体"}</span>
          </div>
        }
        width={820}
        top="4vh"
        placement="center"
        destroyOnClose
        footer={false}
        className="factdb-merge-dialog"
        onClose={onClose}
      >
        <div className={`factdb-merge-panel ${mergePreviewMode ? "is-preview-mode" : ""}`}>
          {/* ===== 选择模式：搜索 & 添加合并对象 ===== */}
          {!mergePreviewMode && (
            <>
              <div className="factdb-merge-panel-alert">
                搜索并添加需要合并进目标实体的源实体。合并后，目标实体（当前选中）保留，被添加的实体将被删除，其数据按规则合入目标实体。
              </div>

              {/* 目标实体（选中，合并后保留） */}
              <div className="factdb-merge-source-entity">
                <span className="factdb-merge-role-label">目标实体（合并后保留）</span>
                <Tag
                  theme="success"
                  variant="light-outline"
                  closable={false}
                  className="factdb-merge-entity-tag factdb-merge-target-tag"
                >
                  #{targetEntity?.id} {targetEntity?.title}
                </Tag>
              </div>

              {/* 搜索被合并实体 */}
              <div className="factdb-merge-search-wrapper">
                <div className="factdb-merge-search-input-container">
                  <Input
                    value={mergeSearchValue}
                    onChange={handleMergeSearch}
                    placeholder="搜索需要合并的源实体..."
                    clearable
                    className="factdb-merge-search-input"
                  />
                  {mergeSearchResults.length > 0 && (
                    <div className="factdb-merge-search-dropdown">
                      {mergeSearchResults.map((sourceEntity) => (
                        <div
                          key={sourceEntity.id}
                          className="factdb-merge-search-item"
                          onClick={() => handleSelectMergeSource(sourceEntity)}
                        >
                          <span className="factdb-merge-search-item-title">{sourceEntity.title}</span>
                          <span className="factdb-merge-search-item-id">ID: {sourceEntity.id}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* 已选择的被合并实体 */}
              {mergeSourceEntities.length > 0 && (
                <div className="factdb-merge-target-entities">
                  <span className="factdb-merge-role-label">被合并实体（将被删除）</span>
                  <div className="factdb-merge-target-tags">
                    {mergeSourceEntities.map((sourceEntity) => (
                      <Tag
                        key={sourceEntity.id}
                        theme="danger"
                        variant="light"
                        closable
                        onClose={() => handleRemoveMergeSource(sourceEntity.id)}
                        className="factdb-merge-entity-tag factdb-merge-source-tag"
                      >
                        #{sourceEntity.id} {sourceEntity.title}
                      </Tag>
                    ))}
                  </div>
                </div>
              )}

              {/* 预览按钮 */}
              <div className="factdb-merge-actions">
                <Button
                  theme="primary"
                  size="large"
                  disabled={mergeSourceEntities.length === 0}
                  onClick={handleEnterPreview}
                  className="factdb-merge-submit-btn"
                >
                  预览合并结果
                </Button>
              </div>
            </>
          )}

          {/* ===== 预览模式：字段级合并预览 ===== */}
          {mergePreviewMode && (
            <>
              <div className="factdb-merge-preview-meta">
                <div className="factdb-merge-preview-entities">
                  <span className="factdb-merge-role-label">被合并实体（将被删除）</span>
                  {mergeSourceEntities.map((t) => (
                    <Tag key={t.id} theme="danger" variant="light-outline" closable={false}>
                      #{t.id} {t.title}
                    </Tag>
                  ))}
                  <span className="factdb-merge-arrow">→</span>
                  <span className="factdb-merge-role-label">目标实体（合并后保留）</span>
                  <Tag theme="success" variant="light-outline" closable={false}>
                    #{targetEntity?.id} {targetEntity?.title}
                  </Tag>
                </div>
              </div>

              {/* 合并规则说明 + 关联迁移说明 */}
              <div className="factdb-merge-rules-summary">
                <strong>合并规则：</strong> 目标字段为空时从源补入；目标已有值则保留目标，源值随被合并实体丢弃；不覆盖、不拼接。
              </div>
              <div className="factdb-merge-linked-notice">
                合并后，相关联的事实、事件所引用的实体将从被合并实体迁移至目标实体。
              </div>

              {/* 字段级预览列表 */}
              <div className="factdb-merge-preview-fields">
                {computeMergePreview().map((field) => (
                  <div key={field.key} className={`factdb-merge-field-row factdb-merge-field-row--${field.action}`}>
                    <div className="factdb-merge-field-label">{field.label}</div>
                    <div className="factdb-merge-field-body">
                      {/* 目标值 */}
                      <div className="factdb-merge-field-cell factdb-merge-field-cell--target">
                        <span className="factdb-merge-field-cell-label">目标</span>
                        <span className={`factdb-merge-field-value ${field.targetValue ? "has-value" : "empty"}`}>
                          {field.targetValue || "(空)"}
                        </span>
                      </div>

                      {/* 动作指示 */}
                      <div className="factdb-merge-field-action">
                        {field.action === "keep_target" && (
                          <span className="action-badge action-badge--keep">保留目标</span>
                        )}
                        {field.action === "fill_from_source" && (
                          <span className="action-badge action-badge--fill">填入源值</span>
                        )}
                        {field.action === "pick_required" && (
                          <span className="action-badge action-badge--pick">需选择来源</span>
                        )}
                      </div>

                      {/* 来源值 / 选择器 */}
                      <div className="factdb-merge-field-cell factdb-merge-field-cell--source">
                        <span className="factdb-merge-field-cell-label">来源</span>
                        {field.action === "pick_required" && field.sourceValues.length > 1 ? (
                          <select
                            className="factdb-merge-source-select"
                            value={mergeFieldSelections[field.key] || ""}
                                    onChange={(e) => handlePickFieldSource(field.key, e.target.value)}
                          >
                            {field.sourceValues.map((sv) => (
                                      <option key={sv.entityId} value={sv.entityId}>
                                        {sv.entityLabel}: {sv.value.slice(0, 40)}{sv.value.length > 40 ? "..." : ""}
                                      </option>
                            ))}
                          </select>
                        ) : (
                          <span className="factdb-merge-field-value source-value">
                            {field.sourceValues.length > 0
                              ? `${field.sourceValues[0].entityLabel}: ${field.sourceValues[0].value.slice(0, 60)}${field.sourceValues[0].value.length > 60 ? "..." : ""}`
                              : "(无)"}
                          </span>
                        )}
                      </div>

                      {/* 合并结果 */}
                      <div className="factdb-merge-field-cell factdb-merge-field-cell--result">
                        <span className="factdb-merge-field-cell-label">合并后</span>
                        <span className="factdb-merge-field-value result-value">{field.mergedValue || "(空)"}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* 确认合并按钮 + 返回修改 */}
              <div className="factdb-merge-actions factdb-merge-actions--preview">
                <Button
                  variant="outline"
                  size="large"
                  onClick={handleExitPreview}
                  disabled={isMerging}
                >
                  返回修改
                </Button>
                <Button
                  theme="danger"
                  size="large"
                  loading={isMerging}
                  onClick={() => setShowMergeConfirm(true)}
                  className="factdb-merge-submit-btn"
                >
                  确认合并结果
                </Button>
              </div>
            </>
          )}
        </div>
      </Dialog>
      {mergeConfirmDialog}
    </>
  );
}
