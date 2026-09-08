import { useEffect, useMemo, useRef, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import {
  Button,
  Card,
  DatePicker,
  DateRangePicker,
  Empty,
  Loading,
  MessagePlugin,
  Radio,
  Space,
  Table,
} from 'tdesign-react';
import type {
  DatePickerProps,
  DateRangePickerProps,
  PageInfo,
  PrimaryTableCol,
} from 'tdesign-react';
import echartsTheme from '@/design-tokens/zhijilab-echarts-theme.json';
import { usePageScenario } from '@/pageScenario';
import { useCurrentBusiness, usePrototypeBusinessSwitcher } from '@/prototypeContext';
import {
  DEFAULT_DETAIL_RANGE,
  DEFAULT_WEEK_DATE,
  getEmptyQaDashboardData,
  getQaDashboardData,
} from './mock';
import PubgmBoard from './PubgmBoard';
import FcmBoard from './FcmBoard';
import type { FrequentQuestion, QaDashboardData } from './mock';
import type { QaDashboardScenario } from './scenarios';
import styles from './index.module.less';

type BoardType = 'general' | 'business';
type ViewType = 'weekly' | 'detail';
type ShortcutType = '7d' | '30d' | 'custom';
type GranularityType = 'day' | 'week';
type LoadState = 'ready' | 'loading' | 'error';

const PUBGM_GAME_ID = 'mock-game-pubgm';
const FCM_GAME_ID = 'mock-game-fcm';

const DAY_MS = 86400000;

const pad = (value: number) => String(value).padStart(2, '0');

const formatDate = (date: Date) => (
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
);

const parseDate = (value: string) => new Date(`${value}T00:00:00`);

const getNaturalWeek = (dateValue: string): [string, string] => {
  const date = parseDate(dateValue);
  const day = date.getDay() || 7;
  const start = new Date(date.getTime() - (day - 1) * DAY_MS);
  const end = new Date(start.getTime() + 6 * DAY_MS);

  return [formatDate(start), formatDate(end)];
};

// 按周统计只产出完整自然周的数据点，残缺的周需要在查询前拦住
const hasCompleteNaturalWeek = ([start, end]: [string, string]) => {
  const startDate = parseDate(start);
  const firstMonday = new Date(
    startDate.getTime() + ((8 - (startDate.getDay() || 7)) % 7) * DAY_MS,
  );

  return firstMonday.getTime() + 6 * DAY_MS <= parseDate(end).getTime();
};

const normalizeRangeValue = (
  value: Parameters<NonNullable<DateRangePickerProps['onChange']>>[0],
): [string, string] | null => {
  if (!Array.isArray(value) || value.length < 2) return null;

  const normalized = value.map((item) => {
    if (item instanceof Date) return formatDate(item);
    return String(item);
  });

  if (!normalized[0] || !normalized[1]) return null;
  return [normalized[0], normalized[1]];
};

const normalizeDateValue = (
  value: Parameters<NonNullable<DatePickerProps['onChange']>>[0],
): string | null => {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate) return null;
  if (candidate instanceof Date) return formatDate(candidate);

  return String(candidate);
};

const defaultWeekRange = getNaturalWeek(DEFAULT_WEEK_DATE);

// 当天数据尚未沉淀完整，按日查询最晚只到昨天
const latestSelectableDate = formatDate(new Date(Date.now() - DAY_MS));
// 按周统计只产出完整自然周，尚未结束的本周及以后整周不可选
const currentWeekStart = parseDate(getNaturalWeek(formatDate(new Date()))[0]).getTime();

const questionColumns: PrimaryTableCol<FrequentQuestion>[] = [
  { colKey: 'rank', title: '序号', width: 70, align: 'center' },
  { colKey: 'question', title: '高频问题', ellipsis: true },
  { colKey: 'count', title: '次数', width: 120, align: 'right' },
  { colKey: 'users', title: '涉及用户', width: 120, align: 'right' },
  { colKey: 'percentage', title: '占比', width: 100, align: 'right' },
];

export default function QaDashboardPage() {
  const previewScenario = usePageScenario<QaDashboardScenario>();
  const { game_id } = useCurrentBusiness();
  const { currentBusiness } = usePrototypeBusinessSwitcher();
  const scenarioStartsDetailed = previewScenario === 'detailed';
  const scenarioStartsBusiness = previewScenario === 'business';
  const scenarioForcesEmpty = previewScenario === 'empty';
  const defaultData = useMemo(() => getQaDashboardData({
    gameId: game_id,
    dateRange: defaultWeekRange,
    granularity: 'day',
  }), [game_id]);
  const [boardType, setBoardType] = useState<BoardType>(
    scenarioStartsBusiness ? 'business' : 'general',
  );
  const [view, setView] = useState<ViewType>(scenarioStartsDetailed ? 'detail' : 'weekly');
  const [weekRange, setWeekRange] = useState<[string, string]>(defaultWeekRange);
  const [draftRange, setDraftRange] = useState<[string, string]>(DEFAULT_DETAIL_RANGE);
  const [shortcut, setShortcut] = useState<ShortcutType>('7d');
  const [granularity, setGranularity] = useState<GranularityType>('day');
  const [data, setData] = useState<QaDashboardData>(() => (
    scenarioForcesEmpty || previewScenario === 'loading'
      ? getEmptyQaDashboardData()
      : defaultData
  ));
  const [loadState, setLoadState] = useState<LoadState>(() => {
    if (previewScenario === 'loading') return 'loading';
    if (previewScenario === 'error') return 'error';
    return 'ready';
  });
  const [pageInfo, setPageInfo] = useState({ current: 1, pageSize: 10 });
  const previousGameId = useRef(game_id);

  const loading = loadState === 'loading';

  useEffect(() => {
    if (previousGameId.current === game_id) return undefined;

    previousGameId.current = game_id;
    const refreshedData = view === 'weekly'
      ? getQaDashboardData({ gameId: game_id, dateRange: weekRange, granularity: 'day' })
      : getQaDashboardData({ gameId: game_id, dateRange: draftRange, granularity });

    setData(
      scenarioForcesEmpty || previewScenario === 'loading'
        ? getEmptyQaDashboardData()
        : refreshedData,
    );
    setPageInfo((current) => ({ ...current, current: 1 }));
    return undefined;
  }, [game_id, previewScenario]);

  const trendOption = useMemo(() => ({
    tooltip: { trigger: 'axis' },
    legend: {
      data: ['用户消息总量', '用户 UV', '会话总量'],
      bottom: 0,
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '12%',
      top: '10%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: data.trend.map(({ date }) => date),
    },
    yAxis: { type: 'value' },
    series: [
      {
        name: '用户消息总量',
        type: 'line',
        data: data.trend.map(({ messageCount }) => messageCount),
      },
      {
        name: '用户 UV',
        type: 'line',
        data: data.trend.map(({ userUv }) => userUv),
      },
      {
        name: '会话总量',
        type: 'line',
        data: data.trend.map(({ sessionCount }) => sessionCount),
      },
    ],
  }), [data.trend]);

  const qualityTrendOption = useMemo(() => ({
    tooltip: {
      trigger: 'axis',
      valueFormatter: (value: number) => `${value}%`,
    },
    legend: { data: ['连续追问会话占比'], bottom: 0 },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '12%',
      top: '10%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: data.qualityTrend.map(({ date }) => date),
    },
    yAxis: {
      type: 'value',
      axisLabel: { formatter: '{value}%' },
    },
    series: [{
      name: '连续追问会话占比',
      type: 'line',
      smooth: true,
      areaStyle: { opacity: 0.12 },
      data: data.qualityTrend.map(({ followUpRate }) => followUpRate),
    }],
  }), [data.qualityTrend]);

  const runLoad = (nextData: QaDashboardData, message?: string) => {
    setLoadState('loading');
    window.setTimeout(() => {
      setData(scenarioForcesEmpty ? getEmptyQaDashboardData() : nextData);
      setLoadState('ready');
      setPageInfo((current) => ({ ...current, current: 1 }));
      if (message) MessagePlugin.success(message);
    }, 360);
  };

  const handleWeekChange: DatePickerProps['onChange'] = (value) => {
    const normalized = normalizeDateValue(value);
    if (!normalized) return;

    const nextWeekRange = getNaturalWeek(normalized);
    setWeekRange(nextWeekRange);
    runLoad(getQaDashboardData({
      gameId: game_id,
      dateRange: nextWeekRange,
      granularity: 'day',
    }));
  };

  const handleDraftRangeChange: DateRangePickerProps['onChange'] = (value) => {
    const normalized = normalizeRangeValue(value);
    if (!normalized) return;

    setDraftRange(normalized);
    setShortcut('custom');
  };

  const handleShortcutChange = (value: string | number | boolean) => {
    const nextShortcut = String(value) as ShortcutType;
    setShortcut(nextShortcut);

    if (nextShortcut === '7d') setDraftRange(DEFAULT_DETAIL_RANGE);
    if (nextShortcut === '30d') setDraftRange(['2026-06-08', '2026-07-07']);
  };

  const queryDetailData = () => {
    if (granularity === 'week' && !hasCompleteNaturalWeek(draftRange)) {
      MessagePlugin.warning('按周统计需包含至少一个完整自然周（周一至周日），请调整日期范围');
      return;
    }

    runLoad(
      getQaDashboardData({ gameId: game_id, dateRange: draftRange, granularity }),
      '数据已更新',
    );
  };

  const resetDetailFilters = () => {
    setDraftRange(DEFAULT_DETAIL_RANGE);
    setShortcut('7d');
    setGranularity('day');
    runLoad(defaultData, '筛选条件已重置');
  };

  const retry = () => {
    runLoad(defaultData, '看板数据已重新加载');
  };

  const handlePageChange = (nextPageInfo: PageInfo) => {
    setPageInfo({ current: nextPageInfo.current, pageSize: nextPageInfo.pageSize });
  };

  const chartEmpty = (title: string) => (
    <div className={styles.chartEmpty}>
      <Empty title={title} description="请调整日期范围后重新查询" />
    </div>
  );

  const loadingPlaceholder = (className: string) => (
    <div className={`${styles.loadingPlaceholder} ${className}`}>
      <Loading loading size="small" text="数据加载中" />
    </div>
  );

  return (
    <div className={styles.page}>
      <div className={styles.boardSwitch}>
        <Radio.Group
          value={boardType}
          variant="default-filled"
          theme="button"
          onChange={(value) => setBoardType(String(value) as BoardType)}
        >
          <Radio.Button value="general">通用看板</Radio.Button>
          <Radio.Button value="business">业务看板</Radio.Button>
        </Radio.Group>
      </div>

      <header className={styles.pageHeader}>
        <h1>问答数据看板</h1>
        {boardType === 'general' && (
          <Radio.Group
            value={view}
            variant="default-filled"
            theme="button"
            onChange={(value) => setView(String(value) as ViewType)}
          >
            <Radio.Button value="weekly">周报视图</Radio.Button>
            <Radio.Button value="detail">详细数据筛选</Radio.Button>
          </Radio.Group>
        )}
      </header>

      {boardType === 'business' ? (
        (() => {
          if (game_id === PUBGM_GAME_ID) {
            return (
              <PubgmBoard
                previewScenario={previewScenario}
                projectName={currentBusiness.name}
              />
            );
          }
          if (game_id === FCM_GAME_ID) {
            return (
              <FcmBoard
                previewScenario={previewScenario}
                projectName={currentBusiness.name}
              />
            );
          }
          return (
            <Card className={styles.sectionCard} bordered={false}>
              <div className={styles.businessEmpty}>
                <Empty
                  title="业务看板建设中"
                  description={`当前业务（${currentBusiness.name}）尚未配置定制看板，可在顶部业务选择器切换到 PUBGM 或 FCM 项目组查看定制看板示例。`}
                />
              </div>
            </Card>
          );
        })()
      ) : (
        <>
      {view === 'weekly' ? (
        <div className={styles.weekBar}>
          <DatePicker
            className={styles.weekPicker}
            value={parseDate(weekRange[0])}
            valueType="YYYY-MM-DD"
            mode="week"
            firstDayOfWeek={1}
            allowInput={false}
            clearable={false}
            disableDate={(date) => new Date(date).getTime() >= currentWeekStart}
            onChange={handleWeekChange}
          />
          <span>
            {weekRange[0]} ~ {weekRange[1]}（周一00:00:00至周日23:59:59）
          </span>
        </div>
      ) : (
        <Card className={styles.filterCard} bordered={false}>
          <div className={styles.filterRow}>
            <div className={styles.filterItem}>
              <span className={styles.filterLabel}>日期</span>
              <DateRangePicker
                className={styles.detailDatePicker}
                value={draftRange}
                valueType="YYYY-MM-DD"
                clearable={false}
                disableDate={{ after: latestSelectableDate }}
                onChange={handleDraftRangeChange}
              />
            </div>
            <div className={styles.filterItem}>
              <span className={styles.filterLabel}>快捷</span>
              <Radio.Group
                value={shortcut}
                variant="default-filled"
                theme="button"
                onChange={handleShortcutChange}
              >
                <Radio.Button value="7d">近7天</Radio.Button>
                <Radio.Button value="30d">近30天</Radio.Button>
                <Radio.Button value="custom">自定义</Radio.Button>
              </Radio.Group>
            </div>
            <div className={styles.filterItem}>
              <span className={styles.filterLabel}>统计粒度</span>
              <Radio.Group
                value={granularity}
                variant="default-filled"
                theme="button"
                onChange={(value) => setGranularity(String(value) as GranularityType)}
              >
                <Radio.Button value="day">按日</Radio.Button>
                <Radio.Button value="week">按周</Radio.Button>
              </Radio.Group>
            </div>
            <Space className={styles.filterActions} size={8}>
              <Button theme="primary" loading={loading} onClick={queryDetailData}>查询</Button>
              <Button disabled={loading} onClick={resetDetailFilters}>重置</Button>
            </Space>
          </div>
        </Card>
      )}

      {loadState === 'error' ? (
        <Card className={styles.errorCard} bordered={false}>
          <Empty
            type="network-error"
            title="看板数据加载失败"
            description="当前视图与筛选条件已保留，请重新加载"
            action={<Button theme="primary" onClick={retry}>重新加载</Button>}
          />
        </Card>
      ) : (
        <>
          <Card
            className={styles.sectionCard}
            bordered={false}
            title="数据概览"
            description="统计周期内的问答规模与会话质量指标"
          >
            {loading ? loadingPlaceholder(styles.metricLoadingPlaceholder) : (
              <div className={styles.metricGrid}>
                {data.metrics.map((metric) => (
                  <article key={metric.key} className={styles.metricItem}>
                    <div className={styles.metricLabel}>{metric.label}</div>
                    <div className={styles.metricValue}>{metric.value}</div>
                    {view === 'weekly' && metric.value !== '--' && (
                      <div className={styles.metricChange}>
                        环比{' '}
                        <span className={metric.change >= 0 ? styles.up : styles.down}>
                          {metric.change >= 0 ? '+' : ''}{metric.change.toFixed(2)}%
                        </span>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}
          </Card>

          <Card
            className={styles.sectionCard}
            bordered={false}
            title="核心指标趋势"
            description="用户消息总量、用户 UV 与会话总量变化趋势"
          >
            {loading ? loadingPlaceholder(styles.trendLoadingPlaceholder) : (
              data.trend.length > 0 ? (
                <ReactECharts
                  className={styles.trendChart}
                  option={trendOption}
                  theme={echartsTheme.theme}
                  notMerge
                />
              ) : chartEmpty('当前范围暂无核心指标趋势')
            )}
          </Card>

          <Card
            className={styles.sectionCard}
            bordered={false}
            title="会话质量"
            description="连续追问会话占比变化趋势"
          >
            {loading ? loadingPlaceholder(styles.qualityLoadingPlaceholder) : (
              data.qualityTrend.length > 0 ? (
                <ReactECharts
                  className={styles.qualityChart}
                  option={qualityTrendOption}
                  theme={echartsTheme.theme}
                  notMerge
                />
              ) : chartEmpty('当前范围暂无会话质量趋势')
            )}
          </Card>

          <Card
            className={`${styles.sectionCard} ${styles.questionCard}`}
            bordered={false}
            title="高频问题"
            description="统计周期内用户提问频次 Top 20"
          >
            {loading ? loadingPlaceholder(styles.tableLoadingPlaceholder) : (
              <Table<FrequentQuestion>
                data={data.questions}
                columns={questionColumns}
                rowKey="rank"
                bordered={false}
                hover
                size="medium"
                empty={<Empty title="当前范围暂无高频问题" />}
                pagination={{
                  current: pageInfo.current,
                  pageSize: pageInfo.pageSize,
                  total: data.questions.length,
                  showJumper: true,
                  pageSizeOptions: [10, 20, 50],
                  totalContent: `共 ${data.questions.length} 条数据`,
                }}
                onPageChange={handlePageChange}
              />
            )}
          </Card>
        </>
      )}
        </>
      )}
    </div>
  );
}
