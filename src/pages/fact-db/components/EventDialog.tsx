import React, { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { Dialog, Form, Input, Textarea, Select, DatePicker, MessagePlugin } from "tdesign-react";
import type { ContentLanguage, EventTagValue, EventTimeType, GameEvent, LocalizedContent } from "../types";
import { languageOptions, tagOptions } from "../mock";
import EditorField from "./EditorField";

interface Props {
  visible: boolean;
  mode: "create" | "edit";
  event?: GameEvent | null;
  onClose: () => void;
  onSave?: (diffSummary: string, updatedFields: Partial<GameEvent>) => void;
}

type LocalizedDraft = Record<ContentLanguage, { alias: string; description: string; timeDesc: string }>;

type FormModel = {
  name: string;
  categories: string[];
  timeType: EventTimeType;
  startTime: string;
  endTime: string;
  recurringWeekdays: number[];
  recurringTimeStart: string;
  recurringTimeEnd: string;
  recurringDurationDays: number;
  localized: LocalizedDraft;
  source: string;
  remark: string;
};

const languageCodes: ContentLanguage[] = ["zh", "en", "ar", "tr", "ru", "yue"];
const weekdayOptions = [
  { label: "周一", value: 1 }, { label: "周二", value: 2 }, { label: "周三", value: 3 }, { label: "周四", value: 4 },
  { label: "周五", value: 5 }, { label: "周六", value: 6 }, { label: "周日", value: 7 },
];
const timeTypeOptions = [
  { label: "限时事件", value: "span" },
  { label: "周期事件", value: "recurring" },
  { label: "限时周期", value: "hybrid" },
  { label: "时间未定", value: "undetermined" },
];

function createLocalizedDraft(source?: LocalizedContent, alias = "", description = "", timeDesc = ""): LocalizedDraft {
  return languageCodes.reduce<LocalizedDraft>((result, language) => {
    result[language] = {
      alias: source?.[language]?.alias || (language === "zh" ? alias : ""),
      description: source?.[language]?.description || (language === "zh" ? description : ""),
      timeDesc: source?.[language]?.timeDesc || (language === "zh" ? timeDesc : ""),
    };
    return result;
  }, {} as LocalizedDraft);
}

const emptyModel: FormModel = {
  name: "",
  categories: ["活动"],
  timeType: "span",
  startTime: "",
  endTime: "",
  recurringWeekdays: [],
  recurringTimeStart: "19:00",
  recurringTimeEnd: "21:00",
  recurringDurationDays: 1,
  localized: createLocalizedDraft(),
  source: "",
  remark: "",
};

function normalizeTime(value?: string) {
  if (!value || value === "-") return "";
  return value.replace(" ", "T");
}

function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.map((item) => String(item)).filter(Boolean) : [];
}

function asNumberArray(value: unknown) {
  return Array.isArray(value) ? value.map((item) => Number(item)).filter((item) => Number.isFinite(item)) : [];
}

function calcDurationDaysByRange(startTime?: string, endTime?: string) {
  if (!startTime || !endTime) return 1;
  const start = new Date(startTime);
  const end = new Date(endTime);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 1;
  const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
  const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime();
  return Math.max(0, Math.round((endDay - startDay) / 86400000)) + 1;
}

function toLocalizedContent(localized: LocalizedDraft): LocalizedContent {
  return languageCodes.reduce<LocalizedContent>((result, language) => {
    const value = localized[language];
    if (value.alias.trim() || value.description.trim() || value.timeDesc.trim()) {
      result[language] = {
        ...(value.alias.trim() ? { alias: value.alias.trim() } : {}),
        ...(value.description.trim() ? { description: value.description.trim() } : {}),
        ...(value.timeDesc.trim() ? { timeDesc: value.timeDesc.trim() } : {}),
      };
    }
    return result;
  }, {});
}

function toEventPatch(form: FormModel): Partial<GameEvent> {
  const translations = toLocalizedContent(form.localized);
  return {
    name: form.name.trim(),
    eventType: form.categories[0] || "活动",
    categories: form.categories,
    translations,
    timeType: form.timeType,
    startTime: form.startTime || "-",
    endTime: form.endTime || "-",
    recurringWeekdays: form.timeType === "recurring" || form.timeType === "hybrid" ? form.recurringWeekdays : [],
    recurringTimeRange: form.timeType === "recurring" || form.timeType === "hybrid" ? [form.recurringTimeStart, form.recurringTimeEnd] : undefined,
    recurringDurationDays: form.timeType === "recurring" || form.timeType === "hybrid" ? form.recurringDurationDays : undefined,
    alias: form.localized.zh.alias.trim() || undefined,
    description: form.localized.zh.description.trim() || "",
    timeDesc: form.localized.zh.timeDesc.trim() || "",
    source: form.source.trim() || "-",
    remark: form.remark.trim() || "-",
  };
}

function getDiffText(previous: FormModel, next: FormModel) {
  const labels: Array<[keyof Omit<FormModel, "localized" | "categories">, string]> = [
    ["name", "事件名称"], ["timeType", "时间类型"],
    ["startTime", "开始时间"], ["endTime", "结束时间"], ["recurringTimeStart", "周期开始时刻"],
    ["recurringTimeEnd", "周期结束时刻"], ["recurringDurationDays", "单次持续天数"], ["source", "来源"], ["remark", "备注"],
  ];
  const changed = labels
    .filter(([key]) => String(previous[key] ?? "") !== String(next[key] ?? ""))
    .map(([key, label]) => `${label}：${String(previous[key] || "-")} → ${String(next[key] || "-")}`);
  if (JSON.stringify(previous.categories) !== JSON.stringify(next.categories)) changed.push("分类已更新");
  if (JSON.stringify(previous.recurringWeekdays) !== JSON.stringify(next.recurringWeekdays)) changed.push("周期星期已更新");
  if (JSON.stringify(previous.localized) !== JSON.stringify(next.localized)) changed.push("多语言内容已更新");
  return changed.length > 0 ? changed.join("；") : "未修改具体字段";
}

function createFormModel(event?: GameEvent | null): FormModel {
  if (!event) return {
    ...emptyModel,
    categories: [...emptyModel.categories],
    recurringWeekdays: [],
    localized: createLocalizedDraft(),
  };
  return {
    name: event.name || "",
    categories: event.categories?.length ? event.categories : [event.eventType || "活动"],
    timeType: event.timeType || "span",
    startTime: normalizeTime(event.startTime),
    endTime: normalizeTime(event.endTime),
    recurringWeekdays: event.recurringWeekdays || [],
    recurringTimeStart: event.recurringTimeRange?.[0] || "19:00",
    recurringTimeEnd: event.recurringTimeRange?.[1] || "21:00",
    recurringDurationDays: event.recurringDurationDays || 1,
    localized: createLocalizedDraft(event.translations, event.alias || "", event.description || "", event.timeDesc || ""),
    source: event.source || "",
    remark: event.remark || "",
  };
}

export default function EventDialog({ visible, mode, event, onClose, onSave }: Props) {
  const initialModel = mode === "edit" ? createFormModel(event) : createFormModel();
  const [form, setForm] = useState<FormModel>(initialModel);
  const [initial, setInitial] = useState<FormModel>(initialModel);
  const [activeLanguage, setActiveLanguage] = useState<ContentLanguage>("zh");

  useLayoutEffect(() => {
    if (!visible) return;
    const next = mode === "edit" ? createFormModel(event) : createFormModel();
    setForm(next);
    setInitial(next);
    setActiveLanguage("zh");
  }, [visible, mode, event]);

  const isRecurringLike = form.timeType === "recurring" || form.timeType === "hybrid";
  const isSpanLike = form.timeType === "span" || form.timeType === "hybrid";
  const isHybrid = form.timeType === "hybrid";

  useEffect(() => {
    if (!isHybrid) return;
    const days = calcDurationDaysByRange(form.startTime, form.endTime);
    setForm((previous) => previous.recurringDurationDays === days ? previous : { ...previous, recurringDurationDays: days });
  }, [isHybrid, form.startTime, form.endTime]);

  const updateLocalized = (patch: Partial<LocalizedDraft[ContentLanguage]>) => {
    setForm((previous) => ({
      ...previous,
      localized: {
        ...previous.localized,
        [activeLanguage]: { ...previous.localized[activeLanguage], ...patch },
      },
    }));
  };

  const canSubmit = useMemo(() => {
    if (!form.name.trim()) return false;
    if (isSpanLike && (!form.startTime || !form.endTime)) return false;
    if (isRecurringLike && form.recurringWeekdays.length === 0) return false;
    return true;
  }, [form, isRecurringLike, isSpanLike]);

  const handleSubmit = () => {
    if (!canSubmit) {
      MessagePlugin.warning("请先完善必填项");
      return;
    }
    onSave?.(mode === "create" ? "创建事件" : getDiffText(initial, form), toEventPatch(form));
    MessagePlugin.success(mode === "create" ? "创建成功" : "保存成功");
    onClose();
  };

  return (
    <Dialog
      visible={visible}
      header={mode === "create" ? "新建事件" : "编辑事件"}
      width={1080}
      top="3vh"
      placement="center"
      destroyOnClose
      className="factdb-edit-dialog factdb-edit-dialog--event"
      confirmBtn={{ content: mode === "create" ? "创建" : "保存", theme: "primary", disabled: !canSubmit }}
      cancelBtn={{ content: "取消", variant: "outline" }}
      onClose={onClose}
      onConfirm={handleSubmit}
    >
      <Form layout="vertical" colon className="factdb-editor-form factdb-event-editor">
        <div className="factdb-editor-grid factdb-editor-grid--top">
          <EditorField label="事件名称" requiredMark>
            <Input value={form.name} onChange={(value) => setForm((state) => ({ ...state, name: value as string }))} placeholder="请输入事件名称" />
          </EditorField>
          <EditorField label="分类" requiredMark>
            <Select
              multiple
              filterable
              value={form.categories}
              onChange={(value) => setForm((state) => ({ ...state, categories: asStringArray(value) }))}
              options={tagOptions.filter((option) => option.value !== "all").map((option) => ({ label: option.label, value: option.value }))}
              placeholder="可多选事件分类"
            />
          </EditorField>
        </div>

        <div className="factdb-editor-grid">
          <section className="factdb-editor-section">
            <div className="factdb-language-tabs" role="tablist" aria-label="事件多语言信息">
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
            <EditorField label="别名">
              <Textarea value={form.localized[activeLanguage].alias} onChange={(value) => updateLocalized({ alias: value as string })} autosize={{ minRows: 3, maxRows: 6 }} placeholder="每行一个别名" />
            </EditorField>
            <EditorField label="事件描述">
              <Textarea value={form.localized[activeLanguage].description} onChange={(value) => updateLocalized({ description: value as string })} autosize={{ minRows: 5, maxRows: 10 }} placeholder="请输入事件描述" />
            </EditorField>
            <EditorField label="时间说明">
              <Textarea value={form.localized[activeLanguage].timeDesc} onChange={(value) => updateLocalized({ timeDesc: value as string })} autosize={{ minRows: 3, maxRows: 5 }} placeholder="如：每周五晚开启、具体时间待官方公布" />
            </EditorField>
            <EditorField label="来源">
              <Input value={form.source} onChange={(value) => setForm((state) => ({ ...state, source: value as string }))} placeholder="来源任务、渠道或原始数据标识" />
            </EditorField>
            <EditorField label="备注">
              <Textarea value={form.remark} onChange={(value) => setForm((state) => ({ ...state, remark: value as string }))} autosize={{ minRows: 2, maxRows: 4 }} />
            </EditorField>
          </section>

          <section className="factdb-editor-section">
            <EditorField label="时间类型" requiredMark>
              <Select value={form.timeType} onChange={(value) => setForm((state) => ({ ...state, timeType: value as EventTimeType }))} options={timeTypeOptions} />
            </EditorField>

            {isSpanLike && (
              <div className="factdb-editor-inline-grid">
                <EditorField label="开始时间" requiredMark>
                  <DatePicker enableTimePicker value={form.startTime} onChange={(value) => setForm((state) => ({ ...state, startTime: String(value || "") }))} format="YYYY-MM-DD HH:mm:ss" />
                </EditorField>
                <EditorField label="结束时间" requiredMark>
                  <DatePicker enableTimePicker value={form.endTime} onChange={(value) => setForm((state) => ({ ...state, endTime: String(value || "") }))} format="YYYY-MM-DD HH:mm:ss" />
                </EditorField>
              </div>
            )}

            {isRecurringLike && (
              <>
                <EditorField label="周期星期" requiredMark>
                  <Select
                    multiple
                    value={form.recurringWeekdays}
                    onChange={(value) => setForm((state) => ({ ...state, recurringWeekdays: asNumberArray(value) }))}
                    options={weekdayOptions}
                    placeholder="请选择触发星期"
                  />
                </EditorField>
                <div className="factdb-editor-inline-grid">
                  <EditorField label="开始时刻">
                    <Input value={form.recurringTimeStart} onChange={(value) => setForm((state) => ({ ...state, recurringTimeStart: value as string }))} placeholder="19:00" />
                  </EditorField>
                  <EditorField label="结束时刻">
                    <Input value={form.recurringTimeEnd} onChange={(value) => setForm((state) => ({ ...state, recurringTimeEnd: value as string }))} placeholder="21:00" />
                  </EditorField>
                </div>
                <EditorField label="单次持续">
                  {isHybrid ? (
                    <Input value={`${form.recurringDurationDays} 天（由起止日期自动计算）`} readonly />
                  ) : (
                    <Input type="number" value={String(form.recurringDurationDays)} onChange={(value) => setForm((state) => ({ ...state, recurringDurationDays: Math.max(1, Number(value || 1)) }))} />
                  )}
                </EditorField>
              </>
            )}
          </section>
        </div>
      </Form>
    </Dialog>
  );
}
