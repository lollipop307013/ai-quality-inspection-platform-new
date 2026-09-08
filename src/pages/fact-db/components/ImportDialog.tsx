import React, { useState, useRef } from "react";
import { Dialog, Button, Space, MessagePlugin, Tag, Tabs, Table, DialogPlugin } from "tdesign-react";

const { TabPanel } = Tabs;

interface ImportDialogProps {
  visible: boolean;
  title: string;
  onClose: () => void;
}

// ── 导入记录类型 ─────────────────────────────────────────────────────────────
interface ImportRecord {
  id: string;
  operator: string;
  time: string;
  fileName: string;
  total: number;
  success: number;
  fail: number;
  status: "进行中" | "成功" | "部分失败" | "失败" | "已回退" | "已中止";
  canRollback: boolean;
  progress?: number; // 0-100，进行中时使用
}

const mockImportRecords: ImportRecord[] = [
  { id: "imp_000", operator: "dorrawang", time: "2026-05-06 11:10:00", fileName: "攻略批量导入_0506.csv",  total: 200, success: 87,  fail: 0,  status: "进行中",  canRollback: false, progress: 43 },
  { id: "imp_001", operator: "dorrawang", time: "2026-05-06 10:42:15", fileName: "事实库导入_0506.csv",    total: 120, success: 120, fail: 0,  status: "成功",    canRollback: true  },
  { id: "imp_002", operator: "zhangsan",  time: "2026-05-05 16:30:08", fileName: "霓虹英雄攻略.csv",      total: 45,  success: 43,  fail: 2,  status: "部分失败", canRollback: true  },
  { id: "imp_003", operator: "dorrawang", time: "2026-05-04 09:15:33", fileName: "0504全量导入.csv",      total: 300, success: 300, fail: 0,  status: "已回退",  canRollback: false },
  { id: "imp_004", operator: "lisi",      time: "2026-05-03 14:22:47", fileName: "外团标注结果_v2.csv",   total: 88,  success: 0,   fail: 88, status: "失败",    canRollback: false },
  { id: "imp_005", operator: "zhangsan",  time: "2026-05-02 17:05:12", fileName: "测试数据_0502.csv",     total: 50,  success: 31,  fail: 0,  status: "已中止",  canRollback: false },
];

const TEMPLATE_COLUMNS = [
  "id（有 ID 则覆盖原记录；留空则系统自动分配新 ID 入库）",
  "title（标题）",
  "content（事实内容）",
  "category（分类）",
  "sourceType（来源类型）",
  "source（来源）",
  "sourceUrl（来源URL）",
  "sourceContent（来源内容）",
  "startTime（开始时间，格式：YYYY-MM-DD HH:mm:ss）",
  "endTime（结束时间）",
  "timeDesc（时间描述）",
  "relatedEntities（关联实体ID，逗号分隔）",
  "relatedEvents（关联事件ID，逗号分隔）",
  "conflictIds（矛盾事实ID，逗号分隔）",
  "status（审核状态：待审核/已审核）",
];

const STATUS_THEME: Record<string, "success" | "warning" | "danger" | "default" | "primary"> = {
  "进行中":  "primary",
  "成功":    "success",
  "部分失败": "warning",
  "失败":    "danger",
  "已回退":  "default",
  "已中止":  "default",
};

export default function ImportDialog({ visible, title, onClose }: ImportDialogProps) {
  const [activeTab, setActiveTab] = useState("import");
  const [file, setFile] = useState<File | null>(null);
  const [records, setRecords] = useState<ImportRecord[]>(mockImportRecords);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFile(e.target.files?.[0] || null);
  };

  const handleDownloadTemplate = () => {
    const header = [
      "id", "title", "content", "category", "sourceType",
      "source", "sourceUrl", "sourceContent",
      "startTime", "endTime", "timeDesc",
      "relatedEntities", "relatedEvents", "conflictIds", "status",
    ].join(",");
    const example = [
      "", "霓虹技能价格说明", "高速通道300资金，闪电弹球300资金",
      "英雄攻略-霓虹", "游戏内提取", "-", "-", "-",
      "2026-01-01 00:00:00", "2026-12-31 23:59:59", "长期有效",
      "", "", "", "待审核",
    ].map((v) => `"${v}"`).join(",");
    const blob = new Blob(["\uFEFF" + `${header}\n${example}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "事实库导入模板.csv";
    a.click();
    URL.revokeObjectURL(url);
    MessagePlugin.success("模板已下载");
  };

  const handleImport = () => {
    if (!file) { MessagePlugin.warning("请先选择文件"); return; }
    // 模拟生成一条新导入记录
    const newRecord: ImportRecord = {
      id: `imp_${Date.now()}`,
      operator: "dorrawang",
      time: new Date().toLocaleString("zh-CN").replace(/\//g, "-"),
      fileName: file.name,
      total: Math.floor(Math.random() * 100) + 10,
      success: 0,
      fail: 0,
      status: "成功",
      canRollback: true,
    };
    newRecord.success = newRecord.total;
    setRecords((prev) => [newRecord, ...prev]);
    MessagePlugin.success(`「${file.name}」导入任务已提交`);
    setFile(null);
    setActiveTab("records"); // 导入后自动跳到记录 Tab
  };

  const handleRollback = (record: ImportRecord) => {
    const dlg = DialogPlugin.confirm({
      header: "确认回退导入",
      body: `回退将删除本次导入（${record.fileName}）新增/覆盖的 ${record.success} 条记录，此操作不可撤销，是否继续？`,
      theme: "danger",
      confirmBtn: { content: "确认回退", theme: "danger" },
      onConfirm: () => {
        setRecords((prev) => prev.map((r) =>
          r.id === record.id ? { ...r, status: "已回退" as const, canRollback: false } : r
        ));
        MessagePlugin.success("回退成功，相关记录已撤销");
        dlg.destroy();
      },
      onCancel: () => dlg.destroy(),
    });
  };

  const handleAbort = (record: ImportRecord) => {
    const dlg = DialogPlugin.confirm({
      header: "确认中止导入",
      body: `中止将立即停止导入进程，并回退已导入的 ${record.success} 条数据，未导入的部分将被丢弃，此操作不可撤销，是否继续？`,
      theme: "danger",
      confirmBtn: { content: "确认中止", theme: "danger" },
      onConfirm: () => {
        setRecords((prev) => prev.map((r) =>
          r.id === record.id ? { ...r, status: "已中止" as const, canRollback: false, progress: undefined } : r
        ));
        MessagePlugin.warning(`导入已中止，已回退 ${record.success} 条数据`);
        dlg.destroy();
      },
      onCancel: () => dlg.destroy(),
    });
  };

  const handleClose = () => { onClose(); setFile(null); setActiveTab("import"); };

  // ── 记录列表列定义 ──────────────────────────────────────────────────────
  const recordColumns = [
    {
      colKey: "time", title: "操作时间", width: 160,
      cell: ({ row }: { row: ImportRecord }) => (
        <span style={{ fontSize: 12, whiteSpace: "nowrap" }}>{row.time}</span>
      ),
    },
    { colKey: "operator", title: "操作人", width: 90 },
    {
      colKey: "fileName", title: "文件名", ellipsis: true,
      cell: ({ row }: { row: ImportRecord }) => (
        <span style={{ fontSize: 12 }}>{row.fileName}</span>
      ),
    },
    {
      colKey: "stat", title: "条数", width: 120,
      cell: ({ row }: { row: ImportRecord }) => (
        <div style={{ fontSize: 12 }}>
          {row.status === "进行中" ? (
            <div>
              <div style={{ marginBottom: 3, color: "var(--td-text-color-secondary)" }}>
                {row.success} / {row.total} 条
              </div>
              {/* 进度条 */}
              <div style={{ height: 4, background: "var(--td-bg-color-component)", borderRadius: 2, overflow: "hidden" }}>
                <div style={{
                  height: "100%", borderRadius: 2,
                  background: "var(--td-brand-color)",
                  width: `${row.progress ?? 0}%`,
                  transition: "width .4s",
                }} />
              </div>
              <div style={{ fontSize: 11, color: "var(--td-text-color-placeholder)", marginTop: 2 }}>
                {row.progress ?? 0}%
              </div>
            </div>
          ) : (
            <span>
              共 {row.total} 条
              {row.fail > 0 && (
                <span style={{ color: "var(--td-error-color)", marginLeft: 4 }}>
                  失败 {row.fail}
                </span>
              )}
            </span>
          )}
        </div>
      ),
    },
    {
      colKey: "status", title: "状态", width: 85,
      cell: ({ row }: { row: ImportRecord }) => (
        <Tag theme={STATUS_THEME[row.status] || "default"} variant="light" size="small">
          {row.status}
        </Tag>
      ),
    },
    {
      colKey: "op", title: "操作", width: 90, fixed: "right" as const,
      cell: ({ row }: { row: ImportRecord }) => {
        if (row.status === "进行中") {
          return (
            <Button variant="text" theme="danger" size="small" onClick={() => handleAbort(row)}>
              中止
            </Button>
          );
        }
        if (row.canRollback) {
          return (
            <Button variant="text" theme="danger" size="small" onClick={() => handleRollback(row)}>
              回退
            </Button>
          );
        }
        return <span style={{ fontSize: 12, color: "var(--td-text-color-placeholder)" }}>—</span>;
      },
    },
  ];

  return (
    <Dialog
      visible={visible}
      header={title}
      width={620}
      onClose={handleClose}
      footer={
        activeTab === "import" ? (
          <Space>
            <Button variant="outline" onClick={handleClose}>取消</Button>
            <Button theme="primary" onClick={handleImport}>开始导入</Button>
          </Space>
        ) : (
          <Button variant="outline" onClick={handleClose}>关闭</Button>
        )
      }
    >
      <Tabs value={activeTab} onChange={(v) => setActiveTab(v as string)} style={{ marginTop: -8 }}>

        {/* ── Tab 1：导入 ── */}
        <TabPanel value="import" label="导入">
          <div style={{ paddingTop: 16 }}>

            {/* 步骤 1：下载模板 */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>① 下载标注模板</div>
              <div style={{ fontSize: 13, color: "var(--td-text-color-secondary)", marginBottom: 10, lineHeight: 1.6 }}>
                外团标注时请使用此模板，填写完成后将文件发回。模板包含以下字段：
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 12 }}>
                {TEMPLATE_COLUMNS.map((col, i) => (
                  <Tag key={i} theme="default" variant="light" size="small">{col}</Tag>
                ))}
              </div>
              <Button theme="primary" variant="outline" onClick={handleDownloadTemplate}>
                ⬇ 下载导入模板 (.csv)
              </Button>
            </div>

            <div style={{ height: 1, background: "var(--td-component-stroke)", margin: "0 0 16px" }} />

            {/* 导入规则 */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>② 导入规则</div>
              <div style={{ fontSize: 13, color: "var(--td-text-color-secondary)", lineHeight: 1.8 }}>
                <div>• <strong>有 ID</strong>：按 ID 匹配，覆盖原有记录的全部字段</div>
                <div>• <strong>空 ID</strong>：系统自动分配新 ID，作为新记录入库</div>
                <div>• 每个 ID 在库内唯一，同一文件内不允许出现重复 ID</div>
                <div>• <strong>状态过滤（事实导入）</strong>：仅导入 status 为「已审核」的行，「待审核」/「已拒绝」自动跳过；status 为空时按「待审核」入库</div>
                <div>• <strong>关联实体/事件解析</strong>：<code>relatedEntities</code> / <code>relatedEvents</code> 字段以 <code>id:name</code> 格式存储（多值逗号分隔），导入时优先按 ID 关联；ID 缺失时按名称走 recall 模糊匹配，若仍未命中会进入下方"新实体处理"流程</div>
                <div>• <strong>新实体/事件去重聚合</strong>：检测到 <code>new_entity_*</code> / <code>new_event_*</code> 列且 <code>_keep=1</code> 时，后端按 <strong>名称聚合</strong>跨批次重复建议（不同 <code>tmp_id</code> 同名 → 合并为一个），分配正式 ID 后再关联事实；同名实体若已在库中则直接复用</div>
                <div>• <strong>tmp_id 的作用</strong>：仅用于跨字段在同一文件内引用（如事实的 <code>relatedEntities</code> 临时引用同文件的新实体），导入完成后被替换为正式 ID，不入库</div>
              </div>
            </div>

            <div style={{ height: 1, background: "var(--td-component-stroke)", margin: "0 0 16px" }} />

            {/* 步骤 2：上传文件 */}
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>③ 上传数据文件 (.csv)</div>
              <div
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "12px 14px",
                  border: `1px dashed ${file ? "var(--td-brand-color)" : "var(--td-component-stroke)"}`,
                  borderRadius: 8, cursor: "pointer", transition: "border-color .2s",
                }}
                onClick={() => fileRef.current?.click()}
              >
                <Button variant="outline" size="small" onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}>
                  选择文件
                </Button>
                <span style={{ fontSize: 13, color: file ? "var(--td-text-color-primary)" : "var(--td-text-color-placeholder)" }}>
                  {file ? file.name : "点击选择 .csv 文件"}
                </span>
                <input ref={fileRef} type="file" accept=".csv" style={{ display: "none" }} onChange={handleFileChange} />
              </div>
              <div style={{ fontSize: 12, color: "var(--td-text-color-placeholder)", marginTop: 6 }}>
                支持 .csv 格式，文件编码请使用 UTF-8（含 BOM）
              </div>
            </div>

          </div>
        </TabPanel>

        {/* ── Tab 2：导入记录 ── */}
        <TabPanel value="records" label={`导入记录（${records.length}）`}>
          <div style={{ paddingTop: 12 }}>
            <div style={{ fontSize: 12, color: "var(--td-text-color-placeholder)", marginBottom: 10 }}>
              回退操作将删除本次导入新增/覆盖的数据，请谨慎操作。
            </div>
            <Table
              data={records}
              columns={recordColumns}
              rowKey="id"
              hover
              size="small"
            />
          </div>
        </TabPanel>

      </Tabs>
    </Dialog>
  );
}
