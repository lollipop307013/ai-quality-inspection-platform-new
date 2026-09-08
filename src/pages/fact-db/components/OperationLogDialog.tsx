import React from "react";
import { Dialog, Table, Button, Tag } from "tdesign-react";
import type { OperationLog } from "../types";

interface OperationLogDialogProps {
  visible: boolean;
  factId?: number;
  factTitle?: string;
  logs?: OperationLog[];
  onClose: () => void;
}

const ACTION_THEME: Record<string, "primary" | "success" | "warning" | "danger" | "default"> = {
  "创建-手动": "success",
  "创建-导入": "success",
  "编辑":     "primary",
  "状态变更":  "warning",
  "回退":     "danger",
  "同步":     "primary",
  "删除":     "danger",
};

const columns = [
  {
    colKey: "time",
    title: "操作时间",
    width: 175,
    cell: ({ row }: { row: OperationLog }) => (
      <span style={{ fontSize: 12, whiteSpace: "nowrap", color: "var(--td-text-color-secondary)" }}>
        {row.time}
      </span>
    ),
  },
  {
    colKey: "operator",
    title: "操作人",
    width: 110,
    cell: ({ row }: { row: OperationLog }) => (
      <span style={{ fontSize: 13 }}>{row.operator}</span>
    ),
  },
  {
    colKey: "action",
    title: "操作类型",
    width: 100,
    cell: ({ row }: { row: OperationLog }) => (
      <Tag theme={ACTION_THEME[row.action] || "default"} variant="light" size="small">
        {row.action}
      </Tag>
    ),
  },
  {
    colKey: "detail",
    title: "操作内容",
    cell: ({ row }: { row: OperationLog }) => (
      <span style={{ fontSize: 13, color: "var(--td-text-color-primary)" }}>{row.detail}</span>
    ),
  },
];

export default function OperationLogDialog({
  visible,
  factId,
  factTitle,
  logs = [],
  onClose,
}: OperationLogDialogProps) {
  return (
    <Dialog
      visible={visible}
      header={
        <div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>操作记录</div>
          {factTitle && (
            <div style={{ fontSize: 12, color: "var(--td-text-color-secondary)", fontWeight: 400, marginTop: 2 }}>
              ID: {factId} · {factTitle}
            </div>
          )}
        </div>
      }
      width={700}
      onClose={onClose}
      footer={<Button variant="outline" onClick={onClose}>关闭</Button>}
    >
      {logs.length === 0 ? (
        <div style={{ padding: "32px 0", textAlign: "center", color: "var(--td-text-color-placeholder)", fontSize: 13 }}>
          暂无操作记录
        </div>
      ) : (
        <Table
          data={[...logs].reverse()}  // 最新的在最上方
          columns={columns}
          rowKey="id"
          hover
          size="small"
        />
      )}
    </Dialog>
  );
}
