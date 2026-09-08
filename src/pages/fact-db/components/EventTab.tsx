import React, { useEffect, useMemo, useRef, useState } from "react";
import { Table, Button, Tag, Space, Input, Select, DialogPlugin, MessagePlugin, Loading, Tabs, Tooltip } from "tdesign-react";
import { SearchIcon, AddIcon, EditIcon, CloseIcon, ViewListIcon, TreeRoundDotIcon, SwapIcon, ChartBarIcon, CalendarIcon, HelpCircleIcon, ChevronLeftIcon, ChevronRightIcon } from "tdesign-icons-react";
import { mockEvents, languageOptions, tagOptions } from "../mock";
import EventDialog from "./EventDialog";
import ImportDialog from "./ImportDialog";
import OperationLogDialog from "./OperationLogDialog";
import PendingCoverTag from "./PendingCoverTag";
import { buildPendingCoverIndex, navigateToReviewList } from "../review-bridge";
import type { GameEvent, CategoryNode, EventTimeType } from "../types";

const { TabPanel } = Tabs;

type SpanStatus = "upcoming" | "ongoing" | "ended";
type TopView = "default" | "list" | "tree";

type RecurringScopeFilter = "all" | "finite" | "longterm";



const eventTreeData: CategoryNode[] = [
  { name: "版本", count: 8, children: [{ name: "版本更新", count: 5 }, { name: "停服维护", count: 3 }] },
  { name: "活动", count: 35, children: [{ name: "限时活动", count: 20 }, { name: "常驻活动", count: 15 }] },
  { name: "比赛", count: 12, children: [{ name: "全国大赛", count: 4 }, { name: "联赛", count: 8 }] },
  { name: "公告", count: 14, children: [] },
];

const WEEKDAY_LABELS: Record<number, string> = { 1: "周一", 2: "周二", 3: "周三", 4: "周四", 5: "周五", 6: "周六", 7: "周日" };
const WEEKDAY_SHORT = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
const RECURRING_PALETTE = ["#0052D9", "#00A870", "#E37318", "#8543E0", "#D54941", "#0594FA"];
const spanStatusLabel: Record<SpanStatus, string> = { upcoming: "未开始", ongoing: "进行中", ended: "已结束" };

function parseDT(s?: string): Date | null {
  if (!s || s === "-") return null;
  const d = new Date(s.replace(/-/g, "/"));
  return isNaN(d.getTime()) ? null : d;
}
function pad(n: number) { return String(n).padStart(2, "0"); }
function fmtDate(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function fmtMonth(d: Date) { return `${d.getFullYear()} 年 ${d.getMonth() + 1} 月`; }
function daysBetween(a: Date, b: Date) { return Math.max(0, Math.round((b.getTime() - a.getTime()) / 86400000)); }
function fmtDuration(a: Date, b: Date) {
  const days = daysBetween(a, b);
  if (days < 1) return "不足1天";
  if (days < 31) return `持续 ${days} 天`;
  if (days < 365) return `持续约 ${Math.round(days / 30)} 个月`;
  return `持续约 ${(days / 365).toFixed(1)} 年`;
}
function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

// 根据目标刻度数量挑选「整齐」的步进天数
const STEP_CANDIDATES = [1, 2, 3, 5, 7, 10, 14, 30, 60, 90, 180, 365];
function niceStep(target: number) {
  for (const s of STEP_CANDIDATES) if (s >= target) return s;
  return STEP_CANDIDATES[STEP_CANDIDATES.length - 1];
}
function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function endOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59);
}
/** 周一=1 ... 周日=7 */
function weekday1to7(d: Date) {
  const js = d.getDay();
  return js === 0 ? 7 : js;
}
function isSameDate(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function getSpanStatus(start: Date, end: Date | null, now: Date): SpanStatus {
  if (now < start) return "upcoming";
  if (end && now > end) return "ended";
  return "ongoing";
}

function getTimeType(e: GameEvent): EventTimeType {
  return e.timeType ?? "span";
}

function isHybrid(e: GameEvent) {
  return getTimeType(e) === "hybrid";
}

function eventTypeLabel(t: EventTimeType) {
  if (t === "span") return "限时事件";
  if (t === "recurring") return "周期事件";
  if (t === "hybrid") return "限时周期";
  return "未分类";
}

function buildMonthMatrix(target: Date) {
  const y = target.getFullYear();
  const m = target.getMonth();
  const first = new Date(y, m, 1);
  const firstWeekday = weekday1to7(first); // 周一=1
  const start = addDays(first, -(firstWeekday - 1));
  const weeks: Date[][] = [];
  for (let w = 0; w < 6; w++) {
    const row: Date[] = [];
    for (let d = 0; d < 7; d++) row.push(addDays(start, w * 7 + d));
    weeks.push(row);
  }
  return weeks;
}

interface WeekOccurrence {
  event: GameEvent;
  start: Date;
  colStart: number; // 1..7
  span: number; // 当周占几列
  lane: number;
}

function assignLanes(occs: Omit<WeekOccurrence, "lane">[]): WeekOccurrence[] {
  const sorted = [...occs].sort((a, b) => a.colStart - b.colStart || b.span - a.span);
  const laneEnd: number[] = []; // 每条 lane 目前占到的最后列
  return sorted.map((o) => {
    let lane = laneEnd.findIndex((endCol) => o.colStart > endCol);
    if (lane === -1) {
      lane = laneEnd.length;
      laneEnd.push(0);
    }
    laneEnd[lane] = o.colStart + o.span - 1;
    return { ...o, lane };
  });
}

export default function EventTab() {
  const [keyword, setKeyword] = useState("");
  const [language, setLanguage] = useState("zh");

  const [eventType, setEventType] = useState("all");
  const [dialogVisible, setDialogVisible] = useState(false);
  const [importVisible, setImportVisible] = useState(false);
  const [logVisible, setLogVisible] = useState(false);
  const [logEvent, setLogEvent] = useState<GameEvent | null>(null);
  const handleOpenLog = (row: GameEvent) => { setLogEvent(row); setLogVisible(true); };
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [editEvent, setEditEvent] = useState<GameEvent | null>(null);

  // 一级视图改为下拉式按钮切换
  const [topView, setTopView] = useState<TopView>("default");
  // 默认视图下二级：时间跨度 / 固定周期 / 时间未定
  const [subView, setSubView] = useState<"span" | "recurring" | "undetermined">("span");

  // 时间跨度专属过滤
  const [spanStatusFilter, setSpanStatusFilter] = useState<"all" | SpanStatus>("all");
  const [spanPage, setSpanPage] = useState(1);
  const [spanPageSize, setSpanPageSize] = useState(10);
  const [spanBlockHeight, setSpanBlockHeight] = useState(320);
  const [spanZoomDays, setSpanZoomDays] = useState(120);

  // 甘特图轨道：宽度测量 + 原生（非被动）滚轮监听
  const scrollRef = useRef<HTMLDivElement>(null);
  const axisRef = useRef<HTMLDivElement>(null);
  const [trackWidth, setTrackWidth] = useState(700);

  useEffect(() => {
    const axis = axisRef.current;
    const update = () => { if (axis) setTrackWidth(axis.clientWidth || 700); };
    update();
    const ro = new ResizeObserver(update);
    if (axis) ro.observe(axis);
    return () => ro.disconnect();
  }, []);

  // 滚轮区域：整条甘特轨道宽度分 4 份，中间 2 份缩放，左右 2 份交给原生滚动条
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      if (!el || !document.body.contains(el)) return;
      const rect = el.getBoundingClientRect();
      const trackLeft = rect.left + 140;
      const trackW = rect.width - 148;
      if (trackW <= 0) return;

      const x = e.clientX - trackLeft;
      const inMiddle = x >= trackW * 0.25 && x <= trackW * 0.75;
      if (!inMiddle) return; // 左右两侧：放行原生滚动

      // 中段只允许缩放，不允许滚动条位移
      const keepTop = el.scrollTop;
      const keepLeft = el.scrollLeft;
      e.preventDefault();
      e.stopPropagation();
      // @ts-ignore 兼容不同浏览器实现
      if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();

      setSpanZoomDays((prev) => Math.max(20, Math.min(540, e.deltaY < 0 ? Math.round(prev * 0.85) : Math.round(prev * 1.15))));

      requestAnimationFrame(() => {
        if (el.scrollTop !== keepTop) el.scrollTop = keepTop;
        if (el.scrollLeft !== keepLeft) el.scrollLeft = keepLeft;
      });
    };

    el.addEventListener("wheel", onWheel, { passive: false, capture: true });
    return () => el.removeEventListener("wheel", onWheel, true);
  }, []);

  // 固定周期专属过滤
  const [recurringScopeFilter, setRecurringScopeFilter] = useState<RecurringScopeFilter>("all");
  const [monthCursor, setMonthCursor] = useState(() => startOfDay(new Date()));
  const [recurringRulePage, setRecurringRulePage] = useState(1);
  const recurringRulePageSize = 6;

  const [viewLoading, setViewLoading] = useState(false);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  const switchTop = (mode: TopView) => {
    if (mode === topView) return;
    setViewLoading(true);
    setTopView(mode);
    setTimeout(() => setViewLoading(false), 450);
  };
  const switchSub = (mode: "span" | "recurring" | "undetermined") => {
    if (mode === subView) return;
    setViewLoading(true);
    setSubView(mode);
    setTimeout(() => setViewLoading(false), 350);
  };
  const toggleNode = (name: string) => {
    setExpandedNodes((prev) => { const n = new Set(prev); n.has(name) ? n.delete(name) : n.add(name); return n; });
  };

  const [events, setEvents] = useState<GameEvent[]>(mockEvents);
  const [selectedKeys, setSelectedKeys] = useState<(string | number)[]>([]);

  // 有待审覆盖版本的事件 ID 集合（来自审核任务静态索引）
  const pendingCoverIds = useMemo(() => buildPendingCoverIndex().event, []);

  // ===== 顶部过滤（全视图共享） =====
  const baseFiltered = useMemo(() => {
    let r = events;
    if (keyword) {
      const kw = keyword.toLowerCase();
      r = r.filter((e) => e.name.toLowerCase().includes(kw) || e.description.toLowerCase().includes(kw) || (e.alias || "").toLowerCase().includes(kw));
    }
    if (eventType !== "all") r = r.filter((e) => e.eventType === eventType);

    // 语言在 demo 数据中统一中文，这里保留筛选位并作占位行为
    if (language !== "zh") {
      r = [];
    }
    return r;
  }, [keyword, eventType, language, events]);

  const NOW = useMemo(() => new Date(), []);

  // 时间跨度视图：span + hybrid
  const spanEventsRaw = useMemo(
    () => baseFiltered.filter((e) => ["span", "hybrid"].includes(getTimeType(e)) && parseDT(e.startTime)),
    [baseFiltered],
  );

  const spanEventsWithStatus = useMemo(() => {
    return spanEventsRaw.map((e) => {
      const start = parseDT(e.startTime)!;
      const end = parseDT(e.endTime);
      const status = getSpanStatus(start, end, NOW);
      return { event: e, start, end, status };
    });
  }, [spanEventsRaw, NOW]);

  const spanEventsFiltered = useMemo(() => {
    if (spanStatusFilter === "all") return spanEventsWithStatus;
    return spanEventsWithStatus.filter((it) => it.status === spanStatusFilter);
  }, [spanEventsWithStatus, spanStatusFilter]);

  const spanTotalPages = Math.max(1, Math.ceil(spanEventsFiltered.length / spanPageSize));
  const safeSpanPage = Math.min(spanPage, spanTotalPages);

  const spanEventsPaged = useMemo(() => {
    const start = (safeSpanPage - 1) * spanPageSize;
    return spanEventsFiltered.slice(start, start + spanPageSize);
  }, [spanEventsFiltered, safeSpanPage, spanPageSize]);

  // 甘特图与下方时间线列表统一排序，保证上下顺序一致
  const spanEventsDisplay = useMemo(() => {
    return [...spanEventsPaged].sort((a, b) => b.start.getTime() - a.start.getTime() || b.event.id - a.event.id);
  }, [spanEventsPaged]);

  const spanViewport = useMemo(() => {
    const half = Math.max(7, Math.round(spanZoomDays / 2));
    const min = addDays(startOfDay(NOW), -half).getTime();
    const max = addDays(startOfDay(NOW), half).getTime();
    return { min, max };
  }, [spanZoomDays, NOW]);

  const axisLabels = useMemo(() => {
    const total = spanViewport.max - spanViewport.min;
    if (total <= 0) return [] as { date: Date; xPct: number; show: boolean }[];
    const base = new Date(1970, 0, 1);
    const stepDays = niceStep(spanZoomDays / 14);
    const minD = new Date(spanViewport.min);
    minD.setHours(0, 0, 0, 0);
    const firstIdx = Math.ceil(Math.floor((minD.getTime() - base.getTime()) / 86400000) / stepDays) * stepDays;

    const ticks: { date: Date; xPct: number }[] = [];
    for (let d = firstIdx; ; d += stepDays) {
      const t = base.getTime() + d * 86400000;
      if (t > spanViewport.max) break;
      ticks.push({ date: new Date(t), xPct: ((t - spanViewport.min) / total) * 100 });
    }

    // 相邻日期标签过近时隐藏右侧那个，允许更远的日期继续被缩放拉近
    const MIN_GAP = 54;
    let lastX = -Infinity;
    return ticks.map((tk) => {
      const px = (tk.xPct / 100) * trackWidth;
      const show = px - lastX >= MIN_GAP;
      if (show) lastX = px;
      return { ...tk, show };
    });
  }, [spanViewport, spanZoomDays, trackWidth]);

  const timelineGroups = useMemo(() => {
    const groups: { key: string; label: string; items: typeof spanEventsDisplay }[] = [];
    spanEventsDisplay.forEach((it) => {
      const d = it.start;
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      let g = groups.find((x) => x.key === key);
      if (!g) {
        g = { key, label: fmtMonth(d), items: [] };
        groups.push(g);
      }
      g.items.push(it);
    });
    return groups;
  }, [spanEventsDisplay]);

  // 固定周期视图：recurring + hybrid
  const recurringEventsRaw = useMemo(
    () => baseFiltered.filter((e) => ["recurring", "hybrid"].includes(getTimeType(e))),
    [baseFiltered],
  );

  const recurringEventsFiltered = useMemo(() => {
    if (recurringScopeFilter === "all") return recurringEventsRaw;
    if (recurringScopeFilter === "finite") return recurringEventsRaw.filter((e) => isHybrid(e));
    return recurringEventsRaw.filter((e) => !isHybrid(e));
  }, [recurringEventsRaw, recurringScopeFilter]);

  const recurringColorMap = useMemo(() => {
    const map = new Map<number, string>();
    recurringEventsFiltered.forEach((e, i) => map.set(e.id, RECURRING_PALETTE[i % RECURRING_PALETTE.length]));
    return map;
  }, [recurringEventsFiltered]);

  const currentMonthStart = useMemo(() => new Date(monthCursor.getFullYear(), monthCursor.getMonth(), 1), [monthCursor]);
  const monthWeeks = useMemo(() => buildMonthMatrix(currentMonthStart), [currentMonthStart]);

  const recurringOccurrencesByWeek = useMemo(() => {
    const monthStart = monthWeeks[0][0];
    const monthEnd = monthWeeks[monthWeeks.length - 1][6];

    const allByWeek: WeekOccurrence[][] = monthWeeks.map(() => []);

    for (const e of recurringEventsFiltered) {
      const weekdays = e.recurringWeekdays ?? [];
      if (weekdays.length === 0) continue;

      const spanStart = parseDT(e.startTime);
      const spanEnd = parseDT(e.endTime);
      const durationDays = Math.max(1, Number(e.recurringDurationDays || 1));

      for (let d = new Date(monthStart); d <= monthEnd; d = addDays(d, 1)) {
        if (!weekdays.includes(weekday1to7(d))) continue;

        // hybrid 需要受整体跨度约束
        if (isHybrid(e)) {
          if (!spanStart) continue;
          if (d < startOfDay(spanStart)) continue;
          if (spanEnd && d > endOfDay(spanEnd)) continue;
        }

        const weekIndex = monthWeeks.findIndex((w) => w.some((x) => isSameDate(x, d)));
        if (weekIndex < 0) continue;
        const colStart = monthWeeks[weekIndex].findIndex((x) => isSameDate(x, d)) + 1;
        const span = Math.max(1, Math.min(durationDays, 8 - colStart));
        allByWeek[weekIndex].push({ event: e, start: new Date(d), colStart, span, lane: 0 });
      }
    }

    return allByWeek.map((weekOccs) => assignLanes(weekOccs.map((o) => ({ event: o.event, start: o.start, colStart: o.colStart, span: o.span }))));
  }, [monthWeeks, recurringEventsFiltered]);

  const recurringRuleTotalPages = Math.max(1, Math.ceil(recurringEventsFiltered.length / recurringRulePageSize));
  const recurringRuleSafePage = Math.min(recurringRulePage, recurringRuleTotalPages);
  const recurringRulesPaged = useMemo(() => {
    const s = (recurringRuleSafePage - 1) * recurringRulePageSize;
    return recurringEventsFiltered.slice(s, s + recurringRulePageSize);
  }, [recurringEventsFiltered, recurringRuleSafePage]);

  const undeterminedEvents = useMemo(() => baseFiltered.filter((e) => getTimeType(e) === "undetermined"), [baseFiltered]);

  const countSpan = spanEventsRaw.length;
  const countRecurring = recurringEventsRaw.length;
  const countUndetermined = undeterminedEvents.length;

  const handleCreate = () => { setDialogMode("create"); setEditEvent(null); setDialogVisible(true); };
  const handleEdit = (row: GameEvent) => { setDialogMode("edit"); setEditEvent(row); setDialogVisible(true); };

  const handleDelete = (row: GameEvent) => {
    const dlg = DialogPlugin.confirm({
      header: "确认删除", body: `确认删除事件「${row.name}」？`, theme: "danger",
      confirmBtn: { content: "删除", theme: "danger" }, cancelBtn: { content: "取消", variant: "outline" },
      onConfirm: () => { MessagePlugin.success("删除成功"); dlg.destroy(); },
      onCancel: () => { dlg.destroy(); },
    });
  };
  const handleTreeDelete = (node: CategoryNode) => {
    const dlg = DialogPlugin.confirm({
      header: "确认删除", body: `确认删除分类「${node.name}」？`, theme: "danger",
      confirmBtn: { content: "删除", theme: "danger" }, cancelBtn: "取消",
      onConfirm: () => { MessagePlugin.success("删除成功"); dlg.destroy(); },
      onCancel: () => { dlg.destroy(); },
    });
  };

  // 批量删除（对应 events/batch-delete 入口；原型内为本地状态移除）
  const handleBatchDelete = () => {
    if (selectedKeys.length === 0) { MessagePlugin.warning("请先选择记录"); return; }
    const selected = events.filter((e) => selectedKeys.includes(e.id));
    const names = selected.slice(0, 3).map((e) => `「${e.name}」`).join("、");
    const dlg = DialogPlugin.confirm({
      header: "批量删除",
      body: `确认删除选中的 ${selected.length} 条事件？${names}${selected.length > 3 ? "…" : ""}删除后不可恢复。`,
      theme: "danger",
      confirmBtn: { content: "删除", theme: "danger" }, cancelBtn: { content: "取消", variant: "outline" },
      onConfirm: () => {
        const ids = new Set(selectedKeys);
        setEvents((prev) => prev.filter((e) => !ids.has(e.id)));
        setSelectedKeys([]);
        MessagePlugin.success(`已删除 ${selected.length} 条事件`);
        dlg.destroy();
      },
      onCancel: () => dlg.destroy(),
    });
  };

  const columns = [
    { colKey: "row-select", type: "multiple" as const, width: 40 },
    { colKey: "id", title: "ID", width: 80 },
    { colKey: "name", title: "事件名称", width: 150, cell: ({ row }: { row: GameEvent }) => (
      <span>
        {row.name}
        {pendingCoverIds.has(row.id) && <PendingCoverTag objectType="event" objectId={row.id} />}
      </span>
    ) },
    { colKey: "eventType", title: "分类", width: 190, cell: ({ row }: { row: GameEvent }) => (
      <Space size={4} breakLine>
        {(row.categories?.length ? row.categories : [row.eventType]).map((category) => <Tag key={category} variant="light">{category}</Tag>)}
      </Space>
    ) },
    {
      colKey: "alias", title: "别名（多个用英文逗号分隔）", width: 220, cell: ({ row }: { row: GameEvent }) => {
        if (!row.alias || row.alias === "-") return <span style={{ color: "var(--td-text-color-placeholder)" }}>-</span>;
        return <Tooltip content={row.alias}><span style={{ cursor: "default", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>{row.alias}</span></Tooltip>;
      },
    },
    {
      colKey: "timeType", title: "时间类型", width: 130, cell: ({ row }: { row: GameEvent }) => {
        const t = getTimeType(row);
        return (
          <Tag variant="light" theme={t === "span" ? "primary" : t === "recurring" ? "success" : t === "hybrid" ? "warning" : "default"}>
            {eventTypeLabel(t)}
          </Tag>
        );
      },
    },
    { colKey: "startTime", title: "开始时间", width: 170 },
    { colKey: "endTime", title: "结束时间", width: 170 },
    { colKey: "timeDesc", title: "时间描述", width: 180, ellipsis: true, cell: ({ row }: { row: GameEvent }) => row.timeDesc || <span style={{ color: "var(--td-text-color-placeholder)" }}>-</span> },
    {
      colKey: "op", title: "操作", width: 180, fixed: "right" as const, cell: ({ row }: { row: GameEvent }) => (
        <Space size={4}>
          <Button variant="text" theme="primary" size="small" onClick={() => handleEdit(row)}>编辑</Button>
          <Button variant="text" theme="primary" size="small" onClick={() => handleOpenLog(row)}>查看记录</Button>
          <Button variant="text" theme="danger" size="small" onClick={() => handleDelete(row)}>删除</Button>
        </Space>
      ),
    },
  ];

  const undeterminedColumns = [
    { colKey: "row-select", type: "multiple" as const, width: 40 },
    { colKey: "id", title: "ID", width: 80 },
    { colKey: "name", title: "事件名称", width: 180, cell: ({ row }: { row: GameEvent }) => (
      <span>
        {row.name}
        {pendingCoverIds.has(row.id) && <PendingCoverTag objectType="event" objectId={row.id} />}
      </span>
    ) },
    { colKey: "eventType", title: "分类", width: 100, cell: ({ row }: { row: GameEvent }) => <Tag variant="light">{row.eventType}</Tag> },
    { colKey: "timeDesc", title: "时间说明", ellipsis: true, cell: ({ row }: { row: GameEvent }) => row.timeDesc || <span style={{ color: "var(--td-text-color-placeholder)" }}>暂无说明</span> },
    {
      colKey: "op", title: "操作", width: 180, fixed: "right" as const, cell: ({ row }: { row: GameEvent }) => (
        <Space size={4}>
          <Button variant="text" theme="primary" size="small" onClick={() => handleEdit(row)}>编辑</Button>
          <Button variant="text" theme="primary" size="small" onClick={() => handleOpenLog(row)}>查看记录</Button>
          <Button variant="text" theme="danger" size="small" onClick={() => handleDelete(row)}>删除</Button>
        </Space>
      ),
    },
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

  const renderSpanBar = (
    start: Date,
    end: Date | null,
    status: SpanStatus,
    viewportMin: number,
    viewportMax: number,
  ) => {
    const effectiveEnd = end ?? NOW;
    const barStart = Math.max(start.getTime(), viewportMin);
    const barEnd = Math.min(effectiveEnd.getTime(), viewportMax);
    if (barEnd <= barStart) return null;

    const total = viewportMax - viewportMin || 1;
    const leftPct = ((barStart - viewportMin) / total) * 100;
    const widthPct = Math.max(((barEnd - barStart) / total) * 100, 0.8);

    return <div className={`span-compare-bar span-compare-bar--${status}`} style={{ left: `${leftPct}%`, width: `${widthPct}%` }} />;
  };

  const renderSpanView = () => (
    <div className="event-span-view">
      <div className="span-compare-card">
        <div className="span-compare-header">
          <span className="span-compare-title">时间线</span>
          <span className="span-compare-hint">
            <span className="legend-dot legend-dot--ongoing" />进行中
            <span className="legend-dot legend-dot--upcoming" />未开始
            <span className="legend-dot legend-dot--ended" />已结束
            <span style={{ marginLeft: 8 }}>滚轮在中段缩放时间，两侧滚动列表</span>
          </span>
        </div>

        {spanEventsPaged.length > 0 ? (
          <>
            <div className="span-compare-axis" ref={axisRef}>
              {axisLabels.map((tk, i) => (
                <span key={i} className="span-compare-axis-label" style={{ left: `${tk.xPct}%`, visibility: tk.show ? "visible" : "hidden" }}>{fmtDate(tk.date)}</span>
              ))}
              <span className="span-compare-axis-today">【今天】</span>
            </div>
            <div
              className="span-compare-rows-scroll"
              ref={scrollRef}
              style={{ maxHeight: spanBlockHeight }}
            >
              <div className="span-compare-rows">
                <div className="span-compare-grid">
                  {axisLabels.map((tk, i) => (
                    <span key={i} className={`span-compare-gridline${tk.show ? " is-major" : ""}`} style={{ left: `${tk.xPct}%` }} />
                  ))}
                </div>
                <div className="span-compare-today-line is-centered" title={`今天：${fmtDate(NOW)}`} />

                {spanEventsDisplay.map(({ event: e, start, end, status }) => (
                  <div className="span-compare-row" key={e.id}>
                    <Tooltip content={`${e.name}：${fmtDate(start)} ~ ${end ? fmtDate(end) : "进行中"}`}>
                      <button className="span-compare-name span-compare-name-btn" onClick={() => handleEdit(e)}>{e.name}</button>
                    </Tooltip>
                    <div className="span-compare-track">
                      {renderSpanBar(start, end, status, spanViewport.min, spanViewport.max)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {spanEventsPaged.length > 10 && (
              <div
                className="span-compare-resizer"
                onMouseDown={(ev) => {
                  ev.preventDefault();
                  const startY = ev.clientY;
                  const startH = spanBlockHeight;
                  const onMove = (me: MouseEvent) => setSpanBlockHeight(Math.max(260, Math.min(760, startH + (me.clientY - startY))));
                  const onUp = () => {
                    window.removeEventListener("mousemove", onMove);
                    window.removeEventListener("mouseup", onUp);
                  };
                  window.addEventListener("mousemove", onMove);
                  window.addEventListener("mouseup", onUp);
                }}
              >拖拽调整图表高度</div>
            )}
          </>
        ) : (
          <div className="event-timeline-empty">暂无限时事件</div>
        )}
      </div>

      <div className="span-compare-tools span-compare-tools--below">
        <Select
          value={spanStatusFilter}
          style={{ width: 150 }}
          onChange={(v) => { setSpanStatusFilter(v as any); setSpanPage(1); }}
          options={[
            { label: "全部状态", value: "all" },
            { label: "进行中", value: "ongoing" },
            { label: "未开始", value: "upcoming" },
            { label: "已结束", value: "ended" },
          ]}
        />
        <Select
          value={String(spanPageSize)}
          style={{ width: 120 }}
          onChange={(v) => { setSpanPageSize(Number(v)); setSpanPage(1); }}
          options={[
            { label: "每页 5 条", value: "5" },
            { label: "每页 10 条", value: "10" },
            { label: "每页 20 条", value: "20" },
            { label: "每页 50 条", value: "50" },
          ]}
        />
        <span className="span-compare-page-text">第 {safeSpanPage} / {spanTotalPages} 页</span>
        <Button variant="outline" size="small" disabled={safeSpanPage <= 1} onClick={() => setSpanPage((p) => Math.max(1, p - 1))}>上一页</Button>
        <Button variant="outline" size="small" disabled={safeSpanPage >= spanTotalPages} onClick={() => setSpanPage((p) => Math.min(spanTotalPages, p + 1))}>下一页</Button>
      </div>

      <div className="event-timeline">
        {timelineGroups.map((group) => (
          <div key={group.key}>
            <div className="event-timeline-month">{group.label}</div>
            {group.items.map(({ event: e, start, end, status }) => (
              <div className="event-timeline-item" key={e.id}>
                <div className="event-timeline-dot" />
                <div className="event-timeline-card">
                  <div className="event-timeline-card-header">
                    <button className="event-timeline-card-name event-timeline-card-name-btn" onClick={() => handleEdit(e)}>{e.name}</button>
                    {pendingCoverIds.has(e.id) && <PendingCoverTag objectType="event" objectId={e.id} />}
                    <Tag size="small" theme={status === "ongoing" ? "success" : status === "upcoming" ? "primary" : "default"} variant="light">{spanStatusLabel[status]}</Tag>
                    <Tag size="small" variant="outline">{e.eventType}</Tag>
                    {isHybrid(e) && <Tag size="small" variant="outline" theme="warning">限时周期</Tag>}
                    <span className="event-timeline-card-duration">{fmtDuration(start, end ?? NOW)}</span>
                  </div>
                  <div className="event-timeline-card-time">{fmtDate(start)} 至 {end ? fmtDate(end) : "进行中（暂无结束时间）"}</div>
                  <div className="event-timeline-card-footer">
                    <span style={{ color: "var(--td-text-color-placeholder)", fontSize: 12 }}>{e.description !== "-" ? e.description : ""}</span>
                    <Space size={4}>
                      <Button variant="text" theme="primary" size="small" onClick={() => handleEdit(e)}>编辑</Button>
                      <Button variant="text" theme="primary" size="small" onClick={() => handleOpenLog(e)}>查看记录</Button>
                      <Button variant="text" theme="danger" size="small" onClick={() => handleDelete(e)}>删除</Button>
                    </Space>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))}
        {spanEventsPaged.length === 0 && <div className="event-timeline-empty">暂无符合条件的限时事件</div>}
      </div>
    </div>
  );

  const renderRecurringView = () => (
    <div className="event-recurring-view">
      <div className="event-recurring-calendar">
        <div className="event-recurring-calendar-head">
          <div className="event-recurring-calendar-title">{fmtMonth(currentMonthStart)}</div>
          <div className="event-recurring-calendar-actions">
            <Select
              value={recurringScopeFilter}
              style={{ width: 150 }}
              onChange={(v) => { setRecurringScopeFilter(v as RecurringScopeFilter); setRecurringRulePage(1); }}
              options={[
                { label: "全部周期事件", value: "all" },
                { label: "仅限时周期", value: "finite" },
                { label: "仅长期周期", value: "longterm" },
              ]}
            />
            <Button variant="outline" size="small" icon={<ChevronLeftIcon />} onClick={() => setMonthCursor((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}>上月</Button>
            <Button variant="outline" size="small" icon={<ChevronRightIcon />} onClick={() => setMonthCursor((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}>下月</Button>
          </div>
        </div>

        <div className="event-recurring-weekdays">
          {WEEKDAY_SHORT.map((w) => <div key={w} className="event-recurring-weekday">{w}</div>)}
        </div>

        <div className="event-recurring-month-grid">
          {monthWeeks.map((week, wi) => {
            const weekOccs = recurringOccurrencesByWeek[wi] || [];
            const laneCount = Math.max(1, (weekOccs.reduce((m, x) => Math.max(m, x.lane), 0) + 1));
            return (
              <div className="event-recurring-week" key={wi}>
                <div className="event-recurring-week-days">
                  {week.map((d, di) => {
                    const inMonth = d.getMonth() === currentMonthStart.getMonth();
                    const isToday = isSameDate(d, NOW);
                    return (
                      <div key={di} className={`event-recurring-day-cell${inMonth ? "" : " is-out"}${isToday ? " is-today" : ""}`}>
                        <span className="event-recurring-day-no">{d.getDate()}</span>
                      </div>
                    );
                  })}
                </div>

                <div className="event-recurring-week-lanes" style={{ minHeight: laneCount * 24 }}>
                  {weekOccs.map((occ, idx) => {
                    const color = recurringColorMap.get(occ.event.id) || "#5b7cff";
                    const labelPrefix = occ.event.recurringTimeRange?.[0] ? `${occ.event.recurringTimeRange[0]} ` : "";
                    return (
                      <button
                        key={`${occ.event.id}-${idx}-${fmtDate(occ.start)}`}
                        className={`event-recurring-bar${isHybrid(occ.event) ? " is-finite" : ""}`}
                        style={{
                          gridColumn: `${occ.colStart} / span ${occ.span}`,
                          gridRow: `${occ.lane + 1}`,
                          background: `${color}1A`,
                          color,
                          borderColor: `${color}66`,
                        }}
                        onClick={() => handleEdit(occ.event)}
                        title={`${occ.event.name}（${labelPrefix}${(occ.event.recurringDurationDays || 1) > 1 ? `${occ.event.recurringDurationDays}天` : ""}）`}
                      >
                        {labelPrefix}{occ.event.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="event-recurring-legend">
        <div className="event-recurring-legend-title">周期规则（{recurringEventsFiltered.length}）</div>
        {recurringRulesPaged.map((e) => (
          <div className="event-recurring-legend-item" key={e.id}>
            <div className="event-recurring-legend-name">
              <span className="event-recurring-color-dot" style={{ background: recurringColorMap.get(e.id) }} />
              <button className="event-recurring-name-btn" onClick={() => handleEdit(e)}>{e.name}</button>
              {pendingCoverIds.has(e.id) && <PendingCoverTag objectType="event" objectId={e.id} />}
              {isHybrid(e) && <Tag size="small" theme="warning" variant="light">限时周期</Tag>}
            </div>
            <div className="event-recurring-legend-rule">
              {e.timeDesc || `${(e.recurringWeekdays ?? []).map((w) => WEEKDAY_LABELS[w]).join("、")} ${e.recurringTimeRange ? e.recurringTimeRange.join("-") : ""}`}
              {(e.recurringDurationDays || 1) > 1 && <span className="event-recurring-rule-extra">（单次持续 {e.recurringDurationDays} 天）</span>}
            </div>
            <div className="event-recurring-legend-actions">
              <Button variant="text" theme="primary" size="small" onClick={() => handleEdit(e)}>编辑</Button>
              <Button variant="text" theme="primary" size="small" onClick={() => handleOpenLog(e)}>查看记录</Button>
              <Button variant="text" theme="danger" size="small" onClick={() => handleDelete(e)}>删除</Button>
            </div>
          </div>
        ))}

        <div className="event-recurring-legend-pager">
          <span>第 {recurringRuleSafePage} / {recurringRuleTotalPages} 页</span>
          <Space size={6}>
            <Button variant="outline" size="small" disabled={recurringRuleSafePage <= 1} onClick={() => setRecurringRulePage((p) => Math.max(1, p - 1))}>上一页</Button>
            <Button variant="outline" size="small" disabled={recurringRuleSafePage >= recurringRuleTotalPages} onClick={() => setRecurringRulePage((p) => Math.min(recurringRuleTotalPages, p + 1))}>下一页</Button>
          </Space>
        </div>

        {recurringEventsFiltered.length === 0 && <div className="event-timeline-empty">暂无周期事件</div>}
      </div>
    </div>
  );

  return (
    <div className="factdb-tab-content">
      {/* 统计栏 */}
      <div className="page-stats">
        <span className="stat-item">共 <b className="stat-num">{events.length}</b> 个事件</span>
        <span className="stat-divider">·</span>
        <span className="stat-item">限时事件 <b className="stat-num">{events.filter((e) => ["span", "hybrid"].includes(getTimeType(e))).length}</b></span>
        <span className="stat-divider">·</span>
        <span className="stat-item">周期事件 <b className="stat-num">{events.filter((e) => ["recurring", "hybrid"].includes(getTimeType(e))).length}</b></span>
        <span className="stat-divider">·</span>
        <span className="stat-item">未分类 <b className="stat-num">{events.filter((e) => getTimeType(e) === "undetermined").length}</b></span>
        {pendingCoverIds.size > 0 && (
          <>
            <span className="stat-divider">·</span>
            <span className="stat-item stat-item--link" title="点击前往内容审核工作台" onClick={() => navigateToReviewList()}>
              待审版本 <b className="stat-num" style={{ color: "var(--td-warning-color)" }}>{pendingCoverIds.size}</b>
            </span>
          </>
        )}
      </div>

      <div className="factdb-toolbar">
        <div className="factdb-toolbar-left">
          <Input prefixIcon={<SearchIcon />} placeholder="搜索事件..." value={keyword} onChange={(v) => setKeyword(v)} style={{ width: 190 }} />
          <Select filterable options={languageOptions} value={language} onChange={(v) => setLanguage(v as string)} style={{ width: 90 }} />
          <Select filterable options={tagOptions.map((tag) => ({ ...tag, label: tag.value === "all" ? "所有事件分类" : tag.label }))} value={eventType} onChange={(value) => setEventType(value as string)} style={{ width: 150 }} />

          <Select
            filterable
            prefixIcon={<SwapIcon />}
            label="排序:"
            options={[
              { label: "开始时间（新到旧）", value: "startTime_desc" },
              { label: "开始时间（旧到新）", value: "startTime_asc" },
              { label: "创建时间（新到旧）", value: "createTime_desc" },
              { label: "创建时间（旧到新）", value: "createTime_asc" },
              { label: "ID（小到大）", value: "id_asc" },
              { label: "ID（大到小）", value: "id_desc" },
            ]}
            value="startTime_desc"
            onChange={() => {}}
            style={{ width: 210 }}
          />
          <div className="event-view-switcher-segment event-view-switcher-inline" role="tablist" aria-label="一级视图切换">
            {[
              { key: "default", label: "默认视图" },
              { key: "list", label: "列表视图" },
              { key: "tree", label: "树状视图" },
            ].map((item) => (
              <button
                key={item.key}
                type="button"
                className={`event-view-switcher-segment-item${topView === item.key ? " is-active" : ""}`}
                onClick={() => switchTop(item.key as TopView)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
        <Space>
          <Button theme="primary" onClick={handleCreate}>+ 新建事件</Button>
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

      {/* 默认视图下二级分类 */}
      {topView === "default" && (
        <Tabs value={subView} onChange={(v) => switchSub(v as any)} theme="card" className="event-sub-tabs">
          <TabPanel value="span" label={<span><ChartBarIcon style={{ marginRight: 4 }} />限时事件 {countSpan}</span>} />
          <TabPanel value="recurring" label={<span><CalendarIcon style={{ marginRight: 4 }} />周期事件 {countRecurring}</span>} />
          <TabPanel value="undetermined" label={<span><HelpCircleIcon style={{ marginRight: 4 }} />未分类 {countUndetermined}</span>} />
        </Tabs>
      )}

      <Loading loading={viewLoading} text="加载中..." style={{ minHeight: 200 }}>
        {topView === "default" && subView === "span" && renderSpanView()}
        {topView === "default" && subView === "recurring" && renderRecurringView()}
        {topView === "default" && subView === "undetermined" && (
          <Table
            data={undeterminedEvents}
            columns={undeterminedColumns}
            rowKey="id"
            hover
            selectedRowKeys={selectedKeys}
            onSelectChange={(keys) => setSelectedKeys(keys)}
            pagination={{ defaultPageSize: 50, pageSizeOptions: [20, 50, 100, 200], total: undeterminedEvents.length, showJumper: true }}
          />
        )}

        {topView === "list" && (
          <Table
            data={baseFiltered}
            columns={columns}
            rowKey="id"
            hover
            selectedRowKeys={selectedKeys}
            onSelectChange={(keys) => setSelectedKeys(keys)}
            pagination={{ defaultPageSize: 50, pageSizeOptions: [20, 50, 100, 200], total: baseFiltered.length, showJumper: true }}
          />
        )}

        {topView === "tree" && (
          <div className="entity-tree-view">
            <div className="entity-tree-header"><strong>全部事件</strong></div>
            {eventTreeData.map((node) => renderTreeNode(node, 0))}
          </div>
        )}
      </Loading>

      <EventDialog
        key={`${dialogMode}-${editEvent?.id ?? "new"}`}
        visible={dialogVisible}
        mode={dialogMode}
        event={editEvent}
        onClose={() => setDialogVisible(false)}
        onSave={(diffSummary, updatedFields) => {
          const now = new Date().toLocaleString("zh-CN").replace(/\//g, "-");
          if (dialogMode === "edit" && editEvent) {
            setEvents((previous) => previous.map((event) => event.id !== editEvent.id ? event : {
              ...event,
              ...updatedFields,
              logs: [...(event.logs ?? []), {
                id: (event.logs?.length ?? 0) + 1,
                operator: "dorrawang",
                time: now,
                action: "编辑" as const,
                detail: diffSummary,
              }],
            }));
            return;
          }
          setEvents((previous) => {
            const nextId = Math.max(0, ...previous.map((event) => event.id)) + 1;
            return [...previous, {
              id: nextId,
              name: updatedFields.name || "未命名事件",
              description: updatedFields.description || "",
              eventType: updatedFields.eventType || "活动",
              categories: updatedFields.categories || [updatedFields.eventType || "活动"],
              translations: updatedFields.translations,
              status: "已上线",
              timeType: updatedFields.timeType || "span",
              startTime: updatedFields.startTime || "-",
              endTime: updatedFields.endTime || "-",
              recurringWeekdays: updatedFields.recurringWeekdays,
              recurringTimeRange: updatedFields.recurringTimeRange,
              recurringDurationDays: updatedFields.recurringDurationDays,
              timeDesc: updatedFields.timeDesc || "",
              source: updatedFields.source || "-",
              remark: updatedFields.remark || "-",
              alias: updatedFields.alias,
              logs: [{ id: 1, operator: "dorrawang", time: now, action: "创建-手动", detail: diffSummary }],
            }];
          });
        }}
      />

      <ImportDialog visible={importVisible} title="批量导入事件" onClose={() => setImportVisible(false)} />

      <OperationLogDialog
        visible={logVisible}
        factId={logEvent?.id}
        factTitle={logEvent?.name}
        logs={logEvent?.logs}
        onClose={() => { setLogVisible(false); setLogEvent(null); }}
      />
    </div>
  );
}
