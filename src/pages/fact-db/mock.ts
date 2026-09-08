import type { Entity, GameEvent, Fact, CategoryNode, ExtractBufferItem, OperationLog } from "./types";

export const gameOptions = [
  { label: "失控进化 (代号RM国内)", value: "valorant" },
  { label: "无畏契约：源能行动", value: "cfm" },
  { label: "PUBG Mobile", value: "pubg" },
  { label: "FC Mobile", value: "fc" },
  { label: "饥荒", value: "dst" },
];

export const languageOptions = [
  { label: "中文", value: "zh" },
  { label: "English", value: "en" },
  { label: "العربية", value: "ar" },
  { label: "Türkçe", value: "tr" },
  { label: "Русский", value: "ru" },
  { label: "粤语", value: "yue" },
];

export const tagOptions = [
  { label: "所有分类", value: "all" },
  { label: "粘性榴弹", value: "粘性榴弹" },
  { label: "潜袭爬虫", value: "潜袭爬虫" },
  { label: "战术投送", value: "战术投送" },
  { label: "事件类型", value: "事件类型" },
  { label: "段位", value: "段位" },
  { label: "机制", value: "机制" },
  { label: "系统模块", value: "系统模块" },
];

export const onlineStatusOptions = [
  { label: "所有线上状态", value: "all" },
  { label: "已上线", value: "已上线" },
  { label: "已下线", value: "已下线" },
];

export const ONLINE_STATUS_CONFIG: Record<string, { label: string; theme: "success" | "default" }> = {
  "已上线": { label: "已上线", theme: "success" },
  "已下线": { label: "已下线", theme: "default" },
};

export const uploadOptions = [
  { label: "所有上传状态", value: "all" },
  { label: "待上传", value: "待上传" },
  { label: "需要更新", value: "需要更新" },
  { label: "已上传", value: "已上传" },
];

export const mockEntities: Entity[] = [
  { id: 12087, title: "雷蛇榴弹", tag: "粘性榴弹", status: "已上线", source: "-", description: "极道特工中具有的能力，向一扇可以将远处的位置连同一簇扎形的黏附炸弹一起投出的连锁爆炸。", alias: "粘性炸弹, 蛇榴弹",
    logs: [
      { id: 1, operator: "dorrawang", time: "2026-01-10 09:00:00", action: "创建-导入" as const, detail: "白皮书批量导入" },
      { id: 2, operator: "zhangsan",  time: "2026-02-05 14:22:10", action: "编辑"     as const, detail: "补充别名：粘性炸弹, 蛇榴弹" },
      { id: 3, operator: "dorrawang", time: "2026-03-01 10:15:33", action: "状态变更" as const, detail: "待审核 → 已审核" },
    ],
  },
  { id: 12081, title: "精准预测", tag: "潜袭爬虫", status: "已上线", source: "-", description: "提前在特殊的环境及对手的行动路径上部署好技能，计算好对方的移动轨迹",
    logs: [
      { id: 1, operator: "dorrawang", time: "2026-01-10 09:00:00", action: "创建-导入" as const, detail: "白皮书批量导入" },
      { id: 2, operator: "dorrawang", time: "2026-03-01 10:15:33", action: "状态变更" as const, detail: "待审核 → 已审核" },
    ],
  },
  { id: 12062, title: "地震炮", tag: "战术投送", status: "已上线", source: "-", description: "裂动技术中两种武器，可以穿墙，可以使用它在目标上造成震荡效果来击败对手", alias: "震荡炮, 穿墙炮",
    logs: [
      { id: 1, operator: "lisi",      time: "2026-01-12 11:30:00", action: "创建-导入" as const, detail: "白皮书批量导入" },
      { id: 2, operator: "lisi",      time: "2026-01-12 15:40:22", action: "编辑"     as const, detail: "修正描述，补充穿墙特性说明" },
      { id: 3, operator: "dorrawang", time: "2026-03-01 10:16:00", action: "状态变更" as const, detail: "待审核 → 已审核" },
    ],
  },
  { id: 11961, title: "激流勇进", tag: "机制", status: "已上线", source: "-", description: "遇到对方的火力，一种闪避的动作，用于提高命中率和可射击的防御能力",
    logs: [
      { id: 1, operator: "dorrawang", time: "2026-01-10 09:00:00", action: "创建-导入" as const, detail: "白皮书批量导入" },
      { id: 2, operator: "dorrawang", time: "2026-03-01 10:15:33", action: "状态变更" as const, detail: "待审核 → 已审核" },
    ],
  },
  { id: 11938, title: "白银1-4",   tag: "段位", status: "已上线", source: "-", description: "白银1-4",
    logs: [{ id: 1, operator: "dorrawang", time: "2026-01-10 09:00:00", action: "创建-导入" as const, detail: "白皮书批量导入" },
           { id: 2, operator: "dorrawang", time: "2026-03-01 10:15:33", action: "状态变更" as const, detail: "待审核 → 已审核" }] },
  { id: 11937, title: "青铜1-3",   tag: "段位", status: "已上线", source: "-", description: "青铜1-3",
    logs: [{ id: 1, operator: "dorrawang", time: "2026-01-10 09:00:00", action: "创建-导入" as const, detail: "白皮书批量导入" },
           { id: 2, operator: "dorrawang", time: "2026-03-01 10:15:33", action: "状态变更" as const, detail: "待审核 → 已审核" }] },
  { id: 11936, title: "黑铁1-3",   tag: "段位", status: "已上线", source: "-", description: "黑铁1-3",
    logs: [{ id: 1, operator: "dorrawang", time: "2026-01-10 09:00:00", action: "创建-导入" as const, detail: "白皮书批量导入" },
           { id: 2, operator: "dorrawang", time: "2026-03-01 10:15:33", action: "状态变更" as const, detail: "待审核 → 已审核" }] },
  { id: 11928, title: "大厅", tag: "系统模块", status: "已上线", source: "-", description: "游戏内的主要功能区域", alias: "游戏大厅, 主界面, Lobby",
    logs: [{ id: 1, operator: "dorrawang", time: "2026-01-10 09:00:00", action: "创建-导入" as const, detail: "白皮书批量导入" },
           { id: 2, operator: "dorrawang", time: "2026-03-01 10:15:33", action: "状态变更" as const, detail: "待审核 → 已审核" }] },
  { id: 11917, title: "事件公告", tag: "事件类型", status: "已上线", source: "-", description: "有创公告记时间内事件即将开始等相关公告活动即发布的通知消息",
    logs: [{ id: 1, operator: "zhangsan", time: "2026-04-20 16:00:00", action: "创建-手动" as const, detail: "事实提取后手动新增实体" }] },
  { id: 11901, title: "限时活动", tag: "事件类型", status: "已上线", source: "-", description: "游戏中会不定期推出各种限时活动", alias: "限时, 限时模式, Limited Time",
    logs: [{ id: 1, operator: "dorrawang", time: "2026-01-10 09:00:00", action: "创建-导入" as const, detail: "白皮书批量导入" },
           { id: 2, operator: "dorrawang", time: "2026-03-01 10:15:33", action: "状态变更" as const, detail: "待审核 → 已审核" }] },
];

export const mockEvents: GameEvent[] = [
  { id: 11002, name: "S34赛季公测", description: "新赛季公测启动", eventType: "版本", status: "已上线", timeType: "span", startTime: "2026-09-01 10:00:00", endTime: "2026-10-15 23:59:59", source: "-", remark: "-", alias: "S34公测",
    logs: [
      { id: 1, operator: "dorrawang", time: "2026-08-01 10:00:00", action: "创建-手动" as const, detail: "版本更新手动录入" },
      { id: 2, operator: "dorrawang", time: "2026-08-01 10:20:00", action: "状态变更" as const, detail: "待审核 → 已审核" },
    ],
  },
  { id: 10926, name: "九九大吉", description: "满级大吉", eventType: "活动", status: "已上线", timeType: "span", startTime: "2026-01-20 00:00:00", endTime: "2026-04-09 23:59:59", source: "-", remark: "-", alias: "99大吉, 九九大吉活动, 新春活动",
    logs: [
      { id: 1, operator: "dorrawang", time: "2026-01-18 10:00:00", action: "创建-手动" as const, detail: "活动上线前手动录入" },
      { id: 2, operator: "dorrawang", time: "2026-01-18 10:30:00", action: "状态变更" as const, detail: "待审核 → 已审核" },
      { id: 3, operator: "zhangsan",  time: "2026-01-20 00:05:00", action: "编辑"     as const, detail: "补充别名：99大吉, 九九大吉活动, 新春活动" },
    ],
  },
  { id: 10889, name: "联赛冠军赛", description: "联赛冠军赛", eventType: "比赛", status: "已上线", timeType: "span", startTime: "2025-12-08 10:00:00", endTime: "2026-04-09 18:00:00", source: "-", remark: "-", alias: "冠军联赛, 联赛赛程",
    logs: [
      { id: 1, operator: "lisi",      time: "2025-12-05 09:00:00", action: "创建-手动" as const, detail: "赛事手动录入" },
      { id: 2, operator: "dorrawang", time: "2025-12-06 14:00:00", action: "状态变更" as const, detail: "待审核 → 已审核" },
    ],
  },
  { id: 10888, name: "千秋高思", description: "-", eventType: "活动", status: "已上线", timeType: "span", startTime: "2025-12-08 00:00:00", endTime: "-", source: "-", remark: "-",
    logs: [
      { id: 1, operator: "dorrawang", time: "2025-12-07 11:20:00", action: "创建-手动" as const, detail: "活动手动录入" },
      { id: 2, operator: "dorrawang", time: "2025-12-07 11:45:00", action: "状态变更" as const, detail: "待审核 → 已审核" },
    ],
  },
  { id: 10700, name: "落马石头礼", description: "宫崎骏系列", eventType: "活动", status: "已上线", timeType: "span", startTime: "2025-11-19 10:00:00", endTime: "2025-12-04 23:59:59", source: "-", remark: "-",
    logs: [
      { id: 1, operator: "zhangsan",  time: "2025-11-18 09:30:00", action: "创建-手动" as const, detail: "活动手动录入" },
      { id: 2, operator: "dorrawang", time: "2025-11-18 15:00:00", action: "状态变更" as const, detail: "待审核 → 已审核" },
    ],
  },
  { id: 10508, name: "爆裂大爆炸队列", description: "-", eventType: "版本", status: "已上线", timeType: "span", startTime: "2025-11-07 02:00:00", endTime: "2025-11-28 06:00:00", source: "-", remark: "-",
    logs: [
      { id: 1, operator: "dorrawang", time: "2025-11-06 18:00:00", action: "创建-手动" as const, detail: "版本更新手动录入" },
      { id: 2, operator: "dorrawang", time: "2025-11-06 18:30:00", action: "状态变更" as const, detail: "待审核 → 已审核" },
    ],
  },
  { id: 10143, name: "无畏契约正式服上线", description: "无畏契约手游开服", eventType: "版本", status: "已上线", timeType: "span", startTime: "2025-08-19 10:00:00", endTime: "2025-09-19 23:59:59", source: "-", remark: "-", alias: "CFM上线, 手游开服, 源能行动上线",
    logs: [
      { id: 1, operator: "dorrawang", time: "2025-08-18 12:00:00", action: "创建-手动" as const, detail: "重大版本事件手动录入" },
      { id: 2, operator: "lisi",      time: "2025-08-18 14:00:00", action: "编辑"     as const, detail: "补充别名：CFM上线, 手游开服, 源能行动上线" },
      { id: 3, operator: "dorrawang", time: "2025-08-18 16:00:00", action: "状态变更" as const, detail: "待审核 → 已审核" },
    ],
  },
  // 固定周期（按星期重复）
  { id: 20001, name: "周常竞技赛", description: "每周固定开放的排位竞技赛", eventType: "比赛", status: "已上线", timeType: "recurring", startTime: "-", endTime: "-", recurringWeekdays: [3, 5], recurringTimeRange: ["19:00", "21:00"], recurringDurationDays: 1, timeDesc: "每周三、周五 19:00-21:00", source: "-", remark: "-",
    logs: [
      { id: 1, operator: "dorrawang", time: "2025-09-01 10:00:00", action: "创建-手动" as const, detail: "固定周期赛事手动录入" },
      { id: 2, operator: "dorrawang", time: "2025-09-01 10:20:00", action: "状态变更" as const, detail: "待审核 → 已审核" },
    ],
  },
  { id: 20002, name: "每日签到有礼", description: "每天登录即可领取签到奖励", eventType: "活动", status: "已上线", timeType: "recurring", startTime: "-", endTime: "-", recurringWeekdays: [1, 2, 3, 4, 5, 6, 7], recurringTimeRange: ["00:00", "23:59"], timeDesc: "每天 00:00-23:59", source: "-", remark: "-", alias: "每日签到, 签到奖励",
    logs: [
      { id: 1, operator: "lisi", time: "2025-06-10 09:00:00", action: "创建-手动" as const, detail: "常驻活动手动录入" },
      { id: 2, operator: "dorrawang", time: "2025-06-10 09:30:00", action: "状态变更" as const, detail: "待审核 → 已审核" },
    ],
  },
  { id: 20003, name: "周末双倍经验", description: "周末登录游戏经验获取翻倍", eventType: "活动", status: "已上线", timeType: "recurring", startTime: "-", endTime: "-", recurringWeekdays: [6, 7], recurringTimeRange: ["00:00", "23:59"], recurringDurationDays: 2, timeDesc: "每周六开始，连续两天全天", source: "-", remark: "-",
    logs: [
      { id: 1, operator: "zhangsan", time: "2026-04-02 15:00:00", action: "创建-手动" as const, detail: "常驻活动手动录入，待审核" },
    ],
  },
  // 时间未定
  { id: 21001, name: "赛季冲刺周末战", description: "赛季末冲刺活动，活动期内每周五晚开启并持续两天", eventType: "活动", status: "已上线", timeType: "hybrid", startTime: "2026-08-01 00:00:00", endTime: "2026-10-31 23:59:59", recurringWeekdays: [5], recurringTimeRange: ["19:00", "23:00"], recurringDurationDays: 2, timeDesc: "2026/08-10 有限期，每周五晚开启并跨周末", source: "-", remark: "-", alias: "冲刺周末战, 周末冲刺",
    logs: [
      { id: 1, operator: "dorrawang", time: "2026-07-20 10:00:00", action: "创建-手动" as const, detail: "有限期周期活动手动录入" },
      { id: 2, operator: "dorrawang", time: "2026-07-20 10:20:00", action: "状态变更" as const, detail: "待审核 → 已审核" },
    ],
  },
  { id: 30001, name: "新英雄·夜莺上线", description: "新英雄夜莺预告，具体上线时间待定", eventType: "版本", status: "已上线", timeType: "undetermined", startTime: "-", endTime: "-", timeDesc: "预计S34赛季上线，具体时间待官方公布", source: "-", remark: "-", alias: "夜莺, 新英雄预告",
    logs: [
      { id: 1, operator: "lisi", time: "2026-04-15 11:00:00", action: "创建-手动" as const, detail: "根据预告片手动录入，时间未定" },
    ],
  },
  { id: 30002, name: "跨界联动活动", description: "与知名动漫IP的联动活动，细节洽谈中", eventType: "活动", status: "已上线", timeType: "undetermined", startTime: "-", endTime: "-", timeDesc: "合作细节未最终确定，暂无排期", source: "-", remark: "-",
    logs: [
      { id: 1, operator: "dorrawang", time: "2026-04-20 09:40:00", action: "创建-手动" as const, detail: "根据市场部消息手动录入" },
    ],
  },
  { id: 30003, name: "下一届全国大赛", description: "年度全国大赛，赛程尚未公布", eventType: "比赛", status: "已上线", timeType: "undetermined", startTime: "-", endTime: "-", timeDesc: "上一届已结束，新一届赛程待官方公布", source: "-", remark: "-",
    logs: [
      { id: 1, operator: "zhangsan", time: "2026-03-10 14:00:00", action: "创建-手动" as const, detail: "赛事手动录入，等待赛程公布" },
      { id: 2, operator: "dorrawang", time: "2026-03-10 16:00:00", action: "状态变更" as const, detail: "待审核 → 已审核" },
    ],
  },
];

export const mockFacts: Fact[] = [
  {
    id: 37958, title: "钛鼠在隐士修所a点如何使用来日审判进攻",
    content: "钛鼠的终极技能末日审判在满储蓄力后释放可形成大范围伤害区域。在隐士修所A点进攻时，建议先使用闪光弹清除防守方视野，然后在A大道或A小道入口处释放末日审判。该技能的覆盖范围可以迫使防守方撤离常规防守位置，为队友创造推进空间。注意释放时需要确保自身安全，建议有队友配合掩护。",
    status: "已上线",
    keywords: "[12087] 雷蛇榴弹, [12081] 精准预测, [11961] 激流勇进",
    category: "英雄攻略-钛狐", sourceType: "任务相关-勇士学院",
    source: "勇士学院训练(211160049910000)",
    sourceContent: "问题：勇士学院训练 答案1：【勇士学院训练】分为战斗技巧、英雄训练、攻防训练三部分 1、战斗技巧5：掌握设计、身法、拆除爆能器等相关技巧 2...",
    startTime: "2026-01-15 10:00:00", endTime: "2026-06-30 23:59:59",
    timeDesc: "长期有效，每赛季更新",
    relatedEvents: "[10926] 九九大吉, [10889] 联赛冠军赛",
    conflict: "[37957] 不死鸟在日落之城a点怎么使用手感火热防守",
    duplicate: "[37956] 蟾蜍在日落之城b点如何使用停云进攻",
    env: "prod",
    syncStatus: "success", syncAt: "2026-04-20 10:00:08",
    logs: [
      { id: 1, operator: "dorrawang", time: "2026-01-15 10:00:00", action: "创建-导入" as const, detail: "白皮书批量导入，默认已审核" },
      { id: 2, operator: "zhangsan",  time: "2026-02-10 14:23:11", action: "编辑"    as const, detail: "修正技能描述：末日审判范围数据更新" },
      { id: 3, operator: "dorrawang", time: "2026-03-05 09:41:55", action: "状态变更" as const, detail: "已审核 → 已上线" },
      { id: 4, operator: "lisi",      time: "2026-04-01 16:08:30", action: "状态变更" as const, detail: "已上线 → 已下线；原因：版本更新需修订" },
      { id: 5, operator: "dorrawang", time: "2026-04-20 10:00:00", action: "状态变更" as const, detail: "已下线 → 已上线" },
    ],
  },
  {
    id: 37957, title: "不死鸟在日落之城a点怎么使用手感火热防守",
    content: "英雄不死鸟的技能'手感火热'可投掷一个火球，撞击地面后形成持续燃烧的火海。在日落之城A点防守时，推荐在回合开始时将火球投掷至A主通道地面，可有效延缓进攻方的推进节奏。火海持续约7秒，期间敌方通过会受到持续伤害。配合队友的减速或控制技能效果更佳。注意火球飞行有弧度，需要练习投掷角度以精准覆盖关键通道。",
    status: "已上线",
    keywords: "[12062] 地震炮, [11928] 大厅",
    category: "英雄攻略-不死鸟", sourceType: "任务相关-勇士学院",
    source: "勇士学院新兵认证(211160049930000)",
    sourceContent: "问题：勇士学院新兵认证 答案1：【勇士学院新兵认证】分为新兵、精英、专家三个部分，完成前一认证阶段才可开启下一阶段...",
    startTime: "-", endTime: "-", timeDesc: "-", relatedEvents: "-", conflict: "-",
    env: "prod",
    syncStatus: "failed", syncError: "向量服务超时（5000ms），请重试或联系运维", syncAt: "2026-04-29 18:42:11",
    logs: [
      { id: 1, operator: "dorrawang", time: "2026-01-15 10:00:00", action: "创建-导入" as const, detail: "白皮书批量导入，默认已审核" },
      { id: 2, operator: "dorrawang", time: "2026-03-20 11:15:40", action: "状态变更" as const, detail: "已审核 → 已上线" },
    ],
  },
  {
    id: 37956, title: "蟾蜍在日落之城b点如何使用停云进攻",
    content: "特工蟾蜍的技能停云在回合开始前可以拾取并重新部署。在日落之城B点进攻时，建议将停云部署在B通道入口，遮挡防守方的视野后快速推进。停云的持续时间较长，可以为团队提供持续的掩护。配合闪光弹使用效果更佳，先投闪光再借助停云推进是常见的战术组合。",
    status: "已上线",
    keywords: "[11938] 白银1-4, [11937] 青铜1-3",
    category: "英雄攻略-蟾蜍", sourceType: "-", source: "-",
    sourceContent: "模块名称：任务 模块简介：分为每日任务和每周任务，累计完成10个任意任务可领取周奖励，奖励包含通行证经验",
    startTime: "-", endTime: "-", timeDesc: "-", relatedEvents: "-", conflict: "-",
    env: "test",
    syncStatus: "success", syncAt: "2026-04-28 14:55:08",
    logs: [
      { id: 1, operator: "zhangsan",  time: "2026-04-10 09:00:00", action: "创建-手动" as const, detail: "测试环境手动新建" },
      { id: 2, operator: "zhangsan",  time: "2026-04-10 10:30:22", action: "编辑"     as const, detail: "补充来源内容字段" },
      { id: 3, operator: "dorrawang", time: "2026-04-28 14:55:03", action: "状态变更" as const, detail: "待审核 → 已审核" },
    ],
  },
  {
    id: 37955, title: "暮褐在岸堡战场进攻时如何使用烟雾",
    content: "霸凝为暮褐的基础技能，可投掷烟雾道具形成遮挡视野的烟雾墙。在岸堡战场进攻时，推荐在中路或A大道释放烟雾，切断防守方的视野线。烟雾持续约15秒，期间可以安全地切换位置或架设道具。暮褐的烟雾墙是目前游戏中持续时间最长的视野遮挡技能之一，合理使用可以大幅提升团队的战术灵活性。",
    status: "已上线",
    keywords: "[11936] 黑铁1-3",
    category: "英雄攻略-暮褐", sourceType: "-", source: "-", sourceContent: "-",
    startTime: "-", endTime: "-", timeDesc: "-", relatedEvents: "-", conflict: "-",
    env: "test",
    syncStatus: "pending",
    logs: [
      { id: 1, operator: "lisi", time: "2026-05-01 16:20:00", action: "创建-导入" as const, detail: "事实提取后从缓冲池批量入库" },
    ],
  },
];

/** 抽取缓冲池 mock 数据 */
export const mockExtractBuffer: ExtractBufferItem[] = [
  {
    bufferId: "buf_001",
    extractedAt: "2026-05-06 09:30:00",
    title: "霓虹技能价格与大招点数",
    content: "在游戏《无畏契约》中，特工霓虹的技能及其获取方式为：高速通道需花费300资金，闪电弹球需花费300资金，充能疾驰通过充能获取能量，超限暴走需要消耗7点大招点数。",
    category: "",
    entities: ["霓虹", "技能", "高速通道", "闪电弹球", "充能疾驰", "超限暴走", "大招点"],
    newEntities: [],
    events: [],
    newEvents: [],
    startTime: "",
    endTime: "",
    timeDesc: "",
    conflict: {
      detected: true,
      reason: "新事实中闪电弹球价格为300资金，超限暴走需要7点大招点数；而已审核事实[ID:10002]中闪电弹球价格为200资金，超限暴走需要8点大招点数。两者在数值上存在直接冲突。",
      factId: "ID:10002",
      factContent: "霓虹的技能价格为：高速通道300资金，闪电弹球200资金，充能疾驰免费通过充能获取能量，超限暴走需要8点大招点数。",
    },
    bufferStatus: "待审核",
  },
  {
    bufferId: "buf_002",
    extractedAt: "2026-05-06 09:30:00",
    title: "勇士学院训练模块说明",
    content: "勇士学院训练分为战斗技巧、英雄训练和攻防训练三部分。每个英雄的训练分为入门和进阶两部分。",
    category: "",
    entities: ["勇士学院", "战斗技巧", "英雄训练", "攻防训练"],
    newEntities: ["攻防训练"],
    events: [],
    newEvents: [],
    startTime: "",
    endTime: "",
    timeDesc: "",
    conflict: null,
    bufferStatus: "待审核",
  },
];

export const entityTreeData: CategoryNode[] = [
  { name: "事件类型", count: 6, children: [] },
  { name: "机制", count: 19, children: [] },
  { name: "术语", count: 26, children: [
    { name: "经验", count: 0 },
  ]},
  { name: "彩蛋", count: 2, children: [] },
  { name: "段位", count: 17, children: [] },
  { name: "界面元素", count: 23, children: [] },
  { name: "烟雾", count: 4, children: [] },
  { name: "技巧", count: 75, children: [] },
  { name: "战术", count: 42, children: [] },
  { name: "游戏", count: 2, children: [
    { name: "恶意游戏行为", count: 0 },
    { name: "使用作弊工具", count: 0 },
    { name: "行为受限", count: 0 },
  ]},
  { name: "操作布局", count: 3, children: [] },
  { name: "系统功能", count: 15, children: [
    { name: "好友系统", count: 2 },
    { name: "设置", count: 5 },
  ]},
  { name: "装备", count: 30, children: [
    { name: "武器", count: 18, children: [
      { name: "步枪", count: 8, children: [
        { name: "突击步枪", count: 4 },
        { name: "战术步枪", count: 4 },
      ]},
      { name: "狙击枪", count: 5 },
      { name: "霰弹枪", count: 3 },
      { name: "冲锋枪", count: 2 },
    ]},
    { name: "护甲", count: 6, children: [
      { name: "轻甲", count: 3 },
      { name: "重甲", count: 3 },
    ]},
    { name: "道具", count: 6 },
  ]},
  { name: "英雄", count: 120, children: [
    { name: "哨位", count: 30, children: [
      { name: "斯凯", count: 8 },
      { name: "索瓦", count: 12 },
      { name: "飞刀", count: 10 },
    ]},
    { name: "决斗", count: 35, children: [
      { name: "不死鸟", count: 10, children: [
        { name: "技能组合", count: 5 },
        { name: "地图攻略", count: 5 },
      ]},
      { name: "霓虹", count: 8 },
      { name: "锐势", count: 9 },
      { name: "零", count: 8 },
    ]},
    { name: "先锋", count: 25 },
    { name: "控场", count: 30, children: [
      { name: "蟾蜍", count: 10 },
      { name: "暮褐", count: 10 },
      { name: "港口守卫", count: 10 },
    ]},
  ]},
];

export const categoryTree: CategoryNode[] = [
  { name: "全部分类", count: 0, children: [] },
  { name: "未分类", count: 0, children: [] },
  { name: "任务相关", count: 3, children: [] },
  { name: "公告相关", count: 3, children: [] },
  { name: "商业化", count: 418, children: [
    { name: "皮肤", count: 200 },
    { name: "通行证", count: 100 },
    { name: "抽奖", count: 118 },
  ]},
  { name: "地图", count: 39, children: [] },
  { name: "常见问题", count: 1057, children: [
    { name: "账号问题", count: 300 },
    { name: "充值问题", count: 200 },
    { name: "游戏问题", count: 557 },
  ]},
  { name: "攻略", count: 7730, children: [
    { name: "英雄攻略", count: 5000 },
    { name: "地图攻略", count: 1500 },
    { name: "战术攻略", count: 1230 },
  ]},
  { name: "服务类&福利", count: 66, children: [] },
  { name: "游戏指引", count: 75, children: [] },
  { name: "游戏活动", count: 23, children: [] },
  { name: "玩法模式", count: 27, children: [] },
  { name: "装备相关", count: 133, children: [] },
  { name: "赛事相关", count: 3, children: [] },
  { name: "隐私合规", count: 3, children: [] },
];
