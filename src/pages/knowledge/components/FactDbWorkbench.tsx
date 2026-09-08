import React, { useEffect, useState } from 'react';
import { Card } from 'tdesign-react';
import { useCurrentBusiness } from '@/prototypeContext';
import EntityTab from '@/pages/fact-db/components/EntityTab';
import EventTab from '@/pages/fact-db/components/EventTab';
import FactTab from '@/pages/fact-db/components/FactTab';
import ExtractTab from '@/pages/fact-db/components/ExtractTab';
import ReviewTab from '@/pages/fact-db/components/ReviewTab';
import QaTab from '@/pages/fact-db/components/QaTab';
import ErrorDetectTab from '@/pages/fact-db/components/ErrorDetectTab';
import { REVIEW_NAV_EVENT, type ReviewLocator } from '@/pages/fact-db/review-bridge';
import '@/pages/fact-db/style.less';
import '@/pages/fact-db/review.less';
import '@/pages/fact-db/error-detect.less';
import styles from './FactDbWorkbench.module.less';

export interface FactDbWorkbenchProps {
  activeMenu: string;
}

const menuNames: Record<string, string> = {
  entity: '实体管理',
  event: '事件管理',
  fact: '事实管理',
  'fact-classification': '事实分类',
  'fact-extract': '事实提取',
  'qa-reply': '问题回复',
  'faq-manage': 'FAQ问题管理',
  review: '内容审核',
  'error-detect': '错误表述检测',
  'content-manage': '内容库管理',
  'content-qa-match': '内容库问答匹配',
  'resource-list': '资源库',
  'data-overview': '数据分析',
  'precision-list': '精准运营',
  'intent-list': '意图实体',
  'sys-tools-list': '系统设置',
  'self-check-list': '自助工具',
  'user-list': '一方租户',
  'opd-list': 'OPD公域数据',
};

const knownMenus = Object.keys(menuNames);

export default function FactDbWorkbench({ activeMenu }: FactDbWorkbenchProps) {
  const { project_id, game_id } = useCurrentBusiness();
  const [reviewLocator, setReviewLocator] = useState<ReviewLocator | null>(null);

  useEffect(() => {
    const onNavigate = (event: Event) => {
      const detail = (event as CustomEvent<ReviewLocator>).detail;
      if (!detail) return;
      setReviewLocator(detail);
    };
    window.addEventListener(REVIEW_NAV_EVENT, onNavigate);
    return () => window.removeEventListener(REVIEW_NAV_EVENT, onNavigate);
  }, []);

  return (
    <div className={`${styles.page} factdb-page`}>
      <header className={styles.pageHeader}>
        <h1>{menuNames[activeMenu] || activeMenu}</h1>
      </header>

      <Card className={styles.sectionCard} bordered={false}>
        {!knownMenus.includes(activeMenu) ? (
          <div style={{ padding: 64, textAlign: 'center' }}>
            <div
              style={{
                fontSize: 16,
                fontWeight: 600,
                color: 'var(--td-text-color-primary)',
                marginBottom: 8,
              }}
            >
              {menuNames[activeMenu] || '该模块'}
            </div>
            <div style={{ color: 'var(--td-text-color-placeholder)' }}>
              该模块为线上既有功能，本原型聚焦事实库相关模块，此处保留入口占位。
            </div>
          </div>
        ) : (
          <div className="factdb-panel">
            {activeMenu === 'entity' && <EntityTab />}
            {activeMenu === 'event' && <EventTab />}
            {(activeMenu === 'fact' || activeMenu === 'fact-classification') && <FactTab env="prod" />}
            {activeMenu === 'fact-extract' && <ExtractTab />}
            {(activeMenu === 'qa-reply' || activeMenu === 'faq-manage') && <QaTab />}
            {activeMenu === 'review' && <ReviewTab locator={reviewLocator} />}
            {activeMenu === 'error-detect' && <ErrorDetectTab />}
            {[
              'content-manage',
              'content-qa-match',
              'resource-list',
              'data-overview',
              'precision-list',
              'intent-list',
              'sys-tools-list',
              'self-check-list',
              'user-list',
              'opd-list',
            ].includes(activeMenu) && (
              <div style={{ padding: 64, textAlign: 'center' }}>
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 600,
                    color: 'var(--td-text-color-primary)',
                    marginBottom: 8,
                  }}
                >
                  {menuNames[activeMenu]}
                </div>
                <div style={{ color: 'var(--td-text-color-placeholder)' }}>
                  该模块为线上既有功能，本原型聚焦事实库相关模块，此处保留入口占位。
                </div>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
