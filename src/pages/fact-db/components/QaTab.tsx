import React, { useState } from "react";
import { Card, Input, Button, Checkbox, Space, Loading, Tag } from "tdesign-react";

const mockReply = "根据现有知识库，信息不足以回答此问题。您的问题似乎不完整，目前无法提供相关答案。";

const mockEntities = [
  { name: "卡面", desc: "游戏内道具，用于展示玩家个人身份和成就的背景图片或插画" },
  { name: "好友系统", desc: "1.同平台好友会自动显示在列表，也可以在游戏内添加好友 2.可查看仅好友可见的动态。好友动态也显示玩家自己的触发动态；在与我有关页签" },
  { name: "森寒冬港", desc: "别名：冰箱 说明：常规模式地图，有A、B两个包点" },
  { name: "个人资料", desc: "1.总览：展示玩家的名称、头像、头像框、卡面、段位、成就、编号、称号等信息 2.战绩：储存玩家战斗记录" },
  { name: "静步", desc: "一种移动技巧，通过轻推摇杆实现无声息地靠近敌人" },
  { name: "无畏时刻", desc: "录制玩家对局中精彩操作，可以保存本地或分享社交平台" },
  { name: "通行证", desc: "1.通行证分为免费和付费两个奖励路线 2.奖励内容为源晶品、赛季币和常规外显资源 3.赛季币可兑换各种挂饰、喷漆、卡面等" },
  { name: "道具", desc: "游戏道具" },
];

interface RelationNode {
  name: string;
  children?: RelationNode[];
}

const mockRelations: RelationNode[] = [
  { name: "卡面", children: [
    { name: "道具", children: [
      { name: "地图" },
    ]},
    { name: "皮肤" },
  ]},
  { name: "好友系统", children: [{ name: "系统模块" }] },
  { name: "森寒冬港", children: [{ name: "地图" }] },
  { name: "个人资料", children: [
    { name: "系统模块", children: [
      { name: "设置" },
      { name: "好友系统" },
    ]},
  ]},
  { name: "静步", children: [{ name: "技巧" }] },
  { name: "无畏时刻", children: [{ name: "系统模块" }] },
  { name: "通行证", children: [{ name: "系统模块" }, { name: "商业化" }] },
];

const mockFacts = [
  { id: 37958, similarity: 1.2, content: "无畏时刻：录制玩家对局中精彩操作，可以保存本地或分享社交平台", entity: "无畏时刻", event: "无" },
  { id: 37957, similarity: 1.1, content: "玩家可以在游戏首页的通行证模块中查看新通行证的具体内容。", entity: "通行证", event: "无" },
  { id: 37956, similarity: 0.8, content: "在关于英雄芮娜的视频内容中，游戏环境采用了第一人称视角和暗色调背景，以增强沉浸感和战斗氛围。", entity: "芮娜", event: "无" },
];

const mockQaEvents = [
  { id: 10926, name: "九九大吉", eventType: "活动", startTime: "2026-01-20 00:00:00", endTime: "2026-04-09 23:59:59" },
  { id: 10889, name: "联赛冠军赛", eventType: "比赛", startTime: "2025-12-08 10:00:00", endTime: "2026-04-09 18:00:00" },
  { id: 10888, name: "千秋高思", eventType: "活动", startTime: "2025-12-08 00:00:00", endTime: "-" },
];

function RelationTree({ nodes, depth }: { nodes: RelationNode[]; depth: number }) {
  return (
    <>
      {nodes.map((node) => (
        <div key={node.name}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: `6px 12px 6px ${12 + depth * 16}px`, borderTop: "1px solid var(--td-border-level-1-color)" }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--td-brand-color)", opacity: Math.max(0.3, 1 - depth * 0.2), flexShrink: 0 }} />
            <span style={{ color: "var(--td-text-color-secondary)", fontSize: 13 }}>{node.name}</span>
          </div>
          {node.children && <RelationTree nodes={node.children} depth={depth + 1} />}
        </div>
      ))}
    </>
  );
}

export default function QaTab() {
  const [question, setQuestion] = useState("");
  const [genReply, setGenReply] = useState(true);
  const [auditOnly, setAuditOnly] = useState(false);
  const [llmFilter, setLlmFilter] = useState(true);
  const [loading, setLoading] = useState(false);
  const [hasResult, setHasResult] = useState(false);

  const handleQuery = () => {
    if (!question.trim()) return;
    setLoading(true);
    setHasResult(false);
    setTimeout(() => {
      setLoading(false);
      setHasResult(true);
    }, 1500);
  };

  return (
    <div className="factdb-tab-content">
      <Card bordered>
        <h3 style={{ marginTop: 0, marginBottom: 16 }}>FactRAG 问题回复</h3>
        <div style={{ marginBottom: 12, fontWeight: 500 }}>输入问题</div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <Input
            placeholder="请输入您的问题..."
            value={question}
            onChange={(v) => setQuestion(v)}
            style={{ flex: 1 }}
          />
          <Space size="large">
            <Checkbox checked={genReply} onChange={(v) => setGenReply(v as boolean)}>生成回复</Checkbox>
            <Checkbox checked={auditOnly} onChange={(v) => setAuditOnly(v as boolean)}>仅使用已审核内容</Checkbox>
            <Checkbox checked={llmFilter} onChange={(v) => setLlmFilter(v as boolean)}>LLM筛选实体/事件</Checkbox>
          </Space>
          <Button theme="primary" loading={loading} onClick={handleQuery}>查询</Button>
        </div>
      </Card>

      {loading && (
        <Card bordered style={{ marginTop: 16, textAlign: "center", padding: 48 }}>
          <Loading text="正在查询中，请稍候..." size="medium" />
        </Card>
      )}

      {hasResult && !loading && (
        <div className="qa-result">
          <div className="qa-section qa-section--reply">
            <div className="qa-section-title" style={{ color: "var(--td-success-color)" }}>生成的回复</div>
            <div className="qa-section-body" style={{ color: "var(--td-success-color)" }}>{mockReply}</div>
          </div>

          <div className="qa-section">
            <div className="qa-section-title" style={{ color: "var(--td-brand-color)" }}>参考实体</div>
            <div className="qa-section-body">
              {mockEntities.map((e) => (
                <div key={e.name} style={{ marginBottom: 8, display: "flex", alignItems: "flex-start", gap: 8 }}>
                  <Tag theme="default" variant="light" style={{ flexShrink: 0 }}>{e.name}</Tag>
                  <span style={{ color: "var(--td-text-color-secondary)" }}>{e.desc}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="qa-section">
            <div className="qa-section-title" style={{ color: "var(--td-brand-color)" }}>参考实体关系</div>
            <div className="qa-section-body">
              {mockRelations.map((r) => (
                <div key={r.name} style={{ border: "1px solid var(--td-border-level-1-color)", borderRadius: 6, marginBottom: 10, overflow: "hidden" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "var(--td-bg-color-container-hover)" }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--td-brand-color)", flexShrink: 0 }} />
                    <span style={{ fontWeight: 600 }}>{r.name}</span>
                  </div>
                  {r.children && <RelationTree nodes={r.children} depth={1} />}
                </div>
              ))}
            </div>
          </div>

          <div className="qa-section">
            <div className="qa-section-title" style={{ color: "var(--td-brand-color)" }}>参考事件</div>
            <div className="qa-section-body">
              {mockQaEvents.map((e) => (
                <div key={e.id} className="qa-fact-card">
                  <div style={{ marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, color: "var(--td-brand-color)" }}>事件 #{e.id}</span>
                    <span style={{ fontSize: 12, color: "var(--td-text-color-placeholder)", marginLeft: 8 }}>分类: {e.eventType}</span>
                  </div>
                  <div style={{ marginBottom: 4 }}>{e.name}</div>
                  <div style={{ fontSize: 12, color: "var(--td-text-color-placeholder)" }}>
                    起止时间: {e.startTime} ~ {e.endTime}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="qa-section">
            <div className="qa-section-title" style={{ color: "var(--td-brand-color)" }}>参考事实（按相似度排序）</div>
            <div className="qa-section-body">
              {mockFacts.map((f) => (
                <div key={f.id} className="qa-fact-card">
                  <div style={{ marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, color: "var(--td-brand-color)" }}>事实 #{f.id}</span>
                    <span style={{ fontSize: 12, color: "var(--td-text-color-placeholder)", marginLeft: 8 }}>相似度: {f.similarity}%</span>
                  </div>
                  <div style={{ marginBottom: 4 }}>{f.content}</div>
                  <div style={{ fontSize: 12, color: "var(--td-text-color-placeholder)" }}>
                    关联实体: {f.entity} | 关联事件: {f.event}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
