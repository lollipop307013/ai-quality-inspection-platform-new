import React, { useState, useMemo } from "react";
import { Card, Form, Textarea, Button, Checkbox, Select, Space, Loading, Input, Tag, Alert, Statistic } from "tdesign-react";
import { CheckCircleFilledIcon } from "tdesign-icons-react";
import "../../fact-db/error-detect.less";

const { FormItem } = Form;

interface FactResult {
  id: number;
  content: string;
  matchType: "模糊匹配" | "实体匹配" | "RAG召回";
  status: "待判断" | "无错误" | "有错误";
  analysis?: string;
}

const mockFactResults: FactResult[] = [
  {
    id: 16841,
    content: "无畏契约手游的标准阵容由四个固定位置组成：决斗：一突（捷风、霓虹、雷兹）二突（芮娜、不死鸟（火男）、夜露、壹决）、控场（炼狱、幽影、蜂蛇、星碴）、哨位（贤者、零、奇乐、尚勃勒）和先锋（铁臂、猎枭、斯凯）。在亚海悬城地图防守时采用212站位策略：一突抢A大控制权，二突守A小并提供中路信息和道具支援，控场在中路封锁敌方路线，哨位在B大放置道具，先锋在市场待机，形成2人守A、1人中路、2人守B的防守布局。进攻时一突高机动率先行动并沟通道具需求，二突补枪，控场根据需求施放烟雾，先锋使用控制或者侦察技能，哨位跟随二突提供治疗。",
    matchType: "模糊匹配",
    status: "待判断",
  },
  {
    id: 16842,
    content: "霓虹的技能价格为：高速通道300资金，闪电弹球200资金，充能疾驰免费通过充能获取能量，超限暴走需要8点大招点数。霓虹是一个以速度著称的决斗型特工，她的冲刺能力使她能够快速穿越地图并切入敌人后方。",
    matchType: "模糊匹配",
    status: "待判断",
  },
  {
    id: 16843,
    content: "无畏契约中竞技模式的段位系统从低到高依次为：黑铁、青铜、白银、黄金、白金、钻石、永恒、超凡、无畏。每个段位（除超凡和无畏外）分为3个小段。",
    matchType: "实体匹配",
    status: "待判断",
  },
];

export default function ErrorDetectTab() {
  const [wrong, setWrong] = useState("");
  const [correct, setCorrect] = useState("");
  const [original, setOriginal] = useState("");
  const [fuzzy, setFuzzy] = useState(true);
  const [entity, setEntity] = useState(false);
  const [rag, setRag] = useState(false);
  const [m1, setM1] = useState("deepseek-v3-2-251201");
  const [m2, setM2] = useState("deepseek-v3-2-251201");
  const [m3, setM3] = useState("deepseek-v3-2-251201");

  const [phase, setPhase] = useState<"idle" | "detecting" | "detected" | "fixing" | "fixed">("idle");
  const [factResults, setFactResults] = useState<FactResult[]>([]);
  const [hideNoError, setHideNoError] = useState(false);
  const [filterText, setFilterText] = useState("");

  const handleDetect = () => {
    setPhase("detecting");
    setFactResults([]);
    setTimeout(() => {
      setPhase("detected");
      setFactResults(mockFactResults.map((f) => ({ ...f, status: "待判断" })));
    }, 2000);
  };

  const handleFix = () => {
    setPhase("fixing");
    setTimeout(() => {
      setPhase("fixed");
      setFactResults((prev) =>
        prev.map((f) => ({
          ...f,
          status: "无错误" as const,
          analysis: f.id === 16841
            ? "事实文本中'不死鸟（火男）'的标注与错误表述'枪支不是火男'无关，文本未出现将'枪支'与'火男'身份进行等同或否定比较的相同逻辑错误。"
            : f.id === 16842
            ? "该事实中霓虹的技能价格描述与已知数据一致，未发现错误表述。"
            : "段位系统描述准确，未发现与错误表述相关的问题。",
        }))
      );
    }, 2000);
  };

  const stats = useMemo(() => {
    if (phase === "detected" || phase === "fixing") {
      return {
        type: "detect" as const,
        recallCount: factResults.length,
        fuzzyCount: factResults.filter((f) => f.matchType === "模糊匹配").length,
        entityCount: factResults.filter((f) => f.matchType === "实体匹配").length,
        ragCount: factResults.filter((f) => f.matchType === "RAG召回").length,
      };
    }
    if (phase === "fixed") {
      return {
        type: "fix" as const,
        checkedCount: factResults.length,
        errorCount: factResults.filter((f) => f.status === "有错误").length,
        fixedCount: 0,
      };
    }
    return null;
  }, [phase, factResults]);

  const filteredResults = useMemo(() => {
    let results = factResults;
    if (hideNoError) {
      results = results.filter((f) => f.status !== "无错误");
    }
    if (filterText.trim()) {
      const kw = filterText.toLowerCase();
      results = results.filter((f) => f.content.toLowerCase().includes(kw));
    }
    return results;
  }, [factResults, hideNoError, filterText]);

  return (
    <div className="factdb-tab-content">
      <Card bordered>
        <h3 style={{ marginTop: 0, marginBottom: 16 }}>错误表述检测与修正建议</h3>
        <Form labelAlign="top" labelWidth={0}>
          <FormItem label="错误表述" requiredMark>
            <Textarea placeholder="请输入错误的表述片段..." value={wrong} onChange={(v) => setWrong(v)} autosize={{ minRows: 3 }} />
          </FormItem>
          <FormItem label="正确表述" requiredMark>
            <Textarea placeholder="请输入对应的正确表述..." value={correct} onChange={(v) => setCorrect(v)} autosize={{ minRows: 3 }} />
          </FormItem>
          <FormItem label="完整原始内容（可选，提供完整原始内容可帮助更好匹配）">
            <Textarea placeholder="可选的完整原始文档内容..." value={original} onChange={(v) => setOriginal(v)} autosize={{ minRows: 3 }} />
          </FormItem>
          <FormItem label="召回方式（多选，可选择多种召回方式）">
            <Space size="large">
              <Checkbox checked={fuzzy} onChange={(v) => setFuzzy(v as boolean)}>模糊匹配</Checkbox>
              <Checkbox checked={entity} onChange={(v) => setEntity(v as boolean)}>实体匹配</Checkbox>
              <Checkbox checked={rag} onChange={(v) => setRag(v as boolean)}>RAG召回</Checkbox>
            </Space>
          </FormItem>
          <FormItem label="执行" style={{ marginBottom: 0 }}>
            <div className="ed-section-subtitle" style={{ marginBottom: 0 }}>分步执行</div>
          </FormItem>
          <div style={{ marginBottom: 20 }}>
            <div className="ed-step-cards">
              <div className={`ed-step-card ${phase !== "idle" ? "ed-step-card--done" : ""}`}>
                <div className="ed-step-card-header">
                  <span className="ed-step-num">1</span>
                  <div>
                    <div className="ed-step-card-title">检索</div>
                    <div className="ed-step-card-desc">召回相关事实</div>
                  </div>
                </div>
                <div className="ed-step-card-model-label">模型设置</div>
                <Select filterable value={m1} onChange={(v) => setM1(v as string)} options={[{ label: "deepseek-v3-2-251201", value: "deepseek-v3-2-251201" }]} style={{ width: "100%" }} />
              </div>
              <div className={`ed-step-card ${phase === "fixed" || phase === "fixing" ? "ed-step-card--done" : ""}`}>
                <div className="ed-step-card-header">
                  <span className="ed-step-num">2</span>
                  <div>
                    <div className="ed-step-card-title">判断</div>
                    <div className="ed-step-card-desc">核验表述准确性</div>
                  </div>
                </div>
                <div className="ed-step-card-model-label">模型设置</div>
                <Select filterable value={m2} onChange={(v) => setM2(v as string)} options={[{ label: "deepseek-v3-2-251201", value: "deepseek-v3-2-251201" }]} style={{ width: "100%" }} />
              </div>
              <div className={`ed-step-card ${phase === "fixed" ? "ed-step-card--done" : ""}`}>
                <div className="ed-step-card-header">
                  <span className="ed-step-num">3</span>
                  <div>
                    <div className="ed-step-card-title">修复</div>
                    <div className="ed-step-card-desc">生成修正建议</div>
                  </div>
                </div>
                <div className="ed-step-card-model-label">模型设置</div>
                <Select filterable value={m3} onChange={(v) => setM3(v as string)} options={[{ label: "deepseek-v3-2-251201", value: "deepseek-v3-2-251201" }]} style={{ width: "100%" }} />
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
            <Button theme="primary" loading={phase === "detecting"} onClick={handleDetect} disabled={phase === "detecting" || phase === "fixing"}>
              检索
            </Button>
            <Button theme="primary" loading={phase === "fixing"} onClick={handleFix} disabled={phase !== "detected" && phase !== "fixed"}>
              判断并修复
            </Button>
          </div>
        </Form>
      </Card>

      {phase === "detecting" && (
        <Card bordered style={{ marginTop: 16, textAlign: "center", padding: 32 }}>
          <Loading text="正在检索相关事实，请稍候..." />
        </Card>
      )}

      {phase === "fixing" && (
        <Card bordered style={{ marginTop: 16, textAlign: "center", padding: 32 }}>
          <Loading text="正在判断并修复，请稍候..." />
        </Card>
      )}

      {(phase === "detected" || phase === "fixed") && stats && (
        <>
          {/* 统计信息 - 使用 TDesign Card + Statistic */}
          <Card bordered title="统计信息" style={{ marginTop: 16 }}>
            {stats.type === "detect" ? (
              <Space size={80} style={{ display: "flex", justifyContent: "center", textAlign: "center" }}>
                <div style={{ textAlign: "center" }}><Statistic title="召回事实数" value={stats.recallCount} color="blue" /></div>
                <div style={{ textAlign: "center" }}><Statistic title="模糊匹配" value={stats.fuzzyCount} color="blue" /></div>
                <div style={{ textAlign: "center" }}><Statistic title="实体匹配" value={stats.entityCount} color="blue" /></div>
                <div style={{ textAlign: "center" }}><Statistic title="RAG召回" value={stats.ragCount} color="blue" /></div>
              </Space>
            ) : (
              <Space size={80} style={{ display: "flex", justifyContent: "center", textAlign: "center" }}>
                <div style={{ textAlign: "center" }}><Statistic title="已检查事实数" value={stats.checkedCount} color="blue" /></div>
                <div style={{ textAlign: "center" }}><Statistic title="存在错误的事实数" value={stats.errorCount} color="red" /></div>
                <div style={{ textAlign: "center" }}><Statistic title="已修复事实数" value={stats.fixedCount} color="blue" /></div>
              </Space>
            )}
          </Card>

          {/* 错误分析 - 使用 TDesign Alert */}
          <div style={{ marginTop: 16 }}>
            <Alert
              theme="warning"
              title="错误分析"
              message="错误表述'枪支不是火男'在逻辑和事实上都存在混淆。'枪支'是一种武器或物品，而'火男'通常指代一个角色、身份或称号（例如游戏角色、绑号等），两者属于完全不同的范畴，不能直接进行'是'或'不是'的等同或否定判断。正确的表述'我是火男'明确了'火男'是说话者自身的身份标识。"
            />
          </div>

          {/* 检测结果 - 使用 TDesign Card */}
          <Card bordered style={{ marginTop: 16 }} header={
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
              <span style={{ fontSize: 15, fontWeight: 600 }}>检测结果</span>
              <Space size={12} align="center">
                <Checkbox checked={hideNoError} onChange={(v) => setHideNoError(v as boolean)}>隐藏无错误事实</Checkbox>
                <Input
                  placeholder="筛选包含指定内容的事实..."
                  value={filterText}
                  onChange={(v) => setFilterText(v)}
                  style={{ width: 220 }}
                />
              </Space>
            </div>
          }>
            {hideNoError && (
              <div style={{ fontSize: 13, color: "var(--td-text-color-secondary)", marginBottom: 16 }}>
                显示 {filteredResults.length} / {factResults.length} 个事实{" "}
                <span style={{ color: "var(--td-brand-color)", cursor: "pointer" }}>[已隐藏无错误事实]</span>
              </div>
            )}

            <Space direction="vertical" size={16} style={{ width: "100%" }}>
              {filteredResults.map((fact) => (
                <FactResultCard key={fact.id} fact={fact} phase={phase} />
              ))}
              {filteredResults.length === 0 && (
                <div style={{ textAlign: "center", padding: 32, color: "var(--td-text-color-placeholder)" }}>
                  暂无匹配的事实
                </div>
              )}
            </Space>
          </Card>
        </>
      )}
    </div>
  );
}

function FactResultCard({ fact, phase }: { fact: FactResult; phase: string }) {
  const isFixed = phase === "fixed";
  const isNoError = fact.status === "无错误";
  const borderColor = isFixed
    ? isNoError ? "var(--td-success-color)" : "var(--td-error-color)"
    : "var(--td-brand-color)";

  return (
    <div className="qa-fact-card" style={{ borderLeftColor: borderColor, marginBottom: 0 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <Space size={12} align="center">
          <span style={{ fontSize: 15, fontWeight: 600, color: "var(--td-brand-color)" }}>事实 #{fact.id}</span>
          {isFixed ? (
            isNoError ? (
              <Tag theme="success" variant="light"><CheckCircleFilledIcon style={{ marginRight: 4 }} />无错误</Tag>
            ) : (
              <Tag theme="danger" variant="light">✗ 有错误</Tag>
            )
          ) : (
            <Tag theme="default" variant="light">待判断</Tag>
          )}
        </Space>
        <Tag variant="outline" size="small">{fact.matchType}</Tag>
      </div>

      {isFixed && fact.analysis && (
        <div style={{ marginBottom: 12 }}>
          <Alert
            theme={isNoError ? "success" : "error"}
            title={isNoError ? "未发现相同错误" : "发现错误"}
            message={fact.analysis}
          />
        </div>
      )}

      <div style={{ fontSize: 13, lineHeight: 1.8, color: "var(--td-text-color-primary)" }}>
        {fact.content}
      </div>
    </div>
  );
}
