import React, { useState, useMemo } from "react";
import { Table, Button, Tag, Space, Input, Select, DialogPlugin, MessagePlugin, Loading, Tabs, Tooltip } from "tdesign-react";
import { SearchIcon, AddIcon, EditIcon, CloseIcon } from "tdesign-icons-react";
import { mockEntities, languageOptions, tagOptions, entityTreeData } from "../mock";
import EntityDialog from "./EntityDialog";
import MergeDialog from "./MergeDialog";
import ImportDialog from "./ImportDialog";
import OperationLogDialog from "./OperationLogDialog";
import PendingCoverTag from "./PendingCoverTag";
import { buildPendingCoverIndex, navigateToReviewList } from "../review-bridge";
import type { Entity, CategoryNode } from "../types";

const { TabPanel } = Tabs;

const tagColorMap: Record<string, string> = {
  "编辑": "#00A870",
  "角色": "#2EC2FF",
  "装备": "#E67E22",
  "地图": "#9B59B6",
  "版本": "#3498DB",
  "活动": "#F39C12",
  "默认": "var(--td-brand-color)",
};

export default function EntityTab() {
  const [keyword, setKeyword] = useState("");
  const [language, setLanguage] = useState("中文");
  const [sortBy, setSortBy] = useState("创建时间(排序)");
  const [dialogVisible, setDialogVisible] = useState(false);
  // 独立合并窗口：目标实体 + 可见性（不经过编辑窗口）
  const [mergeVisible, setMergeVisible] = useState(false);
  const [mergeTarget, setMergeTarget] = useState<Entity | null>(null);
  const [importVisible, setImportVisible] = useState(false);
  const [logVisible, setLogVisible] = useState(false);
  const [logEntity, setLogEntity] = useState<Entity | null>(null);
  const handleOpenLog = (row: Entity) => { setLogEntity(row); setLogVisible(true); };
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [editEntity, setEditEntity] = useState<Entity | null>(null);
  const [viewMode, setViewMode] = useState("list");
  const [viewLoading, setViewLoading] = useState(false);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [selectedKeys, setSelectedKeys] = useState<(string | number)[]>([]);

  // 有待审覆盖版本的实体 ID 集合（来自审核任务静态索引）
  const pendingCoverIds = useMemo(() => buildPendingCoverIndex().entity, []);

  const switchView = (mode: string) => {
    if (mode === viewMode) return;
    setViewLoading(true);
    setViewMode(mode);
    setTimeout(() => setViewLoading(false), 600);
  };

  const toggleNode = (name: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  };

  const [entities, setEntities] = useState<Entity[]>(mockEntities);

  const appendEntityLog = (id: number, detail: string) => {
    const now = new Date().toLocaleString("zh-CN").replace(/\//g, "-");
    setEntities((prev) => prev.map((entity) => {
      if (entity.id !== id) return entity;
      const newLog = { id: (entity.logs?.length ?? 0) + 1, operator: "dorrawang", time: now, action: "编辑" as const, detail };
      return { ...entity, logs: [...(entity.logs ?? []), newLog] };
    }));
  };

  const filtered = useMemo(() => {
    if (!keyword) return entities;
    const value = keyword.toLowerCase();
    return entities.filter((entity) => entity.title.toLowerCase().includes(value) || entity.description.toLowerCase().includes(value));
  }, [entities, keyword]);

  const handleCreate = () => { setDialogMode("create"); setEditEntity(null); setDialogVisible(true); };
  const handleEdit = (row: Entity) => { setDialogMode("edit"); setEditEntity(row); setDialogVisible(true); };
  const handleMerge = (row: Entity) => { setMergeTarget(row); setMergeVisible(true); };
  const handleDelete = (row: Entity) => {
    const dlg = DialogPlugin.confirm({
      header: "确认删除", body: `确认删除实体「${row.title}」？`, theme: "danger",
      confirmBtn: { content: "删除", theme: "danger" }, cancelBtn: { content: "取消", variant: "outline" },
      onConfirm: () => { MessagePlugin.success("删除成功"); dlg.destroy(); },
      onCancel: () => { dlg.destroy(); },
    });
  };
  const handleTreeDelete = (node: CategoryNode) => {
    const dlg = DialogPlugin.confirm({
      header: "确认删除", body: `确认删除分类「${node.name}」？`, theme: "danger",
      confirmBtn: { content: "删除", theme: "danger" }, cancelBtn: { content: "取消", variant: "outline" },
      onConfirm: () => { MessagePlugin.success("删除成功"); dlg.destroy(); },
      onCancel: () => { dlg.destroy(); },
    });
  };

  // 批量删除（对应 entities/batch-delete 入口；原型内为本地状态移除）
  const handleBatchDelete = () => {
    if (selectedKeys.length === 0) { MessagePlugin.warning("请先选择记录"); return; }
    const selected = entities.filter((e) => selectedKeys.includes(e.id));
    const names = selected.slice(0, 3).map((e) => `「${e.title}」`).join("、");
    const dlg = DialogPlugin.confirm({
      header: "批量删除",
      body: `确认删除选中的 ${selected.length} 条实体？${names}${selected.length > 3 ? "…" : ""}删除后不可恢复。`,
      theme: "danger",
      confirmBtn: { content: "删除", theme: "danger" }, cancelBtn: { content: "取消", variant: "outline" },
      onConfirm: () => {
        const ids = new Set(selectedKeys);
        setEntities((prev) => prev.filter((e) => !ids.has(e.id)));
        setSelectedKeys([]);
        MessagePlugin.success(`已删除 ${selected.length} 条实体`);
        dlg.destroy();
      },
      onCancel: () => dlg.destroy(),
    });
  };

  const columns = [
    { colKey: "row-select", type: "multiple" as const, width: 40 },
    { colKey: "id", title: "ID", width: 80 },
    { colKey: "title", title: "名称", width: 120,
      cell: ({ row }: { row: Entity }) => (
        <span className="entity-name-cell">
          {row.title}
          {pendingCoverIds.has(row.id) && <PendingCoverTag objectType="entity" objectId={row.id} />}
        </span>
      ),
    },
    { colKey: "description", title: "描述", width: 140, ellipsis: true },
    { colKey: "alias", title: "详细描述", width: 160, ellipsis: true, cell: ({ row }: { row: Entity }) => {
      if (!row.alias || row.alias === "-") return <span style={{ color: "var(--td-text-color-placeholder)" }}>-</span>;
      return <Tooltip content={row.alias}><span>{row.alias}</span></Tooltip>;
    }},
    { colKey: "tag", title: "分类", width: 100, cell: ({ row }: { row: Entity }) => {
      const tags = row.tag.split(/[,，]/).map((t) => t.trim()).filter(Boolean);
      return (
        <Space size="small">
          {tags.slice(0, 1).map((t) => (
            <Tag key={t} variant="light" size="small" style={{
              color: tagColorMap[t] || tagColorMap["默认"],
              borderColor: tagColorMap[t] || tagColorMap["默认"],
              backgroundColor: (tagColorMap[t] || tagColorMap["默认"]) + "15",
            }}>{t}</Tag>
          ))}
          {tags.length > 1 && <span style={{ fontSize: 12, color: "var(--td-text-color-placeholder)" }}>+{tags.length - 1}</span>}
        </Space>
      );
    }},
    { colKey: "tags", title: "标签", width: 200, cell: ({ row }: { row: Entity }) => {
      // 标签来源：entity 自身的 tags 字段（不存在则取 row.alias 作为兜底，但不再硬编码"查看已译"）
      const raw = (row as Entity & { tags?: string }).tags ?? row.alias;
      const tags = raw && raw !== "-" ? raw.split(/[,，]/).map(t => t.trim()).filter(Boolean) : [];
      if (tags.length === 0) return <span style={{ color: "var(--td-text-color-placeholder)" }}>-</span>;
      return (
        <Space size={4} style={{ flexWrap: "wrap" }}>
          {tags.map((t) => (
            <Tag key={t} variant="light-outline" size="small">{t}</Tag>
          ))}
        </Space>
      );
    }},
    { colKey: "op", title: "操作", width: 320, minWidth: 320, fixed: "right" as const, cell: ({ row }: { row: Entity }) => (
      <Space size={4} style={{ whiteSpace: "nowrap" }}>
        <Button variant="text" theme="primary" size="small" onClick={() => handleEdit(row)}>编辑</Button>
        <Button variant="text" theme="primary" size="small" onClick={() => handleMerge(row)}>合并</Button>
        <Button variant="text" theme="primary" size="small" onClick={() => handleOpenLog(row)}>查看记录</Button>
        <Button variant="text" theme="danger" size="small" onClick={() => handleDelete(row)}>删除</Button>
      </Space>
    )},
  ];

  const renderTreeNode = (node: CategoryNode, depth: number = 0) => {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedNodes.has(node.name);
    return (
      <div key={node.name}>
        <div className="entity-tree-row" style={{ paddingLeft: 16 + depth * 24 }} onClick={() => hasChildren && toggleNode(node.name)}>
          <span className="entity-tree-arrow">{hasChildren ? (isExpanded ? "▼" : "▶") : ""}</span>
          <span className="entity-tree-name">{node.name}</span>
          <span className="entity-tree-count">({node.count})</span>
          <span className="entity-tree-actions" onClick={(e) => e.stopPropagation()}>
            <Button variant="text" size="small" shape="square" icon={<AddIcon />} onClick={handleCreate} />
            <Button variant="text" size="small" shape="square" icon={<EditIcon />} onClick={handleCreate} />
            <Button variant="text" theme="danger" size="small" shape="square" icon={<CloseIcon />} onClick={() => handleTreeDelete(node)} />
          </span>
        </div>
        {hasChildren && isExpanded && node.children!.map((child) => renderTreeNode(child, depth + 1))}
      </div>
    );
  };

  return (
    <div className="factdb-tab-content">
      {/* 统计栏 */}
      <div className="page-stats">
        <span className="stat-item">共 <b className="stat-num">{filtered.length}</b> 条筛选</span>
        <span className="stat-divider">|</span>
        <span className="stat-item">已排除 <b className="stat-num">{entities.length - filtered.length}</b></span>
        <span className="stat-divider">|</span>
        <span className="stat-item">使用数 <b className="stat-num">0</b></span>
        {pendingCoverIds.size > 0 && (
          <>
            <span className="stat-divider">|</span>
            <span className="stat-item stat-item--link" title="点击前往内容审核工作台" onClick={() => navigateToReviewList()}>
              待审版本 <b className="stat-num" style={{ color: "var(--td-warning-color)" }}>{pendingCoverIds.size}</b>
            </span>
          </>
        )}
      </div>

      {/* 工具栏：搜索 + 筛选 + 操作按钮 */}
      <div className="factdb-toolbar">
        <div className="factdb-toolbar-left">
          <Input prefixIcon={<SearchIcon />} placeholder="请输入搜索" value={keyword} onChange={(v) => setKeyword(v)} clearable style={{ width: 200 }} />
          <Select
            value={language}
            onChange={(v) => setLanguage(v as string)}
            options={[{ label: "中文", value: "中文" }, { label: "英文", value: "英文" }]}
            style={{ width: 100 }}
          />
          <Select
            value={sortBy}
            onChange={(v) => setSortBy(v as string)}
            options={[
              { label: "创建时间(排序)", value: "创建时间(排序)" },
              { label: "更新时间(排序)", value: "更新时间(排序)" },
            ]}
            style={{ width: 140 }}
          />
        </div>
        <Space>
          <Button theme="primary" onClick={handleCreate}>+ 新增数据</Button>
          <Button variant="outline" onClick={() => setImportVisible(true)}>批量导入</Button>
        </Space>
      </div>

      {/* 批量操作栏（有选中时展开） */}
      {selectedKeys.length > 0 && (
        <div className="batch-action-bar">
          <span style={{ fontSize: 13, color: "var(--td-text-color-secondary)" }}>
            已选 <strong style={{ color: "var(--td-brand-color)" }}>{selectedKeys.length}</strong> 条
          </span>
          <span className="batch-action-divider" />
          <Button size="small" variant="outline" theme="danger" onClick={handleBatchDelete}>批量删除</Button>
          <Button size="small" variant="text" onClick={() => setSelectedKeys([])}>清空选择</Button>
        </div>
      )}

      {/* 视图切换 Tab */}
      <Tabs value={viewMode} onChange={(v) => switchView(v as string)} className="factdb-view-tabs">
        <TabPanel value="list" label="列表视图" />
        <TabPanel value="tree" label="关系视图" />
      </Tabs>

      <Loading loading={viewLoading} text="加载中..." style={{ minHeight: 200 }}>
        {viewMode === "list" && (
          <Table
            data={filtered}
            columns={columns}
            rowKey="id"
            hover
            stripe
            selectedRowKeys={selectedKeys}
            onSelectChange={(keys) => setSelectedKeys(keys)}
            pagination={{
              defaultCurrent: 1,
              defaultPageSize: 10,
              pageSizeOptions: [10, 20, 50],
              total: filtered.length,
              showJumper: true,
              showPageSize: true,
              size: "small",
            }}
          />
        )}
        {viewMode === "tree" && (
          <div className="entity-tree-view">
            <div className="entity-tree-header">
              <strong>全部分类</strong>
              <Button theme="primary" size="small" onClick={handleCreate}>+ 添加分类</Button>
            </div>
            {entityTreeData.map((node: CategoryNode) => renderTreeNode(node, 0))}
          </div>
        )}
      </Loading>

      <EntityDialog
        key={`${dialogMode}-${editEntity?.id ?? "new"}`}
        visible={dialogVisible}
        mode={dialogMode}
        entity={editEntity}
        onClose={() => setDialogVisible(false)}
        onSave={(diffSummary, updatedFields) => {
          if (dialogMode === "edit" && editEntity) {
            setEntities((prev) => prev.map((entity) => entity.id === editEntity.id ? { ...entity, ...updatedFields } : entity));
            appendEntityLog(editEntity.id, diffSummary);
            return;
          }
          setEntities((prev) => {
            const nextId = Math.max(0, ...prev.map((entity) => entity.id)) + 1;
            const now = new Date().toLocaleString("zh-CN").replace(/\//g, "-");
            return [...prev, {
              id: nextId,
              title: updatedFields.title || "未命名实体",
              description: updatedFields.description || "",
              alias: updatedFields.alias || "",
              tag: updatedFields.tag || "角色",
              status: "已上线",
              source: "手动创建",
              logs: [{ id: 1, operator: "dorrawang", time: now, action: "创建-手动", detail: diffSummary }],
            }];
          });
        }}
      />
      <MergeDialog
        visible={mergeVisible}
        targetEntity={mergeTarget}
        onClose={() => { setMergeVisible(false); setMergeTarget(null); }}
        onMerge={(targetId, sourceIds) => {
          const sourceIdSet = new Set(sourceIds);
          setEntities((prev) => prev.filter((entity) => !sourceIdSet.has(entity.id)));
          setMergeTarget(null);
        }}
      />
      <ImportDialog visible={importVisible} title="批量导入实体" onClose={() => setImportVisible(false)} />
      <OperationLogDialog
        visible={logVisible}
        factId={logEntity?.id}
        factTitle={logEntity?.title}
        logs={logEntity?.logs}
        onClose={() => { setLogVisible(false); setLogEntity(null); }}
      />
    </div>
  );
}
