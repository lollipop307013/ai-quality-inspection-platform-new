import { useEffect, useMemo, useRef, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { Alert, Button, Card, DatePicker, Empty, Loading } from 'tdesign-react';
import type { DatePickerProps } from 'tdesign-react';
import echartsTheme from '@/design-tokens/zhijilab-echarts-theme.json';
import TooltipIcon from '@/components/TooltipIcon';
import {
  getEmptyPubgmDashboardData,
  getInitialPubgmWeekRange,
  getPubgmDashboardData,
} from './pubgm-mock';
import type { PubgmDashboardData, PubgmLanguageItem } from './pubgm-mock';
import type { QaDashboardScenario } from './scenarios';
import styles from './PubgmBoard.module.less';

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

const defaultWeekRange = getInitialPubgmWeekRange();

// 按周统计只产出完整自然周，尚未结束的本周及以后整周不可选
const currentWeekStart = parseDate(getNaturalWeek(formatDate(new Date()))[0]).getTime();

interface PubgmBoardProps {
  previewScenario: QaDashboardScenario;
  projectName: string;
}

type LoadState = 'ready' | 'loading' | 'error';

export default function PubgmBoard({ previewScenario, projectName }: PubgmBoardProps) {
  const scenarioForcesEmpty = previewScenario === 'empty';
  const scenarioForcesLoading = previewScenario === 'loading';
  const scenarioForcesError = previewScenario === 'error';

  const initialRange = defaultWeekRange;

  const [weekRange, setWeekRange] = useState<[string, string]>(initialRange);
  const [data, setData] = useState<PubgmDashboardData>(() => {
    if (scenarioForcesEmpty) return getEmptyPubgmDashboardData(initialRange);
    if (scenarioForcesLoading || scenarioForcesError) {
      return getEmptyPubgmDashboardData(initialRange);
    }
    return getPubgmDashboardData({ dateRange: initialRange });
  });
  const [loadState, setLoadState] = useState<LoadState>(() => {
    if (scenarioForcesLoading) return 'loading';
    if (scenarioForcesError) return 'error';
    return 'ready';
  });
  const previousScenario = useRef(previewScenario);

  useEffect(() => {
    if (previousScenario.current === previewScenario) return undefined;
    previousScenario.current = previewScenario;

    const nextRange = defaultWeekRange;

    setWeekRange(nextRange);
    setLoadState(scenarioForcesLoading
      ? 'loading'
      : scenarioForcesError
        ? 'error'
        : 'ready');
    setData(scenarioForcesEmpty
      ? getEmptyPubgmDashboardData(nextRange)
      : scenarioForcesLoading || scenarioForcesError
        ? getEmptyPubgmDashboardData(nextRange)
        : getPubgmDashboardData({ dateRange: nextRange }));
    return undefined;
  }, [previewScenario]);

  const loading = loadState === 'loading';

  const runLoad = (nextData: PubgmDashboardData) => {
    setLoadState('loading');
    window.setTimeout(() => {
      setData(scenarioForcesEmpty ? getEmptyPubgmDashboardData(weekRange) : nextData);
      setLoadState('ready');
    }, 320);
  };

  const handleWeekChange: DatePickerProps['onChange'] = (value) => {
    const normalized = normalizeDateValue(value);
    if (!normalized) return;
    const nextRange = getNaturalWeek(normalized);
    setWeekRange(nextRange);
    runLoad(getPubgmDashboardData({ dateRange: nextRange }));
  };

  const retry = () => {
    setLoadState('loading');
    window.setTimeout(() => {
      setData(getPubgmDashboardData({ dateRange: weekRange }));
      setLoadState('ready');
    }, 320);
  };

  const languageChartOption = useMemo(() => ({
    tooltip: {
      trigger: 'item',
      formatter: (params: { name: string; value: number; percent: number }) => (
        `${params.name}<br/>消息数：${params.value.toLocaleString('en-US')}<br/>占比：${params.percent}%`
      ),
    },
    legend: { show: false },
    series: [{
      name: '语种消息数',
      type: 'pie',
      radius: ['52%', '78%'],
      center: ['50%', '52%'],
      avoidLabelOverlap: true,
      itemStyle: {
        borderRadius: 4,
        borderColor: echartsTheme.theme.borderColor,
        borderWidth: 2,
      },
      label: {
        show: true,
        position: 'outside',
        formatter: (params: { name: string; percent: number }) => (
          `${params.name}\n${params.percent}%`
        ),
        fontSize: 12,
        color: echartsTheme.theme.textColor,
      },
      labelLine: { length: 12, length2: 12 },
      labelLayout: { hideOverlap: true },
      data: data.languages.map((item) => ({
        name: item.code,
        value: item.count,
      })),
    }],
    graphic: [{
      type: 'text',
      left: 'center',
      top: '46%',
      style: {
        text: data.languageTotal.toLocaleString('en-US'),
        textAlign: 'center',
        fill: echartsTheme.theme.titleColor,
        fontSize: 22,
        fontWeight: 600,
      },
    }, {
      type: 'text',
      left: 'center',
      top: '56%',
      style: {
        text: `提问消息总数\n${data.languageCount} 种语种`,
        textAlign: 'center',
        fill: echartsTheme.theme.subtitleColor,
        fontSize: 12,
        lineHeight: 18,
      },
    }],
  }), [data.languages, data.languageTotal, data.languageCount]);

  const maxLanguageCount = useMemo(
    () => data.languages.reduce((max, item) => Math.max(max, item.count), 0),
    [data.languages],
  );

  return (
    <div className={styles.board}>
      <header className={styles.boardHeader}>
        <div className={styles.boardTitle}>
          <h2>PUBGM 周报</h2>
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

      {data.grayOnly && (
        <Alert
          className={styles.alert}
          theme="info"
          message="当前数据为全量灰度（汇总表未提供非灰度行），灰度 vs 非灰度对比项以「--」展示。"
          close={false}
        />
      )}

      {loadState === 'error' ? (
        <Card className={styles.sectionCard} bordered={false}>
          <Empty
            type="network-error"
            title="PUBGM 看板数据加载失败"
            description="当前周期已保留，请重新加载"
            action={<Button theme="primary" onClick={retry}>重新加载</Button>}
          />
        </Card>
      ) : (
        <>
          <Card
            className={styles.sectionCard}
            bordered={false}
            title="数据概览"
            description="周期内 PUBGM 问答规模与追问情况"
          >
            {loading ? (
              <div className={styles.loadingPlaceholder}>
                <Loading loading size="small" text="数据加载中" />
              </div>
            ) : (
              <div className={styles.metricGrid}>
                {data.metrics.map((metric) => (
                  <article key={metric.key} className={styles.metricItem}>
                    <div className={styles.metricLabel}>
                      {metric.label}
                      <TooltipIcon content={metric.tooltip} />
                    </div>
                    <div className={styles.metricValue}>{metric.value}</div>
                    {metric.grayOnlyLabel && metric.value !== '--' && (
                      <div className={styles.metricSub}>{metric.grayOnlyLabel}</div>
                    )}
                  </article>
                ))}
              </div>
            )}
          </Card>

          <Card
            className={styles.sectionCard}
            bordered={false}
            title="语种消息数与占比"
            description="按 language_code 统计提问消息数和占比"
          >
            {loading ? (
              <div className={`${styles.loadingPlaceholder} ${styles.languageLoading}`}>
                <Loading loading size="small" text="数据加载中" />
              </div>
            ) : data.languages.length === 0 ? (
              <div className={styles.languageEmpty}>
                <Empty title="当前范围暂无语种数据" description="请调整周期后重新查询" />
              </div>
            ) : (
              <div className={styles.languageLayout}>
                <div className={styles.languageChart}>
                  <h3 className={styles.subhead}>语种消息占比分布</h3>
                  <ReactECharts
                    className={styles.pieChart}
                    option={languageChartOption}
                    theme={echartsTheme.theme}
                    notMerge
                  />
                </div>
                <div className={styles.languageRight}>
                  <div className={styles.summaryCard}>
                    <h3 className={styles.subhead}>各语种提问消息数 · 完整排行</h3>
                    <div className={styles.summaryTags}>
                      <span className={styles.summaryTag}>
                        TOP 3 合计占比 <strong>{data.top3Share.toFixed(2)}%</strong>
                      </span>
                      <span className={styles.summaryTag}>
                        TOP 4 合计占比 <strong>{data.top4Share.toFixed(2)}%</strong>
                      </span>
                    </div>
                    <ul className={styles.rankingList}>
                      {data.languages.map((language: PubgmLanguageItem, index) => {
                        const ratio = maxLanguageCount === 0
                          ? 0
                          : (language.count / maxLanguageCount) * 100;
                        return (
                          <li key={language.code} className={styles.rankingItem}>
                            <span className={styles.rankingCode}>{language.code}</span>
                            <span className={styles.rankingName}>{language.name}</span>
                            <span className={styles.rankingBarTrack}>
                              <span
                                className={styles.rankingBarFill}
                                style={{
                                  width: `${ratio}%`,
                                  background: echartsTheme.theme.color[
                                    index % echartsTheme.theme.color.length
                                  ],
                                }}
                              />
                            </span>
                            <span className={styles.rankingCount}>
                              {language.count.toLocaleString('en-US')}
                            </span>
                            <span className={styles.rankingPercentage}>
                              {language.percentage.toFixed(2)}%
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </Card>

          <Card
            className={`${styles.sectionCard} ${styles.feedbackCard}`}
            bordered={false}
            title="用户反馈"
            description={`${projectName} · 本周期整体数据`}
          >
            {loading ? (
              <div className={`${styles.loadingPlaceholder} ${styles.feedbackLoading}`}>
                <Loading loading size="small" text="数据加载中" />
              </div>
            ) : (
              <ul className={styles.feedbackList}>
                {data.feedback.map((item) => (
                  <li key={item.key} className={styles.feedbackItem}>
                    <span className={styles.feedbackLabel}>{item.label}</span>
                    <span className={styles.feedbackValue}>{item.value}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
