import React from "react";

type EditorFieldProps = {
  label: React.ReactNode;
  requiredMark?: boolean;
  children: React.ReactNode;
};

/**
 * 编辑窗口字段包装器。
 * 不使用 TDesign FormItem 的值注入机制，避免无 name 字段时覆盖本地受控状态。
 */
export default function EditorField({ label, requiredMark, children }: EditorFieldProps) {
  return (
    <div className="factdb-editor-field">
      <div className="factdb-editor-field-label">
        {requiredMark && <span aria-hidden="true">*</span>}
        {label}
      </div>
      <div className="factdb-editor-field-control">{children}</div>
    </div>
  );
}
