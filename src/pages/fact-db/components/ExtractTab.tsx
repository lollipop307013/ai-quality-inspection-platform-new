import React, { useState } from "react";
import {
  Form, Textarea, Button, Radio, Loading, Tag, Space, Select,
  MessagePlugin, Tooltip, DialogPlugin, Dialog, Drawer, Input, DatePicker,
  Checkbox,
} from "tdesign-react";
import {
  HelpCircleIcon, CheckIcon, CloseIcon, ChevronDownIcon, ChevronRightIcon, AddIcon,
  AttachIcon, FileIcon, FileExcelIcon, FilePdfIcon, FileWordIcon,
} from "tdesign-icons-react";
import { mockEntities, mockEvents } from "../mock";

const { FormItem } = Form;

const entityOptions = mockEntities.map((e) => ({ label: `[${e.id}] ${e.title}`, value: e.title }));
const eventOptions  = mockEvents.map((e)  => ({ label: `[${e.id}] ${e.name}`,  value: e.name }));

// ─── 类型 ─────────────────────────────────────────────────────────────────────
interface ExtractedFact {
  factId: string;
  content: string;
  // ① 实体匹配
  entities: string[];                 // 建议关联的已有实体
  newEntities: NewEntitySuggestion[]; // 建议新增的新名词（结构化：名称/描述/标签）
  // ② 事件匹配
  events: string[];          // 建议关联的已有事件
  newEvents: NewEventSuggestion[]; // 建议新增的事件（带详情）
  // ③ 冲突检测（与已有事实在描述上互斥）
  conflict: ConflictRef | null;
  // ④ 重复检测（与已有事实表达同一信息）
  duplicate: DuplicateRef | null;
  // ⑤ 事实有效时间
  startTime: string;
  endTime: string;
  timeDesc: string;
  status: "待审核" | "已审核" | "已拒绝";
  /** 操作日志：缓冲池阶段的所有动作流水（创建 / 编辑 / 通过 / 拒绝 / 撤回 等） */
  logs: BufferLog[];
  // ⑥ 元数据（POST /api/facts 字段对齐，全部可选）
  title?: string;                              // 事实标题
  categoryId?: number | null;                  // 分类 ID
  sourceType?: string;                         // 来源类型（系统字段，不可编辑，extract_text/extract_doc/extract_csv/manual...）
  source?: string;                             // 来源（提取人/手动来源）
  sourceUrl?: string;                          // 来源 URL
  sourceContent?: string;                      // 来源内容（原始问答对/批次 ID）
  contradictionReason?: string;                // 矛盾原因
  contradictingFactIds?: string;               // 矛盾事实 ID（多个用逗号分隔）
  duplicateFactIds?: string;                   // 语义重复事实 ID（多个用逗号分隔）
  reviewPriority?: "low" | "medium" | "high";  // 审核优先级
  extra?: string;                              // 扩展内容（JSON 字符串）
  // ⑦ 多语言（仅 fact_text / time_description / title 三个字段按语言独立保存）
  i18nContent?: Partial<Record<LangCode, string>>;
  i18nTimeDesc?: Partial<Record<LangCode, string>>;
  i18nTitle?: Partial<Record<LangCode, string>>;
}

/** 支持的语言代码（与后端 6 语种对齐） */
type LangCode = "zh" | "en" | "ar" | "tr" | "ru" | "zh_hk";

const LANG_OPTIONS: Array<{ code: LangCode; label: string }> = [
  { code: "zh",    label: "中文" },
  { code: "en",    label: "English" },
  { code: "ar",    label: "العربية" },
  { code: "tr",    label: "Türkçe" },
  { code: "ru",    label: "Русский" },
  { code: "zh_hk", label: "粵語" },
];

/** 缓冲池条目操作日志 */
interface BufferLog {
  id: number;
  time: string;
  operator: string;
  action: "创建" | "编辑" | "通过" | "拒绝" | "撤回" | "实体丢弃" | "实体恢复" | "事件丢弃" | "事件恢复" | "冲突解除" | "重复解除";
  detail: string;
}

/** 冲突事实引用（指向已入库的事实，用于对比） */
interface ConflictRef {
  factId: string;       // 已有事实的 ID（带前缀，如 "ID:37957"）
  factContent: string;  // 已有事实的内容
  reason: string;       // 冲突说明
}

/** 重复事实引用（同义/近义表达） */
interface DuplicateRef {
  factId: string;
  factContent: string;
  similarity: number;   // 0~1，相似度
}

/** 建议新增的实体（与"添加实体"原型表单字段对齐）
 *  decision: keep=保留(默认入库) | discard=丢弃(置灰划线，可恢复)
 *  reservedEntityId: 审核者点"保留"时通过 POST /api/entities 创建拿到的正式 entity_id；
 *  仅在 decision=keep 且实际已落库后填充。未填充表示尚未确认（导出时拦截）。
 */
interface NewEntitySuggestion {
  name: string;
  description: string;
  tags: string[];
  decision: "keep" | "discard";
  reservedEntityId?: number;
}

/** 建议新增的事件
 *  decision 只有两种结果：
 *    keep    = 保留（默认，事实入库时随之新增进事件库）
 *    discard = 丢弃（不入库，置灰划线展示，可恢复）
 *  reservedEventId: 审核者点"保留"时通过 POST /api/events 创建拿到的正式 event_id；
 *  仅在 decision=keep 且实际已落库后填充。
 */
interface NewEventSuggestion {
  name: string;
  eventType: string;
  startTime: string;
  endTime: string;
  timeDesc: string;
  description: string;
  tags: string[];
  decision: "keep" | "discard";
  reservedEventId?: number;
}

interface ExtractBatch {
  batchId: string;
  extractedAt: string;
  /** 提取操作人（提取结果所有人共享可见，此字段用于追溯+筛选） */
  extractor: string;
  sourceText: string;
  batchLabel: string;
  model: string;
  mode: string;
  /** 提取语种：决定冲突/重复检测查询哪个语种的库、实体/事件匹配走哪个语种、审核通过后写入哪个 i18n 字段 */
  extractLang: LangCode;
  facts: ExtractedFact[];
  expanded: boolean;
  /** 是否已归档：true=已归档区，false=待处理区 */
  archived: boolean;
  /** 归档原因：exported（已导出 CSV）/ committed（已批量入库）/ manual（手动归档） */
  archiveReason?: "exported" | "committed" | "manual";
  /** 归档时间 */
  archivedAt?: string;
  /** 归档操作人 */
  archivedBy?: string;
  /** 导出时间（如导出过 CSV） */
  exportedAt?: string;
}

/** 文件解析得到的候选片段（供用户勾选后批量提取） */
interface FileSegment {
  /** 片段唯一 id */
  id: string;
  /** 章节 / 行号 / 段落标记，例如 "第 3 章 / 1.2" 或 "第 15 行" */
  location: string;
  /** 片段文本（前 100 字预览，详情可悬浮看全） */
  text: string;
  /** 是否勾选（默认全选，用户可取消） */
  selected: boolean;
  /** 来源工作表类型：用于导入时定向处理 */
  sheetType?: "entity" | "event" | "knowledge";
  /** 原始行数据（用于提取入库映射） */
  rowData?: Record<string, any>;
}

/** 当前登录用户（demo 中固定，实际接入时由登录态注入） */
const CURRENT_USER = "yzhinan(南勇志)";

/** 模拟"调 POST /api/entities 后分配的正式 entity_id"递增计数器（避开 mock 已用的 90001~90004 / 80001） */
let __mockReservedEntityId = 90100;
const allocReservedEntityId = () => ++__mockReservedEntityId;
let __mockReservedEventId = 80100;
const allocReservedEventId = () => ++__mockReservedEventId;

/** 把字符串数组快速转成 NewEntitySuggestion 数组（mock 用）
 *  默认 decision=keep + 立即分配 reservedEntityId（模拟 entities/recall 已确认到正式 ID） */
const mkNE = (names: string[]): NewEntitySuggestion[] =>
  names.map((n) => ({ name: n, description: "", tags: [], decision: "keep", reservedEntityId: allocReservedEntityId() }));

/** 当前时间字符串（用于日志） */
const nowStr = () => new Date().toLocaleString("zh-CN").replace(/\//g, "-");

/** 创建一条日志 */
const mkLog = (action: BufferLog["action"], detail: string, operator = CURRENT_USER): BufferLog => ({
  id: Date.now() + Math.floor(Math.random() * 1000),
  time: nowStr(),
  operator,
  action,
  detail,
});

/** 创建批次时给每条 fact 的初始日志 */
const initLogs = (operator: string, time: string): BufferLog[] => [
  { id: Math.floor(Math.random() * 100000), time, operator, action: "创建", detail: "AI 提取入缓冲池" },
];

// 通用导出工具：把若干 (batch, fact) 对生成 CSV 并触发下载，返回下载文件名
// v2.4：列名对齐「事实导入模板」中文表头；导出三态全部条目，但不附带审核人/审核时间/审核备注
const exportFactsToCSV = (
  rows: Array<{ batch: ExtractBatch; fact: ExtractedFact }>,
  fileSuffix = ""
): string => {
  // 名称 → 正式 ID 字典（mock 演示），真实环境应来自 entities/recall 与新建实体响应
  const entityNameToId = new Map<string, number>(mockEntities.map((e) => [e.title, e.id]));
  const eventNameToId  = new Map<string, number>(mockEvents.map((e)  => [e.name, e.id]));
  // 收集本条事实最终要落库的 entity_ids / event_ids（已匹配 + 审核保留的新实体）
  const collectEntityIds = (f: ExtractedFact): number[] => {
    const ids: number[] = [];
    f.entities.forEach((n) => {
      const id = entityNameToId.get(n);
      if (id) ids.push(id);
    });
    f.newEntities.forEach((e) => {
      if (e.decision === "keep" && e.reservedEntityId) ids.push(e.reservedEntityId);
    });
    return Array.from(new Set(ids));
  };
  const collectEventIds = (f: ExtractedFact): number[] => {
    const ids: number[] = [];
    f.events.forEach((n) => {
      const id = eventNameToId.get(n);
      if (id) ids.push(id);
    });
    f.newEvents.forEach((e) => {
      if (e.decision === "keep" && e.reservedEventId) ids.push(e.reservedEventId);
    });
    return Array.from(new Set(ids));
  };

  // 与 5/22「事实库导入模板-事实.csv」保持一致的中文表头
  const headers = [
    "事实ID", "标题", "事实内容", "分类ID",
    "来源类型", "来源", "来源URL", "来源内容",
    "开始时间", "结束时间", "时间描述",
    "关联实体ID（多个用英文逗号分隔）",
    "关联事件ID（多个用英文逗号分隔）",
    "矛盾事实ID（多个用英文逗号分隔）",
    "审核状态（待审核/已审核/已拒绝）",
  ];

  const escape = (s: string) => s.replace(/\r?\n/g, " ").replace(/"/g, "\"\"");
  const data: string[][] = [headers];
  rows.forEach(({ batch: b, fact: f }) => {
    const row: string[] = [
      "",                                      // 事实ID（入库时分配）
      "",                                      // 标题
      escape(f.content),                       // 事实内容
      "",                                      // 分类ID（导入后人工归类）
      "extract_text",                          // 来源类型
      b.extractor,                             // 来源（提取人）
      "",                                      // 来源URL
      b.batchId,                               // 来源内容（批次 ID 回溯）
      f.startTime || "",                       // 开始时间
      f.endTime   || "",                       // 结束时间
      f.timeDesc  || "",                       // 时间描述
      collectEntityIds(f).join(","),           // 关联实体ID
      collectEventIds(f).join(","),            // 关联事件ID
      f.conflict ? f.conflict.factId : "",     // 矛盾事实ID
      f.status,                                // 审核状态（中文三态）
    ];
    data.push(row);
  });

  const csv = data.map((row) => row.map((c) => `"${c}"`).join(",")).join("\r\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const filename = `fact-export-${new Date().toISOString().slice(0, 10)}${fileSuffix}.csv`;
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  return filename;
};

// ─── 冲突/重复检测 mock 库 ─────────────────────────────────────────────────────
/** 已入库事实的"指纹库"。编辑保存后会重新基于关键词匹配，模拟"重新查冲突"。 */
interface KnownFact {
  factId: string;
  content: string;
  /** 触发"冲突"的关键词组合（必须全部命中） */
  conflictKeywords: string[];
  /** 冲突说明 */
  conflictReason: string;
  /** 触发"重复"的关键词组合（必须全部命中） */
  duplicateKeywords: string[];
  /** 重复相似度示例值 */
  similarity: number;
}

const KNOWN_FACTS: KnownFact[] = [
  {
    factId: "ID:37957",
    content: "英雄维斯的剃刀藤蔓落地后处于隐形状态，接触到敌人后自动触发，对范围内敌人造成持续伤害与减速效果。",
    conflictKeywords: ["剃刀藤蔓", "手动激活"],
    conflictReason: "已有事实[ID:37957]描述剃刀藤蔓落地后需手动激活，但已审核事实[ID:10088]中描述该技能为自动触发。两者在激活方式上存在直接冲突。",
    duplicateKeywords: [],
    similarity: 0,
  },
  {
    factId: "ID:42010",
    content: "在游戏地图日落之城的A点，英雄维斯可以将技能剃刀藤蔓投掷在A大道拐角、A小出口墙面等位置，利用反弹将陷阱布置到视野盲区，配合弧光玫瑰对进点敌人形成控制。",
    conflictKeywords: [],
    conflictReason: "",
    duplicateKeywords: ["日落之城", "A点", "剃刀藤蔓", "弧光玫瑰"],
    similarity: 0.86,
  },
];

/** 重新校验：基于事实内容关键词匹配，模拟后端冲突/重复查询 */
function recheckConflict(content: string): { conflict: ConflictRef | null; duplicate: DuplicateRef | null } {
  let conflict: ConflictRef | null = null;
  let duplicate: DuplicateRef | null = null;
  for (const k of KNOWN_FACTS) {
    if (!conflict && k.conflictKeywords.length > 0 && k.conflictKeywords.every((kw) => content.includes(kw))) {
      conflict = { factId: k.factId, factContent: k.content, reason: k.conflictReason };
    }
    if (!duplicate && k.duplicateKeywords.length > 0 && k.duplicateKeywords.every((kw) => content.includes(kw))) {
      duplicate = { factId: k.factId, factContent: k.content, similarity: k.similarity };
    }
  }
  return { conflict, duplicate };
}

/** 极简字符级 diff：返回带类型的片段数组（基于 LCS） */
type DiffSeg = { type: "equal" | "del" | "ins"; text: string };
function charDiff(oldStr: string, newStr: string): DiffSeg[] {
  const m = oldStr.length, n = newStr.length;
  // dp[i][j] = LCS length of oldStr[0..i] vs newStr[0..j]
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = oldStr[i - 1] === newStr[j - 1]
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  const segs: DiffSeg[] = [];
  let i = m, j = n;
  while (i > 0 && j > 0) {
    if (oldStr[i - 1] === newStr[j - 1]) {
      segs.unshift({ type: "equal", text: oldStr[i - 1] });
      i--; j--;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      segs.unshift({ type: "del", text: oldStr[i - 1] });
      i--;
    } else {
      segs.unshift({ type: "ins", text: newStr[j - 1] });
      j--;
    }
  }
  while (i > 0) { segs.unshift({ type: "del", text: oldStr[i - 1] }); i--; }
  while (j > 0) { segs.unshift({ type: "ins", text: newStr[j - 1] }); j--; }
  // 合并相邻同类型
  const merged: DiffSeg[] = [];
  for (const s of segs) {
    const last = merged[merged.length - 1];
    if (last && last.type === s.type) last.text += s.text;
    else merged.push({ ...s });
  }
  return merged;
}

// ─── mock 数据 ────────────────────────────────────────────────────────────────
const mockBatches: ExtractBatch[] = [
  {
    batchId: "BATCH-20260506-0001",
    extractedAt: "2026-05-06 09:30:00",
    extractor: CURRENT_USER,
    model: "deepseek-v3-2-251201",
    mode: "多段提取",
    extractLang: "zh",
    sourceText: "在游戏地图'深海明珠'的A点，英雄'维斯'可以使用其基础技能'弧光玫瑰'进行防守。弧光玫瑰可部署在墙面或地面，部署后处于隐形状态，再次激活时可致盲所有注视该墙面的敌人，并会提供闪光命中的提示音。该技能可回收并重新部署，且通过辅助射击键可将玫瑰部署在墙体另一侧实现隔墙闪光。在防守深海明珠A点时，进攻方通常从A主门（经A大道）或水下路线推进。维斯可在A包点内侧墙面、A主门出口墙体背面或水下出口拐角等位置部署弧光玫瑰。当通过声音或道具信息判断敌人即将进点时，激活玫瑰致盲从A主门或水下拉出的敌人，随后可根据提示音判断命中人数，协同队友从掩体后拉出进行反清击杀，以打乱敌方进攻节奏。若敌方暂缓进攻，维斯可以回收玫瑰并重新部署到其他位置以灵活应对。\n\n在游戏地图日落之城的B点，英雄维斯的技能剃刀藤蔓是一个可投掷的陷阱装置，落地后隐形，可手动激活，激活后从地面伸出藤蔓，对范围内移动的敌人造成持续伤害与减速效果，并伴随较大声响；该技能可通过墙面反弹进行布置。\n\n在游戏地图日落之城的A点，英雄维斯的技能剃刀藤蔓是一个可投掷的陷阱装置，落地后隐形，可手动激活，激活后从地面伸出藤蔓，对范围内移动的敌人造成持续伤害与减速效果，并伴随较大声响。该技能可通过墙面反弹进行布置。",
    batchLabel: "在游戏地图'深海明珠'的A点，英雄'维斯'可以使用其基础技能'弧光玫瑰'进行防守…",
    expanded: true,
    archived: false,
    facts: [
      {
        factId: "f_001_1",
        content: "在游戏地图'深海明珠'的A点，英雄'维斯'可以使用其基础技能'弧光玫瑰'进行防守。弧光玫瑰可部署在墙面或地面，部署后处于隐形状态，再次激活时可致盲所有注视该墙面的敌人，并会提供闪光命中的提示音。该技能可回收并重新部署，且通过辅助射击键可将玫瑰部署在墙体另一侧实现隔墙闪光。在防守深海明珠A点时，进攻方通常从A主门（经A大道）或水下路线推进。维斯可在A包点内侧墙面、A主门出口墙体背面或水下出口拐角等位置部署弧光玫瑰。当通过声音或道具信息判断敌人即将进点时，激活玫瑰致盲从A主门或水下拉出的敌人，随后可根据提示音判断命中人数，协同队友从掩体后拉出进行反清击杀，以打乱敌方进攻节奏。若敌方暂缓进攻，维斯可以回收玫瑰并重新部署到其他位置以灵活应对。",
        entities: ["维斯", "弧光玫瑰", "深海明珠", "A点", "A主门", "A大道", "技能", "道具", "陷阱", "隐形"],
        newEntities: mkNE(["A包点", "水下路线"]),
        events: [],
        newEvents: [],
        startTime: "",
        endTime: "",
        timeDesc: "",
        conflict: null,
        duplicate: null,
        status: "待审核",
        logs: initLogs("yzhinan(南勇志)", "2026-05-06 09:30:00"),
      },
      {
        factId: "f_001_2",
        content: "在游戏地图日落之城的B点，英雄维斯的技能剃刀藤蔓是一个可投掷的陷阱装置，落地后隐形，可手动激活，激活后从地面伸出藤蔓，对范围内移动的敌人造成持续伤害与减速效果，并伴随较大声响；该技能可通过墙面反弹进行布置。在防守B点时，该技能可用于封锁B大道入口、B二楼楼梯口及中坡连接通道等进攻方必经之路，例如在B大道拐角墙壁、B二楼楼梯下方地面或中坡拐角处反弹投掷。当获得敌方进攻信息时，激活剃刀藤蔓可以打断敌方节奏，协同队友进行反清或调整站位。",
        entities: ["维斯", "剃刀藤蔓", "日落之城", "B点", "B大道", "B二楼", "技能", "陷阱", "隐形", "减速"],
        newEntities: mkNE(["中坡连接通道"]),
        events: [],
        newEvents: [],
        startTime: "",
        endTime: "",
        timeDesc: "",
        conflict: {
          factId: "ID:37957",
          factContent: "英雄维斯的剃刀藤蔓落地后处于隐形状态，接触到敌人后自动触发，对范围内敌人造成持续伤害与减速效果。",
          reason: "已有事实[ID:37957]描述剃刀藤蔓落地后需手动激活，但已审核事实[ID:10088]中描述该技能为自动触发。两者在激活方式上存在直接冲突。",
        },
        duplicate: null,
        status: "待审核",
        logs: initLogs("yzhinan(南勇志)", "2026-05-06 09:30:00"),
      },
      {
        factId: "f_001_3",
        content: "在游戏地图日落之城的A点，英雄维斯的技能剃刀藤蔓是一个可投掷的陷阱装置，落地后隐形，可手动激活，激活后从地面伸出藤蔓，对范围内移动的敌人造成持续伤害与减速效果，并伴随较大声响。该技能可通过墙面反弹进行布置。在防守A点时，维斯可将剃刀藤蔓投掷在A大道拐角墙面、A小出口墙壁或A包点掩体后等关键位置，利用反弹将陷阱布置在视野盲区。当听到敌方道具声或脚步声时激活藤蔓，可以封锁关键通道，迫使敌人减速或承受伤害，打乱其进攻节奏。陷阱触发后，防守方可利用减速效果架枪反清，或拖延敌方进点时间等待队友回防。该技能可与维斯的另一技能弧光玫瑰配合，对进点敌人形成控制链。",
        entities: ["维斯", "剃刀藤蔓", "弧光玫瑰", "日落之城", "A点", "A大道", "A小出口", "技能", "陷阱", "隐形", "减速"],
        newEntities: mkNE(["A包点掩体", "视野盲区", "控制链"]),
        events: [],
        newEvents: [],
        startTime: "",
        endTime: "",
        timeDesc: "",
        conflict: null,
        duplicate: {
          factId: "ID:42010",
          factContent: "在游戏地图日落之城的A点，英雄维斯可以将技能剃刀藤蔓投掷在A大道拐角、A小出口墙面等位置，利用反弹将陷阱布置到视野盲区，配合弧光玫瑰对进点敌人形成控制。",
          similarity: 0.86,
        },
        status: "待审核",
        logs: initLogs("yzhinan(南勇志)", "2026-05-06 09:30:00"),
      },
      {
        factId: "f_001_4",
        content: "2026年4月23日至5月7日，游戏限时活动「深渊突袭季」开启，特工维斯获得专属活动皮肤「暗影执行者」，活动期间完成维斯英雄挑战任务可额外获得活动积分，积分可兑换限定喷漆及玩家卡。此外，「深海明珠」地图在本次活动期间加入竞技轮换池。",
        entities: ["维斯", "深海明珠", "英雄挑战任务", "积分"],
        newEntities: [
          { name: "暗影执行者", description: "维斯专属活动皮肤，仅在「深渊突袭季」期间获得", tags: ["皮肤", "限定"], decision: "keep", reservedEntityId: 90001 },
          { name: "活动积分", description: "深渊突袭季期间通过完成英雄挑战任务获得，可兑换限定道具", tags: ["积分", "活动"], decision: "keep", reservedEntityId: 90002 },
          { name: "限定喷漆", description: "活动积分可兑换的喷漆道具", tags: ["道具", "限定"], decision: "keep", reservedEntityId: 90003 },
          { name: "玩家卡", description: "活动积分可兑换的玩家卡道具", tags: ["道具"], decision: "keep", reservedEntityId: 90004 },
        ],
        events: [],
        newEvents: [
          {
            name: "深渊突袭季",
            eventType: "活动",
            startTime: "2026-04-23 00:00:00",
            endTime:   "2026-05-07 23:59:59",
            timeDesc:  "活动限时，结束后皮肤不再获得",
            description: "维斯获得专属皮肤「暗影执行者」，完成英雄挑战任务可获活动积分，积分可兑换限定喷漆及玩家卡；深海明珠地图加入竞技轮换池",
            tags: ["限时活动", "皮肤", "积分"],
            decision: "keep",
            reservedEventId: 80001,
          },
        ],
        startTime: "2026-04-23 00:00:00",
        endTime:   "2026-05-07 23:59:59",
        timeDesc:  "活动限时，结束后皮肤不再获得",
        conflict: null,
        duplicate: null,
        status: "待审核",
        logs: initLogs("yzhinan(南勇志)", "2026-05-06 09:30:00"),
      },
    ],
  },
  {
    batchId: "BATCH-20260506-0002",
    extractedAt: "2026-05-06 14:20:00",
    extractor: "zhaoweilin(林兆伟)",
    model: "deepseek-v3-2-251201",
    mode: "单段提取",
    extractLang: "zh",
    sourceText: "在游戏地图「裂隙」C点，英雄「赛奇」可以使用其终极技能「复苏」对倒地队友进行复活，复苏过程中赛奇与目标队友均处于无敌状态。该技能冷却时间长，通常用于关键回合的翻盘。",
    batchLabel: "在游戏地图「裂隙」C点，英雄「赛奇」可以使用其终极技能「复苏」对倒地队友…",
    expanded: true,
    archived: false,
    facts: [
      {
        factId: "f_002_1",
        content: "在游戏地图「裂隙」C点，英雄「赛奇」可以使用其终极技能「复苏」对倒地队友进行复活，复苏过程中赛奇与目标队友均处于无敌状态。该技能冷却时间长，通常用于关键回合的翻盘。",
        entities: ["赛奇", "复苏", "裂隙", "C点", "终极技能"],
        newEntities: [],
        events: [],
        newEvents: [],
        startTime: "",
        endTime: "",
        timeDesc: "",
        conflict: null,
        duplicate: null,
        status: "待审核",
        logs: initLogs("zhaoweilin(林兆伟)", "2026-05-06 14:20:00"),
      },
    ],
  },
  // 已归档批次（演示用：已导出 CSV）
  {
    batchId: "BATCH-20260505-0003",
    extractedAt: "2026-05-05 16:08:22",
    extractor: CURRENT_USER,
    model: "deepseek-v3-2-251201",
    mode: "多段提取",
    extractLang: "zh",
    sourceText: "在游戏地图断章城的 B 点，英雄绿松石可以使用技能能量充能进行布防。能量充能可在落地后形成一个能量场，对范围内敌人造成伤害…",
    batchLabel: "在游戏地图断章城的 B 点，英雄绿松石可以使用技能能量充能进行布防…",
    expanded: false,
    archived: true,
    archiveReason: "exported",
    archivedAt: "2026-05-05 17:30:11",
    archivedBy: CURRENT_USER,
    exportedAt: "2026-05-05 17:30:11",
    facts: [
      {
        factId: "f_arch_1",
        content: "在游戏地图断章城的 B 点，英雄绿松石可以使用技能能量充能进行布防。能量充能可在落地后形成一个能量场，对范围内敌人造成伤害。",
        entities: ["绿松石", "能量充能", "断章城", "B点"],
        newEntities: [],
        events: [],
        newEvents: [],
        startTime: "", endTime: "", timeDesc: "",
        conflict: null, duplicate: null,
        status: "待审核",
        logs: [
          { id: 1, time: "2026-05-05 16:08:22", operator: CURRENT_USER, action: "创建", detail: "AI 提取入审核区" },
          { id: 2, time: "2026-05-05 17:30:11", operator: CURRENT_USER, action: "编辑", detail: "导出 CSV（fact-export-20260505.csv）" },
        ],
      },
      {
        factId: "f_arch_2",
        content: "绿松石的另一技能能量护盾可生成一道临时屏障，阻挡子弹与技能投射物，但持续时间短。",
        entities: ["绿松石", "能量护盾"],
        newEntities: [],
        events: [],
        newEvents: [],
        startTime: "", endTime: "", timeDesc: "",
        conflict: null, duplicate: null,
        status: "待审核",
        logs: [
          { id: 1, time: "2026-05-05 16:08:22", operator: CURRENT_USER, action: "创建", detail: "AI 提取入审核区" },
          { id: 2, time: "2026-05-05 17:30:11", operator: CURRENT_USER, action: "编辑", detail: "导出 CSV（fact-export-20260505.csv）" },
        ],
      },
    ],
  },
  // 文件导入批次（演示用：来自白皮书 PDF）
  {
    batchId: "BATCH-20260506-0003",
    extractedAt: "2026-05-06 11:15:44",
    extractor: "zhaoweilin(林兆伟)",
    model: "deepseek-v3-2-251201",
    mode: "文件解析",
    extractLang: "zh",
    sourceText: "来源文件：无畏契约-维斯角色白皮书.pdf\n\n【第 1 章 / 1.2 技能机制】\n弧光玫瑰：维斯的基础技能，可部署在墙面或地面，部署后处于隐形状态，再次激活时可致盲所有注视该墙面的敌人，并提供闪光命中的提示音。该技能可回收并重新部署。\n\n【第 1 章 / 1.3 技能机制】\n剃刀藤蔓：可投掷的陷阱装置，落地后隐形，可手动激活，激活后从地面伸出藤蔓，对范围内移动的敌人造成持续伤害与减速效果，伴随较大声响；可通过墙面反弹进行布置。\n\n【第 2 章 / 2.1 地图配合】\n深海明珠地图 A 点防守时，建议在 A 主门、水下出口拐角等位置部署弧光玫瑰，当判断敌人即将进点时激活，配合队友反清。\n\n【第 2 章 / 2.2 战术建议】\n维斯擅长防守回合的预判布防，弧光玫瑰与剃刀藤蔓可形成控制链，有效封锁关键通道。",
    batchLabel: "[白皮书] 无畏契约-维斯角色白皮书.pdf",
    expanded: true,
    archived: false,
    facts: [
      {
        factId: "f_003_1",
        content: "弧光玫瑰是维斯的基础技能，可部署在墙面或地面，部署后处于隐形状态，再次激活时可致盲所有注视该墙面的敌人，并提供闪光命中的提示音。该技能可回收并重新部署。",
        entities: ["维斯", "弧光玫瑰", "技能", "隐形"],
        newEntities: mkNE(["提示音"]),
        events: [],
        newEvents: [],
        startTime: "", endTime: "", timeDesc: "",
        conflict: null, duplicate: null,
        status: "待审核",
        logs: initLogs("zhaoweilin(林兆伟)", "2026-05-06 11:15:44"),
      },
      {
        factId: "f_003_2",
        content: "剃刀藤蔓是维斯的陷阱技能，落地后隐形，可手动激活，激活后从地面伸出藤蔓，对范围内移动的敌人造成持续伤害与减速效果，伴随较大声响；可通过墙面反弹进行布置。",
        entities: ["维斯", "剃刀藤蔓", "技能", "隐形", "减速"],
        newEntities: [],
        events: [],
        newEvents: [],
        startTime: "", endTime: "", timeDesc: "",
        conflict: null, duplicate: null,
        status: "待审核",
        logs: initLogs("zhaoweilin(林兆伟)", "2026-05-06 11:15:44"),
      },
    ],
  },
];

// ─── 主组件 ────────────────────────────────────────────────────────────────────
export default function ExtractTab() {
  const [text, setText] = useState("");
  const [mode, setMode] = useState("single");
  const [model, setModel] = useState("deepseek-v3-2-251201");
  /** 提取语种（默认中文，选择后影响冲突/重复检测、实体匹配、入库 i18n 字段） */
  const [extractLang, setExtractLang] = useState<LangCode>("zh");
  const [loading, setLoading] = useState(false);
  const [batches, setBatches] = useState<ExtractBatch[]>(mockBatches);
  /** 左侧提取输入区是否已收起 */
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  /** 提取人筛选：all=全部（共享），mine=只看自己的 */
  const [scope, setScope] = useState<"all" | "mine">("all");
  /** 输入方式：text=文本粘贴，file=文件导入 */
  const [inputMode, setInputMode] = useState<"text" | "file">("text");
  /** 文件导入态 */
  const [file, setFile] = useState<File | null>(null);
  const [parseStatus, setParseStatus] = useState<"idle" | "parsing" | "parsed" | "error">("idle");
  const [parseError, setParseError] = useState("");
  const [segments, setSegments] = useState<FileSegment[]>([]);
  /** 视图分区：pending=待处理，archived=已归档 */
  const [view, setView] = useState<"pending" | "archived">("pending");
  /** 多选的事实 ID 集合（跨批次累加） */
  const [selectedFactIds, setSelectedFactIds] = useState<Set<string>>(new Set());

  // 1. 按提取人筛选
  const scopedBatches = scope === "mine"
    ? batches.filter((b) => b.extractor === CURRENT_USER)
    : batches;

  // 2. 按归档状态切换池子
  const visibleBatches = scopedBatches.filter((b) => view === "pending" ? !b.archived : b.archived);

  // 3. 全局统计（仅按提取人筛选，不分池）
  const pendingPoolCount  = scopedBatches.filter((b) => !b.archived).reduce((a, b) => a + b.facts.length, 0);
  const archivedPoolCount = scopedBatches.filter((b) =>  b.archived).reduce((a, b) => a + b.facts.length, 0);

  // 4. 当前视图的统计
  const pendingCount  = visibleBatches.reduce((a, b) => a + b.facts.filter((f) => f.status === "待审核").length, 0);
  const approvedCount = visibleBatches.reduce((a, b) => a + b.facts.filter((f) => f.status === "已审核").length, 0);
  const totalCount    = visibleBatches.reduce((a, b) => a + b.facts.length, 0);
  /** 符合入库条件：批次内全部条目已标注（无待审核）的批次中的「已审核」条目数 */
  const commitableCount = visibleBatches
    .filter((b) => !b.archived && !b.facts.some((f) => f.status === "待审核"))
    .reduce((a, b) => a + b.facts.filter((f) => f.status === "已审核").length, 0);
  /** 阻塞入库的批次：含已审核但仍有待审核的批次数（用于 tooltip 提示） */
  const blockedBatchCount = visibleBatches.filter((b) =>
    !b.archived
    && b.facts.some((f) => f.status === "已审核")
    && b.facts.some((f) => f.status === "待审核")
  ).length;

  // 5. 多选相关
  const selectedCount = selectedFactIds.size;
  const clearSelection = () => setSelectedFactIds(new Set());
  const toggleSelectFact = (factId: string) => {
    setSelectedFactIds((prev) => {
      const next = new Set(prev);
      next.has(factId) ? next.delete(factId) : next.add(factId);
      return next;
    });
  };
  /** 整批切换选中：若批次内所有条目全已选中则全取消，否则全选中 */
  const toggleSelectBatch = (batch: ExtractBatch) => {
    const batchFactIds = batch.facts.map((f) => f.factId);
    const allSelected = batchFactIds.every((id) => selectedFactIds.has(id));
    setSelectedFactIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        batchFactIds.forEach((id) => next.delete(id));
      } else {
        batchFactIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };
  /** 全选/取消全选当前视图所有 facts */
  const allVisibleFactIds = visibleBatches.flatMap((b) => b.facts.map((f) => f.factId));
  const allVisibleSelected = allVisibleFactIds.length > 0 && allVisibleFactIds.every((id) => selectedFactIds.has(id));
  const someVisibleSelected = allVisibleFactIds.some((id) => selectedFactIds.has(id));
  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      clearSelection();
    } else {
      setSelectedFactIds(new Set(allVisibleFactIds));
    }
  };
  // 视图切换时清空选择
  React.useEffect(() => { clearSelection(); }, [view, scope]);

  const handleExtract = () => {
    if (!text.trim()) { MessagePlugin.warning("请输入文本内容"); return; }
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      const label = text.slice(0, 40) + (text.length > 40 ? "…" : "");
      // 业务编号：BATCH-{YYYYMMDD}-{当日 4 位序号}
      const today = new Date();
      const ymd = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;
      const seq = String(batches.filter((b) => b.batchId.includes(ymd)).length + 1).padStart(4, "0");
      const newBatchId = `BATCH-${ymd}-${seq}`;
      const newBatch: ExtractBatch = {
        batchId: newBatchId,
        extractedAt: new Date().toLocaleString("zh-CN").replace(/\//g, "-"),
        extractor: CURRENT_USER,
        sourceText: text,
        batchLabel: label,
        model,
        mode: mode === "single" ? "单段提取" : "多段提取",
        extractLang,
        expanded: true,
        archived: false,
        facts: mode === "single"
          ? [{ factId: `f_${Date.now()}_1`, content: text.trim(), entities: ["霓虹", "高速通道"], newEntities: [], events: [], newEvents: [], startTime: "", endTime: "", timeDesc: "", conflict: null, duplicate: null, status: "待审核", logs: initLogs(CURRENT_USER, nowStr()) }]
          : [
              { factId: `f_${Date.now()}_1`, content: text.trim().split("\n")[0] || text.trim(), entities: ["霓虹"], newEntities: [], events: [], newEvents: [], startTime: "", endTime: "", timeDesc: "", conflict: null, duplicate: null, status: "待审核", logs: initLogs(CURRENT_USER, nowStr()) },
              { factId: `f_${Date.now()}_2`, content: text.trim().split("\n")[1] || "（第二段提取结果）", entities: ["勇士学院"], newEntities: mkNE(["新实体示例"]), events: [], newEvents: [], startTime: "", endTime: "", timeDesc: "", conflict: null, duplicate: null, status: "待审核", logs: initLogs(CURRENT_USER, nowStr()) },
            ],
      };
      setBatches((prev) => [newBatch, ...prev]);
      setText("");
      const langLabel = LANG_OPTIONS.find((language) => language.code === extractLang)?.label || extractLang;
      MessagePlugin.success(`提取完成（${newBatchId}，${langLabel}），生成 ${newBatch.facts.length} 条事实，已进入右侧审核区`);
    }, 2000);
  };

  /** 选择文件后解析：支持三 Sheet（实体/事件/知识资讯）定向处理 */
  const handleFileSelect = async (f: File) => {
    setFile(f);
    setParseStatus("parsing");
    setParseError("");
    setSegments([]);

    const ext = f.name.split(".").pop()?.toLowerCase() || "";
    const isTable = ext === "xlsx" || ext === "csv";
    const sizeMB = f.size / 1024 / 1024;

    if (isTable && sizeMB > 5) {
      setParseStatus("error");
      setParseError(`表格文件超过 5MB（${sizeMB.toFixed(2)}MB），请拆分后重试`);
      return;
    }
    if (!isTable && sizeMB > 20) {
      setParseStatus("error");
      setParseError(`文件超过 20MB（${sizeMB.toFixed(2)}MB），请压缩或拆分后重试`);
      return;
    }
    if (f.name.includes("encrypted")) {
      setParseStatus("error");
      setParseError("文件已加密，无法解析。请提供未加密版本");
      return;
    }

    const inferSheetType = (sheetName: string): FileSegment["sheetType"] => {
      const n = sheetName.toLowerCase();
      if (sheetName.includes("实体") || n.includes("entity")) return "entity";
      if (sheetName.includes("事件") || n.includes("event")) return "event";
      if (sheetName.includes("知识") || n.includes("knowledge")) return "knowledge";
      return undefined;
    };

    const firstNonEmpty = (row: Record<string, any>, keys: string[]) => {
      for (const k of keys) {
        const exact = row[k];
        if (exact !== undefined && String(exact).trim()) return String(exact).trim();
        const fuzzyKey = Object.keys(row).find((rk) => rk.includes(k));
        if (fuzzyKey && String(row[fuzzyKey]).trim()) return String(row[fuzzyKey]).trim();
      }
      return "";
    };

    try {
      if (ext === "xlsx") {
        const XLSX = await import("xlsx");
        const buf = await f.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array" });

        const segs: FileSegment[] = [];
        wb.SheetNames.forEach((sheetName) => {
          const sheetType = inferSheetType(sheetName);
          if (!sheetType) return;
          const ws = wb.Sheets[sheetName];
          const rows = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: "" });

          rows.forEach((row, idx) => {
            const hasData = Object.values(row).some((v) => String(v ?? "").trim());
            if (!hasData) return;

            const primaryName = sheetType === "entity"
              ? firstNonEmpty(row, ["实体名", "实体名称"])
              : sheetType === "event"
                ? firstNonEmpty(row, ["事件名", "事件名称"])
                : firstNonEmpty(row, ["标题", "知识文本"]);

            const text = Object.entries(row)
              .filter(([, v]) => String(v ?? "").trim())
              .map(([k, v]) => `${k}：${String(v).trim()}`)
              .join("；");

            segs.push({
              id: `${sheetType}_${sheetName}_${idx + 1}`,
              location: `${sheetName} 第 ${idx + 2} 行`,
              text: text || `${primaryName || "未命名"}`,
              selected: true,
              sheetType,
              rowData: row,
            });
          });
        });

        if (segs.length === 0) {
          setParseStatus("error");
          setParseError("未在【实体 / 事件 / 知识资讯】sheet 中识别到可用数据，请先按模板填写");
          return;
        }

        setSegments(segs);
        setParseStatus("parsed");
        const cEntity = segs.filter((s) => s.sheetType === "entity").length;
        const cEvent = segs.filter((s) => s.sheetType === "event").length;
        const cKnow = segs.filter((s) => s.sheetType === "knowledge").length;
        MessagePlugin.success(`解析完成：实体 ${cEntity} 条，事件 ${cEvent} 条，知识 ${cKnow} 条`);
        return;
      }

      // csv 或文档：保留原有 mock 片段
      const segs: FileSegment[] = isTable
        ? [
            { id: "seg_1", location: "第 2 行（表格）", text: "在游戏地图深海明珠的 A 点，特工维斯可以使用基础技能弧光玫瑰进行防守…", selected: true, sheetType: "knowledge" },
            { id: "seg_2", location: "第 3 行（表格）", text: "在游戏地图日落之城的 B 点，特工维斯的剃刀藤蔓是一个可投掷的陷阱装置…", selected: true, sheetType: "knowledge" },
            { id: "seg_3", location: "第 4 行（表格）", text: "限时活动「深渊突袭季」开启，参与活动的玩家可获得专属皮肤暗影执行者…", selected: true, sheetType: "knowledge" },
          ]
        : [
            { id: "seg_1", location: "第 1 章 / 1.1 英雄概述", text: "维斯是一名以战术控制见长的特工，擅长在防守回合通过预判敌方进攻路线进行布防…", selected: true, sheetType: "knowledge" },
            { id: "seg_2", location: "第 1 章 / 1.2 技能机制", text: "弧光玫瑰：维斯的基础技能，可部署在墙面或地面，部署后处于隐形状态，再次激活时可致盲所有注视该墙面的敌人…", selected: true, sheetType: "knowledge" },
            { id: "seg_3", location: "第 1 章 / 1.3 技能机制", text: "剃刀藤蔓：可投掷的陷阱装置，落地后隐形，可手动激活，激活后从地面伸出藤蔓，对范围内移动的敌人造成持续伤害与减速效果…", selected: true, sheetType: "knowledge" },
          ];

      setSegments(segs);
      setParseStatus("parsed");
      MessagePlugin.success(`文件解析完成，识别出 ${segs.length} 个候选片段`);
    } catch (err: any) {
      setParseStatus("error");
      setParseError(`解析失败：${err?.message || "文件格式不支持"}`);
    }
  };

  /** 文件提取：把选中的片段一次性生成一个批次 */
  const handleFileExtract = () => {
    const picked = segments.filter((s) => s.selected);
    if (picked.length === 0) { MessagePlugin.warning("请至少勾选 1 个候选片段"); return; }

    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      const today = new Date();
      const ymd = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;
      const seq = String(batches.filter((b) => b.batchId.includes(ymd)).length + 1).padStart(4, "0");
      const newBatchId = `BATCH-${ymd}-${seq}`;

      const ext = file?.name.split(".").pop()?.toLowerCase() || "";
      const fileType = ext === "xlsx" || ext === "csv" ? "表格"
        : ext === "pdf" ? "白皮书"
        : ext === "docx" ? "白皮书"
        : "文件";
      const getPrimaryName = (seg: FileSegment) => {
        const row = seg.rowData || {};
        if (seg.sheetType === "entity") return String(row["实体名"] || row["实体名称"] || "").trim();
        if (seg.sheetType === "event") return String(row["事件名"] || row["事件名称"] || "").trim();
        return String(row["标题 / 知识文本中可能缺失的上下文"] || row["标题"] || row["知识文本"] || "").trim();
      };

      const facts: ExtractedFact[] = picked.map((s, i) => {
        const primary = getPrimaryName(s);
        const from = s.sheetType || "knowledge";
        return {
          factId: `f_${Date.now()}_${i + 1}`,
          content: s.text,
          entities: from === "entity" && primary ? [primary] : [],
          newEntities: [],
          events: from === "event" && primary ? [primary] : [],
          newEvents: [],
          startTime: "", endTime: "", timeDesc: "",
          conflict: null,
          duplicate: null,
          status: "待审核",
          logs: initLogs(CURRENT_USER, nowStr()),
          sourceType: from === "entity" ? "extract_entity_sheet" : from === "event" ? "extract_event_sheet" : "extract_knowledge_sheet",
          source: file?.name || "",
          sourceContent: `${s.location}`,
          title: primary || undefined,
          extra: JSON.stringify({ sheetType: from, location: s.location, rowData: s.rowData || {} }),
        };
      });

      const newBatch: ExtractBatch = {
        batchId: newBatchId,
        extractedAt: new Date().toLocaleString("zh-CN").replace(/\//g, "-"),
        extractor: CURRENT_USER,
        sourceText: `来源文件：${file?.name}\n\n` + picked.map((s) => `【${s.location}】\n${s.text}`).join("\n\n"),
        batchLabel: `[${fileType}] ${file?.name}`,
        model,
        mode: "文件解析",
        extractLang,
        expanded: true,
        archived: false,
        facts,
      };
      setBatches((prev) => [newBatch, ...prev]);
      // 清空文件态
      setFile(null);
      setSegments([]);
      setParseStatus("idle");
      const fLangLabel = LANG_OPTIONS.find((language) => language.code === extractLang)?.label || extractLang;
      MessagePlugin.success(`提取完成（${newBatchId}，${fLangLabel}），生成 ${facts.length} 条事实，已进入右侧审核区`);
    }, 2000);
  };

  /** 重置文件态 */
  const handleFileReset = () => {
    setFile(null);
    setSegments([]);
    setParseStatus("idle");
    setParseError("");
  };


  /** 批量入库：批次必须全部审核完毕（无待审核）才能入库，入库后自动归档；否则拒绝执行+toast 提示 */
  const handleCommitAll = () => {
    if (approvedCount === 0) { MessagePlugin.warning("暂无已审核条目可入库"); return; }
    if (commitableCount === 0) {
      MessagePlugin.warning({
        content: `${blockedBatchCount} 个批次仍有待审核条目，请审核完毕后再入库`,
        duration: 3500,
      });
      return;
    }
    const scopeLabel = scope === "mine" ? "我提取的" : "当前视图";

    // 候选批次：当前视图、未归档、含已审核
    const candidateBatches = batches.filter((b) => {
      if (b.archived) return false;
      if (scope === "mine" && b.extractor !== CURRENT_USER) return false;
      return b.facts.some((f) => f.status === "已审核");
    });
    // 校验：所有候选批次必须全部条目已标注（无待审核），否则拒绝
    const blockedBatches = candidateBatches.filter((b) => b.facts.some((f) => f.status === "待审核"));
    if (blockedBatches.length > 0) {
      MessagePlugin.warning({
        content: `${blockedBatches.length} 个批次仍有待审核条目，请审核完毕后再入库`,
        duration: 3500,
      });
      return;
    }

    const readyCount = candidateBatches.length;
    const readyApprovedCount = candidateBatches.reduce((a, b) => a + b.facts.filter((f) => f.status === "已审核").length, 0);

    const dlg = DialogPlugin.confirm({
      header: "入库确认",
      body: (
        <div style={{ fontSize: 13, lineHeight: 1.8 }}>
          <div>将{scopeLabel} <strong style={{ color: "var(--td-success-color)" }}>{readyApprovedCount} 条「已审核」事实</strong>入库（直接以「已审核」状态进入事实库）。</div>
          <div style={{ marginTop: 6 }}>涉及 <strong>{readyCount}</strong> 个批次，全部条目已标注完成，入库后自动归档到「已归档」区。</div>
        </div>
      ) as any,
      theme: "warning",
      confirmBtn: { content: "确认入库", theme: "primary" },
      cancelBtn: { content: "取消", variant: "outline" },
      onConfirm: () => {
        const now = nowStr();
        setBatches((prev) => prev.map((b) => {
          if (b.archived) return b;
          if (scope === "mine" && b.extractor !== CURRENT_USER) return b;
          if (!b.facts.some((f) => f.status === "已审核")) return b;
          if (b.facts.some((f) => f.status === "待审核")) return b;
          const updatedFacts = b.facts.map((f) => f.status === "已审核"
            ? { ...f, logs: [...f.logs, mkLog("通过", `批量入库 → 事实库（已审核）`)] }
            : f);
          return {
            ...b,
            archived: true,
            archiveReason: "committed",
            archivedAt: now,
            archivedBy: CURRENT_USER,
            facts: updatedFacts,
          };
        }));
        MessagePlugin.success(`${readyApprovedCount} 条事实已入库，${readyCount} 个批次已归档`);
        clearSelection();
        dlg.destroy();
      },
      onCancel: () => dlg.destroy(),
    });
  };

  /** 批量通过（多选）：仅对待审核条目生效，已标注的不影响 */
  const handleBatchApprove = () => {
    if (selectedCount === 0) { MessagePlugin.warning("请先勾选事实条目"); return; }
    const ids = selectedFactIds;
    let actualCount = 0;
    setBatches((prev) => prev.map((b) => ({
      ...b,
      facts: b.facts.map((f) => {
        if (!ids.has(f.factId) || f.status !== "待审核") return f;
        actualCount++;
        return { ...f, status: "已审核", logs: [...f.logs, mkLog("通过", "批量通过（多选）")] };
      }),
    })));
    setTimeout(() => {
      MessagePlugin.success(`已通过 ${actualCount} 条`);
      clearSelection();
    }, 0);
  };

  /** 批量拒绝（多选） */
  const handleBatchReject = () => {
    if (selectedCount === 0) { MessagePlugin.warning("请先勾选事实条目"); return; }
    const ids = selectedFactIds;
    let actualCount = 0;
    setBatches((prev) => prev.map((b) => ({
      ...b,
      facts: b.facts.map((f) => {
        if (!ids.has(f.factId) || f.status !== "待审核") return f;
        actualCount++;
        return { ...f, status: "已拒绝", logs: [...f.logs, mkLog("拒绝", "批量拒绝（多选）")] };
      }),
    })));
    setTimeout(() => {
      MessagePlugin.success(`已拒绝 ${actualCount} 条`);
      clearSelection();
    }, 0);
  };

  /** 批量删除（多选）：从缓冲池彻底移除选中条目，需二次确认 */
  const handleBatchDelete = () => {
    if (selectedCount === 0) { MessagePlugin.warning("请先勾选事实条目"); return; }
    const ids = selectedFactIds;
    const dlg = DialogPlugin.confirm({
      header: "批量删除",
      body: `确认从缓冲池删除选中的 ${selectedCount} 条事实？删除后不可恢复，建议优先使用「批量拒绝」留存记录。`,
      theme: "danger",
      confirmBtn: { content: `删除 ${selectedCount} 条`, theme: "danger" },
      onConfirm: () => {
        setBatches((prev) =>
          prev.map((b) => ({ ...b, facts: b.facts.filter((f) => !ids.has(f.factId)) }))
              .filter((b) => b.facts.length > 0)
        );
        MessagePlugin.success(`已删除 ${selectedCount} 条`);
        clearSelection();
        dlg.destroy();
      },
      onCancel: () => dlg.destroy(),
    });
  };

  /** 导出 CSV：必须完整勾选批次；导出完整批次内全部三态事实，不附带审核人/时间字段 */
  const handleExport = () => {
    if (selectedCount === 0) { MessagePlugin.warning("请先勾选事实条目"); return; }

    const involvedBatches = batches.filter((b) => b.facts.some((f) => selectedFactIds.has(f.factId)));
    if (involvedBatches.length === 0) return;

    // 校验：每个涉及批次必须完整选中，不允许导出批次的一部分
    const hasPartialBatch = involvedBatches.some((b) => !b.facts.every((f) => selectedFactIds.has(f.factId)));
    if (hasPartialBatch) {
      MessagePlugin.warning("只允许导出整个批次的数据");
      return;
    }

    // 收集完整批次内全部事实
    const selectedRows: Array<{ batch: ExtractBatch; fact: ExtractedFact }> = [];
    involvedBatches.forEach((b) => b.facts.forEach((f) => selectedRows.push({ batch: b, fact: f })));

    // 校验：所有"保留"的新建议实体/事件必须已拿到正式 ID
    const unconfirmed = selectedRows.filter(({ fact }) =>
      fact.newEntities.some((e) => e.decision === "keep" && !e.reservedEntityId) ||
      fact.newEvents.some((e) => e.decision === "keep" && !e.reservedEventId)
    );
    if (unconfirmed.length > 0) {
      MessagePlugin.warning({
        content: `${unconfirmed.length} 条事实存在尚未确认的新建议实体/事件，请先在审核区确认后再导出`,
        duration: 4000,
      });
      return;
    }

    // 状态分组统计（仅作信息展示，全部导出）
    const cntByStatus = selectedRows.reduce<Record<string, number>>((a, { fact }) => {
      a[fact.status] = (a[fact.status] || 0) + 1; return a;
    }, {});
    const involvedBatchIds = new Set(involvedBatches.map((b) => b.batchId));

    const dlg = DialogPlugin.confirm({
      header: "导出 CSV",
      body: (
        <div style={{ fontSize: 13, lineHeight: 1.8 }}>
          <div>将导出 <strong>{involvedBatches.length}</strong> 个完整批次共 <strong>{selectedRows.length}</strong> 条事实：</div>
          <div style={{ margin: "6px 0 10px", paddingLeft: 8 }}>
            {cntByStatus["已审核"] > 0 && <div>✅ 已通过（approved）<strong style={{ color: "var(--td-success-color)" }}>{cntByStatus["已审核"]}</strong> 条</div>}
            {cntByStatus["待审核"] > 0 && <div>⏳ 待审核（pending）<strong style={{ color: "var(--td-warning-color)" }}>{cntByStatus["待审核"]}</strong> 条</div>}
            {cntByStatus["已拒绝"] > 0 && <div>✗ 已拒绝（deleted）<strong style={{ color: "var(--td-text-color-placeholder)" }}>{cntByStatus["已拒绝"]}</strong> 条</div>}
          </div>
          <div style={{ color: "var(--td-text-color-secondary)", fontSize: 12 }}>
            导出完整批次内全部事实（含待审核/已审核/已拒绝三态）。<br />
            多个完整批次会合并为一份 CSV，不额外增加 batch_id。<br />
            导出后这些批次将自动归档。
          </div>
        </div>
      ) as any,
      theme: "info",
      confirmBtn: { content: "确认导出", theme: "primary" },
      cancelBtn: { content: "取消", variant: "outline" },
      onConfirm: () => {
        const filename = exportFactsToCSV(selectedRows);
        const now = nowStr();
        setBatches((prev) => prev.map((b) => {
          if (!involvedBatchIds.has(b.batchId)) return b;
          return {
            ...b,
            archived: true,
            archiveReason: "exported",
            archivedAt: now,
            archivedBy: CURRENT_USER,
            exportedAt: now,
            facts: b.facts.map((f) => ({ ...f, logs: [...f.logs, mkLog("编辑", `导出 CSV（${filename}）`)] })),
          };
        }));
        MessagePlugin.success(`已导出 ${selectedRows.length} 条事实，${involvedBatchIds.size} 个批次已归档`);
        clearSelection();
        dlg.destroy();
      },
      onCancel: () => dlg.destroy(),
    });
  };

  /** 取消归档：把已归档批次恢复为待处理 */
  const handleUnarchive = (batchId: string) => {
    const dlg = DialogPlugin.confirm({
      header: "恢复为待处理",
      body: "该批次将从「已归档」恢复到「待处理」区，可继续审核操作。\n操作日志会保留归档历史。",
      theme: "warning",
      confirmBtn: { content: "确认恢复", theme: "primary" },
      onConfirm: () => {
        setBatches((prev) => prev.map((b) => {
          if (b.batchId !== batchId) return b;
          return {
            ...b,
            archived: false,
            archiveReason: undefined,
            archivedAt: undefined,
            archivedBy: undefined,
            facts: b.facts.map((f) => ({ ...f, logs: [...f.logs, mkLog("撤回", "从已归档恢复为待处理")] })),
          };
        }));
        MessagePlugin.success("已恢复到待处理区");
        dlg.destroy();
      },
      onCancel: () => dlg.destroy(),
    });
  };

  /** 手动归档：把待处理批次主动归档（需所有条目都已标注） */
  const handleManualArchive = (batchId: string) => {
    const target = batches.find((b) => b.batchId === batchId);
    if (!target) return;
    const hasPending = target.facts.some((f) => f.status === "待审核");
    if (hasPending) {
      MessagePlugin.warning("批次内仍有待审核条目，请先处理完再归档");
      return;
    }
    const dlg = DialogPlugin.confirm({
      header: "归档批次",
      body: "将该批次移入「已归档」区。可随时取消归档恢复。",
      theme: "info",
      confirmBtn: { content: "确认归档", theme: "primary" },
      onConfirm: () => {
        const now = nowStr();
        setBatches((prev) => prev.map((b) => {
          if (b.batchId !== batchId) return b;
          return {
            ...b,
            archived: true,
            archiveReason: "manual",
            archivedAt: now,
            archivedBy: CURRENT_USER,
          };
        }));
        MessagePlugin.success("已归档");
        dlg.destroy();
      },
      onCancel: () => dlg.destroy(),
    });
  };


  return (
    <div className="factdb-tab-content" style={{ display: "flex", gap: 0, alignItems: "flex-start" }}>

      {/* ── 左侧：提取输入（flex:3，可收起）── */}
      <div style={{
        flex: leftCollapsed ? 0 : 3,
        minWidth: leftCollapsed ? 0 : undefined,
        overflow: leftCollapsed ? "hidden" : undefined,
        width: leftCollapsed ? 0 : undefined,
        transition: "flex .2s, width .2s",
        display: "flex", flexDirection: "column", gap: 0,
        paddingRight: leftCollapsed ? 0 : 16,
      }}>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>事实提取</div>

        {/* 输入方式切换 */}
        <Radio.Group
          value={inputMode}
          onChange={(v) => setInputMode(v as "text" | "file")}
          variant="default-filled"
          size="medium"
          style={{ marginBottom: 12, alignSelf: "flex-start" }}
        >
          <Radio.Button value="text">📝 文本粘贴</Radio.Button>
          <Radio.Button value="file">📎 文件导入</Radio.Button>
        </Radio.Group>

        {/* —— 模式 1：文本粘贴 —— */}
        {inputMode === "text" && (
          <>
            <Textarea
              placeholder="粘贴要提取事实的文本内容…"
              value={text}
              onChange={(v) => setText(v)}
              autosize={{ minRows: 12 }}
            />

            {/* 配置区紧贴文本框下方 */}
            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
              <div>
                <div style={{ fontSize: 12, color: "var(--td-text-color-secondary)", marginBottom: 5 }}>提取模式</div>
                <Radio.Group value={mode} onChange={(v) => setMode(v as string)}>
                  <Radio value="single">
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                      单段提取
                      <Tooltip content="将整段文本提取为一条事实">
                        <HelpCircleIcon style={{ color: "var(--td-text-color-placeholder)", fontSize: 14, cursor: "pointer" }} />
                      </Tooltip>
                    </span>
                  </Radio>
                  <Radio value="multi" style={{ marginLeft: 16 }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                      多段提取
                      <Tooltip content="自动拆分为多条事实，每条独立审核">
                        <HelpCircleIcon style={{ color: "var(--td-text-color-placeholder)", fontSize: 14, cursor: "pointer" }} />
                      </Tooltip>
                    </span>
                  </Radio>
                </Radio.Group>
              </div>

              {/* 提取语种选择 */}
              <div>
                <div style={{ fontSize: 12, color: "var(--td-text-color-secondary)", marginBottom: 5 }}>
                  提取语种
                  <Tooltip content="选择源文本的语种。冲突/重复检测、实体/事件匹配均查询对应语种库，审核通过后写入该语种的 i18n 字段">
                    <HelpCircleIcon style={{ color: "var(--td-text-color-placeholder)", fontSize: 14, cursor: "pointer", marginLeft: 4 }} />
                  </Tooltip>
                </div>
                <Select
                  value={extractLang}
                  onChange={(v) => setExtractLang(v as LangCode)}
                  options={LANG_OPTIONS.map((o) => ({ label: o.label, value: o.code }))}
                  style={{ width: 200 }}
                />
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <Button theme="primary" loading={loading} onClick={handleExtract} style={{ flexShrink: 0 }}>
                  提取事实
                </Button>
              </div>
              {loading && (
                <div style={{ fontSize: 12, color: "var(--td-brand-color)", display: "flex", alignItems: "center", gap: 6 }}>
                  <Loading size="small" /> 提取中，结果将出现在右侧审核区…
                </div>
              )}
            </div>
          </>
        )}

        {/* —— 模式 2：文件导入 —— */}
        {inputMode === "file" && (
          <FileImportPanel
            file={file}
            parseStatus={parseStatus}
            parseError={parseError}
            segments={segments}
            loading={loading}
            model={model}
            setModel={setModel}
            setSegments={setSegments}
            onFileSelect={handleFileSelect}
            onExtract={handleFileExtract}
            onReset={handleFileReset}
          />
        )}
      </div>

      {/* 分割条（可点击收起/展开左侧） */}
      <div style={{
        width: 14,
        flexShrink: 0,
        alignSelf: "stretch",
        display: "flex",
        alignItems: "center",
        justifyContent: leftCollapsed ? "flex-start" : "flex-end",
        margin: "0 10px",
        position: "relative",
      }}>
        {/* 细线：贴合小条直角边，收起时渐隐 */}
        <div style={{
          position: "absolute",
          top: 0, bottom: 0,
          [leftCollapsed ? "left" : "right"]: 0,
          width: 0.5,
          background: "rgba(0,0,0,0.08)",
          opacity: leftCollapsed ? 0 : 1,
          transition: "opacity .2s",
        }} />
        {/* 小条按钮 */}
        <div
          onClick={() => setLeftCollapsed(!leftCollapsed)}
          style={{
            position: "relative", zIndex: 1,
            width: 14, height: 48,
            background: "var(--td-bg-color-secondarycontainer)",
            borderRadius: leftCollapsed ? "0 6px 6px 0" : "6px 0 0 6px",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer",
            transition: "background .15s",
          }}
          onMouseEnter={e => (e.currentTarget.style.background = "var(--td-bg-color-component)")}
          onMouseLeave={e => (e.currentTarget.style.background = "var(--td-bg-color-secondarycontainer)")}
        >
          <span style={{ fontSize: 13, color: "var(--td-text-color-placeholder)", lineHeight: 1, userSelect: "none" }}>
            {leftCollapsed ? "›" : "‹"}
          </span>
        </div>
      </div>

      {/* ── 右侧：提取结果审核区 ── */}
      <div style={{ flex: 7, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* 顶部：标题 + 帮助 + 提取人筛选 */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, flexShrink: 0, flexWrap: "wrap", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 15, fontWeight: 600 }}>提取结果审核</span>
            <Tooltip
              placement="bottom-left"
              overlayStyle={{ maxWidth: 420 }}
              content={
                <div style={{ fontSize: 12, lineHeight: 1.6 }}>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>使用说明</div>
                  <div style={{ marginBottom: 6, opacity: 0.85 }}>
                    AI 提取的事实先进入「待处理」区暂存，审核完毕后批量入库或导出 CSV。所有人共享可见。
                  </div>
                  <div style={{ fontWeight: 500, marginTop: 6 }}>使用步骤：</div>
                  <ol style={{ margin: "4px 0 0 18px", padding: 0 }}>
                    <li>左侧粘贴文本或上传文件，选择提取模式后点「提取事实」</li>
                    <li>右侧「待处理」区按批次查看提取结果，逐条核对内容、关联实体/事件、冲突/重复</li>
                    <li>可单条「通过/拒绝/撤回」，也可勾选多条批量操作；已标注的条目不会被批量动作覆盖</li>
                    <li>「整批通过/拒绝」处理批次内的全部条目；若已有部分审核，按钮变为「剩余全部通过/拒绝」，已标注的不变</li>
                    <li><strong>入库规则：</strong>批次内全部条目已标注（无待审核）才能入库，否则点击会被 toast 拦截；已审核入事实库、已拒绝留痕，批次随即归档（committed）。已入库的批次不可恢复</li>
                    <li><strong>导出规则：</strong>导出 = 数据快照，选什么导什么（含 status 字段）。批次全部标注完毕时一并归档（exported），可"恢复审核"返回待处理区；仍有待审核条目则不归档</li>
                    <li>「已归档」区可查历史，已拒绝条目默认隐藏可切换显示</li>
                  </ol>
                </div>
              }
            >
              <HelpCircleIcon style={{ color: "var(--td-text-color-placeholder)", fontSize: 16, cursor: "help" }} />
            </Tooltip>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Radio.Group value={scope} onChange={(v) => setScope(v as "all" | "mine")} variant="default-filled" size="small">
              <Radio.Button value="all">全部</Radio.Button>
              <Radio.Button value="mine">只看自己的</Radio.Button>
            </Radio.Group>
          </div>
        </div>

        {/* 顶级 Tab：待处理 / 已归档 */}
        <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 10, borderBottom: "1px solid var(--td-component-stroke)", flexShrink: 0 }}>
          <button
            onClick={() => setView("pending")}
            style={{
              padding: "8px 16px",
              border: "none",
              background: "transparent",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: view === "pending" ? 600 : 400,
              color: view === "pending" ? "var(--td-brand-color)" : "var(--td-text-color-secondary)",
              borderBottom: `2px solid ${view === "pending" ? "var(--td-brand-color)" : "transparent"}`,
              marginBottom: -1,
            }}
          >
            待处理 <span style={{ fontWeight: 400, marginLeft: 4 }}>({pendingPoolCount})</span>
          </button>
          <button
            onClick={() => setView("archived")}
            style={{
              padding: "8px 16px",
              border: "none",
              background: "transparent",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: view === "archived" ? 600 : 400,
              color: view === "archived" ? "var(--td-brand-color)" : "var(--td-text-color-secondary)",
              borderBottom: `2px solid ${view === "archived" ? "var(--td-brand-color)" : "transparent"}`,
              marginBottom: -1,
            }}
          >
            已归档 <span style={{ fontWeight: 400, marginLeft: 4 }}>({archivedPoolCount})</span>
          </button>
          <span style={{ flex: 1 }} />
          {/* 当前视图统计 */}
          {view === "pending" && totalCount > 0 && (
            <span style={{ fontSize: 12, color: "var(--td-text-color-secondary)", paddingBottom: 8 }}>
              共 <strong>{totalCount}</strong> 条 · 待审核 <strong style={{ color: "var(--td-warning-color)" }}>{pendingCount}</strong> · 已审核 <strong style={{ color: "var(--td-brand-color)" }}>{approvedCount}</strong>
            </span>
          )}
        </div>

        {/* 操作栏：未多选时显示全选入口 + 说明；多选时变为批量操作条 */}
        {view === "pending" && visibleBatches.length > 0 && (
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "7px 12px",
            background: selectedCount > 0 ? "rgba(0,82,217,0.06)" : "var(--td-bg-color-secondarycontainer)",
            border: `1px solid ${selectedCount > 0 ? "rgba(0,82,217,0.2)" : "var(--td-component-stroke)"}`,
            borderRadius: 6,
            marginBottom: 10,
            flexShrink: 0,
            flexWrap: "wrap",
            transition: "background .15s, border-color .15s",
          }}>
            {/* 全选 Checkbox */}
            <Checkbox
              checked={allVisibleSelected}
              indeterminate={someVisibleSelected && !allVisibleSelected}
              onChange={toggleSelectAll}
            />
            {selectedCount === 0 ? (
              // 未多选：提示说明
              <span style={{ fontSize: 12, color: "var(--td-text-color-placeholder)" }}>
                勾选多个条目或批次头进行批量操作
              </span>
            ) : (
              // 多选中：显示数量 + 操作按钮
              <>
                <span style={{ fontSize: 13, color: "var(--td-text-color-primary)" }}>
                  已选 <strong style={{ color: "var(--td-brand-color)" }}>{selectedCount}</strong> 条
                </span>
                <span style={{ width: 1, height: 14, background: "var(--td-component-stroke)" }} />
                <Button size="small" theme="success" variant="outline" icon={<CheckIcon />} onClick={handleBatchApprove}>批量通过</Button>
                <Button size="small" theme="danger"  variant="outline" icon={<CloseIcon />} onClick={handleBatchReject}>批量拒绝</Button>
                <Button size="small" theme="primary" variant="outline" icon={<AttachIcon />} onClick={handleExport}>导出 CSV</Button>
                <span style={{ width: 1, height: 14, background: "var(--td-component-stroke)" }} />
                <Button size="small" variant="outline" theme="danger" onClick={handleBatchDelete}>批量删除</Button>
              </>
            )}
            <span style={{ flex: 1 }} />
            {selectedCount > 0 && (
              <Button size="small" variant="text" onClick={clearSelection}>清空选择</Button>
            )}
          </div>
        )}

        {/* 顶部右侧固定操作（在操作栏之外仍可见） */}
        {view === "pending" && commitableCount > 0 && selectedCount === 0 && (
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10, flexShrink: 0 }}>
            <Tooltip content={`当前有已完全审核的批次可入库（共 ${commitableCount} 条已审核事实）`}>
              <Button theme="primary" size="small" onClick={handleCommitAll}>
                入库 / 归档已完全审核批次
              </Button>
            </Tooltip>
          </div>
        )}

        {/* 批次列表 */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {visibleBatches.length === 0 ? (
            <div style={{ padding: "48px 0", textAlign: "center", color: "var(--td-text-color-placeholder)", fontSize: 13 }}>
              {view === "archived"
                ? "暂无已归档批次"
                : (batches.length === 0
                  ? "暂无审核数据，请在左侧输入文本或上传文件后提取"
                  : "当前筛选下暂无数据，可切换为「全部」查看其他人的提取结果")}
            </div>
          ) : (
            visibleBatches.map((batch) => (
              <BatchCard
                key={batch.batchId}
                batch={batch}
                setBatches={setBatches}
                selectedFactIds={selectedFactIds}
                hasAnySelection={selectedCount > 0}
                onToggleSelect={toggleSelectFact}
                onToggleBatch={toggleSelectBatch}
                onUnarchive={handleUnarchive}
              />
            ))
          )}
        </div>
      </div>

    </div>
  );
}

// ─── 批次卡片 ──────────────────────────────────────────────────────────────────
function BatchCard({
  batch,
  setBatches,
  selectedFactIds,
  hasAnySelection,
  onToggleSelect,
  onToggleBatch,
  onUnarchive,
}: {
  batch: ExtractBatch;
  setBatches: React.Dispatch<React.SetStateAction<ExtractBatch[]>>;
  selectedFactIds: Set<string>;
  /** 全局是否有任何条目被选中（控制所有批次的批量操作按钮显隐） */
  hasAnySelection: boolean;
  onToggleSelect: (factId: string) => void;
  onToggleBatch: (batch: ExtractBatch) => void;
  onUnarchive: (batchId: string) => void;
}) {
  const [sourceVisible, setSourceVisible] = useState(false);
  /** 已归档批次默认隐藏「已拒绝」条目（数据保留为训练资产，但视觉清爽） */
  const [showRejectedInArchive, setShowRejectedInArchive] = useState(false);
  const pending  = batch.facts.filter((f) => f.status === "待审核").length;
  const approved = batch.facts.filter((f) => f.status === "已审核").length;
  const rejected = batch.facts.filter((f) => f.status === "已拒绝").length;
  const isArchived = batch.archived;
  const archiveLabel = batch.archiveReason === "exported" ? "已导出"
    : batch.archiveReason === "committed" ? "已入库"
    : "已归档";
  /** 该批次是否有任何条目被多选 */
  const batchHasSelection = batch.facts.some((f) => selectedFactIds.has(f.factId));
  /** 进度条比例：审核完毕（通过+拒绝）/ 总数 */
  const total = batch.facts.length;
  const reviewed = approved + rejected;
  const progressPct = total === 0 ? 0 : Math.round((reviewed / total) * 100);
  /** 是否全部审核完毕（可入库/归档） */
  const fullyReviewed = !isArchived && total > 0 && pending === 0;

  /** 单批次导出 CSV：把整个批次的 fact 一次性导出，主要给已归档批次提供独立导出入口 */
  const handleExportThisBatch = () => {
    const rows = batch.facts.map((f) => ({ batch, fact: f }));
    if (rows.length === 0) { MessagePlugin.warning("批次内无事实可导出"); return; }
    const filename = exportFactsToCSV(rows, `_${batch.batchId}`);
    setBatches((prev) => prev.map((b) => b.batchId !== batch.batchId ? b : {
      ...b,
      exportedAt: nowStr(),
      facts: b.facts.map((f) => ({ ...f, logs: [...f.logs, mkLog("编辑", `导出此批次为 CSV（${filename}）`)] })),
    }));
    MessagePlugin.success(`已导出批次 ${batch.batchId}（${rows.length} 条事实）`);
  };

  /** 入库/归档此批次：将「已审核」入事实库，批次归档（archiveReason=committed） */
  const handleCommitBatch = () => {
    if (!fullyReviewed) return;
    const approvedInBatch = batch.facts.filter((f) => f.status === "已审核").length;
    const rejectedInBatch = batch.facts.filter((f) => f.status === "已拒绝").length;
    const dlg = DialogPlugin.confirm({
      header: "入库 / 归档此批次",
      body: (
        <div style={{ fontSize: 13, lineHeight: 1.8 }}>
          <div>批次 <strong>{batch.batchId}</strong> 全部 {total} 条事实已标注完毕：</div>
          <div style={{ paddingLeft: 8, marginTop: 4 }}>
            <div>✅ 已审核 <strong style={{ color: "var(--td-success-color)" }}>{approvedInBatch}</strong> 条 → 入事实库</div>
            {rejectedInBatch > 0 && <div>✗ 已拒绝 <strong style={{ color: "var(--td-text-color-placeholder)" }}>{rejectedInBatch}</strong> 条 → 留痕不入库</div>}
          </div>
          <div style={{ marginTop: 6, color: "var(--td-text-color-secondary)", fontSize: 12 }}>
            执行后批次自动归档到「已归档」区，可随时查看历史。
          </div>
        </div>
      ) as any,
      theme: "warning",
      confirmBtn: { content: "确认入库", theme: "primary" },
      cancelBtn: { content: "取消", variant: "outline" },
      onConfirm: () => {
        const now = nowStr();
        setBatches((prev) => prev.map((b) => {
          if (b.batchId !== batch.batchId) return b;
          return {
            ...b,
            archived: true,
            archiveReason: "committed",
            archivedAt: now,
            archivedBy: CURRENT_USER,
            facts: b.facts.map((f) => f.status === "已审核"
              ? { ...f, logs: [...f.logs, mkLog("通过", "入库 → 事实库（已审核）")] }
              : f),
          };
        }));
        MessagePlugin.success(`${approvedInBatch} 条事实已入库，批次已归档`);
        dlg.destroy();
      },
      onCancel: () => dlg.destroy(),
    });
  };

  const toggle = () => setBatches((prev) => prev.map((b) => b.batchId === batch.batchId ? { ...b, expanded: !b.expanded } : b));

  /** 更新单条事实，可附带日志（追加到 logs 末尾） */
  const updateFact = (factId: string, patch: Partial<ExtractedFact>, log?: BufferLog) => {
    setBatches((prev) => prev.map((b) =>
      b.batchId !== batch.batchId ? b : {
        ...b,
        facts: b.facts.map((f) => f.factId === factId
          ? { ...f, ...patch, logs: log ? [...f.logs, log] : f.logs }
          : f),
      }
    ));
  };

  const deleteFact = (factId: string) => {
    const dlg = DialogPlugin.confirm({
      header: "删除确认", body: "确认从缓冲池删除此条事实？", theme: "danger",
      confirmBtn: { content: "删除", theme: "danger" },
      onConfirm: () => {
        setBatches((prev) => prev.map((b) => b.batchId !== batch.batchId ? b : { ...b, facts: b.facts.filter((f) => f.factId !== factId) }).filter((b) => b.facts.length > 0));
        dlg.destroy();
      },
      onCancel: () => dlg.destroy(),
    });
  };

  const handleBatchApprove = () => {
    if (pending === 0) {
      MessagePlugin.warning("批次内已无待审核条目");
      return;
    }
    setBatches((prev) => prev.map((b) =>
      b.batchId !== batch.batchId ? b : {
        ...b,
        facts: b.facts.map((f) => f.status === "待审核"
          ? { ...f, status: "已审核", logs: [...f.logs, mkLog("通过", `整批通过（剩余 ${pending} 条待审核）`)] }
          : f),
      }
    ));
    MessagePlugin.success(`已通过 ${pending} 条剩余待审核（已标注的不变）`);
  };

  const handleBatchReject = () => {
    const dlg = DialogPlugin.confirm({
      header: "拒绝整批", body: `确认拒绝此批次全部 ${pending} 条待审核事实？`, theme: "danger",
      confirmBtn: { content: "确认拒绝", theme: "danger" },
      onConfirm: () => {
        setBatches((prev) => prev.map((b) =>
          b.batchId !== batch.batchId ? b : {
            ...b,
            facts: b.facts.map((f) => f.status === "待审核"
              ? { ...f, status: "已拒绝", logs: [...f.logs, mkLog("拒绝", "整批拒绝（批量操作）")] }
              : f),
          }
        ));
        dlg.destroy();
      },
      onCancel: () => dlg.destroy(),
    });
  };

  const handleDeleteBatch = () => {
    const approvedInBatch = batch.facts.filter((f) => f.status === "已审核").length;
    const hasApproved = approvedInBatch > 0 && !batch.archived;
    const dlg = DialogPlugin.confirm({
      header: "删除批次",
      body: hasApproved ? (
        <div style={{ fontSize: 13, lineHeight: 1.8 }}>
          <div style={{ color: "var(--td-error-color)", fontWeight: 500 }}>
            ⚠️ 此批次内有 {approvedInBatch} 条「已审核」事实尚未入库
          </div>
          <div style={{ marginTop: 6 }}>删除后这些已审核内容将一并丢失，无法恢复。</div>
          <div style={{ marginTop: 4, color: "var(--td-text-color-secondary)", fontSize: 12 }}>
            建议先完成剩余条目的审核并入库后，再删除批次。
          </div>
          <div style={{ marginTop: 6 }}>确认删除该批次全部 {batch.facts.length} 条事实？</div>
        </div>
      ) as any : `确认删除此批次全部 ${batch.facts.length} 条事实？`,
      theme: "danger",
      confirmBtn: { content: hasApproved ? "仍要删除" : "删除", theme: "danger" },
      onConfirm: () => { setBatches((prev) => prev.filter((b) => b.batchId !== batch.batchId)); dlg.destroy(); },
      onCancel: () => dlg.destroy(),
    });
  };

  return (
    <div style={{ border: "1px solid var(--td-component-stroke)", borderRadius: 8, overflow: "hidden", background: "#fff" }}>
      {/* 批次头 */}
      <div
        style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "var(--td-bg-color-secondarycontainer)", cursor: "pointer", userSelect: "none" }}
        onClick={toggle}
      >
        {/* 整批多选 Checkbox（仅待处理批次显示） */}
        {!isArchived && (
          <Checkbox
            checked={batch.facts.length > 0 && batch.facts.every((f) => selectedFactIds.has(f.factId))}
            indeterminate={batch.facts.some((f) => selectedFactIds.has(f.factId)) && !batch.facts.every((f) => selectedFactIds.has(f.factId))}
            onChange={() => onToggleBatch(batch)}
            onClick={(ctx) => ctx?.e?.stopPropagation?.()}
            style={{ flexShrink: 0 }}
          />
        )}
        {batch.expanded ? <ChevronDownIcon style={{ flexShrink: 0 }} /> : <ChevronRightIcon style={{ flexShrink: 0 }} />}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
            <Tooltip content={`点击复制批次编号「${batch.batchId}」`}>
              <Tag
                theme="primary"
                variant="outline"
                size="small"
                style={{ flexShrink: 0, fontFamily: "var(--td-font-family-mono, monospace)", cursor: "pointer", letterSpacing: 0.3 }}
                onClick={(ctx) => {
                  ctx.e.stopPropagation();
                  navigator.clipboard?.writeText(batch.batchId).then(
                    () => MessagePlugin.success(`已复制：${batch.batchId}`),
                    () => MessagePlugin.warning("复制失败，请手动复制"),
                  );
                }}
              >
                {batch.batchId}
              </Tag>
            </Tooltip>
            <span style={{ fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0 }}>{batch.batchLabel}</span>
          </div>
          <div style={{ fontSize: 11, color: "var(--td-text-color-placeholder)" }}>
            {batch.extractedAt} · 提取人：<span style={{ color: batch.extractor === CURRENT_USER ? "var(--td-brand-color)" : "var(--td-text-color-secondary)" }}>{batch.extractor}{batch.extractor === CURRENT_USER ? "（我）" : ""}</span> · {batch.model} · {batch.mode} · <Tag theme={batch.extractLang === "zh" ? "default" : "primary"} variant="light" size="small">{LANG_OPTIONS.find((l) => l.code === batch.extractLang)?.label || batch.extractLang}</Tag> · 共 {batch.facts.length} 条
          </div>
          {/* 导出记录 */}
          {batch.archiveReason === "exported" && batch.exportedAt && (
            <div style={{ fontSize: 11, color: "var(--td-text-color-placeholder)", marginTop: 1 }}>
              📎 导出于 {batch.exportedAt}{batch.archivedBy ? <span> · 由 <span style={{ color: batch.archivedBy === CURRENT_USER ? "var(--td-brand-color)" : "var(--td-text-color-secondary)" }}>{batch.archivedBy.replace(/\(.*?\)/, "").trim() || batch.archivedBy}</span> 操作</span> : ""}
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 5, alignItems: "center", flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
          {isArchived && (
            <Tag theme="success" variant="light" size="small">
              {batch.archiveReason === "exported" ? "📎 已导出" : batch.archiveReason === "committed" ? "📥 已入库" : "📁 已归档"}
            </Tag>
          )}
          {pending  > 0 && <Tag theme="warning" variant="light" size="small">待审核 {pending}</Tag>}
          {approved > 0 && <Tag theme="primary" variant="light" size="small">已审核 {approved}</Tag>}
          {rejected > 0 && <Tag theme="default" variant="light" size="small">已拒绝 {rejected}</Tag>}
          <Button variant="text" size="small" onClick={(e) => { e.stopPropagation(); setSourceVisible(!sourceVisible); }}>
            {sourceVisible
              ? "收起"
              : batch.mode === "文件解析" ? "查看来源内容" : "查看原文"}
          </Button>
          {/* 全局无多选时显示整批操作；有任何多选时统一走顶部批量操作栏 */}
          {!isArchived && !hasAnySelection && pending > 0 && (() => {
            const hasReviewed = approved + rejected > 0;
            const approveLabel = hasReviewed ? "剩余全部通过" : "整批通过";
            const rejectLabel  = hasReviewed ? "剩余全部拒绝" : "整批拒绝";
            const approveTip   = hasReviewed
              ? `把剩余 ${pending} 条待审核条目改为已审核（已标注的不变）`
              : `把当前批次 ${pending} 条全部改为已审核`;
            const rejectTip    = hasReviewed
              ? `把剩余 ${pending} 条待审核条目改为已拒绝（已标注的不变）`
              : `把当前批次 ${pending} 条全部改为已拒绝`;
            return (
              <>
                <Tooltip content={approveTip}>
                  <Button variant="outline" size="small" theme="primary" style={{ minWidth: 96 }} onClick={(e) => { e.stopPropagation(); handleBatchApprove(); }}>
                    {approveLabel}
                  </Button>
                </Tooltip>
                <Tooltip content={rejectTip}>
                  <Button variant="outline" size="small" theme="danger" style={{ minWidth: 96 }} onClick={(e) => { e.stopPropagation(); handleBatchReject(); }}>{rejectLabel}</Button>
                </Tooltip>
              </>
            );
          })()}
          {/* 全部审核完毕：入库/归档此批次（替代整批通过/拒绝） */}
          {fullyReviewed && !hasAnySelection && (
            <Tooltip content={`入库本批次 ${approved} 条已审核事实，并归档此批次`}>
              <Button variant="outline" size="small" theme="success" onClick={(e) => { e.stopPropagation(); handleCommitBatch(); }}>
                入库 / 归档批次
              </Button>
            </Tooltip>
          )}
          {/* 已归档批次：committed 不可取消（已入库，缓冲池只读快照）；exported 允许取消归档恢复审核 */}
          {isArchived && (
            <Tooltip content={`导出此批次（${batch.facts.length} 条）为 CSV 快照`}>
              <Button variant="text" size="small" theme="primary" icon={<AttachIcon />} onClick={(e) => { e.stopPropagation(); handleExportThisBatch(); }}>
                导出
              </Button>
            </Tooltip>
          )}
          {isArchived && batch.archiveReason === "committed" && (
            <Tooltip content={`此批次已入库到事实库${batch.archivedAt ? `（${batch.archivedAt}）` : ""}，缓冲池保留只读快照，如需修改请到事实库操作`}>
              <Tag theme="success" variant="light" size="small" style={{ cursor: "default" }}>
                🔒 已入库不可恢复
              </Tag>
            </Tooltip>
          )}
          {isArchived && batch.archiveReason !== "committed" && (
            <Tooltip content={`归档原因：${archiveLabel}${batch.archivedAt ? ` · ${batch.archivedAt}` : ""}；外部审核如有变故可恢复重审`}>
              <Button variant="outline" size="small" theme="warning" onClick={(e) => { e.stopPropagation(); onUnarchive(batch.batchId); }}>恢复审核</Button>
            </Tooltip>
          )}
          {/* 全局无多选时显示删除批次（× 图标） */}
          {!hasAnySelection && (
            <Tooltip content="删除整个批次">
              <Button
                variant="text"
                size="small"
                theme="danger"
                shape="square"
                icon={<CloseIcon />}
                onClick={(e) => { e.stopPropagation(); handleDeleteBatch(); }}
              />
            </Tooltip>
          )}
        </div>
      </div>

      {/* 批次头底部审核进度条（仅非归档批次，紧贴批次头） */}
      {!isArchived && total > 0 && (
        <Tooltip content={fullyReviewed
          ? `已全部审核（${approved} 通过 / ${rejected} 拒绝）`
          : `审核进度 ${reviewed} / ${total}（待审核 ${pending}）`}>
          <div style={{
            height: 2,
            width: "100%",
            background: "var(--td-bg-color-component-disabled)",
            position: "relative",
            cursor: "default",
          }}>
            <div style={{
              height: "100%",
              width: `${progressPct}%`,
              background: fullyReviewed ? "var(--td-success-color)" : "var(--td-brand-color)",
              transition: "width .25s, background .25s",
            }} />
          </div>
        </Tooltip>
      )}

      {/* 原文 */}
      {sourceVisible && (
        <div style={{ padding: "8px 12px", borderBottom: "1px solid var(--td-component-stroke)", background: "#fafafa", fontSize: 12, lineHeight: 1.8, color: "var(--td-text-color-secondary)", whiteSpace: "pre-wrap", maxHeight: 120, overflowY: "auto" }}>
          {batch.sourceText}
        </div>
      )}

      {/* 事实列表（已归档批次默认隐藏「已拒绝」） */}
      {batch.expanded && (() => {
        const visibleFacts = isArchived && !showRejectedInArchive
          ? batch.facts.filter((f) => f.status !== "已拒绝")
          : batch.facts;
        return (
          <>
            {visibleFacts.map((fact, idx) => (
              <FactRow
                key={fact.factId}
                fact={fact}
                index={idx}
                isLast={idx === visibleFacts.length - 1}
                readOnly={isArchived}
                selected={selectedFactIds.has(fact.factId)}
                onToggleSelect={() => onToggleSelect(fact.factId)}
                onApprove={() => updateFact(fact.factId, { status: "已审核" }, mkLog("通过", "审核通过"))}
                onReject={() => updateFact(fact.factId, { status: "已拒绝" }, mkLog("拒绝", "审核拒绝"))}
                onRevoke={() => updateFact(fact.factId, { status: "待审核" }, mkLog("撤回", `从「${fact.status}」撤回到「待审核」`))}
                onDelete={() => deleteFact(fact.factId)}
                onUpdate={(patch, log) => updateFact(fact.factId, patch, log)}
                batchExtractLang={batch.extractLang}
              />
            ))}
            {/* 已归档批次：已拒绝隐藏开关（仅当存在已拒绝条目时显示） */}
            {isArchived && rejected > 0 && (
              <div style={{
                padding: "6px 12px",
                borderTop: "1px solid var(--td-component-stroke)",
                background: "#fafafa",
                fontSize: 11,
                color: "var(--td-text-color-placeholder)",
                display: "flex", alignItems: "center", gap: 6,
              }}>
                <span>{showRejectedInArchive ? `当前显示全部条目（含 ${rejected} 条已拒绝）` : `已隐藏 ${rejected} 条已拒绝条目（数据保留，可作训练资产）`}</span>
                <Button variant="text" size="small" onClick={() => setShowRejectedInArchive(!showRejectedInArchive)}>
                  {showRejectedInArchive ? "隐藏已拒绝" : `显示已拒绝（${rejected}）`}
                </Button>
              </div>
            )}
          </>
        );
      })()}
    </div>
  );
}

// ─── 单条事实行 ───────────────────────────────────────────────────────────────
function FactRow({
  fact, index, isLast, readOnly, selected, onToggleSelect,
  onApprove, onReject, onRevoke, onDelete, onUpdate, batchExtractLang,
}: {
  fact: ExtractedFact;
  index: number;
  isLast: boolean;
  readOnly: boolean;
  selected: boolean;
  onToggleSelect: () => void;
  onApprove: () => void;
  onReject: () => void;
  onRevoke: () => void;
  onDelete: () => void;
  onUpdate: (patch: Partial<ExtractedFact>, log?: BufferLog) => void;
  batchExtractLang?: LangCode;
}) {
  const [editVisible,     setEditVisible]     = useState(false);
  const [conflictVisible, setConflictVisible] = useState(false);
  const [duplicateVisible, setDuplicateVisible] = useState(false);
  const [logVisible,       setLogVisible]       = useState(false);

  const statusTheme: Record<string, "warning" | "primary" | "default"> = {
    "待审核": "warning", "已审核": "primary", "已拒绝": "default",
  };


  return (
    <>
      <div style={{
        display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 12px",
        borderBottom: isLast ? "none" : "1px solid var(--td-component-stroke)",
        overflow: "hidden",
        background: selected ? "rgba(0,82,217,0.05)" : "transparent",
        transition: "background .15s",
      }}>
        {/* 多选框（仅待处理可见）+ 序号 */}
        {!readOnly && (
          <Checkbox checked={selected} onChange={onToggleSelect} style={{ flexShrink: 0, marginTop: 2 }} />
        )}
        <div style={{ width: 20, height: 20, borderRadius: "50%", background: "var(--td-bg-color-component)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "var(--td-text-color-placeholder)", flexShrink: 0, marginTop: 2 }}>
          {index + 1}
        </div>

        {/* 双列内容 */}
        <div style={{ flex: 1, display: "flex", gap: 12, minWidth: 0 }}>
          {/* 左：事实内容（宽） */}
          <div style={{ flex: "1.6", minWidth: 0 }}>
            <div style={{ fontSize: 13, lineHeight: 1.7, color: "var(--td-text-color-primary)", marginBottom: (fact.conflict || fact.duplicate) ? 8 : 0 }}>
              {fact.content}
            </div>
            {/* 冲突 / 重复 Tag */}
            {(fact.conflict || fact.duplicate) && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                {fact.conflict && (
                  <Tooltip content={<span style={{ fontSize: 12, lineHeight: 1.6 }}>{fact.conflict.reason}</span>} placement="top" overlayStyle={{ maxWidth: 360 }}>
                    <Tag
                      theme="danger"
                      variant="light"
                      size="small"
                      icon={<span style={{ fontSize: 12 }}>⚠</span>}
                      style={{ cursor: "pointer" }}
                      onClick={() => setConflictVisible(true)}
                    >
                      冲突事实：[{fact.conflict.factId}]
                    </Tag>
                  </Tooltip>
                )}
                {fact.duplicate && (
                  <Tooltip content={<span style={{ fontSize: 12, lineHeight: 1.6 }}>相似度 {Math.round(fact.duplicate.similarity * 100)}%：{fact.duplicate.factContent.slice(0, 80)}…</span>} placement="top" overlayStyle={{ maxWidth: 360 }}>
                    <Tag
                      theme="warning"
                      variant="light"
                      size="small"
                      icon={<span style={{ fontSize: 12 }}>≈</span>}
                      style={{ cursor: "pointer" }}
                      onClick={() => setDuplicateVisible(true)}
                    >
                      重复事实：[{fact.duplicate.factId}]
                    </Tag>
                  </Tooltip>
                )}
                {(batchExtractLang && batchExtractLang !== "zh") && (
                  <Tag theme="primary" variant="light" size="small">{LANG_OPTIONS.find((l) => l.code === batchExtractLang)?.label}库检测</Tag>
                )}
              </div>
            )}
          </div>

          {/* 右：三段关联信息 */}
          <div style={{ flex: 1, minWidth: 0, fontSize: 12, display: "flex", flexDirection: "column", gap: 8 }}>

            {/* ① 实体匹配 */}
            <div>
              <div style={{ color: "var(--td-text-color-placeholder)", marginBottom: 4, fontWeight: 500 }}>实体匹配</div>
              {fact.entities.length > 0 ? (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: fact.newEntities.length > 0 ? 4 : 0 }}>
                  {fact.entities.map((e) => (
                    <Tag key={e} theme="default" variant="light" size="small" closable
                      onClose={() => onUpdate(
                        { entities: fact.entities.filter((x) => x !== e) },
                        mkLog("编辑", `移除关联实体「${e}」`),
                      )}>
                      {e}
                    </Tag>
                  ))}
                </div>
              ) : (
                <span style={{ color: "var(--td-text-color-placeholder)", fontSize: 11 }}>无匹配实体</span>
              )}
              {fact.newEntities.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 3 }}>
                  {fact.newEntities.map((e, ei) => {
                    const isDiscarded = e.decision === "discard";
                    const tip = [
                      "提取文本中发现的新名词，确认后可入实体库",
                      e.description && `描述：${e.description}`,
                      e.tags.length > 0 && `标签：${e.tags.join(", ")}`,
                    ].filter(Boolean).join("\n");
                    const toggleDecision = () => {
                      if (isDiscarded) {
                        // 恢复 → 分配 reservedEntityId（mock 调 POST /api/entities）
                        const id = e.reservedEntityId || allocReservedEntityId();
                        const updated = fact.newEntities.map((x, j) => j === ei ? { ...x, decision: "keep" as const, reservedEntityId: id } : x);
                        onUpdate(
                          { newEntities: updated },
                          mkLog("实体恢复", `恢复建议新增实体「${e.name}」（entity_id=${id}）`)
                        );
                      } else {
                        // 丢弃 → 清掉 reservedEntityId
                        const updated = fact.newEntities.map((x, j) => j === ei ? { ...x, decision: "discard" as const, reservedEntityId: undefined } : x);
                        onUpdate(
                          { newEntities: updated },
                          mkLog("实体丢弃", `丢弃建议新增实体「${e.name}」`)
                        );
                      }
                    };
                    return (
                      <Tooltip key={e.name + ei} content={isDiscarded ? `已丢弃「${e.name}」，点击 × 可恢复` : tip}>
                        <Tag
                          theme={isDiscarded ? "default" : "warning"}
                          variant="light"
                          size="small"
                          style={{
                            opacity: isDiscarded ? 0.55 : 1,
                            textDecoration: isDiscarded ? "line-through" : "none",
                            cursor: "default",
                          }}
                          closable
                          onClose={(ctx) => {
                            ctx.e.stopPropagation();
                            toggleDecision();
                          }}
                        >
                          建议新增：{e.name}
                          {!isDiscarded && e.tags.length > 0 && <span style={{ marginLeft: 4, color: "var(--td-text-color-placeholder)" }}>· {e.tags.length}标签</span>}
                        </Tag>
                      </Tooltip>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ② 事件匹配 + 冲突 */}
            <div>
              <div style={{ color: "var(--td-text-color-placeholder)", marginBottom: 4, fontWeight: 500 }}>事件匹配</div>

              {/* 关联已有事件 */}
              {fact.events.length > 0 ? (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {fact.events.map((e) => (
                    <Tag key={e} theme="default" variant="light" size="small" closable
                      onClose={() => onUpdate(
                        { events: fact.events.filter((x) => x !== e) },
                        mkLog("编辑", `移除关联事件「${e}」`),
                      )}>
                      {e}
                    </Tag>
                  ))}
                </div>
              ) : (
                <span style={{ color: "var(--td-text-color-placeholder)", fontSize: 11 }}>无关联事件</span>
              )}

              {/* 建议新增事件 */}
              {fact.newEvents.length > 0 && (
                <div style={{ marginTop: 5, display: "flex", flexDirection: "column", gap: 4 }}>
                  {fact.newEvents.map((ne, i) => {
                    const isDiscarded = ne.decision === "discard";
                    return (
                      <div key={i} style={{
                        background: isDiscarded ? "var(--td-bg-color-component-disabled)" : "rgba(255,184,0,0.06)",
                        border: `1px solid ${isDiscarded ? "var(--td-component-stroke)" : "rgba(255,184,0,0.35)"}`,
                        borderRadius: 4, padding: "5px 8px", fontSize: 11,
                        opacity: isDiscarded ? 0.55 : 1,
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 2 }}>
                          <Tag theme="warning" variant="light" size="small" style={{ flexShrink: 0 }}>建议新增事件</Tag>
                          <span style={{ fontWeight: 500, textDecoration: isDiscarded ? "line-through" : "none" }}>{ne.name}</span>
                          <span style={{ color: "var(--td-text-color-placeholder)" }}>· {ne.eventType}</span>
                          <span style={{ flex: 1 }} />
                          {isDiscarded ? (
                            <Button variant="text" size="small" theme="primary" onClick={() => {
                              const id = ne.reservedEventId || allocReservedEventId();
                              const updated = fact.newEvents.map((x, j) => j === i ? { ...x, decision: "keep" as const, reservedEventId: id } : x);
                              onUpdate({ newEvents: updated }, mkLog("事件恢复", `恢复建议新增事件「${ne.name}」（event_id=${id}）`));
                            }}>恢复</Button>
                          ) : (
                            <Button variant="text" size="small" theme="danger" onClick={() => {
                              const updated = fact.newEvents.map((x, j) => j === i ? { ...x, decision: "discard" as const, reservedEventId: undefined } : x);
                              onUpdate({ newEvents: updated }, mkLog("事件丢弃", `丢弃建议新增事件「${ne.name}」`));
                            }}>丢弃</Button>
                          )}
                        </div>
                        <div style={{
                          color: "var(--td-text-color-secondary)",
                          textDecoration: isDiscarded ? "line-through" : "none",
                        }}>
                          {ne.startTime && <span>{ne.startTime.slice(0, 10)} ~ {ne.endTime.slice(0, 10)}　</span>}
                          {ne.description}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ③ 事实有效时间 */}
            {(fact.startTime || fact.endTime || fact.timeDesc) && (
              <div>
                <div style={{ color: "var(--td-text-color-placeholder)", marginBottom: 3, fontWeight: 500 }}>有效时间</div>
                <div style={{ color: "var(--td-text-color-secondary)", fontSize: 11 }}>
                  {fact.startTime && <span>{fact.startTime.slice(0, 10)} ~ {fact.endTime.slice(0, 10)}　</span>}
                  {fact.timeDesc && <span>{fact.timeDesc}</span>}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 操作区 */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
          {/* 状态标签：已审核/已拒绝时显示操作人 */}
          {(() => {
            if (fact.status === "待审核") {
              return <Tag theme="warning" variant="light" size="small">待审核</Tag>;
            }
            const actionLog = [...fact.logs].reverse().find((l) => l.action === "通过" || l.action === "拒绝");
            const operator = actionLog?.operator ?? "";
            const opShort = operator.replace(/\(.*?\)/, "").trim() || operator;
            if (fact.status === "已审核") {
              return (
                <Tooltip content={`审核人：${operator}${actionLog ? ` · ${actionLog.time}` : ""}`}>
                  <Tag theme="primary" variant="light" size="small" style={{ cursor: "default" }}>
                    {opShort ? `已由 ${opShort} 审核` : "已审核"}
                  </Tag>
                </Tooltip>
              );
            }
            if (fact.status === "已拒绝") {
              return (
                <Tooltip content={`拒绝人：${operator}${actionLog ? ` · ${actionLog.time}` : ""}`}>
                  <Tag theme="default" variant="light" size="small" style={{ cursor: "default" }}>
                    {opShort ? `已由 ${opShort} 拒绝` : "已拒绝"}
                  </Tag>
                </Tooltip>
              );
            }
            return <Tag theme={statusTheme[fact.status] || "default"} variant="light" size="small">{fact.status}</Tag>;
          })()}

          {/* 组 1（上）：编辑 / 日志 / 查看 */}
          <Space size={2}>
            {readOnly ? (
              <Tooltip content="查看事实详情（已归档批次只读）">
                <Button variant="text" theme="primary" size="small" onClick={() => setEditVisible(true)}>查看</Button>
              </Tooltip>
            ) : (
              fact.status !== "已拒绝" && (
                <Button variant="text" theme="primary" size="small" onClick={() => setEditVisible(true)}>编辑</Button>
              )
            )}
            <Tooltip content={`查看操作记录（${fact.logs.length}条）`}>
              <Button variant="text" size="small" onClick={() => setLogVisible(true)}>日志</Button>
            </Tooltip>
          </Space>

          {/* 分隔线 */}
          {!readOnly && (
            <div style={{ width: "100%", height: 1, background: "var(--td-component-stroke)" }} />
          )}

          {/* 组 2（下）：审批操作（通过 / 拒绝 / 撤回），竖排 */}
          {!readOnly && (
            <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "stretch" }}>
              {fact.status === "待审核" && <>
                <Button variant="outline" theme="success" size="small" icon={<CheckIcon />} onClick={onApprove} style={{ justifyContent: "center" }}>通过</Button>
                <Button variant="outline" theme="danger"  size="small" icon={<CloseIcon />} onClick={onReject}  style={{ justifyContent: "center" }}>拒绝</Button>
              </>}
              {(fact.status === "已审核" || fact.status === "已拒绝") && (
                <Tooltip content={fact.status === "已审核" ? "撤回到待审核状态" : "撤回到待审核重新判断"}>
                  <Button variant="outline" theme="warning" size="small" onClick={onRevoke} style={{ width: "100%", justifyContent: "center" }}>撤回</Button>
                </Tooltip>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 编辑抽屉（富信息版）*/}
      <FactEditDrawer
        visible={editVisible}
        fact={fact}
        batchExtractLang={batchExtractLang}
        onClose={() => setEditVisible(false)}
        onSave={(patch, summary) => {
          onUpdate(patch, mkLog("编辑", summary || "编辑事实内容"));
          setEditVisible(false);
          MessagePlugin.success("已保存");
        }}
      />

      {/* 冲突事实详情 + 差异对比 */}
      {fact.conflict && (
        <CompareDialog
          visible={conflictVisible}
          onClose={() => setConflictVisible(false)}
          mode="conflict"
          oldFactId={fact.conflict.factId}
          oldContent={fact.conflict.factContent}
          newContent={fact.content}
          extra={fact.conflict.reason}
        />
      )}
      {/* 重复事实详情 + 差异对比 */}
      {fact.duplicate && (
        <CompareDialog
          visible={duplicateVisible}
          onClose={() => setDuplicateVisible(false)}
          mode="duplicate"
          oldFactId={fact.duplicate.factId}
          oldContent={fact.duplicate.factContent}
          newContent={fact.content}
          extra={`相似度 ${Math.round(fact.duplicate.similarity * 100)}%`}
        />
      )}

      {/* 操作日志 */}
      <BufferLogDialog visible={logVisible} onClose={() => setLogVisible(false)} logs={fact.logs} factTitle={fact.content.slice(0, 30) + "…"} />
    </>
  );
}

// ─── 缓冲池事实编辑抽屉（富信息版）─────────────────────────────────────────────
function FactEditDrawer({
  visible, fact, batchExtractLang, onClose, onSave,
}: {
  visible: boolean;
  fact: ExtractedFact;
  /** 所属批次的提取语种，用于冲突/重复检测语种标注 */
  batchExtractLang?: LangCode;
  onClose: () => void;
  onSave: (patch: Partial<ExtractedFact>, summary?: string) => void;
}) {
  // ── 左栏：事实主体 ─────────────────────────────
  const [content,     setContent]     = useState(fact.content);
  const [entities,    setEntities]    = useState<string[]>(fact.entities);
  const [newEntities, setNewEntities] = useState<NewEntitySuggestion[]>(fact.newEntities);
  const [events,      setEvents]      = useState<string[]>(fact.events);
  const [newEvents,   setNewEvents]   = useState<NewEventSuggestion[]>(fact.newEvents);
  const [startTime,   setStartTime]   = useState(fact.startTime);
  const [endTime,     setEndTime]     = useState(fact.endTime);
  const [timeDesc,    setTimeDesc]    = useState(fact.timeDesc);

  // ── 右栏：元数据（POST /api/facts 字段对齐）────
  const [title,                setTitle]                = useState(fact.title || "");
  const [categoryId,           setCategoryId]           = useState<number | null>(fact.categoryId ?? null);
  const [source,               setSource]               = useState(fact.source || "");
  const [sourceUrl,            setSourceUrl]            = useState(fact.sourceUrl || "");
  const [sourceContent,        setSourceContent]        = useState(fact.sourceContent || "");
  const [contradictionReason,  setContradictionReason]  = useState(fact.contradictionReason || "");
  const [contradictingFactIds, setContradictingFactIds] = useState(fact.contradictingFactIds || "");
  const [duplicateFactIds,     setDuplicateFactIds]     = useState(fact.duplicateFactIds || "");
  const [reviewPriority,       setReviewPriority]       = useState<"low" | "medium" | "high">(fact.reviewPriority || "low");
  const [extra,                setExtra]                = useState(fact.extra || "");

  // ── 多语言切换：仅 fact_text / time_description / title 三个字段按语言独立保存 ─
  const [lang, setLang] = useState<LangCode>("zh");
  const [i18nContent,  setI18nContent]  = useState<Partial<Record<LangCode, string>>>(fact.i18nContent  || {});
  const [i18nTimeDesc, setI18nTimeDesc] = useState<Partial<Record<LangCode, string>>>(fact.i18nTimeDesc || {});
  const [i18nTitle,    setI18nTitle]    = useState<Partial<Record<LangCode, string>>>(fact.i18nTitle    || {});

  // 抽屉打开时（visible 从 false 变 true），把当前 fact 数据填入编辑状态
  const prevVisibleRef = React.useRef(visible);
  React.useEffect(() => {
    if (visible && !prevVisibleRef.current) {
      setContent(fact.content);
      setEntities(fact.entities);
      setNewEntities(fact.newEntities);
      setEvents(fact.events);
      setNewEvents(fact.newEvents);
      setStartTime(fact.startTime);
      setEndTime(fact.endTime);
      setTimeDesc(fact.timeDesc);
      setTitle(fact.title || "");
      setCategoryId(fact.categoryId ?? null);
      setSource(fact.source || "");
      setSourceUrl(fact.sourceUrl || "");
      setSourceContent(fact.sourceContent || "");
      setContradictionReason(fact.contradictionReason || "");
      setContradictingFactIds(fact.contradictingFactIds || "");
      setDuplicateFactIds(fact.duplicateFactIds || "");
      setReviewPriority(fact.reviewPriority || "low");
      setExtra(fact.extra || "");
      setLang("zh");
      setI18nContent(fact.i18nContent  || {});
      setI18nTimeDesc(fact.i18nTimeDesc || {});
      setI18nTitle(fact.i18nTitle    || {});
    }
    prevVisibleRef.current = visible;
  }, [visible, fact]);

  const removeTag = <T extends string>(list: T[], item: T, setList: React.Dispatch<React.SetStateAction<T[]>>) =>
    setList(list.filter((x) => x !== item));

  // 实时基于当前编辑内容做"重新校验"，让用户改内容时立刻看到冲突/重复是否已消除
  const liveCheck = React.useMemo(() => recheckConflict(content), [content]);
  const [compareDlg, setCompareDlg] = useState<{ mode: "conflict" | "duplicate" } | null>(null);

  // ── 多语言三字段的当前显示值（lang=zh 时即主字段） ──
  const currentContent  = lang === "zh" ? content  : (i18nContent[lang]  ?? "");
  const currentTimeDesc = lang === "zh" ? timeDesc : (i18nTimeDesc[lang] ?? "");
  const currentTitle    = lang === "zh" ? title    : (i18nTitle[lang]    ?? "");
  const setCurrentContent  = (v: string) => lang === "zh" ? setContent(v)  : setI18nContent({ ...i18nContent, [lang]: v });
  const setCurrentTimeDesc = (v: string) => lang === "zh" ? setTimeDesc(v) : setI18nTimeDesc({ ...i18nTimeDesc, [lang]: v });
  const setCurrentTitle    = (v: string) => lang === "zh" ? setTitle(v)    : setI18nTitle({ ...i18nTitle, [lang]: v });

  /** JSON 校验：扩展内容字段非空时必须是合法 JSON */
  const extraJsonError = React.useMemo(() => {
    if (!extra.trim()) return "";
    try { JSON.parse(extra); return ""; } catch (e: any) { return `JSON 格式错误：${e.message || "解析失败"}`; }
  }, [extra]);

  /** 保存：先做 recheck，再把最新冲突/重复结果写回；并生成编辑摘要 */
  const handleSave = () => {
    if (extraJsonError) {
      MessagePlugin.error(extraJsonError);
      return;
    }
    const recheck = recheckConflict(content);

    // 组装编辑摘要：列出哪些字段变了
    const changes: string[] = [];
    if (content    !== fact.content)    changes.push("事实内容");
    if (JSON.stringify(entities)    !== JSON.stringify(fact.entities))    changes.push("关联实体");
    if (JSON.stringify(newEntities) !== JSON.stringify(fact.newEntities)) changes.push("新发现实体");
    if (JSON.stringify(events)      !== JSON.stringify(fact.events))      changes.push("关联事件");
    if (JSON.stringify(newEvents)   !== JSON.stringify(fact.newEvents))   changes.push("新发现事件");
    if (startTime !== fact.startTime || endTime !== fact.endTime || timeDesc !== fact.timeDesc) changes.push("有效时间");
    if (title !== (fact.title || ""))                                             changes.push("标题");
    if ((categoryId ?? null) !== (fact.categoryId ?? null))                       changes.push("分类");
    if (source !== (fact.source || ""))                                           changes.push("来源");
    if (sourceUrl !== (fact.sourceUrl || ""))                                     changes.push("来源 URL");
    if (sourceContent !== (fact.sourceContent || ""))                             changes.push("来源内容");
    if (contradictionReason !== (fact.contradictionReason || ""))                 changes.push("矛盾原因");
    if (contradictingFactIds !== (fact.contradictingFactIds || ""))               changes.push("矛盾事实 ID");
    if (duplicateFactIds !== (fact.duplicateFactIds || ""))                       changes.push("重复事实 ID");
    if (reviewPriority !== (fact.reviewPriority || "low"))                        changes.push("审核优先级");
    if (extra !== (fact.extra || ""))                                             changes.push("扩展内容");
    if (JSON.stringify(i18nContent)  !== JSON.stringify(fact.i18nContent  || {})) changes.push("多语言事实内容");
    if (JSON.stringify(i18nTimeDesc) !== JSON.stringify(fact.i18nTimeDesc || {})) changes.push("多语言时间描述");
    if (JSON.stringify(i18nTitle)    !== JSON.stringify(fact.i18nTitle    || {})) changes.push("多语言标题");

    // 冲突/重复变化也写入摘要
    if (fact.conflict  && !recheck.conflict)  changes.push(`已解除与 [${fact.conflict.factId}] 的冲突`);
    if (!fact.conflict &&  recheck.conflict)  changes.push(`命中新冲突 [${recheck.conflict.factId}]`);
    if (fact.duplicate && !recheck.duplicate) changes.push(`已解除与 [${fact.duplicate.factId}] 的重复`);
    if (!fact.duplicate &&  recheck.duplicate) changes.push(`命中新重复 [${recheck.duplicate.factId}]`);

    const summary = changes.length > 0 ? `修改了：${changes.join("、")}` : "无字段变化（点击保存触发了一次重新校验）";

    onSave({
      content, entities, newEntities, events, newEvents, startTime, endTime, timeDesc,
      title, categoryId, source, sourceUrl, sourceContent,
      contradictionReason, contradictingFactIds, duplicateFactIds,
      reviewPriority, extra,
      i18nContent, i18nTimeDesc, i18nTitle,
      conflict: recheck.conflict,
      duplicate: recheck.duplicate,
    }, summary);

    if (!recheck.conflict && fact.conflict) MessagePlugin.success("冲突已通过编辑解除");
    if (!recheck.duplicate && fact.duplicate) MessagePlugin.success("重复已通过编辑解除");
  };



  return (
    <Drawer
      visible={visible}
      header="编辑事实"
      size="80vw"
      placement="right"
      onClose={onClose}
      footer={
        <Space>
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button theme="primary" onClick={handleSave}>保存</Button>
        </Space>
      }
    >
      <div style={{ display: "flex", gap: 0, height: "100%", overflow: "hidden" }}>

        {/* ═══════ 左栏：事实主体（多语言+内容+时效+关联+新建议）═══════ */}
        <div style={{ flex: 1.2, overflow: "auto", paddingRight: 20 }}>
          <Form labelAlign="top" labelWidth={0}>

            {/* 多语言切换：仅影响 fact_text / time_description / title */}
            <FormItem label={
              <span>
                多语言信息
                <span style={{ fontSize: 11, fontWeight: "normal", color: "var(--td-text-color-placeholder)", marginLeft: 8 }}>
                  仅切换事实内容 / 时间描述 / 标题
                </span>
              </span>
            }>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {LANG_OPTIONS.map((l) => {
                  const filled = l.code === "zh"
                    ? !!content
                    : !!(i18nContent[l.code] || i18nTimeDesc[l.code] || i18nTitle[l.code]);
                  return (
                    <Button
                      key={l.code}
                      size="small"
                      variant={lang === l.code ? "base" : "outline"}
                      theme={lang === l.code ? "primary" : "default"}
                      onClick={() => setLang(l.code)}
                    >
                      {l.label}{filled && lang !== l.code && <span style={{ marginLeft: 4, color: "var(--td-success-color)" }}>•</span>}
                    </Button>
                  );
                })}
              </div>
            </FormItem>

            <FormItem label={<span style={{ fontWeight: 600 }}>事实内容 <span style={{ color: "var(--td-error-color)" }}>*</span></span>}>
              <Textarea
                value={currentContent}
                onChange={(v) => setCurrentContent(v)}
                autosize={{ minRows: 6 }}
                placeholder={lang === "zh" ? "请输入事实内容…" : `请输入 ${LANG_OPTIONS.find((l) => l.code === lang)?.label} 翻译…`}
              />
            </FormItem>

            {/* 冲突 / 重复 / 已解除 提示（在提取语种对应的语言 Tab 下展示）*/}
            {lang === (batchExtractLang || "zh") && liveCheck.conflict && (
              <div style={{ padding: "10px 12px", background: "rgba(227,77,89,0.06)", border: "1px solid rgba(227,77,89,0.2)", borderRadius: 6, marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#e34d59" }}>⚠ 冲突事实</span>
                  <Tag theme="danger" variant="light" size="small">[{liveCheck.conflict.factId}]</Tag>
                  {(batchExtractLang && batchExtractLang !== "zh") && (
                    <Tag theme="warning" variant="light" size="small">{LANG_OPTIONS.find((l) => l.code === batchExtractLang)?.label}库</Tag>
                  )}
                  <span style={{ flex: 1 }} />
                  <Button variant="text" size="small" theme="primary" onClick={() => setCompareDlg({ mode: "conflict" })}>查看对比</Button>
                </div>
                <div style={{ fontSize: 12, color: "#e34d59", lineHeight: 1.7 }}>{liveCheck.conflict.reason}</div>
                <div style={{ fontSize: 12, marginTop: 8, color: "var(--td-text-color-secondary)", background: "#fff", borderRadius: 4, padding: "6px 10px", border: "1px solid var(--td-component-stroke)" }}>
                  {liveCheck.conflict.factContent}
                </div>
              </div>
            )}
            {lang === (batchExtractLang || "zh") && liveCheck.duplicate && (
              <div style={{ padding: "10px 12px", background: "rgba(255,184,0,0.06)", border: "1px solid rgba(255,184,0,0.35)", borderRadius: 6, marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--td-warning-color)" }}>≈ 重复事实</span>
                  <Tag theme="warning" variant="light" size="small">[{liveCheck.duplicate.factId}]</Tag>
                  <Tag theme="warning" variant="light" size="small">相似度 {Math.round(liveCheck.duplicate.similarity * 100)}%</Tag>
                  {(batchExtractLang && batchExtractLang !== "zh") && (
                    <Tag theme="primary" variant="light" size="small">{LANG_OPTIONS.find((l) => l.code === batchExtractLang)?.label}库</Tag>
                  )}
                  <span style={{ flex: 1 }} />
                  <Button variant="text" size="small" theme="primary" onClick={() => setCompareDlg({ mode: "duplicate" })}>查看对比</Button>
                </div>
                <div style={{ fontSize: 12, color: "var(--td-text-color-secondary)", background: "#fff", borderRadius: 4, padding: "6px 10px", border: "1px solid var(--td-component-stroke)" }}>
                  {liveCheck.duplicate.factContent}
                </div>
              </div>
            )}
            {lang === (batchExtractLang || "zh") && fact.conflict && !liveCheck.conflict && (
              <div style={{ padding: "8px 12px", background: "rgba(0,168,112,0.06)", border: "1px solid rgba(0,168,112,0.3)", borderRadius: 6, marginBottom: 10, fontSize: 12, color: "var(--td-success-color)" }}>
                ✓ 编辑后已不再与 [{fact.conflict.factId}] 冲突，保存即生效
              </div>
            )}
            {lang === (batchExtractLang || "zh") && fact.duplicate && !liveCheck.duplicate && (
              <div style={{ padding: "8px 12px", background: "rgba(0,168,112,0.06)", border: "1px solid rgba(0,168,112,0.3)", borderRadius: 6, marginBottom: 10, fontSize: 12, color: "var(--td-success-color)" }}>
                ✓ 编辑后已不再与 [{fact.duplicate.factId}] 重复，保存即生效
              </div>
            )}

            {/* 时效（开始/结束/时间描述）*/}
            <div style={{ display: "flex", gap: 8 }}>
              <FormItem label="开始时间" style={{ flex: 1 }}>
                <DatePicker value={startTime} onChange={(v) => setStartTime(v as string)} enableTimePicker clearable placeholder="选择开始时间" style={{ width: "100%" }} />
              </FormItem>
              <FormItem label="结束时间" style={{ flex: 1 }}>
                <DatePicker value={endTime} onChange={(v) => setEndTime(v as string)} enableTimePicker clearable placeholder="选择结束时间" style={{ width: "100%" }} />
              </FormItem>
            </div>
            <FormItem label="时间描述">
              <Input
                value={currentTimeDesc}
                onChange={(v) => setCurrentTimeDesc(v)}
                placeholder={lang === "zh" ? "如：每周五至每周日、每月1号等" : `${LANG_OPTIONS.find((l) => l.code === lang)?.label} 翻译…`}
              />
            </FormItem>

            {/* 关联实体（已存在）*/}
            <FormItem label="关联实体（已存在）">
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 6 }}>
                {entities.map((e) => (
                  <Tag key={e} theme="default" variant="light" size="small" closable onClose={() => removeTag(entities, e, setEntities)}>{e}</Tag>
                ))}
              </div>
              <Select
                filterable placeholder="搜索并添加已有实体…"
                options={entityOptions.filter((o) => !entities.includes(o.value))}
                onChange={(v) => { if (v && !entities.includes(v as string)) setEntities([...entities, v as string]); }}
                style={{ width: "100%" }}
              />
            </FormItem>

            {/* 新发现实体（待入库）*/}
            <FormItem label="新发现实体（待入库）">
              {newEntities.length === 0 && (
                <div style={{ fontSize: 12, color: "var(--td-text-color-placeholder)", marginBottom: 8 }}>
                  未检测到新实体
                </div>
              )}
              {newEntities.map((entity, i) => {
                const isDiscarded = entity.decision === "discard";
                const updateEntity = (patch: Partial<NewEntitySuggestion>) =>
                  setNewEntities(newEntities.map((x, j) => j === i ? { ...x, ...patch } : x));
                /** 保留：模拟调 POST /api/entities 创建实体并拿到 entity_id；
                 *  丢弃：清掉 reservedEntityId，事实将不关联此实体 */
                const setKeep = () => {
                  const id = entity.reservedEntityId || allocReservedEntityId();
                  updateEntity({ decision: "keep", reservedEntityId: id });
                };
                const setDiscard = () => updateEntity({ decision: "discard", reservedEntityId: undefined });
                const removeEntity = () =>
                  setNewEntities(newEntities.filter((_, j) => j !== i));
                return (
                  <div key={i} style={{
                    border: `1px solid ${isDiscarded ? "var(--td-component-stroke)" : "rgba(255,184,0,0.35)"}`,
                    background: isDiscarded ? "var(--td-bg-color-component-disabled)" : "rgba(255,184,0,0.04)",
                    borderRadius: 6, padding: "10px 12px", marginBottom: 8, fontSize: 12,
                    opacity: isDiscarded ? 0.55 : 1,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                      <Tag theme="warning" variant="light" size="small">建议新增</Tag>
                      {isDiscarded && <Tag theme="default" variant="light" size="small">已丢弃</Tag>}
                      {entity.reservedEntityId && !isDiscarded && (
                        <Tag theme="success" variant="light" size="small">ID:{entity.reservedEntityId}</Tag>
                      )}
                      <span style={{ flex: 1 }} />
                      {isDiscarded ? (
                        <Button variant="text" size="small" theme="primary" onClick={setKeep}>恢复</Button>
                      ) : (
                        <Button variant="text" size="small" theme="danger" onClick={setDiscard}>丢弃</Button>
                      )}
                      <Button variant="text" size="small" theme="danger" icon={<CloseIcon />} onClick={removeEntity} />
                    </div>
                    <div style={{ marginBottom: 6 }}>
                      <Input value={entity.name} disabled={isDiscarded} onChange={(v) => updateEntity({ name: v })} placeholder="实体名称" />
                    </div>
                    <div style={{ marginBottom: 6 }}>
                      <Textarea value={entity.description} disabled={isDiscarded} onChange={(v) => updateEntity({ description: v })} autosize={{ minRows: 2, maxRows: 3 }} placeholder="实体描述（可选）" />
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: "var(--td-text-color-placeholder)", marginBottom: 3 }}>标签（用逗号分隔）</div>
                      <Input
                        value={entity.tags.join(", ")}
                        disabled={isDiscarded}
                        onChange={(v) => updateEntity({ tags: v.split(",").map((t) => t.trim()).filter(Boolean) })}
                        placeholder="标签1, 标签2"
                      />
                    </div>
                  </div>
                );
              })}
              <Button variant="outline" size="small" theme="warning" icon={<AddIcon />}
                onClick={() => setNewEntities([...newEntities, { name: "", description: "", tags: [], decision: "keep" }])}>
                添加新实体
              </Button>
            </FormItem>

            {/* 关联事件（已存在）*/}
            <FormItem label="关联事件（已存在）">
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 6 }}>
                {events.map((e) => (
                  <Tag key={e} theme="default" variant="light" size="small" closable onClose={() => removeTag(events, e, setEvents)}>{e}</Tag>
                ))}
              </div>
              <Select
                filterable placeholder="搜索并添加已有事件…"
                options={eventOptions.filter((o) => !events.includes(o.value))}
                onChange={(v) => { if (v && !events.includes(v as string)) setEvents([...events, v as string]); }}
                style={{ width: "100%" }}
              />
            </FormItem>

            {/* 建议新增事件 */}
            <FormItem label="新发现事件（待入库）">
              {newEvents.length === 0 && (
                <div style={{ fontSize: 12, color: "var(--td-text-color-placeholder)", marginBottom: 8 }}>
                  未检测到新事件
                </div>
              )}
              {newEvents.map((ne, i) => {
                const isDiscarded = ne.decision === "discard";
                const updateField = (patch: Partial<NewEventSuggestion>) =>
                  setNewEvents(newEvents.map((x, j) => j === i ? { ...x, ...patch } : x));
                /** 保留：模拟调 POST /api/events 创建并拿到 event_id；丢弃：清掉 reservedEventId */
                const setKeepEv = () => {
                  const id = ne.reservedEventId || allocReservedEventId();
                  updateField({ decision: "keep", reservedEventId: id });
                };
                const setDiscardEv = () => updateField({ decision: "discard", reservedEventId: undefined });
                const removeEvent = () => setNewEvents(newEvents.filter((_, j) => j !== i));
                return (
                  <div key={i} style={{
                    border: `1px solid ${isDiscarded ? "var(--td-component-stroke)" : "rgba(255,184,0,0.35)"}`,
                    background: isDiscarded ? "var(--td-bg-color-component-disabled)" : "rgba(255,184,0,0.04)",
                    borderRadius: 6, padding: "10px 12px", marginBottom: 8, fontSize: 12,
                    opacity: isDiscarded ? 0.55 : 1,
                  }}>
                    {/* 头部：标题 + 丢弃/恢复/删除 */}
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                      <Tag theme="warning" variant="light" size="small">建议新增</Tag>
                      {isDiscarded && <Tag theme="default" variant="light" size="small">已丢弃</Tag>}
                      {ne.reservedEventId && !isDiscarded && (
                        <Tag theme="success" variant="light" size="small">ID:{ne.reservedEventId}</Tag>
                      )}
                      <span style={{ flex: 1 }} />
                      {isDiscarded ? (
                        <Button variant="text" size="small" theme="primary" onClick={setKeepEv}>恢复</Button>
                      ) : (
                        <Button variant="text" size="small" theme="danger" onClick={setDiscardEv}>丢弃</Button>
                      )}
                      <Button variant="text" size="small" theme="danger" icon={<CloseIcon />} onClick={removeEvent} />
                    </div>

                    {/* 名称 + 类型 */}
                    <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                      <div style={{ flex: 2 }}>
                        <Input value={ne.name} disabled={isDiscarded} onChange={(v) => updateField({ name: v })} placeholder="事件名称" />
                      </div>
                      <div style={{ flex: 1 }}>
                        <Select
                          value={ne.eventType}
                          disabled={isDiscarded}
                          onChange={(v) => updateField({ eventType: v as string })}
                          options={[
                            { label: "活动", value: "活动" },
                            { label: "赛事", value: "赛事" },
                            { label: "版本更新", value: "版本更新" },
                            { label: "运营事件", value: "运营事件" },
                            { label: "其他", value: "其他" },
                          ]}
                          placeholder="事件类型"
                          style={{ width: "100%" }}
                        />
                      </div>
                    </div>

                    {/* 开始 + 结束 */}
                    <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                      <DatePicker value={ne.startTime} disabled={isDiscarded} onChange={(v) => updateField({ startTime: v as string })} enableTimePicker clearable placeholder="开始时间" style={{ flex: 1 }} />
                      <DatePicker value={ne.endTime}   disabled={isDiscarded} onChange={(v) => updateField({ endTime:   v as string })} enableTimePicker clearable placeholder="结束时间" style={{ flex: 1 }} />
                    </div>

                    {/* 时间描述 */}
                    <div style={{ marginBottom: 6 }}>
                      <Input value={ne.timeDesc} disabled={isDiscarded} onChange={(v) => updateField({ timeDesc: v })} placeholder="时间描述（可选，如：每周五至每周日）" />
                    </div>

                    {/* 描述 */}
                    <div style={{ marginBottom: 6 }}>
                      <Textarea value={ne.description} disabled={isDiscarded} onChange={(v) => updateField({ description: v })} autosize={{ minRows: 2, maxRows: 4 }} placeholder="事件描述" />
                    </div>

                    {/* 标签 */}
                    <div>
                      <div style={{ fontSize: 11, color: "var(--td-text-color-placeholder)", marginBottom: 3 }}>标签（用逗号分隔）</div>
                      <Input
                        value={ne.tags.join(", ")}
                        disabled={isDiscarded}
                        onChange={(v) => updateField({ tags: v.split(",").map((t) => t.trim()).filter(Boolean) })}
                        placeholder="标签1, 标签2"
                      />
                    </div>
                  </div>
                );
              })}
              <Button variant="outline" size="small" theme="warning" icon={<AddIcon />}
                onClick={() => setNewEvents([...newEvents, { name: "", eventType: "活动", startTime: "", endTime: "", timeDesc: "", description: "", tags: [], decision: "keep" }])}>
                添加新事件
              </Button>
            </FormItem>

          </Form>
        </div>

        {/* 分割线 */}
        <div style={{ width: 1, background: "var(--td-component-stroke)", margin: "0 4px", flexShrink: 0 }} />

        {/* ═══════ 右栏：元数据（标题/分类/来源/矛盾/扩展/优先级）═══════ */}
        <div style={{ flex: 1, overflow: "auto", paddingLeft: 20 }}>
          <Form labelAlign="top" labelWidth={0}>

            {/* 分组 1：基础信息 */}
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--td-text-color-secondary)", margin: "0 0 8px", paddingBottom: 6, borderBottom: "1px solid var(--td-component-stroke)" }}>
              基础信息
            </div>
            <FormItem label="标题">
              <Input
                value={currentTitle}
                onChange={(v) => setCurrentTitle(v)}
                placeholder={lang === "zh" ? "事实标题（可选）" : `${LANG_OPTIONS.find((l) => l.code === lang)?.label} 翻译…`}
              />
            </FormItem>
            <div style={{ display: "flex", gap: 8 }}>
              <FormItem label="分类" style={{ flex: 1 }}>
                <Select
                  value={categoryId ?? undefined}
                  onChange={(v) => setCategoryId((v as number) ?? null)}
                  options={[
                    { label: "无分类", value: 0 },
                    { label: "活动", value: 1 },
                    { label: "技能", value: 2 },
                    { label: "皮肤", value: 3 },
                    { label: "玩法", value: 4 },
                    { label: "其他", value: 99 },
                  ]}
                  clearable
                  placeholder="选择分类"
                  style={{ width: "100%" }}
                />
              </FormItem>
              <FormItem label="审核优先级" style={{ flex: 1 }}>
                <Select
                  value={reviewPriority}
                  onChange={(v) => setReviewPriority(v as "low" | "medium" | "high")}
                  options={[
                    { label: "低", value: "low" },
                    { label: "中", value: "medium" },
                    { label: "高", value: "high" },
                  ]}
                  style={{ width: "100%" }}
                />
              </FormItem>
            </div>

            {/* 分组 2：来源溯源 */}
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--td-text-color-secondary)", margin: "16px 0 8px", paddingBottom: 6, borderBottom: "1px solid var(--td-component-stroke)" }}>
              来源溯源
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <FormItem label="来源类型" style={{ flex: 1 }}>
                <Input value={fact.sourceType || "extract_text"} disabled placeholder="系统字段，不可编辑" />
              </FormItem>
              <FormItem label="来源" style={{ flex: 1 }}>
                <Input value={source} onChange={(v) => setSource(v)} placeholder="提取人 / 手动来源" />
              </FormItem>
            </div>
            <FormItem label="来源 URL">
              <Input value={sourceUrl} onChange={(v) => setSourceUrl(v)} placeholder="https://..." />
            </FormItem>
            <FormItem label="来源内容（原始问答对等）">
              <Textarea
                value={sourceContent}
                onChange={(v) => setSourceContent(v)}
                autosize={{ minRows: 2, maxRows: 4 }}
                placeholder="可填写原始问题/答案/批次 ID，用于追溯来源"
              />
            </FormItem>

            {/* 分组 3：矛盾与重复 */}
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--td-text-color-secondary)", margin: "16px 0 8px", paddingBottom: 6, borderBottom: "1px solid var(--td-component-stroke)" }}>
              矛盾与重复
            </div>
            <FormItem label="矛盾原因">
              <Textarea
                value={contradictionReason}
                onChange={(v) => setContradictionReason(v)}
                autosize={{ minRows: 2, maxRows: 3 }}
                placeholder="如该事实与其他事实存在矛盾，请填写矛盾原因（留空表示无矛盾）"
              />
            </FormItem>
            <FormItem label="矛盾事实 ID（多个用逗号分隔）">
              <Input value={contradictingFactIds} onChange={(v) => setContradictingFactIds(v)} placeholder="如：1,2,3" />
            </FormItem>
            <FormItem label="语义重复事实 ID（多个用逗号分隔）">
              <Input value={duplicateFactIds} onChange={(v) => setDuplicateFactIds(v)} placeholder="如：1,2,3" />
            </FormItem>

            {/* 分组 4：扩展 */}
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--td-text-color-secondary)", margin: "16px 0 8px", paddingBottom: 6, borderBottom: "1px solid var(--td-component-stroke)" }}>
              扩展
            </div>
            <FormItem
              label="扩展内容（JSON，可选）"
              status={extraJsonError ? "error" : undefined}
              tips={extraJsonError || undefined}
            >
              <Textarea
                value={extra}
                onChange={(v) => setExtra(v)}
                autosize={{ minRows: 3, maxRows: 6 }}
                placeholder='例如：{"ticket_id":"12345"}'
              />
            </FormItem>

          </Form>
        </div>
      </div>

      {/* 抽屉内的对比 Dialog */}
      {compareDlg && (
        <CompareDialog
          visible={!!compareDlg}
          onClose={() => setCompareDlg(null)}
          mode={compareDlg.mode}
          oldFactId={(compareDlg.mode === "conflict" ? liveCheck.conflict?.factId : liveCheck.duplicate?.factId) || ""}
          oldContent={(compareDlg.mode === "conflict" ? liveCheck.conflict?.factContent : liveCheck.duplicate?.factContent) || ""}
          newContent={content}
          extra={compareDlg.mode === "conflict"
            ? (liveCheck.conflict?.reason || "")
            : (liveCheck.duplicate ? `相似度 ${Math.round(liveCheck.duplicate.similarity * 100)}%` : "")}
        />
      )}
    </Drawer>
  );
}

// ─── 冲突/重复对比 Dialog ──────────────────────────────────────────────────────
function CompareDialog({
  visible, onClose, mode, oldFactId, oldContent, newContent, extra,
}: {
  visible: boolean;
  onClose: () => void;
  mode: "conflict" | "duplicate";
  oldFactId: string;
  oldContent: string;
  newContent: string;
  extra: string;
}) {
  const isConflict = mode === "conflict";
  const themeColor = isConflict ? "#e34d59" : "var(--td-warning-color)";
  const bgColor    = isConflict ? "rgba(227,77,89,0.06)" : "rgba(255,184,0,0.08)";
  const borderClr  = isConflict ? "rgba(227,77,89,0.25)" : "rgba(255,184,0,0.4)";

  // 字符级 diff 拿到 segs；视觉根据 mode 切换：冲突看 del/ins，重复看 equal
  const segs = React.useMemo(() => charDiff(oldContent, newContent), [oldContent, newContent]);

  /** 冲突场景：在原文中渲染——相同片段淡化、差异片段高亮加粗 */
  const renderConflictText = (side: "old" | "new") => {
    return segs.map((s, i) => {
      if (s.type === "equal") {
        return <span key={i} style={{ color: "var(--td-text-color-placeholder)" }}>{s.text}</span>;
      }
      // 左侧只展示原文（equal + del），右侧只展示新文（equal + ins）
      if (side === "old") {
        if (s.type === "del") {
          return <span key={i} style={{ background: "rgba(227,77,89,0.18)", color: "#c91c30", fontWeight: 600, padding: "0 2px", borderRadius: 2 }}>{s.text}</span>;
        }
        return null; // ins 不显示在左侧
      } else {
        if (s.type === "ins") {
          return <span key={i} style={{ background: "rgba(0,168,112,0.18)", color: "var(--td-success-color)", fontWeight: 600, padding: "0 2px", borderRadius: 2 }}>{s.text}</span>;
        }
        return null; // del 不显示在右侧
      }
    });
  };

  /** 重复场景：相同片段高亮、差异片段淡化（左右各显示自己独有 + 共有） */
  const renderDuplicateText = (side: "old" | "new") => {
    return segs.map((s, i) => {
      if (s.type === "equal") {
        return <span key={i} style={{ background: "rgba(0,168,112,0.16)", color: "var(--td-success-color)", fontWeight: 500, padding: "0 2px", borderRadius: 2 }}>{s.text}</span>;
      }
      if (side === "old") {
        if (s.type === "del") {
          return <span key={i} style={{ color: "var(--td-text-color-placeholder)", opacity: 0.65 }}>{s.text}</span>;
        }
        return null;
      } else {
        if (s.type === "ins") {
          return <span key={i} style={{ color: "var(--td-text-color-placeholder)", opacity: 0.65 }}>{s.text}</span>;
        }
        return null;
      }
    });
  };

  /** 关键差异点 / 重叠点（生产环境由 LLM 抽，本期 mock）——按 oldFactId 命中固定示例 */
  const keyPoints = React.useMemo(() => buildKeyPoints(mode, oldFactId), [mode, oldFactId]);

  /** 重叠率（重复模式专用） */
  const overlapRate = React.useMemo(() => {
    if (!isConflict) {
      const equalLen = segs.filter((s) => s.type === "equal").reduce((a, s) => a + s.text.length, 0);
      const total = Math.max(oldContent.length, newContent.length, 1);
      return Math.round((equalLen / total) * 100);
    }
    return 0;
  }, [segs, isConflict, oldContent, newContent]);

  return (
    <Dialog
      visible={visible}
      onClose={onClose}
      header={isConflict ? "冲突事实对比" : "重复事实对比"}
      width={780}
      footer={<Button theme="primary" onClick={onClose}>关闭</Button>}
    >
      {/* 顶部：详情区 */}
      <div style={{ padding: "10px 12px", background: bgColor, border: `1px solid ${borderClr}`, borderRadius: 6, marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
          <Tag theme={isConflict ? "danger" : "warning"} variant="light" size="small">
            {isConflict ? "⚠ 冲突" : "≈ 重复"}
          </Tag>
          <span style={{ fontSize: 13, fontWeight: 600, color: themeColor }}>{oldFactId}</span>
          {!isConflict && (
            <Tag theme="warning" variant="light" size="small">重叠率 {overlapRate}%</Tag>
          )}
        </div>
        {extra && (
          <div style={{ fontSize: 12, color: themeColor, lineHeight: 1.7 }}>{extra}</div>
        )}
      </div>

      {/* 关键点列表 */}
      {keyPoints.length > 0 && (
        <div style={{ border: "1px solid var(--td-component-stroke)", borderRadius: 6, overflow: "hidden", marginBottom: 12 }}>
          <div style={{ padding: "6px 10px", background: "var(--td-bg-color-secondarycontainer)", fontSize: 12, fontWeight: 500, color: "var(--td-text-color-secondary)", borderBottom: "1px solid var(--td-component-stroke)" }}>
            {isConflict ? "关键差异点" : "主要重叠表述"}
          </div>
          <div style={{ padding: "8px 12px", background: "#fff" }}>
            {keyPoints.map((kp, i) => (
              <div key={i} style={{ fontSize: 12, lineHeight: 1.9, color: "var(--td-text-color-primary)" }}>
                <span style={{ color: "var(--td-text-color-placeholder)", marginRight: 6 }}>·</span>
                {isConflict ? (
                  <>
                    <strong>{kp.label}：</strong>
                    <span style={{ background: "rgba(227,77,89,0.18)", color: "#c91c30", padding: "0 4px", borderRadius: 2, fontWeight: 500 }}>{kp.oldText}</span>
                    <span style={{ color: "var(--td-text-color-placeholder)", margin: "0 6px" }}>↔</span>
                    <span style={{ background: "rgba(0,168,112,0.18)", color: "var(--td-success-color)", padding: "0 4px", borderRadius: 2, fontWeight: 500 }}>{kp.newText}</span>
                  </>
                ) : (
                  <>
                    <strong>{kp.label}：</strong>
                    <span style={{ background: "rgba(0,168,112,0.16)", color: "var(--td-success-color)", padding: "0 4px", borderRadius: 2, fontWeight: 500 }}>{kp.oldText}</span>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 双栏对比：高亮策略按 mode 切换 */}
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1, border: "1px solid var(--td-component-stroke)", borderRadius: 6, overflow: "hidden" }}>
          <div style={{ padding: "6px 10px", background: "var(--td-bg-color-secondarycontainer)", fontSize: 12, fontWeight: 500, color: "var(--td-text-color-secondary)", borderBottom: "1px solid var(--td-component-stroke)", display: "flex", alignItems: "center", gap: 6 }}>
            <Tag theme="default" variant="light" size="small">已有</Tag>
            <span>已有事实 [{oldFactId}]</span>
          </div>
          <div style={{ padding: "10px 12px", fontSize: 13, lineHeight: 1.9, background: "#fff", whiteSpace: "pre-wrap", wordBreak: "break-word", maxHeight: 240, overflowY: "auto" }}>
            {isConflict ? renderConflictText("old") : renderDuplicateText("old")}
          </div>
        </div>
        <div style={{ flex: 1, border: "1px solid var(--td-component-stroke)", borderRadius: 6, overflow: "hidden" }}>
          <div style={{ padding: "6px 10px", background: "var(--td-bg-color-secondarycontainer)", fontSize: 12, fontWeight: 500, color: "var(--td-text-color-secondary)", borderBottom: "1px solid var(--td-component-stroke)", display: "flex", alignItems: "center", gap: 6 }}>
            <Tag theme="primary" variant="light" size="small">新</Tag>
            <span>新事实</span>
          </div>
          <div style={{ padding: "10px 12px", fontSize: 13, lineHeight: 1.9, background: "#fff", whiteSpace: "pre-wrap", wordBreak: "break-word", maxHeight: 240, overflowY: "auto" }}>
            {isConflict ? renderConflictText("new") : renderDuplicateText("new")}
          </div>
        </div>
      </div>

      {/* 图例 */}
      <div style={{ marginTop: 10, fontSize: 11, color: "var(--td-text-color-placeholder)", display: "flex", gap: 14, flexWrap: "wrap" }}>
        {isConflict ? (
          <>
            <span><span style={{ background: "rgba(227,77,89,0.18)", color: "#c91c30", padding: "1px 6px", borderRadius: 2, fontWeight: 600 }}>已有表述</span> 即将被新事实推翻</span>
            <span><span style={{ background: "rgba(0,168,112,0.18)", color: "var(--td-success-color)", padding: "1px 6px", borderRadius: 2, fontWeight: 600 }}>新表述</span> 与已有事实矛盾</span>
            <span style={{ color: "var(--td-text-color-placeholder)" }}>· 灰色 = 双方共识，不影响判断</span>
          </>
        ) : (
          <>
            <span><span style={{ background: "rgba(0,168,112,0.16)", color: "var(--td-success-color)", padding: "1px 6px", borderRadius: 2, fontWeight: 500 }}>重叠表述</span> 双方表意一致</span>
            <span style={{ opacity: 0.65 }}>淡化部分 = 单边独有，可能为合并补充点</span>
          </>
        )}
      </div>
    </Dialog>
  );
}

/** 关键差异点 / 重叠表述（mock）—— 真实环境由 LLM 抽 */
interface KeyPoint { label: string; oldText: string; newText: string; }
function buildKeyPoints(mode: "conflict" | "duplicate", oldFactId: string): KeyPoint[] {
  if (mode === "conflict" && oldFactId === "ID:37957") {
    return [
      { label: "激活方式",  oldText: "接触敌人后自动触发", newText: "可手动激活" },
      { label: "触发条件",  oldText: "落地后处于隐形状态，接触到敌人后自动触发", newText: "落地后隐形，可手动激活，激活后从地面伸出藤蔓" },
    ];
  }
  if (mode === "duplicate" && oldFactId === "ID:42010") {
    return [
      { label: "地点", oldText: "日落之城 A 点" , newText: "" },
      { label: "技能", oldText: "剃刀藤蔓 + 弧光玫瑰" , newText: "" },
      { label: "战术", oldText: "反弹布置陷阱 + 形成控制链" , newText: "" },
    ];
  }
  return [];
}

// ─── 文件导入面板 ──────────────────────────────────────────────────────────────
function FileImportPanel({
  file, parseStatus, parseError, segments, loading, model,
  setModel, setSegments, onFileSelect, onExtract, onReset,
}: {
  file: File | null;
  parseStatus: "idle" | "parsing" | "parsed" | "error";
  parseError: string;
  segments: FileSegment[];
  loading: boolean;
  model: string;
  setModel: (v: string) => void;
  setSegments: React.Dispatch<React.SetStateAction<FileSegment[]>>;
  onFileSelect: (f: File) => void;
  onExtract: () => void;
  onReset: () => void;
}) {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [templateVersion, setTemplateVersion] = React.useState<number>(Date.now());

  const templateHref = `/fact_extract_template.xlsx?v=${templateVersion}`;
  const refreshTemplate = () => {
    setTemplateVersion(Date.now());
    MessagePlugin.success("模板已刷新：当前为三 Sheet（实体/事件/知识资讯）版本");
  };

  const downloadTemplateWithGuide = () => {
    const close = DialogPlugin.confirm({
      header: "导入模板说明",
      confirmBtn: { content: "我知道了，下载模板", theme: "primary" },
      cancelBtn: { content: "取消", variant: "outline" },
      body: (
        <div style={{ fontSize: 13, lineHeight: 1.8 }}>
          <div>模板包含 <strong>3 个 Sheet</strong>，系统会按填写的 Sheet 定向处理：</div>
          <div style={{ marginTop: 6 }}>1）<strong>实体</strong>：生成实体类候选，优先匹配/补充实体信息</div>
          <div>2）<strong>事件</strong>：生成事件类候选，优先匹配/补充事件信息</div>
          <div>3）<strong>知识资讯</strong>：生成通用事实候选，进入审核工作台</div>
          <div style={{ marginTop: 6, color: "var(--td-text-color-secondary)" }}>
            仅识别上述三类 Sheet；其它 Sheet 会自动忽略。
          </div>
        </div>
      ) as any,
      onConfirm: () => {
        const a = document.createElement("a");
        a.href = templateHref;
        a.download = "事实提取导入模板.xlsx";
        document.body.appendChild(a);
        a.click();
        a.remove();
        close?.hide?.();
      },
    });
  };

  const fileTypeIcon = () => {
    const ext = file?.name.split(".").pop()?.toLowerCase() || "";
    const iconStyle = { fontSize: 18, color: "var(--td-brand-color)" };
    if (ext === "pdf")  return <FilePdfIcon style={iconStyle} />;
    if (ext === "docx") return <FileWordIcon style={iconStyle} />;
    if (ext === "xlsx" || ext === "csv") return <FileExcelIcon style={iconStyle} />;
    return <FileIcon style={iconStyle} />;
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  };

  const pickedCount = segments.filter((s) => s.selected).length;
  const allSelected = segments.length > 0 && pickedCount === segments.length;
  const indeterminate = pickedCount > 0 && pickedCount < segments.length;

  const toggleAll = () => {
    setSegments((prev) => prev.map((s) => ({ ...s, selected: !allSelected })));
  };
  const toggleOne = (id: string) => {
    setSegments((prev) => prev.map((s) => s.id === id ? { ...s, selected: !s.selected } : s));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
        <div style={{ fontSize: 12, color: "var(--td-text-color-secondary)" }}>
          先下载三 Sheet 模板（实体 / 事件 / 知识资讯），系统将按所填 Sheet 定向处理
        </div>
        <Space size={8}>
          <Button variant="outline" size="small" onClick={refreshTemplate}>刷新模板结构</Button>
          <Button theme="primary" variant="outline" size="small" onClick={downloadTemplateWithGuide}>下载模板</Button>
        </Space>
      </div>

      {/* 上传区 */}
      {!file && (
        <div
          style={{
            border: "2px dashed var(--td-component-stroke)",
            borderRadius: 8,
            padding: "32px 16px",
            textAlign: "center",
            cursor: "pointer",
            background: "var(--td-bg-color-container-hover)",
            transition: "all .2s",
          }}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const f = e.dataTransfer.files?.[0];
            if (f) onFileSelect(f);
          }}
        >
          <AttachIcon style={{ fontSize: 32, color: "var(--td-text-color-placeholder)", marginBottom: 8 }} />
          <div style={{ fontSize: 13, color: "var(--td-text-color-primary)", marginBottom: 4 }}>
            点击或拖拽文件到此处
          </div>
          <div style={{ fontSize: 12, color: "var(--td-text-color-secondary)" }}>
            支持 PDF · Word · Excel · CSV · 纯文本
          </div>
          <div style={{ fontSize: 11, color: "var(--td-text-color-placeholder)", marginTop: 6 }}>
            PDF / Word ≤ 20MB；Excel / CSV ≤ 5MB
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.xlsx,.csv,.txt"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFileSelect(f);
              e.target.value = "";
            }}
          />
        </div>
      )}

      {/* 文件信息 + 解析态 */}
      {file && (
        <div style={{
          border: "1px solid var(--td-component-stroke)",
          borderRadius: 8,
          padding: "10px 12px",
          background: "#fff",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {fileTypeIcon()}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {file.name}
              </div>
              <div style={{ fontSize: 11, color: "var(--td-text-color-placeholder)" }}>
                {formatSize(file.size)}
                {parseStatus === "parsed"  && <span style={{ marginLeft: 8, color: "var(--td-success-color)" }}>✓ 解析完成（{segments.length} 个候选片段）</span>}
                {parseStatus === "parsing" && <span style={{ marginLeft: 8, color: "var(--td-warning-color)" }}>解析中…</span>}
                {parseStatus === "error"   && <span style={{ marginLeft: 8, color: "var(--td-error-color)" }}>✕ 解析失败</span>}
              </div>
            </div>
            <Button variant="text" size="small" onClick={onReset}>重新选择</Button>
          </div>

          {parseStatus === "parsing" && (
            <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--td-warning-color)" }}>
              <Loading size="small" /> 正在解析文件结构，请稍候…
            </div>
          )}

          {parseStatus === "error" && (
            <div style={{ marginTop: 10, padding: "8px 10px", background: "rgba(227,77,89,0.06)", border: "1px solid rgba(227,77,89,0.2)", borderRadius: 4, fontSize: 12, color: "var(--td-error-color)" }}>
              {parseError}
            </div>
          )}
        </div>
      )}

      {/* 候选片段列表 */}
      {parseStatus === "parsed" && segments.length > 0 && (
        <div style={{
          border: "1px solid var(--td-component-stroke)",
          borderRadius: 8,
          background: "#fff",
          overflow: "hidden",
        }}>
          {/* 头部 */}
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "8px 12px",
            background: "var(--td-bg-color-secondarycontainer)",
            borderBottom: "1px solid var(--td-component-stroke)",
            fontSize: 12,
          }}>
            <Checkbox
              checked={allSelected}
              indeterminate={indeterminate}
              onChange={toggleAll}
            >
              <span style={{ fontWeight: 500 }}>候选片段</span>
            </Checkbox>
            <span style={{ color: "var(--td-text-color-secondary)" }}>
              已选 <strong style={{ color: "var(--td-brand-color)" }}>{pickedCount}</strong> / {segments.length}
            </span>
          </div>

          {/* 列表 */}
          <div style={{ maxHeight: 320, overflowY: "auto" }}>
            {segments.map((s, idx) => (
              <div
                key={s.id}
                style={{
                  display: "flex", alignItems: "flex-start", gap: 8,
                  padding: "8px 12px",
                  borderBottom: idx === segments.length - 1 ? "none" : "1px solid var(--td-component-stroke)",
                  background: s.selected ? "transparent" : "var(--td-bg-color-component-disabled)",
                  opacity: s.selected ? 1 : 0.6,
                }}
              >
                <Checkbox checked={s.selected} onChange={() => toggleOne(s.id)} style={{ flexShrink: 0, marginTop: 2 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, color: "var(--td-text-color-placeholder)", marginBottom: 3 }}>
                    {s.location}
                  </div>
                  <div style={{ fontSize: 12, lineHeight: 1.6, color: "var(--td-text-color-primary)" }}>
                    {s.text.length > 100 ? (
                      <Tooltip content={s.text} overlayStyle={{ maxWidth: 480 }}>
                        <span>{s.text.slice(0, 100)}…</span>
                      </Tooltip>
                    ) : s.text}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 配置 + 提取按钮 */}
      {parseStatus === "parsed" && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4 }}>
          <Select
            filterable value={model} onChange={(v) => setModel(v as string)}
            options={[
              { label: "deepseek-v3-2-251201", value: "deepseek-v3-2-251201" },
              { label: "deepseek-v3-2-250101", value: "deepseek-v3-2-250101" },
              { label: "gpt-4o",               value: "gpt-4o" },
              { label: "claude-3.5-sonnet",    value: "claude-3.5-sonnet" },
            ]}
            style={{ flex: 1 }}
          />
          <Button
            theme="primary"
            loading={loading}
            disabled={pickedCount === 0}
            onClick={onExtract}
            style={{ flexShrink: 0 }}
          >
            提取 {pickedCount} 个片段
          </Button>
        </div>
      )}

      {loading && (
        <div style={{ fontSize: 12, color: "var(--td-brand-color)", display: "flex", alignItems: "center", gap: 6 }}>
          <Loading size="small" /> 提取中，结果将出现在右侧审核区…
        </div>
      )}
    </div>
  );
}

// ─── 缓冲池操作日志 Dialog ─────────────────────────────────────────────────────
function BufferLogDialog({
  visible, onClose, logs, factTitle,
}: {
  visible: boolean;
  onClose: () => void;
  logs: BufferLog[];
  factTitle: string;
}) {
  // 倒序：最新的在最上面
  const sortedLogs = [...logs].reverse();

  const actionTheme: Record<BufferLog["action"], "primary" | "success" | "danger" | "warning" | "default"> = {
    "创建": "primary",
    "编辑": "primary",
    "通过": "success",
    "拒绝": "danger",
    "撤回": "warning",
    "实体丢弃": "default",
    "实体恢复": "default",
    "事件丢弃": "default",
    "事件恢复": "default",
    "冲突解除": "success",
    "重复解除": "success",
  };

  return (
    <Dialog
      visible={visible}
      onClose={onClose}
      header="操作记录"
      width={640}
      footer={<Button theme="primary" onClick={onClose}>关闭</Button>}
    >
      <div style={{ fontSize: 12, color: "var(--td-text-color-secondary)", marginBottom: 10, padding: "6px 10px", background: "var(--td-bg-color-secondarycontainer)", borderRadius: 4 }}>
        当前事实：{factTitle}
      </div>
      {sortedLogs.length === 0 ? (
        <div style={{ padding: "40px 0", textAlign: "center", color: "var(--td-text-color-placeholder)", fontSize: 13 }}>
          暂无操作记录
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 480, overflowY: "auto" }}>
          {sortedLogs.map((log) => (
            <div key={log.id} style={{
              display: "flex", gap: 10, padding: "8px 10px",
              border: "1px solid var(--td-component-stroke)", borderRadius: 6, background: "#fff",
            }}>
              <Tag theme={actionTheme[log.action] || "default"} variant="light" size="small" style={{ flexShrink: 0, alignSelf: "flex-start" }}>
                {log.action}
              </Tag>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: "var(--td-text-color-primary)", lineHeight: 1.6, wordBreak: "break-word" }}>
                  {log.detail}
                </div>
                <div style={{ fontSize: 11, color: "var(--td-text-color-placeholder)", marginTop: 3 }}>
                  {log.operator} · {log.time}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Dialog>
  );
}
