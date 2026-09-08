import React, { useLayoutEffect, useState } from "react";
import { Dialog, Form, Input, Textarea, Select, DatePicker, MessagePlugin } from "tdesign-react";
import type { ContentLanguage, Fact, LocalizedContent } from "../types";
import { languageOptions, mockEntities, mockEvents, tagOptions } from "../mock";
import EditorField from "./EditorField";

interface Props {
  visible: boolean;
  mode: "create" | "edit";
  fact?: Fact | null;
  onClose: () => void;
  onSave?: (diffSummary: string, updatedFields: Partial<Fact>) => void;
}

type LocalizedDraft = Record<ContentLanguage, { content: string; timeDesc: string }>;

type FormModel = {
  title: string;
  category: string;
  localized: LocalizedDraft;
  sourceType: string;
  source: string;
  sourceUrl: string;
  sourceContent: string;
  startTime: string;
  endTime: string;
  relatedEntityIds: string[];
  relatedEvents: string[];
  conflict: string;
  duplicate: string;
  conflictReason: string;
};

const languageCodes: ContentLanguage[] = ["zh", "en", "ar", "tr", "ru", "yue"];

function createLocalizedDraft(source?: LocalizedContent, content = "", timeDesc = ""): LocalizedDraft {
  return languageCodes.reduce<LocalizedDraft>((result, language) => {
    result[language] = {
      content: source?.[language]?.content || (language === "zh" ? content : ""),
      timeDesc: source?.[language]?.timeDesc || (language === "zh" ? timeDesc : ""),
    };
    return result;
  }, {} as LocalizedDraft);
}

const emptyModel: FormModel = {
  title: "",
  category: "系统模块",
  localized: createLocalizedDraft(),
  sourceType: "手动创建",
  source: "",
  sourceUrl: "",
  sourceContent: "",
  startTime: "",
  endTime: "",
  relatedEntityIds: [],
  relatedEvents: [],
  conflict: "",
  duplicate: "",
  conflictReason: "",
};

const entityOptions = mockEntities.map((entity) => ({ label: `[${entity.id}] ${entity.title}`, value: `[${entity.id}] ${entity.title}` }));
const eventOptions = mockEvents.map((event) => ({ label: `[${event.id}] ${event.name}`, value: `[${event.id}] ${event.name}` }));

function normalizeTime(value?: string) {
  if (!value || value === "-") return "";
  return value.replace(" ", "T");
}

function splitReferenceValues(value?: string) {
  if (!value || value === "-") return [];
  return value.split(/[,，]/).map((item) => item.trim()).filter(Boolean);
}

function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.map((item) => String(item)).filter(Boolean) : [];
}

function toLocalizedContent(localized: LocalizedDraft): LocalizedContent {
  return languageCodes.reduce<LocalizedContent>((result, language) => {
    const value = localized[language];
    if (value.content.trim() || value.timeDesc.trim()) {
      result[language] = {
        ...(value.content.trim() ? { content: value.content.trim() } : {}),
        ...(value.timeDesc.trim() ? { timeDesc: value.timeDesc.trim() } : {}),
      };
    }
    return result;
  }, {});
}

function toFactPatch(form: FormModel): Partial<Fact> {
  const translations = toLocalizedContent(form.localized);
  return {
    title: form.title.trim(),
    content: form.localized.zh.content.trim(),
    category: form.category,
    translations,
    sourceType: form.sourceType.trim() || "手动创建",
    source: form.source.trim() || "-",
    sourceUrl: form.sourceUrl.trim() || "-",
    sourceContent: form.sourceContent.trim() || "-",
    startTime: form.startTime || "-",
    endTime: form.endTime || "-",
    timeDesc: form.localized.zh.timeDesc.trim() || "-",
    relatedEntityIds: form.relatedEntityIds,
    keywords: form.relatedEntityIds.join(", ") || "-",
    relatedEvents: form.relatedEvents.join(", ") || "-",
    conflict: form.conflict.trim() || "-",
    duplicate: form.duplicate.trim() || "-",
    conflictReason: form.conflictReason.trim() || undefined,
  };
}

function getDiffSummary(initial: FormModel, next: FormModel) {
  const labels: Array<[keyof Omit<FormModel, "localized">, string]> = [
    ["title", "标题"], ["category", "事实分类"],
    ["sourceType", "来源类型"], ["source", "来源"], ["sourceUrl", "来源 URL"], ["sourceContent", "来源内容"],
    ["startTime", "开始时间"], ["endTime", "结束时间"], ["conflict", "矛盾事实"], ["duplicate", "重复事实"], ["conflictReason", "矛盾原因"],
  ];
  const changed = labels
    .filter(([key]) => initial[key] !== next[key])
    .map(([key, label]) => `${label}：${String(initial[key] || "-")} → ${String(next[key] || "-")}`);
  if (JSON.stringify(initial.relatedEntityIds) !== JSON.stringify(next.relatedEntityIds)) changed.push("关联实体已更新");
  if (JSON.stringify(initial.relatedEvents) !== JSON.stringify(next.relatedEvents)) changed.push("关联事件已更新");
  if (JSON.stringify(initial.localized) !== JSON.stringify(next.localized)) changed.push("多语言内容或时间说明已更新");
  return changed.length > 0 ? changed.join("；") : "未修改具体字段";
}

function createFormModel(fact?: Fact | null): FormModel {
  if (!fact) return {
    ...emptyModel,
    localized: createLocalizedDraft(),
    relatedEntityIds: [],
    relatedEvents: [],
  };
  return {
    title: fact.title || "",
    category: fact.category || "系统模块",
    localized: createLocalizedDraft(fact.translations, fact.content, fact.timeDesc || ""),
    sourceType: fact.sourceType || "手动创建",
    source: fact.source || "",
    sourceUrl: fact.sourceUrl || "",
    sourceContent: fact.sourceContent || "",
    startTime: normalizeTime(fact.startTime),
    endTime: normalizeTime(fact.endTime),
    relatedEntityIds: fact.relatedEntityIds?.length ? fact.relatedEntityIds : splitReferenceValues(fact.keywords),
    relatedEvents: splitReferenceValues(fact.relatedEvents),
    conflict: fact.conflict || "",
    duplicate: fact.duplicate || "",
    conflictReason: fact.conflictReason || "",
  };
}

export default function FactDialog({ visible, mode, fact, onClose, onSave }: Props) {
  const initialModel = mode === "edit" ? createFormModel(fact) : createFormModel();
  const [form, setForm] = useState<FormModel>(initialModel);
  const [initial, setInitial] = useState<FormModel>(initialModel);
  const [activeLanguage, setActiveLanguage] = useState<ContentLanguage>("zh");

  useLayoutEffect(() => {
    if (!visible) return;
    const next = mode === "edit" ? createFormModel(fact) : createFormModel();
    setForm(next);
    setInitial(next);
    setActiveLanguage("zh");
  }, [visible, mode, fact]);

  const updateLocalized = (patch: Partial<LocalizedDraft[ContentLanguage]>) => {
    setForm((previous) => ({
      ...previous,
      localized: {
        ...previous.localized,
        [activeLanguage]: { ...previous.localized[activeLanguage], ...patch },
      },
    }));
  };

  const handleSubmit = () => {
    if (!form.title.trim() || !form.localized.zh.content.trim()) {
      MessagePlugin.warning("请填写事实标题和中文事实内容");
      return;
    }
    onSave?.(mode === "create" ? "创建事实" : getDiffSummary(initial, form), toFactPatch(form));
    MessagePlugin.success(mode === "create" ? "创建成功" : "保存成功");
    onClose();
  };

  return (
    <Dialog
      visible={visible}
      header={mode === "create" ? "新建事实" : "编辑事实"}
      width={1160}
      top="3vh"
      placement="center"
      destroyOnClose
      className="factdb-edit-dialog factdb-edit-dialog--fact"
      confirmBtn={{ content: mode === "create" ? "创建" : "保存", theme: "primary" }}
      cancelBtn={{ content: "取消", variant: "outline" }}
      onClose={onClose}
      onConfirm={handleSubmit}
    >
      <Form layout="vertical" colon className="factdb-editor-form factdb-fact-editor">
        <div className="factdb-editor-grid factdb-editor-grid--top">
          <EditorField label="标题" requiredMark>
            <Input value={form.title} onChange={(value) => setForm((state) => ({ ...state, title: value }))} placeholder="请输入事实标题" />
          </EditorField>
          <EditorField label="分类" requiredMark>
            <Select
              value={form.category}
              onChange={(value) => setForm((state) => ({ ...state, category: String(value || "") }))}
              options={tagOptions.filter((option) => option.value !== "all").map((option) => ({ label: option.label, value: option.value }))}
              filterable
            />
          </EditorField>
        </div>

        <div className="factdb-editor-grid">
          <section className="factdb-editor-section">
            <div className="factdb-language-tabs" role="tablist" aria-label="事实内容语言">
              {languageOptions.map((language) => (
                <button
                  key={language.value}
                  type="button"
                  className={activeLanguage === language.value ? "is-active" : ""}
                  onClick={() => setActiveLanguage(language.value as ContentLanguage)}
                >
                  {language.label}
                </button>
              ))}
            </div>
            <EditorField label="事实内容" requiredMark>
              <Textarea
                value={form.localized[activeLanguage].content}
                onChange={(value) => updateLocalized({ content: value as string })}
                autosize={{ minRows: 7, maxRows: 14 }}
                placeholder={`请输入${languageOptions.find((language) => language.value === activeLanguage)?.label || "当前语言"}事实内容`}
              />
            </EditorField>
            <EditorField label="时间描述">
              <Textarea
                value={form.localized[activeLanguage].timeDesc}
                onChange={(value) => updateLocalized({ timeDesc: value as string })}
                autosize={{ minRows: 2, maxRows: 4 }}
                placeholder="如：每周五晚开启、长期有效"
              />
            </EditorField>
            <EditorField label="来源内容">
              <Textarea value={form.sourceContent} onChange={(value) => setForm((state) => ({ ...state, sourceContent: value as string }))} autosize={{ minRows: 4, maxRows: 8 }} placeholder="原始问答、公告或采集内容" />
            </EditorField>
            <EditorField label="矛盾原因">
              <Textarea value={form.conflictReason} onChange={(value) => setForm((state) => ({ ...state, conflictReason: value as string }))} autosize={{ minRows: 2, maxRows: 4 }} placeholder="存在矛盾时说明原因" />
            </EditorField>
          </section>

          <section className="factdb-editor-section">
            <EditorField label="来源类型">
              <Select
                value={form.sourceType}
                onChange={(value) => setForm((state) => ({ ...state, sourceType: String(value || "") }))}
                options={[
                  { label: "手动创建", value: "手动创建" },
                  { label: "批量导入", value: "批量导入" },
                  { label: "QA 同步", value: "QA 同步" },
                  { label: "内容同步", value: "内容同步" },
                  { label: "事实提取", value: "事实提取" },
                ]}
              />
            </EditorField>
            <EditorField label="来源">
              <Input value={form.source} onChange={(value) => setForm((state) => ({ ...state, source: value as string }))} placeholder="来源任务、渠道或原始数据标识" />
            </EditorField>
            <EditorField label="来源 URL">
              <Input value={form.sourceUrl} onChange={(value) => setForm((state) => ({ ...state, sourceUrl: value as string }))} placeholder="请输入来源 URL" />
            </EditorField>
            <div className="factdb-editor-inline-grid">
              <EditorField label="开始时间">
                <DatePicker enableTimePicker value={form.startTime} onChange={(value) => setForm((state) => ({ ...state, startTime: String(value || "") }))} format="YYYY-MM-DD HH:mm:ss" />
              </EditorField>
              <EditorField label="结束时间">
                <DatePicker enableTimePicker value={form.endTime} onChange={(value) => setForm((state) => ({ ...state, endTime: String(value || "") }))} format="YYYY-MM-DD HH:mm:ss" />
              </EditorField>
            </div>
            <EditorField label="关联实体">
              <Select
                multiple
                filterable
                value={form.relatedEntityIds}
                onChange={(value) => setForm((state) => ({ ...state, relatedEntityIds: asStringArray(value) }))}
                options={entityOptions}
                placeholder="可多选关联实体"
              />
            </EditorField>
            <EditorField label="关联事件">
              <Select
                multiple
                filterable
                value={form.relatedEvents}
                onChange={(value) => setForm((state) => ({ ...state, relatedEvents: asStringArray(value) }))}
                options={eventOptions}
                placeholder="可多选关联事件"
              />
            </EditorField>
            <EditorField label="矛盾事实 ID">
              <Input value={form.conflict} onChange={(value) => setForm((state) => ({ ...state, conflict: value as string }))} placeholder="多个 ID 请用英文逗号分隔" />
            </EditorField>
            <EditorField label="重复事实 ID">
              <Input value={form.duplicate} onChange={(value) => setForm((state) => ({ ...state, duplicate: value as string }))} placeholder="多个 ID 请用英文逗号分隔" />
            </EditorField>
          </section>
        </div>
      </Form>
    </Dialog>
  );
}
