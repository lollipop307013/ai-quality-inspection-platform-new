import React, { useLayoutEffect, useState, useEffect } from "react";
import { Dialog, Form, Input, Textarea, Select, Switch, MessagePlugin } from "tdesign-react";
import type { ContentLanguage, Entity, LocalizedContent } from "../types";
import { languageOptions, tagOptions } from "../mock";
import EditorField from "./EditorField";

interface Props {
  visible: boolean;
  mode: "create" | "edit";
  entity?: Entity | null;
  onClose: () => void;
  onSave?: (diffSummary: string, updatedFields: Partial<Entity>) => void;
}

type LocalizedDraft = Record<ContentLanguage, { title: string; alias: string; description: string }>;

type FormModel = {
  /** 中文名称（兼容与展示用，真实值在 localized[zh].title） */
  title: string;
  categories: string[];
  isCategory: boolean;
  localized: LocalizedDraft;
};

const languageCodes: ContentLanguage[] = ["zh", "en", "ar", "tr", "ru", "yue"];

function createLocalizedDraft(source?: LocalizedContent, alias = "", description = ""): LocalizedDraft {
  return languageCodes.reduce<LocalizedDraft>((result, language) => {
    result[language] = {
      title: source?.[language]?.title || (language === "zh" ? alias : ""),
      alias: source?.[language]?.alias || (language === "zh" ? alias : ""),
      description: source?.[language]?.description || (language === "zh" ? description : ""),
    };
    return result;
  }, {} as LocalizedDraft);
}

const emptyModel: FormModel = {
  title: "",
  categories: ["角色"],
  isCategory: false,
  localized: createLocalizedDraft(),
};

function splitCategories(value?: string) {
  return value ? value.split(/[,，]/).map((item) => item.trim()).filter(Boolean) : [];
}

function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.map((item) => String(item)).filter(Boolean) : [];
}

function toLocalizedContent(localized: LocalizedDraft): LocalizedContent {
  return languageCodes.reduce<LocalizedContent>((result, language) => {
    const value = localized[language];
    const title = value.title.trim();
    const alias = value.alias.trim();
    const description = value.description.trim();
    if (title || alias || description) {
      result[language] = {
        ...(title ? { title } : {}),
        ...(alias ? { alias } : {}),
        ...(description ? { description } : {}),
      };
    }
    return result;
  }, {});
}

function getDiffSummary(initial: FormModel, next: FormModel) {
  const changed: string[] = [];
  if (JSON.stringify(initial.localized) !== JSON.stringify(next.localized)) {
    const titleLangs: string[] = [];
    for (const lang of languageCodes) {
      if (initial.localized[lang].title !== next.localized[lang].title) {
        titleLangs.push(lang);
      }
    }
    if (titleLangs.length > 0) {
      changed.push(`名称（${titleLangs.join("/")}）已更新`);
    } else {
      changed.push("多语言别名或描述已更新");
    }
  }
  if (JSON.stringify(initial.categories) !== JSON.stringify(next.categories)) changed.push("分类已更新");
  if (initial.isCategory !== next.isCategory) changed.push(`分类节点：${next.isCategory ? "启用" : "关闭"}`);
  return changed.length > 0 ? changed.join("；") : "未修改具体字段";
}

function createFormModel(entity?: Entity | null): FormModel {
  if (!entity) return { ...emptyModel, categories: [...emptyModel.categories], localized: createLocalizedDraft() };
  const localized = createLocalizedDraft(entity.translations, entity.alias || "", entity.description || "");
  // 兼容旧实体：title 字段为空时回落到 entity.title
  if (!localized.zh.title && entity.title) localized.zh.title = entity.title;
  return {
    title: entity.title || "",
    categories: entity.categories?.length ? entity.categories : splitCategories(entity.tag),
    isCategory: Boolean(entity.isCategory),
    localized,
  };
}

export default function EntityDialog({ visible, mode, entity, onClose, onSave }: Props) {
  const initialModel = mode === "edit" ? createFormModel(entity) : createFormModel();
  const [form, setForm] = useState<FormModel>(initialModel);
  const [initial, setInitial] = useState<FormModel>(initialModel);
  const [activeLanguage, setActiveLanguage] = useState<ContentLanguage>("zh");

  useLayoutEffect(() => {
    if (!visible) return;
    const next = mode === "edit" ? createFormModel(entity) : createFormModel();
    setForm(next);
    setInitial(next);
    setActiveLanguage("zh");
  }, [visible, mode, entity]);

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
    const zhTitle = form.localized.zh.title.trim();
    if (!zhTitle) {
      MessagePlugin.warning("请填写中文实体名称");
      setActiveLanguage("zh");
      return;
    }
    const translations = toLocalizedContent(form.localized);
    onSave?.(
      mode === "create" ? "创建实体" : getDiffSummary(initial, form),
      {
        title: zhTitle,
        tag: form.categories[0] || "未分类",
        categories: form.categories,
        alias: form.localized.zh.alias.trim(),
        description: form.localized.zh.description.trim(),
        translations,
        isCategory: form.isCategory,
      },
    );
    MessagePlugin.success(mode === "create" ? "创建成功" : "保存成功");
    onClose();
  };

  return (
    <>
    <Dialog
      visible={visible}
      header={
        <div className="factdb-dialog-header">
          <span>{mode === "create" ? "新建实体" : "编辑实体"}</span>
        </div>
      }
      width={820}
      top="4vh"
      placement="center"
      destroyOnClose
      className="factdb-edit-dialog factdb-edit-dialog--entity"
      confirmBtn={{ content: mode === "create" ? "创建" : "保存", theme: "primary" }}
      cancelBtn={{ content: "取消", variant: "outline" }}
      onClose={onClose}
      onConfirm={handleSubmit}
    >
      <Form layout="vertical" colon className="factdb-editor-form factdb-entity-editor">
        <EditorField label="分类" requiredMark>
          <Select
            multiple
            filterable
            value={form.categories}
            onChange={(value) => setForm((state) => ({ ...state, categories: asStringArray(value) }))}
            options={tagOptions.filter((option) => option.value !== "all").map((option) => ({ label: option.label, value: option.value }))}
            placeholder="可多选实体分类"
          />
        </EditorField>

        <div className="factdb-language-tabs" role="tablist" aria-label="实体多语言信息">
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

        <div className="factdb-language-pane-label">
          {languageOptions.find((l) => l.value === activeLanguage)?.label}
          {activeLanguage === "zh" && <span className="factdb-required-mark">*</span>}
        </div>

        <EditorField label={`实体名称 (${languageOptions.find((l) => l.value === activeLanguage)?.label})`} requiredMark={activeLanguage === "zh"}>
          <Input
            value={form.localized[activeLanguage].title}
            onChange={(value) => updateLocalized({ title: value as string })}
            placeholder={activeLanguage === "zh" ? "请输入实体名称" : "请输入该语言的实体名称（可留空）"}
          />
        </EditorField>

        <EditorField label="别名">
          <Textarea
            value={form.localized[activeLanguage].alias}
            onChange={(value) => updateLocalized({ alias: value as string })}
            autosize={{ minRows: 3, maxRows: 6 }}
            placeholder="每行一个别名，每个别名最多 30 字"
          />
        </EditorField>

        <EditorField label="描述">
          <Textarea
            value={form.localized[activeLanguage].description}
            onChange={(value) => updateLocalized({ description: value as string })}
            autosize={{ minRows: 4, maxRows: 8 }}
            placeholder="请输入实体描述"
          />
        </EditorField>

        <div className="factdb-editor-inline-grid factdb-editor-inline-grid--entity">
          <EditorField label="作为分类">
            <Switch value={form.isCategory} size="small" onChange={(value) => setForm((state) => ({ ...state, isCategory: Boolean(value) }))} />
          </EditorField>
        </div>
      </Form>
    </Dialog>
    </>
  );
}
