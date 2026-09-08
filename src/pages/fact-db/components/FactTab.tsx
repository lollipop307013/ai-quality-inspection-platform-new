import React, { useState, useMemo } from "react";
import {
  Table, Button, Tag, Space, Input, Select, Checkbox,
  DialogPlugin, MessagePlugin, Tooltip,
} from "tdesign-react";
import { SearchIcon, AddIcon, EditIcon, CloseIcon, SwapIcon, HelpCircleIcon } from "tdesign-icons-react";
import { mockFacts, languageOptions, categoryTree, onlineStatusOptions, ONLINE_STATUS_CONFIG } from "../mock";
import FactDialog from "./FactDialog";
import ImportDialog from "./ImportDialog";
import OperationLogDialog from "./OperationLogDialog";
import CategoryDialog from "./CategoryDialog";
import PendingCoverTag from "./PendingCoverTag";
import { buildPendingCoverIndex, navigateToReviewList } from "../review-bridge";
import type { Fact, CategoryNode, FactStatus, FactEnv, UploadStatus } from "../types";
import { STATUS_TRANSITIONS } from "../types";

// ── 环境 Context（由 App 透传）─────────────────────────────────────────────
export interface FactTabProps {
  env: FactEnv;
}

function ExpandableCell({ text }: { text: string }) {
  if (!text) return <span>-</span>;
  return (
    <div style={{ maxHeight: "4.8em", overflowY: "auto", lineHeight: 1.6, fontSize: 13, wordBreak: "break-word", whiteSpace: "pre-wrap" }}>
      {text}
    </div>
  );
}

const UPLOAD_STATUS_CONFIG: Record<UploadStatus, { label: string; theme: "success" | "warning" | "danger" | "default"; tip: string }> = {
  pending:     { label: "待上传", theme: "default", tip: "还没上传过，等待后端自动同步" },
  need_update: { label: "待更新", theme: "warning", tip: "已上传过但内容更新了，需要重新上传" },
  done:        { label: "已上传", theme: "success", tip: "当前已成功同步到 RAG/Bot" },
  failed:      { label: "上传失败", theme: "danger",  tip: "同步失败，后端会自动重试" },
};

function normalizeUploadStatus(row: Fact): UploadStatus {
  if (row.uploadStatus) return row.uploadStatus;
  if (row.syncStatus === "failed") return "failed";
  if (row.syncStatus === "pending") return "pending";
  return "done";
}

export default function FactTab({ env: _env }: FactTabProps) {
  const [keyword, setKeyword] = useState("");
  const [idSearch, setIdSearch] = useState("");
  const [language, setLanguage] = useState("zh");
  const [onlineStatus, setOnlineStatus] = useState("all");
  const [category, setCategory] = useState("全部分类");
  const [selectedKeys, setSelectedKeys] = useState<(string | number)[]>([]);
  const [dialogVisible, setDialogVisible] = useState(false);
  const [importVisible, setImportVisible] = useState(false);
  const [logVisible, setLogVisible] = useState(false);
  const [logFact, setLogFact] = useState<Fact | null>(null);

  const handleOpenLog = (row: Fact) => {
    // 若没有日志，补一条创建记录作为占位
    const logsWithFallback: import("../types").OperationLog[] = (row.logs && row.logs.length > 0)
      ? row.logs
      : [{ id: 1, operator: "system", time: row.startTime && row.startTime !== "-" ? row.startTime : "—", action: "创建-手动", detail: "初始入库" }];
    setLogFact({ ...row, logs: logsWithFallback });
    setLogVisible(true);
  };
  const [catDialogVisible, setCatDialogVisible] = useState(false);
  const [catParentName, setCatParentName] = useState<string | undefined>(undefined);
  const [catMode, setCatMode] = useState<"create" | "edit">("create");
  const [catEditName, setCatEditName] = useState("");
  const [catEditDesc, setCatEditDesc] = useState("");
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [editFact, setEditFact] = useState<Fact | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  // 本地可变数据
  const [facts, setFacts] = useState<Fact[]>(mockFacts);
  // 分类侧栏默认收起（多列展示），需要时手动展开查看二级分类
  const [siderCollapsed, setSiderCollapsed] = useState(true);

  // 有待审覆盖版本的事实 ID 集合（来自审核任务静态索引）
  const pendingCoverIds = useMemo(() => buildPendingCoverIndex().fact, []);

  const toggleNode = (name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedNodes((prev) => { const n = new Set(prev); n.has(name) ? n.delete(name) : n.add(name); return n; });
  };

  const filtered = useMemo(() => {
    let result = facts.filter((fact) => !fact.env || fact.env === "prod");
    if (keyword) {
      const value = keyword.toLowerCase();
      result = result.filter((fact) => fact.title.toLowerCase().includes(value) || fact.content.toLowerCase().includes(value));
    }
    if (idSearch) result = result.filter((fact) => String(fact.id).includes(idSearch));
    if (onlineStatus !== "all") result = result.filter((fact) => fact.status === onlineStatus);
    if (category !== "全部分类" && category !== "未分类") result = result.filter((fact) => fact.category.includes(category));
    return result;
  }, [facts, keyword, idSearch, onlineStatus, category]);

  const handleCreate = () => { setDialogMode("create"); setEditFact(null); setDialogVisible(true); };
  const handleEdit = (row: Fact) => { setDialogMode("edit"); setEditFact(row); setDialogVisible(true); };
  const handleDelete = (row: Fact) => {
    const dlg = DialogPlugin.confirm({
      header: "确认删除", body: `确认删除事实「${row.title}」？`,
      theme: "danger", confirmBtn: { content: "删除", theme: "danger" }, cancelBtn: { content: "取消", variant: "outline" },
      onConfirm: () => { setFacts((prev) => prev.filter((f) => f.id !== row.id)); MessagePlugin.success("删除成功"); dlg.destroy(); },
      onCancel: () => dlg.destroy(),
    });
  };

  const appendLog = (factId: number, action: "编辑" | "状态变更" | "删除", detail: string) => {
    const now = new Date().toLocaleString("zh-CN").replace(/\//g, "-");
    setFacts((prev) => prev.map((f) => {
      if (f.id !== factId) return f;
      const newLog = { id: (f.logs?.length ?? 0) + 1, operator: "dorrawang", time: now, action, detail };
      return { ...f, logs: [...(f.logs ?? []), newLog] };
    }));
  };

  // ── 批量状态变更（流转规则校验 + 异常提示）──────────────────────────────
  const handleBatchStatus = (newStatus: FactStatus) => {
    if (selectedKeys.length === 0) { MessagePlugin.warning("请先选择记录"); return; }

    const eligible = facts.filter((f) => selectedKeys.includes(f.id) && STATUS_TRANSITIONS[f.status]?.includes(newStatus));
    const blocked   = facts.filter((f) => selectedKeys.includes(f.id) && !STATUS_TRANSITIONS[f.status]?.includes(newStatus));

    if (blocked.length > 0 && eligible.length === 0) {
      // 全部不符合
      DialogPlugin.confirm({
        header: "无法执行操作",
        body: `所选 ${blocked.length} 条记录当前状态均不允许变更为「${newStatus}」，请重新筛选后操作。`,
        theme: "warning",
        confirmBtn: { content: "知道了", theme: "primary" },
        cancelBtn: false as any,
        onConfirm: (ctx) => ctx.e && (ctx.e as any).dialog?.destroy?.(),
      });
      return;
    }

    if (blocked.length > 0) {
      // 部分不符合：告知情况，让运营决定是否继续
      const blockedSummary = blocked.slice(0, 3).map((f) => `「${f.title}」(${f.status})`).join("、");
      const extra = blocked.length > 3 ? `等 ${blocked.length} 条` : `共 ${blocked.length} 条`;
      const dlg = DialogPlugin.confirm({
        header: "部分记录无法变更",
        body: (
          <div>
            <p>选中的 <strong>{selectedKeys.length}</strong> 条记录中：</p>
            <p style={{ margin: "8px 0" }}>
              ✅ <strong style={{ color: "var(--td-success-color)" }}>{eligible.length} 条</strong>符合条件，将变更为「{newStatus}」
            </p>
            <p style={{ margin: "8px 0" }}>
              ⚠️ <strong style={{ color: "var(--td-warning-color)" }}>{extra}</strong>当前状态不允许此操作（{blockedSummary}{blocked.length > 3 ? "…" : ""}），将跳过
            </p>
            <p style={{ marginTop: 8, fontSize: 12, color: "var(--td-text-color-placeholder)" }}>
              如需对跳过的记录操作，请单独筛选后处理。
            </p>
          </div>
        ) as any,
        theme: "warning",
        confirmBtn: { content: `仅对 ${eligible.length} 条执行`, theme: "primary" },
        cancelBtn: { content: "取消", variant: "outline" },
        onConfirm: () => {
          const now = new Date().toLocaleString("zh-CN").replace(/\//g, "-");
          const eligibleIds = new Set(eligible.map((f) => f.id));
          setFacts((prev) => prev.map((f) => {
            if (!eligibleIds.has(f.id)) return f;
            const newLog = { id: (f.logs?.length ?? 0) + 1, operator: "dorrawang", time: now, action: "状态变更" as const, detail: `${f.status} → ${newStatus}` };
            return { ...f, status: newStatus, logs: [...(f.logs ?? []), newLog] };
          }));
          MessagePlugin.success(`已对 ${eligible.length} 条执行「${newStatus}」，${blocked.length} 条已跳过`);
          setSelectedKeys([]);
          dlg.destroy();
        },
        onCancel: () => dlg.destroy(),
      });
      return;
    }

    // 全部符合：正常确认
    const dlg = DialogPlugin.confirm({
      header: "批量变更状态",
      body: `将选中的 ${eligible.length} 条记录变更为「${newStatus}」？`,
      theme: "warning",
      confirmBtn: { content: "确认变更", theme: "primary" },
      onConfirm: () => {
        const now = new Date().toLocaleString("zh-CN").replace(/\//g, "-");
        setFacts((prev) => prev.map((f) => {
          if (!selectedKeys.includes(f.id)) return f;
          const newLog = { id: (f.logs?.length ?? 0) + 1, operator: "dorrawang", time: now, action: "状态变更" as const, detail: `${f.status} → ${newStatus}` };
          return { ...f, status: newStatus, logs: [...(f.logs ?? []), newLog] };
        }));
        MessagePlugin.success(`已将 ${selectedKeys.length} 条记录变更为「${newStatus}」`);
        setSelectedKeys([]);
        dlg.destroy();
      },
      onCancel: () => dlg.destroy(),
    });
  };

  // ── 批量删除（原型内为本地状态移除）──────────────────────────────────────
  const handleBatchDelete = () => {
    if (selectedKeys.length === 0) { MessagePlugin.warning("请先选择记录"); return; }
    const selected = facts.filter((f) => selectedKeys.includes(f.id));
    const names = selected.slice(0, 3).map((f) => `「${f.title}」`).join("、");
    const dlg = DialogPlugin.confirm({
      header: "批量删除",
      body: `确认删除选中的 ${selected.length} 条事实？${names}${selected.length > 3 ? "…" : ""}删除后不可恢复。`,
      theme: "danger",
      confirmBtn: { content: "删除", theme: "danger" }, cancelBtn: { content: "取消", variant: "outline" },
      onConfirm: () => {
        const ids = new Set(selectedKeys);
        setFacts((prev) => prev.filter((f) => !ids.has(f.id)));
        setSelectedKeys([]);
        MessagePlugin.success(`已删除 ${selected.length} 条事实`);
        dlg.destroy();
      },
      onCancel: () => dlg.destroy(),
    });
  };

  // 根据选中行的当前状态，计算公共可流转的下一步（所有选中行都支持才显示该按钮）
  const commonNextStatuses = useMemo((): FactStatus[] => {
    if (selectedKeys.length === 0) return [];
    const selectedFacts = facts.filter((f) => selectedKeys.includes(f.id));
    if (selectedFacts.length === 0) return [];
    // 取所有选中行各自合法下一步的交集
    const allNext = selectedFacts.map((f) => STATUS_TRANSITIONS[f.status] ?? []);
    return (allNext[0] ?? []).filter((s) => allNext.every((arr) => arr.includes(s)));
  }, [selectedKeys, facts]);

  // ── 分类面板 ────────────────────────────────────────────────────────────
  const handleCatDelete = (node: CategoryNode, e: React.MouseEvent) => {
    e.stopPropagation();
    const dlg = DialogPlugin.confirm({
      header: "确认删除", body: `确认删除分类「${node.name}」？`,
      theme: "danger", confirmBtn: { content: "删除", theme: "danger" }, cancelBtn: "取消",
      onConfirm: () => { MessagePlugin.success("删除成功"); dlg.destroy(); },
      onCancel: () => dlg.destroy(),
    });
  };
  const handleCatAdd = (nodeName: string, e: React.MouseEvent) => { e.stopPropagation(); setCatMode("create"); setCatParentName(nodeName); setCatDialogVisible(true); };
  const handleCatEdit = (nodeName: string, e: React.MouseEvent) => { e.stopPropagation(); setCatMode("edit"); setCatEditName(nodeName); setCatEditDesc(`由 source_type 自动创建：${nodeName}`); setCatDialogVisible(true); };

  // 计算节点下所有叶子数（用于显示计数）
  const countLeaves = (node: CategoryNode): number => {
    if (!node.children || node.children.length === 0) return 1;
    return node.children.reduce((s, c) => s + countLeaves(c), 0);
  };

  const renderCatNode = (node: CategoryNode, depth = 0) => {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedNodes.has(node.name);
    const isActive = category === node.name;
    const leafCount = countLeaves(node);
    return (
      <div key={node.name}>
        <div
          className={`factdb-category-item ${isActive ? "factdb-category-item--active" : ""}`}
          style={{ paddingLeft: 10 + depth * 18 }}
          onClick={() => setCategory(node.name)}
        >
          <div style={{ display: "flex", alignItems: "center", flex: 1 }}>
            {hasChildren ? (
              <span className="entity-tree-arrow" onClick={(e) => toggleNode(node.name, e)}>
                {isExpanded ? "▼" : "▶"}
              </span>
            ) : <span className="entity-tree-arrow" />}
            <span className="factdb-cat-label">{node.name}</span>
            <span className="factdb-cat-count">({leafCount})</span>
          </div>
          <span className="entity-tree-actions" onClick={(e) => e.stopPropagation()}>
            <Button variant="text" size="small" shape="square" icon={<AddIcon />} onClick={(e) => handleCatAdd(node.name, e as any)} />
            <Button variant="text" size="small" shape="square" icon={<EditIcon />} onClick={(e) => handleCatEdit(node.name, e as any)} />
            <Button variant="text" theme="danger" size="small" shape="square" icon={<CloseIcon />} onClick={(e) => handleCatDelete(node, e as any)} />
          </span>
        </div>
        {hasChildren && isExpanded && node.children!.map((child) => renderCatNode(child, depth + 1))}
      </div>
    );
  };

  const columns = [
    { colKey: "row-select", type: "multiple" as const, width: 32 },
    { colKey: "id", title: "事实ID", width: 52, cell: ({ row }: { row: Fact }) => <span style={{ whiteSpace: "nowrap" }}>{row.id}</span> },
    { colKey: "title", title: "标题", width: 80, cell: ({ row }: { row: Fact }) => (
      <span style={{ display: "inline-flex", alignItems: "center", maxWidth: "100%" }}>
        <span className="fact-title-ellipsis" title={row.title}>{row.title}</span>
        {pendingCoverIds.has(row.id) && <PendingCoverTag objectType="fact" objectId={row.id} />}
      </span>
    ) },
    { colKey: "content", title: "事实内容", width: 70, ellipsis: true, cell: ({ row }: { row: Fact }) => (
      <Tooltip content={row.content} placement="top" overlayStyle={{ maxWidth: 480 }}>
        <div className="fact-content-clamp">{row.content}</div>
      </Tooltip>
    ) },
    {
      colKey: "status",
      title: () => (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          状态
          <Tooltip
            placement="top"
            overlayStyle={{ maxWidth: 320 }}
            content={
              <div style={{ fontSize: 12, lineHeight: 1.7 }}>
                <div>每行展示两个状态：上面是「线上状态」（事实内容是否对外可查），下面是「上传状态」（是否已同步到 RAG/Bot）。</div>
                <div style={{ marginTop: 4 }}>hover 标签可查看每个状态的说明。</div>
              </div>
            }
          >
            <HelpCircleIcon style={{ color: "var(--td-text-color-placeholder)", fontSize: 13, cursor: "help" }} />
          </Tooltip>
        </span>
      ),
      width: 80,
      cell: ({ row }: { row: Fact }) => {
        const online = ONLINE_STATUS_CONFIG[row.status];
        const upload = normalizeUploadStatus(row);
        const uploadCfg = UPLOAD_STATUS_CONFIG[upload];
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 2, alignItems: "flex-start" }}>
            {online ? <Tag theme={online.theme} variant="light" size="small">{online.label}</Tag> : <span style={{ fontSize: 11 }}>{row.status}</span>}
            <Tooltip
              placement="left"
              overlayStyle={{ maxWidth: 280 }}
              content={<div style={{ fontSize: 12, lineHeight: 1.6 }}>{uploadCfg.tip}</div>}
            >
              <Tag theme={uploadCfg.theme} variant="light" size="small" style={{ cursor: "default" }}>
                {upload === "failed" ? "⚠ " : ""}{uploadCfg.label}
              </Tag>
            </Tooltip>
          </div>
        );
      },
    },
    { colKey: "related", title: "关联对象", width: 80, ellipsis: true, cell: ({ row }: { row: Fact }) => {
      const ents = row.keywords ? row.keywords.split(",").map((s) => s.trim()).filter(Boolean) : [];
      const evts = row.relatedEvents && row.relatedEvents !== "-" ? row.relatedEvents.split(",").map((s) => s.trim()).filter(Boolean) : [];
      if (ents.length === 0 && evts.length === 0) return <span style={{ color: "var(--td-text-color-placeholder)" }}>-</span>;
      const entHead = ents.slice(0, 1).join(",");
      const evtHead = evts.slice(0, 1).join(",");
      const rest = Math.max(0, ents.length - 1) + Math.max(0, evts.length - 1);
      return (
        <Tooltip
          placement="top"
          overlayStyle={{ maxWidth: 360 }}
          content={
            <div style={{ fontSize: 12, lineHeight: 1.6 }}>
              {ents.length > 0 && <div>实体：{ents.join(", ")}</div>}
              {evts.length > 0 && <div>事件：{evts.join(", ")}</div>}
            </div>
          }
        >
          <span style={{ whiteSpace: "nowrap" }}>
            {[entHead, evtHead].filter(Boolean).join(" / ")}{rest > 0 ? ` +${rest}` : ""}
          </span>
        </Tooltip>
      );
    }},
    { colKey: "source", title: "来源", width: 100, ellipsis: true, cell: ({ row }: { row: Fact }) => {
      const parts: { label: string; tip?: string; href?: string }[] = [];
      if (row.sourceType && row.sourceType !== "-") parts.push({ label: row.sourceType, tip: "来源类型：" + row.sourceType });
      if (row.source && row.source !== "-") parts.push({ label: row.source, tip: "来源：" + row.source });
      if (row.sourceUrl && row.sourceUrl !== "-") parts.push({ label: "URL", tip: row.sourceUrl, href: row.sourceUrl });
      if (row.sourceContent && row.sourceContent !== "-") parts.push({ label: "正文", tip: row.sourceContent });
      if (parts.length === 0) return <span style={{ color: "var(--td-text-color-placeholder)" }}>-</span>;
      return (
        <Space size={2} style={{ flexWrap: "wrap", rowGap: 2 }}>
          {parts.map((p) => {
            const node = p.href
              ? <a href={p.href} target="_blank" rel="noreferrer" style={{ color: "var(--td-brand-color)" }}>{p.label}</a>
              : <span>{p.label}</span>;
            return p.tip
              ? <Tooltip key={p.label} content={p.tip} placement="top" overlayStyle={{ maxWidth: 480 }}><span>{node}</span></Tooltip>
              : <span key={p.label}>{node}</span>;
          })}
        </Space>
      );
    }},
    { colKey: "timeRange", title: "起止时间", width: 70, ellipsis: true, cell: ({ row }: { row: Fact }) => (
      <Tooltip content={row.startTime && row.endTime ? `${row.startTime} ~ ${row.endTime}` : (row.startTime || row.endTime || "-")} placement="top">
        <span style={{ whiteSpace: "nowrap" }}>
          {row.startTime && row.endTime ? `${row.startTime.slice(5)} ~ ${row.endTime.slice(5)}` : (row.startTime || row.endTime || "-")}
        </span>
      </Tooltip>
    )},
    { colKey: "op", title: "操作", width: 96, cell: ({ row }: { row: Fact }) => (
      <Space size={2}>
        <Button variant="text" theme="primary" size="small" onClick={() => handleEdit(row)}>编辑</Button>
        <Button variant="text" theme="primary" size="small" onClick={() => handleOpenLog(row)}>记录</Button>
        <Button variant="text" theme="danger" size="small" onClick={() => handleDelete(row)}>删除</Button>
      </Space>
    )},
  ];

  return (
    <div className="factdb-tab-content">
      {/* 统计栏：线上状态 + 上传状态 */}
      <div className="page-stats">
        <span className="stat-item">共 <b className="stat-num">{filtered.length}</b> 条线上事实</span>
        <span className="stat-divider">·</span>
        <span className="stat-item">已上线 <b className="stat-num" style={{ color: "var(--td-success-color)" }}>{facts.filter((fact) => fact.env !== "test" && fact.status === "已上线").length}</b></span>
        <span className="stat-divider">·</span>
        <span className="stat-item">已下线 <b className="stat-num" style={{ color: "var(--td-text-color-placeholder)" }}>{facts.filter((fact) => fact.env !== "test" && fact.status === "已下线").length}</b></span>
        <span className="stat-divider">·</span>
        <span className="stat-item">已上传 <b className="stat-num" style={{ color: "var(--td-success-color)" }}>{facts.filter(f => normalizeUploadStatus(f) === "done").length}</b></span>
        <span className="stat-divider">·</span>
        <span className="stat-item">待上传 <b className="stat-num" style={{ color: "var(--td-text-color-placeholder)" }}>{facts.filter(f => normalizeUploadStatus(f) === "pending").length}</b></span>
        <span className="stat-divider">·</span>
        <span className="stat-item">待更新 <b className="stat-num" style={{ color: "var(--td-warning-color)" }}>{facts.filter(f => normalizeUploadStatus(f) === "need_update").length}</b></span>
        {facts.filter(f => normalizeUploadStatus(f) === "failed").length > 0 && (
          <>
            <span className="stat-divider">·</span>
            <Tooltip content="点击筛选所有上传失败的事实">
              <span
                className="stat-item"
                style={{ cursor: "pointer", color: "var(--td-error-color)" }}
                onClick={() => MessagePlugin.info("已为你筛选上传失败的事实（demo 占位，可接入实际筛选）")}
              >
                ⚠ 上传失败 <b className="stat-num" style={{ color: "var(--td-error-color)" }}>{facts.filter(f => normalizeUploadStatus(f) === "failed").length}</b>
              </span>
            </Tooltip>
          </>
        )}
        {pendingCoverIds.size > 0 && (
          <>
            <span className="stat-divider">·</span>
            <span className="stat-item stat-item--link" title="点击前往内容审核工作台" onClick={() => navigateToReviewList()}>
              待审版本 <b className="stat-num" style={{ color: "var(--td-warning-color)" }}>{pendingCoverIds.size}</b>
            </span>
          </>
        )}
      </div>
      <div className="factdb-fact-layout">
        {/* 左侧分类面板（可折叠，默认展开） */}
        <div className={`factdb-fact-sider ${siderCollapsed ? "is-collapsed" : ""}`}>
          <div className="factdb-fact-sider-header">
            {!siderCollapsed && <strong>事实分类</strong>}
            <Space size="small">
              {!siderCollapsed && (
                <>
                  <Button variant="text" theme="primary" size="small" onClick={() => { setCatMode("create"); setCatParentName(undefined); setCatDialogVisible(true); }}>+ 一级</Button>
                  <Button variant="text" size="small">刷新</Button>
                </>
              )}
              <Button
                variant="text"
                size="small"
                title={siderCollapsed ? "展开分类" : "收起分类"}
                onClick={() => setSiderCollapsed((v) => !v)}
              >
                {siderCollapsed ? "›" : "‹"}
              </Button>
            </Space>
          </div>
          {!siderCollapsed && (
            <>
              <div style={{ fontSize: 12, color: "var(--td-text-color-secondary)", marginBottom: 8 }}>当前：{category}</div>
              <div style={{ maxHeight: 500, overflowY: "auto" }}>
                {categoryTree.map((cat) => renderCatNode(cat, 0))}
              </div>
            </>
          )}
        </div>

        {/* 右侧主区 */}
        <div className="factdb-fact-main">

          {/* 工具栏 */}
          <div className="factdb-toolbar">
            <div className="factdb-toolbar-left">
              <Input placeholder="ID搜索..." value={idSearch} onChange={(v) => setIdSearch(v)} style={{ width: 110 }} />
              <Input prefixIcon={<SearchIcon />} placeholder="搜索事实..." value={keyword} onChange={(v) => setKeyword(v)} style={{ width: 180 }} />
              <Select filterable options={languageOptions} value={language} onChange={(v) => setLanguage(v as string)} style={{ width: 90 }} />
              <Select filterable options={onlineStatusOptions} value={onlineStatus} onChange={(value) => setOnlineStatus(value as string)} style={{ width: 130 }} />
              <Select filterable prefixIcon={<SwapIcon />} label="排序:" options={[
                { label: "开始时间（新到旧）", value: "startTime_desc" },
                { label: "开始时间（旧到新）", value: "startTime_asc" },
                { label: "创建时间（新到旧）", value: "createTime_desc" },
                { label: "创建时间（旧到新）", value: "createTime_asc" },
                { label: "ID（小到大）", value: "id_asc" },
                { label: "ID（大到小）", value: "id_desc" },
              ]} value="startTime_desc" onChange={() => {}} style={{ width: 200 }} />
              <Checkbox>含多语言列</Checkbox>
            </div>
            <Space>
              <Button theme="primary" onClick={handleCreate}>+ 新建事实</Button>
              <Button variant="outline" onClick={() => setImportVisible(true)}>批量导入</Button>
              <Button variant="outline">导出</Button>
            </Space>
          </div>

          {/* 批量操作栏（有选中时展开） */}
          {selectedKeys.length > 0 && (
            <div style={{
              display: "flex", alignItems: "center", gap: 8, padding: "8px 12px",
              background: "var(--td-bg-color-secondarycontainer)",
              borderRadius: 6, marginBottom: 8, flexWrap: "wrap",
            }}>
              <span style={{ fontSize: 13, color: "var(--td-text-color-secondary)" }}>
                已选 <strong style={{ color: "var(--td-brand-color)" }}>{selectedKeys.length}</strong> 条
              </span>
              {commonNextStatuses.length > 0 && (
                <>
                  <span style={{ width: 1, height: 16, background: "var(--td-component-stroke)", margin: "0 4px" }} />
                  <span style={{ fontSize: 13, color: "var(--td-text-color-secondary)" }}>变更状态：</span>
                  {commonNextStatuses.map((s) => (
                    <Button key={s} size="small" variant="outline" onClick={() => handleBatchStatus(s)}>
                      → {s}
                    </Button>
                  ))}
                </>
              )}
              {commonNextStatuses.length === 0 && (
                <span style={{ fontSize: 12, color: "var(--td-warning-color)" }}>
                  所选记录状态不一致，无公共可流转操作
                </span>
              )}
              <span style={{ width: 1, height: 16, background: "var(--td-component-stroke)", margin: "0 4px" }} />
              <Button size="small" variant="outline" theme="danger" onClick={handleBatchDelete}>批量删除</Button>
              <Button size="small" variant="text" theme="danger" onClick={() => setSelectedKeys([])}>清空选择</Button>
            </div>
          )}

          <Table
            data={filtered}
            columns={columns}
            rowKey="id"
            hover
            selectedRowKeys={selectedKeys}
            onSelectChange={(keys) => setSelectedKeys(keys)}
            pagination={{ defaultPageSize: 50, pageSizeOptions: [20, 50, 100, 200], total: filtered.length, showJumper: true }}
          />

          <FactDialog
            key={`${dialogMode}-${editFact?.id ?? "new"}`}
            visible={dialogVisible}
            mode={dialogMode}
            fact={editFact}
            onClose={() => setDialogVisible(false)}
            onSave={(diffSummary, updatedFields) => {
              if (dialogMode === "edit" && editFact) {
                setFacts((prev) => prev.map((fact) => fact.id === editFact.id ? { ...fact, ...updatedFields } : fact));
                appendLog(editFact.id, "编辑", diffSummary);
                return;
              }
              setFacts((prev) => {
                const nextId = Math.max(0, ...prev.map((fact) => fact.id)) + 1;
                const now = new Date().toLocaleString("zh-CN").replace(/\//g, "-");
                return [...prev, {
                  id: nextId,
                  title: updatedFields.title || "未命名事实",
                  content: updatedFields.content || "",
                  status: "已上线",
                  keywords: updatedFields.keywords || "-",
                  category: updatedFields.category || "未分类",
                  env: "prod",
                  sourceType: updatedFields.sourceType || "手动创建",
                  source: updatedFields.source || "-",
                  sourceUrl: updatedFields.sourceUrl || "-",
                  sourceContent: updatedFields.sourceContent || "-",
                  translations: updatedFields.translations,
                  relatedEntityIds: updatedFields.relatedEntityIds,
                  startTime: updatedFields.startTime || "-",
                  endTime: updatedFields.endTime || "-",
                  timeDesc: updatedFields.timeDesc || "-",
                  relatedEvents: updatedFields.relatedEvents || "-",
                  conflict: updatedFields.conflict || "-",
                  duplicate: updatedFields.duplicate || "-",
                  conflictReason: updatedFields.conflictReason,
                  logs: [{ id: 1, operator: "dorrawang", time: now, action: "创建-手动", detail: diffSummary }],
                }];
              });
            }}
          />
          <ImportDialog visible={importVisible} title="批量导入事实" onClose={() => setImportVisible(false)} />
          <OperationLogDialog
            visible={logVisible}
            factId={logFact?.id}
            factTitle={logFact?.title}
            logs={logFact?.logs}
            onClose={() => { setLogVisible(false); setLogFact(null); }}
          />
          <CategoryDialog visible={catDialogVisible} mode={catMode} parentName={catParentName} editName={catEditName} editDesc={catEditDesc} onClose={() => setCatDialogVisible(false)} />

        </div>
      </div>
    </div>
  );
}
