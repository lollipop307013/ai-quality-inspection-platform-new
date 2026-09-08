import React, { useLayoutEffect, useState } from "react";
import { Dialog, Form, Input, Textarea, Select, MessagePlugin } from "tdesign-react";
import type { CategoryNode } from "../types";
import EditorField from "./EditorField";

interface Props {
  visible: boolean;
  mode: "create" | "edit";
  node?: CategoryNode | null;
  parentName?: string;
  editName?: string;
  editDesc?: string;
  onClose: () => void;
}

type FormModel = {
  name: string;
  parent: string;
  description: string;
  sort: string;
};

const emptyModel: FormModel = {
  name: "",
  parent: "",
  description: "",
  sort: "100",
};

export default function CategoryDialog({ visible, mode, node, parentName, editName, editDesc, onClose }: Props) {
  const [form, setForm] = useState<FormModel>(emptyModel);

  useLayoutEffect(() => {
    if (!visible) return;
    if (mode === "edit") {
      setForm({
        name: editName || node?.name || "",
        parent: parentName || "",
        description: editDesc || "",
        sort: "100",
      });
      return;
    }
    setForm({ ...emptyModel, parent: parentName || "" });
  }, [visible, mode, node, parentName, editName, editDesc]);

  const handleSubmit = () => {
    if (!form.name.trim()) {
      MessagePlugin.warning("请输入分类名称");
      return;
    }
    MessagePlugin.success(mode === "create" ? "创建成功" : "保存成功");
    onClose();
  };

  return (
    <Dialog
      visible={visible}
      header={mode === "create" ? "新增分类" : "编辑分类"}
      width={900}
      top="4vh"
      placement="center"
      className="factdb-edit-dialog"
      confirmBtn={{ content: mode === "create" ? "创建" : "保存", theme: "primary" }}
      cancelBtn={{ content: "取消", variant: "outline" }}
      onClose={onClose}
      onConfirm={handleSubmit}
    >
      <Form layout="vertical" colon className="factdb-editor-form factdb-category-editor factdb-form-grid-2">
        <div className="factdb-form-col">
          <EditorField label="分类名称" requiredMark>
            <Input value={form.name} onChange={(v) => setForm((s) => ({ ...s, name: v }))} />
          </EditorField>

          <EditorField label="父级分类">
            <Select
              value={form.parent}
              onChange={(v) => setForm((s) => ({ ...s, parent: String(v || "") }))}
              options={[{ label: "无（一级分类）", value: "" }]}
            />
          </EditorField>

          <EditorField label="排序值">
            <Input type="number" value={form.sort} onChange={(v) => setForm((s) => ({ ...s, sort: v }))} style={{ width: 180 }} />
          </EditorField>
        </div>

        <div className="factdb-form-col">
          <EditorField label="分类描述">
            <Textarea value={form.description} onChange={(v) => setForm((s) => ({ ...s, description: v }))} autosize={{ minRows: 6, maxRows: 12 }} />
          </EditorField>
        </div>
      </Form>
    </Dialog>
  );
}
