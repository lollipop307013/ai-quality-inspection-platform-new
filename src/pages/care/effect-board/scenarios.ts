import { definePageScenarios } from '@/pageScenario';

const pageScenarios = definePageScenarios({
  default: {
    label: '正常有数据',
    description: '近 7 天 + 全部渠道，默认停留在总览 Tab，指标卡、3 张趋势小图与拦截原因 Top 5 均有数据。',
  },
  past30: {
    label: '近 30 天多渠道',
    description: '近 30 天 + 全部渠道，策略列表含范围外置灰策略（老用户回流关怀、段位掉落安抚等），趋势图 30 个数据点。',
  },
  over31: {
    label: '时间跨度超过 31 天',
    description: '自定义 2026-01-01 ~ 2026-08-10，指标卡与拦截原因正常，趋势图与对比图不渲染并显示跨度提示。',
  },
  empty: {
    label: '当前筛选范围无数据',
    description: '自定义 2026-02-01 ~ 2026-02-28（所有策略生效时间之前），指标卡显示 0，趋势图、Top5、策略列表均为空态。',
  },
  'strategy-zero': {
    label: '策略详情 - 选中 0 项',
    description: '策略详情 Tab 暂无勾选，清除选择与对比按钮禁用，无单策略详情面板。',
  },
  'strategy-one': {
    label: '策略详情 - 选中 1 项(整策略)',
    description: '勾选「对局失败关怀」整策略，底部出现单策略详情面板（聚合视角 + 拦截原因 + 渠道拆分），对比按钮仍禁用。',
  },
  'strategy-one-channel': {
    label: '策略详情 - 选中 1 项(单渠道)',
    description: '点选「对局失败关怀」的小程序渠道 chip，单策略详情面板标题显示渠道名，且隐藏渠道拆分卡片。',
  },
  'strategy-compare': {
    label: '策略详情 - 选中 2~3 项',
    description: '勾选 3 条策略，单策略详情面板隐藏，对比按钮激活；点击打开对比弹窗（指标表 + 3 张趋势对比 + 渠道拆分对比）。',
  },
  'strategy-partial': {
    label: '策略详情 - 部分覆盖提示',
    description: '筛选自定义 2026-07-13 ~ 2026-07-24，仅勾选「紧急活动推送」（生效 2026-07-20 ~ 07-30），单策略面板显示橙色「实际覆盖 5 天」chip。',
  },
  'care-tag-filter': {
    label: '策略详情 - 关怀类型筛选',
    description: '关怀类型筛选切换为「活动提醒」，列表只保留福利活动提醒、紧急活动推送、版本更新提醒。',
  },
  'user-no-input': {
    label: '用户触达 - 未查询',
    description: '尚未输入 open_id，仅展示输入引导文案。',
  },
  'user-not-found': {
    label: '用户触达 - 未找到用户',
    description: '输入 9999999，显示「未找到用户 9999999 的触达记录」。',
  },
  'user-no-record': {
    label: '用户触达 - 用户无记录',
    description: '近 30 天 + 企微渠道下查询 10088（其记录均为小程序），显示「用户 10088 在当前时间范围及渠道：企微下无触达记录」。',
  },
  'user-with-records': {
    label: '用户触达 - 有记录',
    description: '近 30 天 + 全部渠道下查询 10086，展示该用户 3 条触达记录（含成功与失败明细）。',
  },
});

export type EffectBoardScenario = keyof typeof pageScenarios;

export default pageScenarios;
