import { useEffect, useMemo, useRef, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import {
  Button,
  Card,
  DatePicker,
  Dialog,
  Empty,
  Loading,
  Table,
} from 'tdesign-react';
import type {
  DatePickerProps,
  DialogProps,
  PrimaryTableCol,
} from 'tdesign-react';
import echartsTheme from '@/design-tokens/zhijilab-echarts-theme.json';
import TooltipIcon from '@/components/TooltipIcon';
import {
  getEmptyFcmDashboardData,
  getFcmDashboardData,
  getInitialFcmWeekRange,
} from './fcm-mock';
import type {
  FcmActiveUserItem,
  FcmCategoryDetailItem,
  FcmConversationItem,
  FcmDashboardData,
  FcmL1Category,
  FcmTopQuestionItem,
} from './fcm-mock';
import type { QaDashboardScenario } from './scenarios';
import styles from './FcmBoard.module.less';

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

const normalizeDateValue = (
  value: Parameters<NonNullable<DatePickerProps['onChange']>>[0],
): string | null => {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate) return null;
  if (candidate instanceof Date) return formatDate(candidate);
  return String(candidate);
};

const defaultWeekRange = getInitialFcmWeekRange();

// 按周统计只产出完整自然周，尚未结束的本周及以后整周不可选
const currentWeekStart = parseDate(getNaturalWeek(formatDate(new Date()))[0]).getTime();

type LoadState = 'ready' | 'loading' | 'error';

interface FcmBoardProps {
  previewScenario: QaDashboardScenario;
  projectName: string;
}

const buildPieOption = (
  data: Array<{ name: string; value: number; percentage: number }>,
  centerText: { title: string; subtitle: string },
) => ({
  tooltip: {
    trigger: 'item',
    formatter: (params: { name: string; value: number; percent: number }) => (
      `${params.name}<br/>数量：${params.value.toLocaleString('en-US')}<br/>占比：${params.percent}%`
    ),
  },
  legend: {
    type: 'scroll',
    bottom: 0,
    itemWidth: 10,
    itemHeight: 10,
    textStyle: { fontSize: 12 },
  },
  series: [{
    name: centerText.title,
    type: 'pie',
    radius: ['52%', '76%'],
    center: ['50%', '46%'],
    avoidLabelOverlap: true,
    itemStyle: {
      borderRadius: 4,
      borderColor: echartsTheme.theme.borderColor,
      borderWidth: 2,
    },
    label: { show: false },
    labelLine: { show: false },
    data: data.map((item) => ({ name: item.name, value: item.value })),
  }],
  graphic: [{
    type: 'text',
    left: 'center',
    top: '40%',
    style: {
      text: centerText.title,
      textAlign: 'center',
      fill: echartsTheme.theme.titleColor,
      fontSize: 18,
      fontWeight: 600,
    },
  }, {
    type: 'text',
    left: 'center',
    top: '50%',
    style: {
      text: centerText.subtitle,
      textAlign: 'center',
      fill: echartsTheme.theme.subtitleColor,
      fontSize: 12,
    },
  }],
});

export default function FcmBoard({ previewScenario, projectName }: FcmBoardProps) {
  const scenarioForcesEmpty = previewScenario === 'empty';
  const scenarioForcesLoading = previewScenario === 'loading';
  const scenarioForcesError = previewScenario === 'error';

  const [weekRange, setWeekRange] = useState<[string, string]>(defaultWeekRange);
  const [data, setData] = useState<FcmDashboardData>(() => {
    if (scenarioForcesEmpty) return getEmptyFcmDashboardData(defaultWeekRange);
    if (scenarioForcesLoading || scenarioForcesError) {
      return getEmptyFcmDashboardData(defaultWeekRange);
    }
    return getFcmDashboardData({ dateRange: defaultWeekRange });
  });
  const [loadState, setLoadState] = useState<LoadState>(() => {
    if (scenarioForcesLoading) return 'loading';
    if (scenarioForcesError) return 'error';
    return 'ready';
  });
  const previousScenario = useRef(previewScenario);
  const [conversationTarget, setConversationTarget] = useState<FcmActiveUserItem | null>(null);
  const [questionTarget, setQuestionTarget] = useState<FcmTopQuestionItem | null>(null);

  const activeUserColumns = useMemo<PrimaryTableCol<FcmActiveUserItem>[]>(() => [
    { colKey: 'rank', title: '#', width: 56, align: 'center' },
    { colKey: 'openId', title: '用户 OPEN_ID', ellipsis: true },
    { colKey: 'count', title: '消息数', width: 100, align: 'right' },
    { colKey: 'percentage', title: '占比', width: 100, align: 'right' },
    {
      colKey: 'action',
      title: '操作',
      width: 100,
      align: 'center',
      cell: ({ row }: { row: FcmActiveUserItem }) => (
        <Button
          theme="primary"
          variant="text"
          onClick={() => setConversationTarget(row)}
        >
          查看对话
        </Button>
      ),
    },
  ], []);

  const categoryDetailColumns = useMemo<PrimaryTableCol<FcmCategoryDetailItem>[]>(() => [
    { colKey: 'l1Label', title: '一级类', width: 140 },
    { colKey: 'l2Label', title: '二级类', width: 140 },
    { colKey: 'description', title: '描述', ellipsis: true },
    { colKey: 'count', title: '提问量', width: 100, align: 'right' },
    { colKey: 'percentage', title: '占比', width: 100, align: 'right' },
  ], []);

  const topQuestionColumns = useMemo<PrimaryTableCol<FcmTopQuestionItem>[]>(() => [
    { colKey: 'rank', title: '#', width: 56, align: 'center' },
    { colKey: 'question', title: '问题', ellipsis: true },
    { colKey: 'count', title: '次数', width: 80, align: 'right' },
    { colKey: 'category', title: '类别', width: 110 },
    {
      colKey: 'action',
      title: '操作',
      width: 100,
      align: 'center',
      cell: ({ row }: { row: FcmTopQuestionItem }) => (
        <Button
          theme="primary"
          variant="text"
          onClick={() => setQuestionTarget(row)}
        >
          查看问答
        </Button>
      ),
    },
  ], []);

  useEffect(() => {
    if (previousScenario.current === previewScenario) return undefined;
    previousScenario.current = previewScenario;

    setWeekRange(defaultWeekRange);
    setLoadState(scenarioForcesLoading
      ? 'loading'
      : scenarioForcesError
        ? 'error'
        : 'ready');
    setData(scenarioForcesEmpty
      ? getEmptyFcmDashboardData(defaultWeekRange)
      : scenarioForcesLoading || scenarioForcesError
        ? getEmptyFcmDashboardData(defaultWeekRange)
        : getFcmDashboardData({ dateRange: defaultWeekRange }));
    return undefined;
  }, [previewScenario]);

  const loading = loadState === 'loading';

  const runLoad = (nextData: FcmDashboardData) => {
    setLoadState('loading');
    window.setTimeout(() => {
      setData(scenarioForcesEmpty ? getEmptyFcmDashboardData(weekRange) : nextData);
      setLoadState('ready');
    }, 320);
  };

  const handleWeekChange: DatePickerProps['onChange'] = (value) => {
    const normalized = normalizeDateValue(value);
    if (!normalized) return;
    const nextRange = getNaturalWeek(normalized);
    setWeekRange(nextRange);
    runLoad(getFcmDashboardData({ dateRange: nextRange }));
  };

  const retry = () => {
    setLoadState('loading');
    window.setTimeout(() => {
      setData(getFcmDashboardData({ dateRange: weekRange }));
      setLoadState('ready');
    }, 320);
  };

  const dailyMessageOption = useMemo(() => ({
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      valueFormatter: (value: number) => value.toLocaleString('en-US'),
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '8%',
      top: '12%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: data.dailyMessages.map((item) => item.date),
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      axisLabel: { formatter: '{value}' },
    },
    series: [{
      name: '用户消息',
      type: 'bar',
      data: data.dailyMessages.map((item) => item.count),
      barWidth: 32,
      itemStyle: { borderRadius: [4, 4, 0, 0] },
    }],
  }), [data.dailyMessages]);

  const l1PieOption = useMemo(() => {
    if (data.l1Categories.length === 0) return null;
    return buildPieOption(
      data.l1Categories.map((cat) => ({
        name: cat.label,
        value: cat.total,
        percentage: cat.percentage,
      })),
      {
        title: data.l1Categories.reduce((sum, item) => sum + item.total, 0)
          .toLocaleString('en-US'),
        subtitle: `${data.l1Categories.length} 个一级分类`,
      },
    );
  }, [data.l1Categories]);

  const l2PieOptions = useMemo(() => data.l1Categories.map((cat: FcmL1Category) => {
    const total = cat.total;
    return {
      category: cat,
      option: buildPieOption(
        cat.l2.map((l2) => ({
          name: l2.label,
          value: l2.count,
          percentage: l2.shareInL1,
        })),
        {
          title: total.toLocaleString('en-US'),
          subtitle: `${cat.l2.length} 个二级分类`,
        },
      ),
    };
  }), [data.l1Categories]);

  const closeConversationDialog: NonNullable<DialogProps['onClose']> = (context) => {
    if (context?.trigger === 'close-btn' || context?.trigger === 'overlay' || context?.trigger === 'esc') {
      setConversationTarget(null);
    }
  };

  const closeQuestionDialog: NonNullable<DialogProps['onClose']> = (context) => {
    if (context?.trigger === 'close-btn' || context?.trigger === 'overlay' || context?.trigger === 'esc') {
      setQuestionTarget(null);
    }
  };

  const renderConversationList = (items: FcmConversationItem[]) => (
    <ul className={styles.dialogList}>
      {items.map((item, index) => (
        <li key={index} className={styles.dialogItem}>
          <div className={styles.dialogMeta}>
            {item.time} · {item.category}
          </div>
          <div className={styles.dialogQuestion}>
            <span className={styles.dialogTag}>Q</span>
            <span>{item.question}</span>
          </div>
          <div className={styles.dialogAnswer}>
            <span className={styles.dialogTag}>A</span>
            <span>{item.answer}</span>
          </div>
        </li>
      ))}
    </ul>
  );

  return (
    <div className={styles.board}>
      <header className={styles.boardHeader}>
        <div className={styles.boardTitle}>
          <h2>FCM 周报</h2>
          <span className={styles.boardSubtitle}>
            {projectName}
          </span>
        </div>
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
          <span className={styles.weekHint}>
            {weekRange[0]} ~ {weekRange[1]}（周一00:00:00至周日23:59:59）
          </span>
        </div>
      </header>

      {loadState === 'error' ? (
        <Card className={styles.sectionCard} bordered={false}>
          <Empty
            type="network-error"
            title="FCM 看板数据加载失败"
            description="当前周期已保留，请重新加载"
            action={<Button theme="primary" onClick={retry}>重新加载</Button>}
          />
        </Card>
      ) : (
        <>
          <Card
            className={styles.sectionCard}
            bordered={false}
            title="1 整体概览"
            description="项目组最关心：有没有人用、问了多少、是否持续追问"
          >
            {loading ? (
              <div className={styles.loadingPlaceholder}>
                <Loading loading size="small" text="数据加载中" />
              </div>
            ) : (
              <div className={styles.metricGrid}>
                {data.metrics.map((metric) => (
                  <article
                    key={metric.key}
                    className={`${styles.metricItem} ${styles[`tone-${metric.tone}`]}`}
                  >
                    <div className={styles.metricLabel}>
                      {metric.label}
                      <TooltipIcon content={metric.tooltip} />
                    </div>
                    <div className={styles.metricValue}>{metric.value}</div>
                  </article>
                ))}
              </div>
            )}
          </Card>

          <Card
            className={styles.sectionCard}
            bordered={false}
            title="2 使用规模与会话深度"
            description="观察用户使用规模与会话深度"
          >
            {loading ? (
              <div className={`${styles.loadingPlaceholder} ${styles.dailyLoading}`}>
                <Loading loading size="small" text="数据加载中" />
              </div>
            ) : data.dailyMessages.length === 0 ? (
              <Empty title="当前范围暂无每日用户消息数" />
            ) : (
              <ReactECharts
                className={styles.dailyChart}
                option={dailyMessageOption}
                theme={echartsTheme.theme}
                notMerge
              />
            )}
          </Card>

          <Card
            className={`${styles.sectionCard} ${styles.activeUserCard}`}
            bordered={false}
            title="高活跃用户下钻"
            description={`按消息量倒序，取 Top ${data.activeUsers.length}`}
          >
            {loading ? (
              <div className={`${styles.loadingPlaceholder} ${styles.activeUserLoading}`}>
                <Loading loading size="small" text="数据加载中" />
              </div>
            ) : (
              <Table<FcmActiveUserItem>
                data={data.activeUsers}
                columns={activeUserColumns}
                rowKey="rank"
                bordered={false}
                hover
                size="medium"
                pagination={{ total: 1000, pageSize: 1000, showJumper: false, totalContent: false }}
                empty={<Empty title="当前范围暂无高活跃用户" />}
              />
            )}
          </Card>

          <Card
            className={styles.sectionCard}
            bordered={false}
            title="3 提问内容及分类"
            description="用户到底在问什么，可下钻真实问答"
          >
            {loading ? (
              <div className={`${styles.loadingPlaceholder} ${styles.l1Loading}`}>
                <Loading loading size="small" text="数据加载中" />
              </div>
            ) : data.l1Categories.length === 0 ? (
              <Empty title="当前范围暂无分类数据" />
            ) : (
              <div className={styles.classificationLayout}>
                <div className={styles.l1ChartCard}>
                  <h3 className={styles.subhead}>一级分类分布</h3>
                  {l1PieOption && (
                    <ReactECharts
                      className={styles.l1Chart}
                      option={l1PieOption}
                      theme={echartsTheme.theme}
                      notMerge
                    />
                  )}
                </div>
                <div className={styles.l2Grid}>
                  {l2PieOptions.map(({ category, option }) => (
                    <div key={category.key} className={styles.l2ChartCard}>
                      <h3 className={styles.subhead}>{category.label}</h3>
                      <ReactECharts
                        className={styles.l2Chart}
                        option={option}
                        theme={echartsTheme.theme}
                        notMerge
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>

          <Card
            className={`${styles.sectionCard} ${styles.detailCard}`}
            bordered={false}
            title="类别明细"
            description="按一级分类、二级分类输出提问量与占比"
          >
            {loading ? (
              <div className={`${styles.loadingPlaceholder} ${styles.detailLoading}`}>
                <Loading loading size="small" text="数据加载中" />
              </div>
            ) : (
              <Table<FcmCategoryDetailItem>
                data={data.categoryDetails}
                columns={categoryDetailColumns}
                rowKey="id"
                bordered={false}
                hover
                size="medium"
                pagination={{ total: 1000, pageSize: 1000, showJumper: false, totalContent: false }}
                empty={<Empty title="当前范围暂无类别明细" />}
              />
            )}
          </Card>

          <Card
            className={`${styles.sectionCard} ${styles.topQuestionCard}`}
            bordered={false}
            title="高频提问 Top 30（可下钻样例）"
            description="按提问内容聚合，频次倒序"
          >
            {loading ? (
              <div className={`${styles.loadingPlaceholder} ${styles.topQuestionLoading}`}>
                <Loading loading size="small" text="数据加载中" />
              </div>
            ) : (
              <Table<FcmTopQuestionItem>
                data={data.topQuestions}
                columns={topQuestionColumns}
                rowKey="rank"
                bordered={false}
                hover
                size="medium"
                pagination={{ total: 1000, pageSize: 1000, showJumper: false, totalContent: false }}
                empty={<Empty title="当前范围暂无高频提问" />}
              />
            )}
          </Card>

          <Card
            className={styles.sectionCard}
            bordered={false}
            title="4 用户属性与入口"
            description="基于 ext 字段观察用户构成与小程序入口"
          >
            {loading ? (
              <div className={`${styles.loadingPlaceholder} ${styles.svipLoading}`}>
                <Loading loading size="small" text="数据加载中" />
              </div>
            ) : (
              <div className={styles.svipCard}>
                <div className={styles.svipHeader}>
                  <span className={styles.svipLabel}>SVIP 用户</span>
                </div>
                <div className={`${styles.svipValue} ${styles['tone-positive']}`}>
                  {data.svipPercentage.toFixed(2)}%
                </div>
                <div className={styles.svipMeta}>样例用户消息记录</div>
                <div className={styles.svipNote}>SVIP 占比来自 ext.is_svip 字段。</div>
              </div>
            )}
          </Card>
        </>
      )}

      <Dialog
        visible={conversationTarget !== null}
        header={`用户对话详情 · ${conversationTarget?.openId ?? ''}`}
        width={760}
        onClose={closeConversationDialog}
        onClosed={() => setConversationTarget(null)}
        footer={null}
      >
        {conversationTarget && (
          conversationTarget.conversations.length > 0
            ? renderConversationList(conversationTarget.conversations)
            : <Empty title="该用户当前周期暂无对话明细" />
        )}
      </Dialog>

      <Dialog
        visible={questionTarget !== null}
        header={`高频提问问答 · ${questionTarget?.question ?? ''}`}
        width={760}
        onClose={closeQuestionDialog}
        onClosed={() => setQuestionTarget(null)}
        footer={null}
      >
        {questionTarget && (
          questionTarget.questionDetail.length > 0
            ? renderConversationList(questionTarget.questionDetail)
            : <Empty title="当前问题暂无问答明细" />
        )}
      </Dialog>
    </div>
  );
}
