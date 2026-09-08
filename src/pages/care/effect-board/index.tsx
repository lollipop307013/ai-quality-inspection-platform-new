import { useEffect, useMemo, useState } from 'react';
import * as echarts from 'echarts';
import ReactECharts from 'echarts-for-react';
import {
  Button,
  Card,
  Checkbox,
  DateRangePicker,
  Dialog,
  Input,
  MessagePlugin,
  Select,
  Table,
  Tabs,
  Tag,
} from 'tdesign-react';
import type { DateRangePickerProps, PrimaryTableCol, SelectValue } from 'tdesign-react';
import TooltipIcon from '@/components/TooltipIcon';
import echartsTheme from '@/design-tokens/zhijilab-echarts-theme.json';
import { usePageScenario } from '@/pageScenario';
import {
  ALL_CHANNELS,
  BLOCK_REASON_LABEL,
  CARE_TAG_OPTIONS,
  CARE_STRATEGIES,
  CHANNEL_COLOR,
  STATUS_FILTER_OPTIONS,
  STATUS_LABEL,
  TIME_PRESET_OPTIONS,
  TODAY,
  computeTimeRange,
  getBlockReasonRows,
  getCompareItems,
  getComboStrategyChannelSplit,
  getDayLabels,
  getOverviewMetrics,
  getRecordStrategyMeta,
  getScale,
  getSingleStrategyDetail,
  getStrategyRows,
  getTrendLines,
  isStrategyInRange,
  offsetDays,
  queryUserReach,
} from './mock';
import type { EffectBoardScenario } from './scenarios';
import type {
  BlockReasonRow,
  StrategyRow,
} from './mock';
import type {
  ChannelFilterValue,
  ChannelName,
  TimeRange,
  TimeRangePreset,
} from './types';
import styles from './index.module.less';

const pad = (v: number) => String(v).padStart(2, '0');
const formatInt = (v: number | null) => (v === null ? '--' : v.toLocaleString('zh-CN'));

// hex 转 rgba，用于 area fill 与胶囊底色
const withAlpha = (hex: string, alpha: number) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const STATUS_TAG_THEME: Record<string, 'success' | 'warning' | 'default' | 'danger' | 'primary'> = {
  active: 'success',
  paused: 'warning',
  completed: 'default',
  pending: 'primary',
  testing: 'primary',
  launch_failed: 'danger',
};

const BLOCK_ROW_COLOR: Record<string, string> = {
  freq_limited: '#5B8FF9',
  silent_blocked: '#7FA5F1',
  no_available_channel: '#9DBCF5',
  service_disabled: '#B9D0F8',
  other: '#D3E1FB',
};

type TabKey = 'overview' | 'strategies' | 'userReach';

const isChannelCombo = (comboId: string) => comboId.includes('__');

const parseCombo = (comboId: string) => {
  const sepIdx = comboId.indexOf('__');
  if (sepIdx === -1) return { strategyId: comboId, channel: null as ChannelName | null };
  return {
    strategyId: comboId.substring(0, sepIdx),
    channel: comboId.substring(sepIdx + 2) as ChannelName,
  };
};

// ===== 拦截原因进度行（与设计稿一致：标签 + 彩色数值 + 进度条）=====
function BlockReasonList({ rows }: { rows: BlockReasonRow[] }) {
  const maxCount = Math.max(...rows.map((r) => r.count), 1);
  return (
    <div className={styles.blockReasonList}>
      {rows.map((r) => {
        const color = BLOCK_ROW_COLOR[r.key];
        return (
          <div key={r.key}>
            <div className={styles.blockReasonHeader}>
              <span className={styles.blockReasonName}>{r.name}</span>
              <span className={styles.blockReasonCount} style={{ background: withAlpha(color, 0.12) }}>
                {r.count.toLocaleString('zh-CN')}
              </span>
            </div>
            <div className={styles.blockReasonTrack}>
              <div
                className={styles.blockReasonBar}
                style={{
                  width: `${(r.count / maxCount * 100).toFixed(0)}%`,
                  background: `linear-gradient(90deg, ${withAlpha(color, 0.95)}, ${withAlpha(color, 0.68)})`,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ===== 空态/超跨度提示框 =====
function ChartPlaceholder({ text }: { text: string }) {
  return <div className={styles.chartPlaceholder}>{text}</div>;
}

export default function EffectBoardPage() {
  const previewScenario = usePageScenario<EffectBoardScenario>();

  const [tab, setTab] = useState<TabKey>('overview');
  const [timePreset, setTimePreset] = useState<TimeRangePreset>('past7');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [range, setRange] = useState<TimeRange>(() => computeTimeRange('past7', '', ''));
  const [channel, setChannel] = useState<ChannelFilterValue>('all');
  const [keyword, setKeyword] = useState('');
  const [careTag, setCareTag] = useState<(typeof CARE_TAG_OPTIONS)[number]>('全部');
  const [statusFilter, setStatusFilter] = useState('all');
  const [combos, setCombos] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [userInput, setUserInput] = useState('');

  // 场景切换时重置初始状态
  useEffect(() => {
    setTab('overview');
    setCombos([]);
    setCompareOpen(false);
    setUserInput('');
    setKeyword('');
    setCareTag('全部');
    setStatusFilter('all');

    const applyRange = (preset: TimeRangePreset, cs: string, ce: string) => {
      setTimePreset(preset);
      setCustomStart(cs);
      setCustomEnd(ce);
      setRange(computeTimeRange(preset, cs, ce));
    };

    switch (previewScenario) {
      case 'past30':
        applyRange('past30', '', '');
        setChannel('all');
        break;
      case 'over31':
        applyRange('custom', offsetDays(-230), offsetDays(0));
        setChannel('all');
        break;
      case 'empty':
        applyRange('custom', offsetDays(-200), offsetDays(-180));
        setChannel('all');
        break;
      case 'strategy-zero':
      case 'strategy-one':
      case 'strategy-one-channel':
      case 'care-tag-filter':
        applyRange('past7', '', '');
        setChannel('all');
        setTab('strategies');
        if (previewScenario === 'strategy-one') setCombos(['stg_001']);
        if (previewScenario === 'strategy-one-channel') setCombos(['stg_001__小程序']);
        if (previewScenario === 'care-tag-filter') setCareTag('活动提醒');
        break;
      case 'strategy-compare':
        applyRange('past7', '', '');
        setChannel('all');
        setTab('strategies');
        setCombos(['stg_001', 'stg_002', 'stg_003']);
        break;
      case 'strategy-partial':
        applyRange('past7', '', '');
        setChannel('all');
        setTab('strategies');
        setCombos(['stg_001']);
        break;
      case 'user-no-input':
        applyRange('past7', '', '');
        setChannel('all');
        setTab('userReach');
        break;
      case 'user-not-found':
        applyRange('past7', '', '');
        setChannel('all');
        setTab('userReach');
        setUserInput('9999999');
        break;
      case 'user-no-record':
        applyRange('past30', '', '');
        setChannel('企微');
        setTab('userReach');
        setUserInput('10088');
        break;
      case 'user-with-records':
        applyRange('past30', '', '');
        setChannel('all');
        setTab('userReach');
        setUserInput('10086');
        break;
      default:
        applyRange('past7', '', '');
        setChannel('all');
    }
  }, [previewScenario]);

  // ===== 时间 / 渠道 =====
  const handlePresetChange = (value: SelectValue) => {
    const preset = value as TimeRangePreset;
    setTimePreset(preset);
    if (preset !== 'custom') {
      setRange(computeTimeRange(preset, customStart, customEnd));
    }
  };

  // DateRangePicker 受控 value：用默认字符串格式（YYYY-MM-DD），必须始终传数组（undefined 会导致 TDesign 抛错）
  const customRangeValue = useMemo<DateRangePickerProps['value']>(
    () => (customStart && customEnd ? [customStart, customEnd] : []),
    [customStart, customEnd],
  );

  const handleCustomRangeChange = (value: unknown) => {
    if (!Array.isArray(value) || value.length !== 2) return;
    const [s, e] = value;
    if (typeof s !== 'string' || typeof e !== 'string' || !s || !e) return;
    if (s === customStart && e === customEnd) return;
    if (e < s) {
      MessagePlugin.warning('截止日期不能早于起始日期');
      return;
    }
    if (s > TODAY || e > TODAY) {
      MessagePlugin.warning('起止日期不能超过当前日期');
      return;
    }
    setCustomStart(s);
    setCustomEnd(e);
    setRange(computeTimeRange('custom', s, e));
  };

  const handleChannelChange = (value: SelectValue) => {
    setChannel(value as ChannelFilterValue);
  };

  // 渠道/时间变化后，清掉不在新范围内的已选组合
  useEffect(() => {
    setCombos((current) => current.filter((comboId) => {
      const { strategyId, channel: comboChannel } = parseCombo(comboId);
      const s = CARE_STRATEGIES.find((x) => x.id === strategyId);
      if (!s) return false;
      if (!isStrategyInRange(s, range)) return false;
      if (channel !== 'all' && !s.channels.includes(channel)) return false;
      if (comboChannel && channel !== 'all' && comboChannel !== channel) return false;
      return true;
    }));
  }, [range, channel]);

  // ===== 总览数据 =====
  const overviewMetrics = useMemo(() => getOverviewMetrics(range, channel), [range, channel]);
  const trendEmpty = overviewMetrics.totalSend === 0;
  const trendSkipped = range.days > 31;
  const dayLabels = useMemo(() => getDayLabels(range), [range]);

  const CJK_FONT_STACK = '-apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", "Helvetica Neue", Helvetica, Arial, sans-serif';

  // 三张趋势图共享一个 connect 分组：hover 某个日期时三张图联动高亮
  const onTrendChartReady = (chart: echarts.ECharts) => {
    chart.group = 'careEffectTrend';
    echarts.connect('careEffectTrend');
  };

  const buildTrendOption = (kind: 'send' | 'reach' | 'block') => {
    const lines = getTrendLines(range, channel, kind);
    return {
      tooltip: { trigger: 'axis' },
      legend: {
        show: lines.length > 1,
        bottom: 0,
        itemWidth: 16,
        itemHeight: 8,
        textStyle: { fontSize: 12, color: '#666', fontFamily: CJK_FONT_STACK },
        data: lines.map((l) => l.name),
      },
      grid: { left: 56, right: 24, top: 16, bottom: 36 },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: dayLabels,
        axisLabel: { fontSize: 11, color: '#86909c', fontFamily: CJK_FONT_STACK },
        axisTick: { show: false },
        axisLine: { lineStyle: { color: '#e7e9eb' } },
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          fontSize: 11,
          color: '#86909c',
          fontFamily: CJK_FONT_STACK,
          formatter: (v: number) => v.toLocaleString('zh-CN'),
        },
        splitLine: { lineStyle: { color: '#f2f3f5' } },
      },
      series: lines.map((l) => ({
        name: l.name,
        type: 'line' as const,
        smooth: true,
        data: l.data,
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: { width: 2, color: l.color },
        itemStyle: { color: l.color },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: withAlpha(l.color, 0.16) },
            { offset: 1, color: withAlpha(l.color, 0) },
          ]),
        },
      })),
    };
  };

  const blockRows = useMemo(
    () => (trendEmpty ? [] : getBlockReasonRows(Math.max(0, overviewMetrics.totalSend - overviewMetrics.totalReach))),
    [trendEmpty, overviewMetrics],
  );

  // ===== 策略列表 =====
  const strategyRows = useMemo(
    () => getStrategyRows({ keyword, careTag, status: statusFilter, channel, range }),
    [keyword, careTag, statusFilter, channel, range],
  );

  const isSelectable = (strategyId: string, comboChannel: ChannelName | null, silent = false) => {
    const s = CARE_STRATEGIES.find((x) => x.id === strategyId);
    if (!s) return false;
    if (!isStrategyInRange(s, range)) {
      if (!silent) MessagePlugin.warning('该策略不在当前筛选时间范围内，暂不支持点选');
      return false;
    }
    if (channel !== 'all' && !s.channels.includes(channel)) {
      if (!silent) MessagePlugin.warning('该策略不在当前渠道范围内，暂不支持点选');
      return false;
    }
    if (comboChannel && channel !== 'all' && comboChannel !== channel) {
      if (!silent) MessagePlugin.warning('该渠道不在当前筛选范围内，暂不支持点选');
      return false;
    }
    return true;
  };

  const toggleCombo = (strategyId: string, comboChannel: ChannelName) => {
    if (!isSelectable(strategyId, comboChannel)) return;
    const comboId = `${strategyId}__${comboChannel}`;
    setCombos((current) => {
      if (current.includes(comboId)) return current.filter((c) => c !== comboId);
      if (current.length >= 3) {
        MessagePlugin.warning('最多只能选 3 项进行对比');
        return current;
      }
      return [...current.filter((c) => c !== strategyId), comboId];
    });
  };

  const toggleWholeStrategy = (strategyId: string) => {
    if (!isSelectable(strategyId, null)) return;
    setCombos((current) => {
      if (current.includes(strategyId)) return current.filter((c) => c !== strategyId);
      if (current.length >= 3) {
        MessagePlugin.warning('最多只能选 3 项进行对比');
        return current;
      }
      const next = current.filter((c) => {
        const { strategyId: sid } = parseCombo(c);
        return sid !== strategyId;
      });
      return [...next, strategyId];
    });
  };

  const clearSelection = () => {
    setCombos([]);
    MessagePlugin.success('已清除所有选择');
  };

  // ===== 单策略详情 =====
  const singleCombo = combos.length === 1 ? combos[0] : null;
  const singleDetail = useMemo(() => {
    if (!singleCombo) return null;
    const { strategyId, channel: comboChannel } = parseCombo(singleCombo);
    return getSingleStrategyDetail(strategyId, comboChannel, channel, range);
  }, [singleCombo, channel, range]);

  // ===== 对比弹窗 =====
  const compareItems = useMemo(
    () => (compareOpen ? getCompareItems(combos, range, channel) : []),
    [compareOpen, combos, range, channel],
  );

  const buildCompareChartOption = (items: NonNullable<typeof compareItems>, kind: 'send' | 'reach' | 'block') => {
    const series = items.map((it) => {
      let data = it.trend;
      if (kind === 'reach') {
        const ratio = it.send > 0 ? it.reach / it.send : 0;
        data = it.trend.map((v) => Math.round(v * ratio));
      } else if (kind === 'block') {
        data = it.trend.map((v) => Math.max(0, Math.round(v * 0.12)));
      }
      return {
        name: it.label,
        type: 'line' as const,
        smooth: true,
        data,
        symbol: 'circle',
        symbolSize: 5,
        lineStyle: { width: 2, color: it.color },
        itemStyle: { color: it.color },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: withAlpha(it.color, 0.12) },
            { offset: 1, color: withAlpha(it.color, 0) },
          ]),
        },
      };
    });
    return {
      tooltip: { trigger: 'axis' },
      grid: { left: 56, right: 24, top: 16, bottom: 22 },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: dayLabels,
        axisLabel: { fontSize: 11, color: '#86909c', fontFamily: CJK_FONT_STACK },
        axisTick: { show: false },
        axisLine: { lineStyle: { color: '#e7e9eb' } },
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          fontSize: 11,
          color: '#86909c',
          fontFamily: CJK_FONT_STACK,
          formatter: (v: number) => v.toLocaleString('zh-CN'),
        },
        splitLine: { lineStyle: { color: '#f2f3f5' } },
      },
      series,
    };
  };

  // ===== 用户触达（输入实时刷新）=====
  const userResult = useMemo(() => queryUserReach(userInput, range, channel), [userInput, range, channel]);

  // ===== 策略表格列 =====
  const strategyColumns: PrimaryTableCol<StrategyRow>[] = [
    {
      colKey: 'checkbox',
      title: '',
      width: 44,
      cell: ({ row }) => {
        const wholeSelected = combos.includes(row.id);
        const hasChipSelected = combos.some((c) => c.startsWith(`${row.id}__`));
        const disabled = !row.inRange || (hasChipSelected && !wholeSelected);
        return (
          <Checkbox
            checked={wholeSelected}
            disabled={disabled}
            onChange={() => toggleWholeStrategy(row.id)}
          />
        );
      },
    },
    {
      colKey: 'name',
      title: '策略名称',
      width: 240,
      cell: ({ row }) => {
        const wholeSelected = combos.includes(row.id);
        return (
          <div className={styles.strategyNameCell}>
            <div className={styles.strategyNameLine}>
              <span
                className={`${styles.strategyName} ${!row.inRange ? styles.notAllowed : ''} ${wholeSelected ? styles.strategyNameActive : ''}`}
                onClick={() => row.inRange && toggleWholeStrategy(row.id)}
              >
                {row.name}
              </span>
              <span className={styles.careTagChip}>{row.careTag}</span>
              {!row.inRange && <span className={styles.outOfRangeTag}>不在筛选时间范围</span>}
            </div>
            <div className={styles.strategyEffective}>{row.effectiveDisplay}</div>
            {row.inRange && (
              <div className={styles.strategyCoverage}>覆盖 {row.intersectionDays} 天</div>
            )}
          </div>
        );
      },
    },
    {
      colKey: 'channels',
      title: '渠道（点选对比）',
      width: 200,
      cell: ({ row }) => {
        const visibleChannels = channel === 'all' ? row.channels : row.channels.filter((c) => c === channel);
        return (
          <div>
            {visibleChannels.map((c) => {
              const comboId = `${row.id}__${c}`;
              const isSelected = combos.includes(comboId);
              const isWholeSelected = combos.includes(row.id);
              const active = isSelected || isWholeSelected;
              const disabled = !row.inRange || (!active && combos.length >= 3);
              return (
                <span
                  key={c}
                  className={`${styles.channelChip} ${active ? styles.channelChipActive : ''} ${disabled ? styles.channelChipDisabled : ''} ${!row.inRange || (!active && !disabled) ? styles.channelChipGray : ''}`}
                  onClick={() => !disabled && toggleCombo(row.id, c)}
                >
                  {c}{isSelected && ' ×'}
                </span>
              );
            })}
          </div>
        );
      },
    },
    {
      colKey: 'status',
      title: '状态',
      width: 100,
      cell: ({ row }) => (
        <Tag theme={STATUS_TAG_THEME[row.status]} variant="light">{row.statusLabel}</Tag>
      ),
    },
    { colKey: 'send', title: '推送量', width: 100, align: 'right', cell: ({ row }) => formatInt(row.send) },
    { colKey: 'reach', title: '触达量', width: 100, align: 'right', cell: ({ row }) => formatInt(row.reach) },
    { colKey: 'reachUsers', title: '触达人数', width: 100, align: 'right', cell: ({ row }) => formatInt(row.reachUsers) },
    {
      colKey: 'failRate',
      title: '推送失败率',
      width: 110,
      align: 'right',
      cell: ({ row }) => (
        <span className={styles.dangerText}>{row.failRate === null ? '--' : `${row.failRate}%`}</span>
      ),
    },
    {
      colKey: 'freqLimited',
      title: '超频拦截量',
      width: 110,
      align: 'right',
      cell: ({ row }) => (
        <span className={styles.warningText}>{formatInt(row.freqLimited)}</span>
      ),
    },
  ];

  const rowClassName = ({ row }: { row: StrategyRow }) => {
    if (combos.includes(row.id)) return styles.rowSelected;
    if (!row.inRange) return styles.rowDimmed;
    return '';
  };

  // ===== 渲染 =====
  return (
    <div className={styles.page}>
      <div className={styles.breadcrumb}>
        <span className={styles.backLink} onClick={() => MessagePlugin.info('返回主动关怀策略列表')}>‹ 返回列表</span>
        <span className={styles.breadcrumbCurrent}>效果看板</span>
      </div>

      <div className={styles.headerRow}>
        <Tabs value={tab} onChange={(v) => setTab(v as TabKey)} className={styles.tabs}>
          <Tabs.TabPanel value="overview" label="总览" />
          <Tabs.TabPanel value="strategies" label="策略详情" />
          <Tabs.TabPanel value="userReach" label="用户触达" />
        </Tabs>

        <div className={styles.globalFilters}>
          <span className={styles.filterLabel}>时间范围：</span>
          <Select
            value={timePreset}
            options={TIME_PRESET_OPTIONS}
            onChange={handlePresetChange}
            className={styles.presetSelect}
          />
          {timePreset === 'custom' && (
            <DateRangePicker
              value={customRangeValue}
              format="YYYY-MM-DD"
              placeholder={['开始日期', '结束日期']}
              clearable={false}
              onChange={handleCustomRangeChange}
              className={styles.dateRangePicker}
            />
          )}
          <span className={styles.rangeLabel}>{range.start} ~ {range.end}</span>
          <span className={styles.filterLabel}>渠道：</span>
          <Select
            value={channel}
            options={[
              { label: '全部渠道', value: 'all' },
              ...ALL_CHANNELS.map((c) => ({ label: c, value: c })),
            ]}
            onChange={handleChannelChange}
            className={styles.channelSelect}
          />
        </div>
      </div>

      {/* 总览 Tab */}
      {tab === 'overview' && (
        <>
          <div className={styles.metricCards}>
            <div className={styles.metricCard}>
              <div className={styles.metricCardLabel}>运行策略数</div>
              <div className={styles.metricCardValue}>{overviewMetrics.runningCount}</div>
            </div>
            <div className={styles.metricCard}>
              <div className={styles.metricCardLabel}>总推送量</div>
              <div className={styles.metricCardValue}>{overviewMetrics.totalSend.toLocaleString('zh-CN')}</div>
            </div>
            <div className={styles.metricCard}>
              <div className={styles.metricCardLabel}>
                总触达量
                <TooltipIcon content="需异步联动全量消息表进行检查，可能存在时延" />
              </div>
              <div className={styles.metricCardValue}>{overviewMetrics.totalReach.toLocaleString('zh-CN')}</div>
            </div>
            <div className={styles.metricCard}>
              <div className={styles.metricCardLabel}>推送失败率</div>
              <div className={styles.metricCardValue}>{overviewMetrics.failRate}%</div>
            </div>
            <div className={styles.metricCard}>
              <div className={styles.metricCardLabel}>超频拦截量</div>
              <div className={styles.metricCardValue}>{overviewMetrics.freqLimited.toLocaleString('zh-CN')}</div>
            </div>
          </div>

          <Card className={styles.chartCard} bordered={false}>
            <div className={styles.chartTitle}>推送趋势（{range.label} · 项目汇总）</div>
            <div className={styles.trendGrid}>
              {(['send', 'reach', 'block'] as const).map((kind) => {
                const kindLabel = kind === 'send' ? '推送量' : kind === 'reach' ? '触达量' : '超频拦截量';
                return (
                  <div key={kind} className={styles.trendCol}>
                    <div className={styles.trendLabel}>{kindLabel}</div>
                    {trendEmpty ? (
                      <ChartPlaceholder text="当前筛选范围内暂无数据" />
                    ) : trendSkipped ? (
                      <ChartPlaceholder text="当前时间跨度较大，趋势图仅支持展示 31 天内的数据" />
                    ) : (
                      <ReactECharts
                        option={buildTrendOption(kind)}
                        theme={echartsTheme.theme}
                        notMerge
                        onChartReady={onTrendChartReady}
                        style={{ height: 180 }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </Card>

          <Card className={styles.chartCard} bordered={false}>
            <div className={styles.chartTitle}>拦截原因 Top 5</div>
            {blockRows.length === 0 ? (
              <div className={styles.top5Empty}>暂无拦截数据</div>
            ) : (
              <BlockReasonList rows={blockRows} />
            )}
          </Card>
        </>
      )}

      {/* 策略详情 Tab */}
      {tab === 'strategies' && (
        <>
          <Card className={styles.chartCard} bordered={false}>
            <div className={styles.chartTitle}>各策略效果数据</div>
            <div className={styles.strategyFilters}>
              <span className={styles.strategyHint}>勾选 2-3 条策略可进行对比 · 点击策略名查看详情</span>
              <Input
                value={keyword}
                placeholder="搜索策略名称..."
                clearable
                onChange={(v) => setKeyword(v)}
                className={styles.keywordInput}
              />
              <span className={styles.filterLabel}>关怀类型：</span>
              <Select
                value={careTag}
                options={CARE_TAG_OPTIONS.map((t) => ({ label: t, value: t }))}
                onChange={(v) => setCareTag(v as (typeof CARE_TAG_OPTIONS)[number])}
                className={styles.miniSelect}
              />
              <span className={styles.filterLabel}>状态：</span>
              <Select
                value={statusFilter}
                options={STATUS_FILTER_OPTIONS}
                onChange={(v) => setStatusFilter(String(v))}
                className={styles.miniSelect}
              />
            </div>

            <Table
              rowKey="id"
              data={strategyRows}
              columns={strategyColumns}
              hover
              bordered={false}
              rowClassName={rowClassName}
              empty={<div className={styles.tableEmpty}>当前筛选下暂无策略</div>}
            />

            <div className={styles.strategyFooter}>
              <span className={styles.selectedCount}>已选 {combos.length} 项</span>
              <Button variant="outline" size="small" disabled={combos.length === 0} onClick={clearSelection}>
                清除选择
              </Button>
              <Button theme="primary" size="small" disabled={combos.length < 2} onClick={() => setCompareOpen(true)}>
                对比选中项
              </Button>
            </div>
          </Card>

          {singleDetail && (
            <div>
              <div className={styles.detailHeader}>
                <div className={styles.detailTitleLine}>
                  <span className={styles.detailTitle}>
                    {singleDetail.strategy.name} · 详细效果 · {singleDetail.titleScope}
                  </span>
                  <Tag theme={STATUS_TAG_THEME[singleDetail.strategy.status]} variant="light">
                    ● {STATUS_LABEL[singleDetail.strategy.status as keyof typeof STATUS_LABEL]}
                  </Tag>
                  {singleDetail.inRange && (
                    <Tag theme="warning" variant="light">
                      覆盖 {singleDetail.intersectionDays} 天
                    </Tag>
                  )}
                </div>
                <Button variant="outline" size="small" onClick={() => setCombos([])}>‹ 返回策略列表</Button>
              </div>

              <div className={`${styles.metricCards} ${styles.metricCardsSingle}`}>
                <div className={styles.metricCard}>
                  <div className={styles.metricCardLabel}>推送量</div>
                  <div className={styles.metricCardValue}>{singleDetail.send.toLocaleString('zh-CN')}</div>
                </div>
                <div className={styles.metricCard}>
                  <div className={styles.metricCardLabel}>触达量</div>
                  <div className={styles.metricCardValue}>{singleDetail.reach.toLocaleString('zh-CN')}</div>
                </div>
                <div className={styles.metricCard}>
                  <div className={styles.metricCardLabel}>触达人数</div>
                  <div className={styles.metricCardValue}>{singleDetail.reachUsers.toLocaleString('zh-CN')}</div>
                </div>
                <div className={styles.metricCard}>
                  <div className={styles.metricCardLabel}>推送失败率</div>
                  <div className={`${styles.metricCardValue} ${styles.dangerText}`}>{singleDetail.failRate}%</div>
                </div>
                <div className={styles.metricCard}>
                  <div className={styles.metricCardLabel}>超频拦截量</div>
                  <div className={`${styles.metricCardValue} ${styles.warningText}`}>
                    {singleDetail.freqLimited.toLocaleString('zh-CN')}
                  </div>
                </div>
              </div>

              <div className={styles.detailRow}>
                <Card className={styles.detailCardNarrow} bordered={false}>
                  <div className={styles.chartTitle}>拦截原因</div>
                  <BlockReasonList rows={singleDetail.blockReasons} />
                </Card>
                {singleDetail.showChannelSplit && (
                  <Card className={styles.detailCardWide} bordered={false}>
                    <div className={styles.chartTitle}>渠道拆分</div>
                    <table className={styles.plainTable}>
                      <thead>
                        <tr>
                          <th>渠道</th>
                          <th>推送量</th>
                          <th>触达量</th>
                          <th>触达人数</th>
                          <th>推送失败率</th>
                          <th>超频拦截量</th>
                        </tr>
                      </thead>
                      <tbody>
                        {singleDetail.channelSplit.map((c) => (
                          <tr key={c.name}>
                            <td>{c.name}</td>
                            <td>{c.send.toLocaleString('zh-CN')}</td>
                            <td>{c.reach.toLocaleString('zh-CN')}</td>
                            <td>{c.reachUsers.toLocaleString('zh-CN')}</td>
                            <td><span className={styles.dangerText}>{c.failRate}%</span></td>
                            <td><span className={styles.warningText}>{c.freqLimited.toLocaleString('zh-CN')}</span></td>
                          </tr>
                        ))}
                        <tr className={styles.tableSummaryRow}>
                          <td>合计</td>
                          <td>{singleDetail.send.toLocaleString('zh-CN')}</td>
                          <td>{singleDetail.reach.toLocaleString('zh-CN')}</td>
                          <td>{singleDetail.reachUsers.toLocaleString('zh-CN')}</td>
                          <td><span className={styles.dangerText}>{singleDetail.failRate}%</span></td>
                          <td><span className={styles.warningText}>{singleDetail.freqLimited.toLocaleString('zh-CN')}</span></td>
                        </tr>
                      </tbody>
                    </table>
                  </Card>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* 用户触达 Tab */}
      {tab === 'userReach' && (
        <Card className={styles.chartCard} bordered={false}>
          <div className={styles.chartTitle}>按用户查询触达记录</div>
          <div className={styles.userSearchRow}>
            <Input
              value={userInput}
              placeholder="输入用户ID查询触达记录..."
              clearable
              onChange={(v) => setUserInput(v)}
              className={styles.userInput}
            />
            <span className={styles.strategyHint}>展示该用户被所有策略触达过的全部记录</span>
          </div>

          {userResult.kind === 'empty' && (
            <div className={styles.userEmpty}>
              <div className={styles.userEmptyTitle}>请输入用户 open_id 查询触达记录</div>
              <div className={styles.userEmptySub}>查询结果将应用当前时间范围与渠道筛选</div>
            </div>
          )}
          {userResult.kind === 'not-found' && (
            <div className={styles.userEmptyRow}>未找到用户 {userResult.openId} 的触达记录</div>
          )}
          {userResult.kind === 'no-record' && (
            <div className={styles.userEmptyRow}>
              用户 {userResult.openId} 在当前时间范围{userResult.channelLabel}下无触达记录
            </div>
          )}
          {userResult.kind === 'records' && (
            <table className={styles.plainTable}>
              <thead>
                <tr>
                  <th>触达时间</th>
                  <th>策略名称</th>
                  <th>关怀类型</th>
                  <th>渠道</th>
                  <th>触达状态</th>
                  <th>失败原因</th>
                </tr>
              </thead>
              <tbody>
                {userResult.records.map((r, idx) => {
                  const meta = getRecordStrategyMeta(r);
                  return (
                    <tr key={`${r.time}-${idx}`}>
                      <td>{r.time}</td>
                      <td>{r.strategyName}（{meta.id}）</td>
                      <td>{meta.careTag}</td>
                      <td>{r.channel}</td>
                      <td>
                        {r.success
                          ? <span className={styles.successText}>✓ 成功</span>
                          : <span className={styles.dangerText}>✗ 失败</span>}
                      </td>
                      <td>
                        {r.reason
                          ? <span className={styles.dangerText}>{BLOCK_REASON_LABEL[r.reason]}</span>
                          : <span className={styles.dimmedText}>—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Card>
      )}

      {/* 策略对比弹窗 */}
      <Dialog
        visible={compareOpen}
        header="策略对比"
        footer={<Button variant="outline" onClick={() => setCompareOpen(false)}>关闭</Button>}
        onClose={() => setCompareOpen(false)}
        width={900}
        className={styles.compareDialog}
      >
        <div className={styles.compareBody}>
          <div className={styles.compareTitle}>
            策略·渠道对比（{compareItems.length} 项 · {range.label}）
          </div>

          {/* 摘要卡片：每个策略一张 */}
          <div className={styles.compareSummaryGrid}>
            {compareItems.map((it) => (
              <div key={it.comboId} className={styles.compareSummaryCard}>
                <span className={styles.compareSummaryAccent} style={{ background: it.color }} />
                <div className={styles.compareSummaryName}>{it.label}</div>
                <div className={styles.compareSummaryRow}>
                  <span>总推送量</span>
                  <span>{it.send.toLocaleString('zh-CN')}</span>
                </div>
                <div className={styles.compareSummaryRow}>
                  <span>总触达量</span>
                  <span>{it.reach.toLocaleString('zh-CN')}</span>
                </div>
                <div className={styles.compareSummaryRow}>
                  <span>推送失败率</span>
                  <span className={it.failRate >= 0.1 ? styles.dangerText : ''}>{it.failRate}%</span>
                </div>
                <div className={styles.compareSummaryRow}>
                  <span>超频拦截量</span>
                  <span>{it.freqLimited.toLocaleString('zh-CN')}</span>
                </div>
              </div>
            ))}
          </div>

          {range.days > 31 ? (
            <div style={{ marginTop: 16 }}>
              <ChartPlaceholder text="当前时间跨度较大，趋势图仅支持展示 31 天内的数据" />
            </div>
          ) : (
            <>
              <div className={styles.compareChartLabel}>推送量对比</div>
              <ReactECharts
                option={buildCompareChartOption(compareItems, 'send')}
                theme={echartsTheme.theme}
                notMerge
                style={{ height: 140 }}
              />
              <div className={styles.compareChartLabel}>触达量对比</div>
              <ReactECharts
                option={buildCompareChartOption(compareItems, 'reach')}
                theme={echartsTheme.theme}
                notMerge
                style={{ height: 140 }}
              />
              <div className={styles.compareChartLabel}>超频拦截量对比</div>
              <ReactECharts
                option={buildCompareChartOption(compareItems, 'block')}
                theme={echartsTheme.theme}
                notMerge
                style={{ height: 140 }}
              />
              <div className={styles.compareLegend}>
                {compareItems.map((it) => (
                  <span key={it.comboId} className={styles.compareLegendItem}>
                    <span className={styles.compareLegendLine} style={{ background: it.color }} />
                    {it.label}
                  </span>
                ))}
              </div>
            </>
          )}

          {(() => {
            const scale = getScale(range.days);
            // 仅当存在「整策略 + ≥2 个渠道」的选中项时才展开渠道拆分；含所有整策略选中的渠道行
            const wholeSelections = compareItems.filter((it) => !it.channel);
            const hasMultiChannelWhole = wholeSelections.some(
              (it) => it.strategy.metric.channels.length >= 2,
            );
            if (!hasMultiChannelWhole) return null;
            const breakdownRows = wholeSelections.flatMap(
              (it) => getComboStrategyChannelSplit(it, scale),
            );
            return (
              <>
                <div className={styles.compareChartLabel}>渠道拆分对比</div>
                <table className={styles.plainTable}>
                  <thead>
                    <tr>
                      <th>策略·渠道</th>
                      <th>推送量</th>
                      <th>触达量</th>
                      <th>推送失败率</th>
                      <th>超频拦截量</th>
                    </tr>
                  </thead>
                  <tbody>
                    {breakdownRows.map((r, idx) => (
                      <tr key={`${r.strategy}-${r.channel}-${idx}`}>
                        <td style={{ color: r.color, fontWeight: 500 }}>{r.strategy}·{r.channel}</td>
                        <td>{r.send.toLocaleString('zh-CN')}</td>
                        <td>{r.reach.toLocaleString('zh-CN')}</td>
                        <td><span className={styles.dangerText}>{r.failRate}%</span></td>
                        <td>{r.freqLimited.toLocaleString('zh-CN')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            );
          })()}
        </div>
      </Dialog>
    </div>
  );
}
