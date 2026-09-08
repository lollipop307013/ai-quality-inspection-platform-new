import React from "react";
import { Card } from "tdesign-react";
import EntityTab from "./components/EntityTab";
import EventTab from "./components/EventTab";
import FactTab from "./components/FactTab";
import ExtractTab from "./components/ExtractTab";
import ReviewTab from "./components/ReviewTab";
import QaTab from "./components/QaTab";
import ErrorDetectTab from "./components/ErrorDetectTab";
import type { ReviewLocator } from "./review-bridge";
import "./style.less";

const knownMenus = [
  "entity",
  "event",
  "fact",
  "fact-classification",
  "fact-extract",
  "qa-reply",
  "faq-manage",
  "review",
  "error-detect",
  "content-manage",
  "content-qa-match",
];

// 菜单项对应的中文名（用于页面标题 / 占位说明）
const menuNames: Record<string, string> = {
  "content-qa-pool": "内容量审核池",
  "entity": "实体管理",
  "event": "事件管理",
  "fact": "事实管理",
  "view-permission": "查看权限",
  "qa": "同题回答",
  "error-detect": "错误表述检测",
  "kb-list": "知识库",
  "ai-list": "AI应用",
  "high-quality": "高质量",
  "data-overview": "数据分析",
  "intuitive-list": "直观查看",
  "chart-list": "图表决策",
  "sys-tools-list": "系统设置",
  "self-check-list": "自助工具",
  "user-list": "一方租户",
  "opd-list": "OPD公域数据",
  "resource-list": "资源库",
  "precision-list": "精准运营",
  "intent-list": "意图实体",
  "content-manage": "内容库管理",
  "content-qa-match": "内容库问答匹配",
  "fact-extract": "事实提取",
  "qa-reply": "问题回复",
  "faq-manage": "FAQ问题管理",
  "review": "内容审核",
  "fact-classification": "事实分类",
};

interface PageProps {
  activeMenu: string;
  projectName?: string;
  channelName?: string;
  reviewLocator?: ReviewLocator | null;
}

export default function Page({ activeMenu, projectName, channelName, reviewLocator }: PageProps) {
  return (
    <div className="factdb-page">
      {!knownMenus.includes(activeMenu) ? (
        <Card bordered>
          <div style={{ padding: 64, textAlign: "center" }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: "var(--td-text-color-primary)", marginBottom: 8 }}>
              {menuNames[activeMenu] || "该模块"}
            </div>
            <div style={{ color: "var(--td-text-color-placeholder)" }}>
              该模块为线上既有功能，本原型聚焦「内容库」下的事实库相关模块，此处保留入口占位。
            </div>
          </div>
        </Card>
      ) : (
        <>
          {/* 页面标题 + 范围标签（对齐参考平台页面头部） */}
          <div className="page-header">
            <div className="page-header-left">
              <h1 className="page-title">{menuNames[activeMenu] || activeMenu}</h1>
              <p className="page-subtitle">数据资产管理 · 当前范围为「{projectName ?? "--"}」</p>
            </div>
            {activeMenu !== "review" && (
              <div className="page-header-scope">
                <span className="scope-pill scope-pill-soft" title={projectName}>{projectName ?? "--"}</span>
                <span className="scope-pill scope-pill-brand" title={channelName}>{channelName ?? "--"}</span>
              </div>
            )}
          </div>

          {["fact-extract", "qa-reply", "faq-manage"].includes(activeMenu) ? (
            <>
              {activeMenu === "fact-extract" && <ExtractTab />}
              {(activeMenu === "qa-reply" || activeMenu === "faq-manage") && <QaTab />}
            </>
          ) : (
            <div className="factdb-panel">
              {activeMenu === "entity"        && <EntityTab />}
              {activeMenu === "event"         && <EventTab />}
              {(activeMenu === "fact" || activeMenu === "fact-classification") && <FactTab env="prod" />}
              {activeMenu === "review"        && <ReviewTab locator={reviewLocator} />}
              {activeMenu === "error-detect"  && <ErrorDetectTab />}
            </div>
          )}
        </>
      )}
    </div>
  );
}
