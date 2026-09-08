import { useMemo, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import {
  Button,
  Card,
  DatePicker,
  Empty,
  Loading,
  MessagePlugin,
  Select,
  Space,
} from 'tdesign-react';
import type { DatePickerProps, SelectValue } from 'tdesign-react';
import TooltipIcon from '@/components/TooltipIcon';
import echartsTheme from '@/design-tokens/zhijilab-echarts-theme.json';
import { usePageScenario } from '@/pageScenario';
import { useCurrentBusiness } from '@/prototypeContext';
import {
  DEFAULT_DATE,
  DEFAULT_GAME_ID,
  GAMES,
  fetchChannelsByGameId,
  getChannelsByGameId,
  getDashboardData,
} from './mock';
import type { AssistantDashboardScenario } from './scenarios';
import styles from './index.module.less';

const DAY_MS = 86400000;
const WEEK_DAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

const pad = (value: number) => String(value).padStart(2, '0');

const formatDate = (date: Date) => (
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
);

const parseDate = (value: string) => new Date(`${value}T00:00:00`);

const getNaturalWeek = (dateValue: Date) => {
  const selectedDate = new Date(dateValue);
  const selectedDay = selectedDate.getDay() || 7;
  const start = new Date(selectedDate.getTime() - (selectedDay - 1) * DAY_MS);
  const end = new Date(start.getTime() + 6 * DAY_MS);

  return {
    start: formatDate(start),
    end: formatDate(end),
  };
};

const initialChannels = getChannelsByGameId(DEFAULT_GAME_ID);
const initialChannelIds = initialChannels.map(({ channelId }) => channelId);
const defaultWeekDate = parseDate(DEFAULT_DATE);
const initialWeek = getNaturalWeek(defaultWeekDate);
// 按周统计只产出完整自然周，尚未结束的本周及以后整周不可选
const currentWeekStart = parseDate(getNaturalWeek(new Date()).start).getTime();

type DashboardLoadState = 'ready' | 'loading' | 'error';

const normalizeSelectValues = (value: SelectValue): string[] => {
  if (!Array.isArray(value)) return [];

  return value.map((item) => String(item));
};

const formatInteger = (value?: number) => (
  value === undefined ? '--' : Math.round(value).toLocaleString('zh-CN')
);

const formatDecimal = (value?: number) => (
  value === undefined ? '--' : value.toFixed(2)
);

const formatPercent = (value?: number) => (
  value === undefined ? '--' : `${(value * 100).toFixed(1)}%`
);

export default function AssistantDashboardPage() {
  const previewScenario = usePageScenario<AssistantDashboardScenario>();
  const { game_id: businessGameId } = useCurrentBusiness();
  const [gameId, setGameId] = useState(DEFAULT_GAME_ID);
  const [channels, setChannels] = useState(initialChannels);
  const [draftDate, setDraftDate] = useState(defaultWeekDate);
  const [draftChannelIds, setDraftChannelIds] = useState(initialChannelIds);
  const [appliedWeek, setAppliedWeek] = useState(initialWeek);
  const [appliedChannelIds, setAppliedChannelIds] = useState(initialChannelIds);
  const [loadState, setLoadState] = useState<DashboardLoadState>(() => {
    if (previewScenario === 'loading') return 'loading';
    if (previewScenario === 'error') return 'error';
    return 'ready';
  });
  const [forceEmptyData, setForceEmptyData] = useState(
    previewScenario === 'empty' || previewScenario === 'loading',
  );
  const loading = loadState === 'loading';

  const draftWeek = useMemo(() => getNaturalWeek(draftDate), [draftDate]);
  const dashboardData = useMemo(() => {
    const data = getDashboardData({
      businessGameId,
      gameId,
      weekStart: appliedWeek.start,
      channelIds: appliedChannelIds,
    });

    if (!forceEmptyData) return data;

    return {
      ...data,
      metrics: {},
      trend: {
        ...data.trend,
        dau: [],
        newUsers: [],
        sessionsPerUser: [],
      },
      heatmap: [],
      heatmapMax: 1,
    };
  }, [appliedChannelIds, appliedWeek.start, businessGameId, forceEmptyData, gameId]);

  const gameOptions = useMemo(() => GAMES.map((game) => ({
    label: game.name,
    value: game.gameId,
  })), []);

  const channelOptions = useMemo(() => channels.map((channel) => ({
    label: channel.name,
    value: channel.channelId,
  })), [channels]);

  const metrics = [
    {
      key: 'dau',
      title: 'DAU',
      value: formatInteger(dashboardData.metrics.dau),
      description: '选定自然周内使用过助理的去重用户数',
      tooltip: '按 open_id 去重统计发送过消息的用户。',
    },
    {
      key: 'newUsers',
      title: '新增用户',
      value: formatInteger(dashboardData.metrics.newUsers),
      description: '周内首次使用助理的去重用户数',
      tooltip: '仅统计首次使用记录落在当前选定渠道范围内的用户。',
    },
    {
      key: 'sessionsPerUser',
      title: '人均会话数',
      value: formatDecimal(dashboardData.metrics.sessionsPerUser),
      description: '会话数 / 提问用户 UV',
      tooltip: '选定时间内总 session 数除以同期去重用户数。',
    },
    {
      key: 'turnsPerSession',
      title: '平均会话轮次',
      value: formatDecimal(dashboardData.metrics.turnsPerSession),
      description: '用户提问次数 / 总会话数',
      tooltip: '一次用户提问计为一轮，用户提问与助理回答共同构成一轮对话。',
    },
    {
      key: 'messagesPerUser',
      title: '人均消息数',
      value: formatDecimal(dashboardData.metrics.messagesPerUser),
      description: '用户消息数 / 提问用户 UV',
      tooltip: '选定时间内用户发送消息总数除以同期去重用户数。',
    },
    {
      key: 'roleBindingRate',
      title: '角色绑定率',
      value: formatPercent(dashboardData.metrics.roleBindingRate),
      description: '已绑定当前游戏角色的活跃用户占比',
      tooltip: '分子与分母均在当前游戏、自然周和渠道范围内按用户去重。',
    },
  ];

  const trendOption = useMemo(() => ({
    tooltip: { trigger: 'axis' },
    legend: { bottom: 0 },
    grid: { left: 48, right: 54, top: 28, bottom: 56 },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: dashboardData.trend.dates,
    },
    yAxis: [
      { type: 'value', min: 0 },
      {
        type: 'value',
        min: 0,
        position: 'right',
        axisLabel: { formatter: '{value}' },
        splitLine: { show: false },
      },
    ],
    series: [
      {
        name: 'DAU',
        type: 'line',
        data: dashboardData.trend.dau,
      },
      {
        name: '新增用户',
        type: 'line',
        data: dashboardData.trend.newUsers,
      },
      {
        name: '人均会话数',
        type: 'line',
        yAxisIndex: 1,
        data: dashboardData.trend.sessionsPerUser,
      },
    ],
  }), [dashboardData.trend]);

  const heatmapOption = useMemo(() => ({
    tooltip: {
      position: 'top',
      formatter: ({ value }: { value: [number, number, number] }) => (
        `${WEEK_DAYS[value[1]]} ${pad(value[0])}:00<br/>会话数：${value[2].toLocaleString('zh-CN')}`
      ),
    },
    grid: { left: 58, right: 18, top: 34, bottom: 72 },
    xAxis: {
      type: 'category',
      data: Array.from({ length: 24 }, (_, hour) => hour),
      position: 'top',
      splitArea: { show: true },
    },
    yAxis: {
      type: 'category',
      data: WEEK_DAYS,
      inverse: true,
      splitArea: { show: true },
    },
    visualMap: {
      min: 0,
      max: dashboardData.heatmapMax,
      calculable: false,
      orient: 'horizontal',
      left: 58,
      bottom: 10,
      text: ['高', '低'],
    },
    series: [{
      name: '会话数',
      type: 'heatmap',
      data: dashboardData.heatmap,
      label: { show: false },
    }],
  }), [dashboardData.heatmap, dashboardData.heatmapMax]);

  const handleDateChange: DatePickerProps['onChange'] = (value) => {
    if (value instanceof Date) setDraftDate(value);
  };

  const handleGameChange = async (value: SelectValue) => {
    const nextGameId = String(value);
    setGameId(nextGameId);
    setLoadState('loading');
    setForceEmptyData(false);

    try {
      const nextChannels = await fetchChannelsByGameId(nextGameId);
      const nextChannelIds = nextChannels.map(({ channelId }) => channelId);
      setChannels(nextChannels);
      setDraftChannelIds(nextChannelIds);
      setAppliedChannelIds(nextChannelIds);
    } catch {
      setChannels([]);
      setDraftChannelIds([]);
      setAppliedChannelIds([]);
      MessagePlugin.error('渠道列表加载失败，请稍后重试');
    } finally {
      setLoadState('ready');
    }
  };

  const handleChannelChange = (value: SelectValue) => {
    const nextChannelIds = normalizeSelectValues(value);
    setDraftChannelIds(nextChannelIds.length > 0 ? nextChannelIds : channels.map(({ channelId }) => channelId));
  };

  const applyFilters = () => {
    setLoadState('loading');
    setForceEmptyData(false);
    setAppliedWeek(draftWeek);
    setAppliedChannelIds(draftChannelIds);
    window.setTimeout(() => {
      setLoadState('ready');
      MessagePlugin.success('数据已更新');
    }, 260);
  };

  const resetFilters = () => {
    const defaultChannelIds = channels.map(({ channelId }) => channelId);
    setDraftDate(defaultWeekDate);
    setDraftChannelIds(defaultChannelIds);
    setAppliedWeek(initialWeek);
    setAppliedChannelIds(defaultChannelIds);
    MessagePlugin.success('筛选条件已重置');
  };

  const retryDashboard = () => {
    setLoadState('loading');
    setForceEmptyData(false);
    window.setTimeout(() => {
      setLoadState('ready');
      MessagePlugin.success('看板数据已重新加载');
    }, 360);
  };

  const hasTrendData = dashboardData.trend.dau.length > 0;
  const hasHeatmapData = dashboardData.heatmap.length > 0;

  const loadingPlaceholder = (className: string) => (
    <div className={`${styles.loadingPlaceholder} ${className}`}>
      <Loading loading size="small" text="数据加载中" />
    </div>
  );

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <h1>助理对话看板</h1>
          <p>查看私人用户助理的核心运营指标与行为分布</p>
        </div>
      </header>

      <Card className={styles.filterCard} bordered={false}>
        <div className={styles.filterRow}>
          <div className={styles.filterItem}>
            <span className={styles.filterLabel}>助理</span>
            <Select
              className={styles.gameSelect}
              value={gameId}
              options={gameOptions}
              onChange={handleGameChange}
            />
          </div>
          <div className={styles.filterItem}>
            <span className={styles.filterLabel}>自然周</span>
            <div className={styles.weekPicker}>
              <DatePicker
                value={draftDate}
                mode="week"
                valueType="Date"
                firstDayOfWeek={1}
                disableDate={(date) => new Date(date).getTime() >= currentWeekStart}
                onChange={handleDateChange}
              />
              <span className={styles.weekSummary}>
                {draftWeek.start} ～ {draftWeek.end}
              </span>
            </div>
          </div>
          <div className={styles.filterItem}>
            <span className={styles.filterLabel}>渠道</span>
            <Select
              className={styles.channelSelect}
              value={draftChannelIds}
              multiple
              minCollapsedNum={1}
              loading={loading}
              empty="暂无可用渠道"
              valueDisplay={({ value }) => {
                const selectedOptions = Array.isArray(value) ? value : [];
                if (channels.length > 0 && selectedOptions.length === channels.length) {
                  return '全部渠道';
                }

                return selectedOptions.map((option) => (
                  typeof option === 'object' && option !== null && 'label' in option
                    ? String(option.label)
                    : String(option)
                )).join('、');
              }}
              onChange={handleChannelChange}
            >
              <Select.Option checkAll>全部渠道</Select.Option>
              {channelOptions.map((option) => (
                <Select.Option key={option.value} value={option.value} label={option.label}>
                  {option.label}
                </Select.Option>
              ))}
            </Select>
          </div>
          <Space className={styles.filterActions} size={8}>
            <Button theme="primary" loading={loading} onClick={applyFilters}>查询</Button>
            <Button variant="outline" disabled={loading} onClick={resetFilters}>重置</Button>
          </Space>
        </div>
      </Card>

      {loadState === 'error' ? (
        <Card className={styles.errorCard} bordered={false}>
          <Empty
            type="network-error"
            title="看板数据加载失败"
            description="当前助理和筛选条件已保留，请重新加载"
            action={<Button theme="primary" onClick={retryDashboard}>重新加载</Button>}
          />
        </Card>
      ) : (
        <>
          <Card
            className={styles.sectionCard}
            bordered={false}
            title="数据概览"
            description="展示当前助理的核心用户运营指标"
            actions={<span className={styles.appliedRange}>{appliedWeek.start} ～ {appliedWeek.end}</span>}
          >
            {loading ? loadingPlaceholder(styles.metricLoadingPlaceholder) : (
              <div className={styles.metricGrid}>
                {metrics.map((metric) => (
                  <article key={metric.key} className={styles.metricItem}>
                    <div className={styles.metricLabel}>
                      <span>{metric.title}</span>
                      <TooltipIcon content={metric.tooltip} />
                    </div>
                    <div className={styles.metricValue}>{metric.value}</div>
                    <div className={styles.metricSub}>{metric.description}</div>
                  </article>
                ))}
              </div>
            )}
          </Card>

          <Card
            className={styles.sectionCard}
            bordered={false}
            title="核心指标趋势"
            description="DAU、新增用户与人均会话数按日变化"
          >
            {loading ? loadingPlaceholder(styles.trendLoadingPlaceholder) : (
              hasTrendData ? (
                <ReactECharts
                  className={styles.trendChart}
                  option={trendOption}
                  theme={echartsTheme.theme}
                  notMerge
                />
              ) : (
                <div className={styles.chartEmpty}>
                  <Empty
                    title="当前范围暂无趋势数据"
                    description="请调整自然周或渠道后重新查询"
                  />
                </div>
              )
            )}
          </Card>

          <Card
            className={styles.sectionCard}
            bordered={false}
            title="行为分布洞察"
            description="展示当前筛选范围内的用户活跃时段分布"
          >
            {loading ? loadingPlaceholder(styles.heatmapLoadingPlaceholder) : (
              hasHeatmapData ? (
                <ReactECharts
                  className={styles.heatmapChart}
                  option={heatmapOption}
                  theme={echartsTheme.theme}
                  notMerge
                />
              ) : (
                <div className={styles.chartEmpty}>
                  <Empty
                    title="暂无活跃时段数据"
                    description="当前筛选范围尚未产生会话记录"
                  />
                </div>
              )
            )}
          </Card>
        </>
      )}
    </div>
  );
}
